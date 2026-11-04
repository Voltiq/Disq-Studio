//! Running as administrator: checking for it, and restarting with it.
//!
//! An administrator can read folders other accounts can't, and lets Disk
//! Studio read a whole NTFS drive's file table at once (see `mft`).

/// Whether this process runs with administrator rights (elevated).
#[cfg(windows)]
pub fn is_elevated() -> bool {
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY};
    use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    let mut token: HANDLE = std::ptr::null_mut();
    if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) } == 0 {
        return false;
    }
    let mut elevation = TOKEN_ELEVATION { TokenIsElevated: 0 };
    let mut len = 0u32;
    let ok = unsafe {
        GetTokenInformation(
            token,
            TokenElevation,
            (&mut elevation as *mut TOKEN_ELEVATION).cast(),
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut len,
        )
    };
    unsafe { CloseHandle(token) };
    ok != 0 && elevation.TokenIsElevated != 0
}

#[cfg(not(windows))]
pub fn is_elevated() -> bool {
    false
}

/// Quotes one argument the way `CommandLineToArgvW` reads it back:
/// backslashes before a quote (or the closing quote) are doubled.
pub fn quote_arg(arg: &str) -> String {
    let mut out = String::from("\"");
    // Backslashes in the current run, already copied once.
    let mut slashes = 0;
    for c in arg.chars() {
        match c {
            '\\' => slashes += 1,
            '"' => {
                // 2n + 1 in all: n more, plus one for the quote itself.
                out.extend(std::iter::repeat_n('\\', slashes + 1));
                slashes = 0;
            }
            _ => slashes = 0,
        }
        out.push(c);
    }
    out.extend(std::iter::repeat_n('\\', slashes));
    out.push('"');
    out
}

/// Starts this program again as administrator, after Windows asks the user.
/// The new copy waits for this one to close before it opens its window.
/// Returns `Ok(false)` if the user said no.
#[cfg(windows)]
pub fn relaunch_elevated(folder: Option<&str>) -> Result<bool, String> {
    use windows_sys::Win32::Foundation::{GetLastError, ERROR_CANCELLED};
    use windows_sys::Win32::UI::Shell::{ShellExecuteExW, SEE_MASK_NOASYNC, SHELLEXECUTEINFOW};
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let mut params = format!("{WAIT_FLAG} {}", std::process::id());
    if let Some(folder) = folder {
        params.push(' ');
        params.push_str(&quote_arg(folder));
    }
    let verb = wide("runas");
    let file = wide(&exe.to_string_lossy());
    let params = wide(&params);
    let mut info: SHELLEXECUTEINFOW = unsafe { std::mem::zeroed() };
    info.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
    info.fMask = SEE_MASK_NOASYNC;
    info.lpVerb = verb.as_ptr();
    info.lpFile = file.as_ptr();
    info.lpParameters = params.as_ptr();
    info.nShow = SW_SHOWNORMAL;
    if unsafe { ShellExecuteExW(&mut info) } != 0 {
        return Ok(true);
    }
    match unsafe { GetLastError() } {
        ERROR_CANCELLED => Ok(false),
        err => Err(std::io::Error::from_raw_os_error(err as i32).to_string()),
    }
}

#[cfg(not(windows))]
pub fn relaunch_elevated(_folder: Option<&str>) -> Result<bool, String> {
    Err("Restarting as administrator is only available on Windows.".into())
}

/// Passed to the relaunched copy, followed by the old copy's process id.
pub const WAIT_FLAG: &str = "--after";

/// Started by `relaunch_elevated`: wait (up to 15 s) for the copy that
/// started us to close, so this one doesn't just hand over to it and exit.
#[cfg(windows)]
pub fn wait_for_previous(args: &[String]) {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{OpenProcess, WaitForSingleObject, PROCESS_SYNCHRONIZE};

    let Some(pid) = args.windows(2).find(|w| w[0] == WAIT_FLAG).and_then(|w| w[1].parse::<u32>().ok()) else {
        return;
    };
    let handle = unsafe { OpenProcess(PROCESS_SYNCHRONIZE, 0, pid) };
    if !handle.is_null() {
        unsafe {
            WaitForSingleObject(handle, 15_000);
            CloseHandle(handle);
        }
    }
}

#[cfg(not(windows))]
pub fn wait_for_previous(_args: &[String]) {}

/// An elevated window doesn't accept messages from normal programs, so a
/// second launch (from Explorer's "Analyze with Disq Studio") couldn't hand
/// its folder over. Let that one message through.
#[cfg(windows)]
pub fn accept_handoff_while_elevated() {
    use windows_sys::Win32::UI::WindowsAndMessaging::{ChangeWindowMessageFilter, MSGFLT_ADD, WM_COPYDATA};
    if is_elevated() {
        unsafe { ChangeWindowMessageFilter(WM_COPYDATA, MSGFLT_ADD) };
    }
}

#[cfg(not(windows))]
pub fn accept_handoff_while_elevated() {}

#[cfg(test)]
mod tests {
    use super::quote_arg;

    #[test]
    fn quotes_survive_the_command_line() {
        assert_eq!(quote_arg(r"C:\Users\nico"), r#""C:\Users\nico""#);
        // A trailing backslash would otherwise escape the closing quote.
        assert_eq!(quote_arg(r"C:\"), r#""C:\\""#);
        assert_eq!(quote_arg(r"D:\a b\"), r#""D:\a b\\""#);
        assert_eq!(quote_arg(r#"x\"y"#), r#""x\\\"y""#);
    }
}
