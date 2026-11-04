//! The drives the start screen offers to scan.

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Volume {
    /// Root path, such as `C:\`.
    pub path: String,
    pub label: String,
    pub file_system: String,
    pub kind: &'static str,
    pub total: u64,
    pub free: u64,
}

#[cfg(windows)]
pub fn list() -> Vec<Volume> {
    use windows_sys::Win32::Storage::FileSystem::{
        GetDiskFreeSpaceExW, GetDriveTypeW, GetLogicalDrives, GetVolumeInformationW,
    };

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }
    fn from_wide(buf: &[u16]) -> String {
        let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
        String::from_utf16_lossy(&buf[..end])
    }

    let mask = unsafe { GetLogicalDrives() };
    let mut out = Vec::new();
    for i in 0..26u32 {
        if mask & (1 << i) == 0 {
            continue;
        }
        let path = format!("{}:\\", (b'A' + i as u8) as char);
        let root = wide(&path);
        let kind = match unsafe { GetDriveTypeW(root.as_ptr()) } {
            2 => "removable",
            3 => "fixed",
            4 => "network",
            5 => "optical",
            6 => "ram",
            _ => continue,
        };
        let (mut avail, mut total, mut free) = (0u64, 0u64, 0u64);
        // Fails for empty card readers and optical drives; skip those.
        if unsafe { GetDiskFreeSpaceExW(root.as_ptr(), &mut avail, &mut total, &mut free) } == 0 {
            continue;
        }
        let mut label = [0u16; 261];
        let mut fs = [0u16; 261];
        unsafe {
            GetVolumeInformationW(
                root.as_ptr(),
                label.as_mut_ptr(),
                label.len() as u32,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                fs.as_mut_ptr(),
                fs.len() as u32,
            );
        }
        out.push(Volume {
            path,
            label: from_wide(&label),
            file_system: from_wide(&fs),
            kind,
            total,
            free,
        });
    }
    out
}

/// The file system (such as "NTFS") of the volume holding `path`.
#[cfg(windows)]
pub fn file_system_of(path: &std::path::Path) -> String {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{GetVolumeInformationW, GetVolumePathNameW};

    let wide: Vec<u16> = path.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
    let mut root = [0u16; 1024];
    let mut fs = [0u16; 261];
    unsafe {
        if GetVolumePathNameW(wide.as_ptr(), root.as_mut_ptr(), root.len() as u32) == 0 {
            return String::new();
        }
        if GetVolumeInformationW(
            root.as_ptr(),
            std::ptr::null_mut(),
            0,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            fs.as_mut_ptr(),
            fs.len() as u32,
        ) == 0
        {
            return String::new();
        }
    }
    let end = fs.iter().position(|&c| c == 0).unwrap_or(fs.len());
    String::from_utf16_lossy(&fs[..end])
}

#[cfg(not(windows))]
pub fn file_system_of(_path: &std::path::Path) -> String {
    // Inode numbers are unique per file system, which is all deduping needs.
    "unix".into()
}

#[cfg(not(windows))]
pub fn list() -> Vec<Volume> {
    vec![Volume {
        path: "/".into(),
        label: "Root".into(),
        file_system: String::new(),
        kind: "fixed",
        total: 0,
        free: 0,
    }]
}
