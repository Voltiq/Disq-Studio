//! Works out, before deleting, whether Windows will really recycle an item.
//!
//! The `trash` crate asks Windows to recycle without showing any dialogs.
//! When an item can't be recycled (the drive has no Recycle Bin, the bin is
//! set to delete immediately, or the item is bigger than the bin), Windows
//! then deletes it permanently and still reports success. Tested: a file on
//! a USB stick came back `Ok(())` and was gone, with nothing in any bin.
//! So every delete is checked here first, and anything that would be
//! destroyed is held back unless the user explicitly allowed it.

use serde::Serialize;
use std::path::Path;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BinInfo {
    /// The volume's root, such as `C:\`.
    pub root: String,
    /// Removable, network and optical drives have no Recycle Bin.
    pub has_bin: bool,
    /// "Don't move files to the Recycle Bin" is set for this drive.
    pub nuke_on_delete: bool,
    /// The most the bin can hold, when known.
    pub max_bytes: Option<u64>,
    /// No setting was found, so `max_bytes` is Windows' usual default.
    pub max_is_estimate: bool,
    /// What's in the bin on this drive now.
    pub used_bytes: u64,
}

impl BinInfo {
    /// Why an item of `size` bytes would be deleted permanently, if it would.
    pub fn blocks(&self, size: u64) -> Option<String> {
        if !self.has_bin {
            Some(format!("{} has no Recycle Bin", self.root))
        } else if self.nuke_on_delete {
            Some(format!("the Recycle Bin on {} is set to delete files right away", self.root))
        } else {
            self.max_bytes
                .filter(|&max| size > max)
                .map(|max| format!("bigger than the Recycle Bin on {}, which holds {}", self.root, human(max)))
        }
    }
}

fn human(bytes: u64) -> String {
    let gb = bytes as f64 / (1024.0 * 1024.0 * 1024.0);
    if gb >= 1.0 {
        format!("{gb:.1} GB")
    } else {
        format!("{:.0} MB", bytes as f64 / (1024.0 * 1024.0))
    }
}

#[cfg(windows)]
pub fn info(path: &Path) -> BinInfo {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        GetDiskFreeSpaceExW, GetDriveTypeW, GetVolumeNameForVolumeMountPointW, GetVolumePathNameW,
    };
    use windows_sys::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_DWORD};
    use windows_sys::Win32::UI::Shell::{SHQueryRecycleBinW, SHQUERYRBINFO};

    const DRIVE_FIXED: u32 = 3;
    let wide = |s: &str| s.encode_utf16().chain(std::iter::once(0)).collect::<Vec<u16>>();
    let from_wide = |buf: &[u16]| {
        let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
        String::from_utf16_lossy(&buf[..end])
    };

    let path_w: Vec<u16> = path.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
    let mut root_buf = [0u16; 1024];
    let root = if unsafe { GetVolumePathNameW(path_w.as_ptr(), root_buf.as_mut_ptr(), root_buf.len() as u32) } != 0 {
        from_wide(&root_buf)
    } else {
        path.to_string_lossy().into_owned()
    };
    let root_w = wide(&root);

    let mut out = BinInfo {
        root: root.clone(),
        has_bin: unsafe { GetDriveTypeW(root_w.as_ptr()) } == DRIVE_FIXED,
        nuke_on_delete: false,
        max_bytes: None,
        max_is_estimate: false,
        used_bytes: 0,
    };
    if !out.has_bin {
        return out;
    }

    // Per-drive settings live under the volume's GUID.
    let mut guid_buf = [0u16; 64];
    let guid = if unsafe { GetVolumeNameForVolumeMountPointW(root_w.as_ptr(), guid_buf.as_mut_ptr(), guid_buf.len() as u32) } != 0 {
        let name = from_wide(&guid_buf); // \\?\Volume{...}\
        name.find('{').and_then(|s| name.find('}').map(|e| name[s..=e].to_string()))
    } else {
        None
    };
    let read_dword = |subkey: &str, value: &str| -> Option<u32> {
        let (k, v) = (wide(subkey), wide(value));
        let mut data = 0u32;
        let mut size = 4u32;
        let status = unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                k.as_ptr(),
                v.as_ptr(),
                RRF_RT_REG_DWORD,
                std::ptr::null_mut(),
                (&mut data as *mut u32).cast(),
                &mut size,
            )
        };
        (status == 0).then_some(data)
    };
    const BASE: &str = r"Software\Microsoft\Windows\CurrentVersion\Explorer\BitBucket";
    let volume_key = guid.map(|g| format!(r"{BASE}\Volume\{g}"));
    let setting = |value: &str| {
        volume_key
            .as_deref()
            .and_then(|k| read_dword(k, value))
            .or_else(|| read_dword(BASE, value))
    };
    out.nuke_on_delete = setting("NukeOnDelete").unwrap_or(0) != 0;
    match setting("MaxCapacity") {
        Some(mb) => out.max_bytes = Some(mb as u64 * 1024 * 1024),
        None => {
            // Never configured: Windows' default is about 5% of the drive.
            let (mut avail, mut total, mut free) = (0u64, 0u64, 0u64);
            if unsafe { GetDiskFreeSpaceExW(root_w.as_ptr(), &mut avail, &mut total, &mut free) } != 0 {
                out.max_bytes = Some(total / 20);
                out.max_is_estimate = true;
            }
        }
    }

    let mut q: SHQUERYRBINFO = unsafe { std::mem::zeroed() };
    q.cbSize = std::mem::size_of::<SHQUERYRBINFO>() as u32;
    if unsafe { SHQueryRecycleBinW(root_w.as_ptr(), &mut q) } >= 0 {
        out.used_bytes = q.i64Size.max(0) as u64;
    }
    out
}

#[cfg(not(windows))]
pub fn info(path: &Path) -> BinInfo {
    BinInfo {
        root: path.to_string_lossy().into_owned(),
        has_bin: true,
        nuke_on_delete: false,
        max_bytes: None,
        max_is_estimate: false,
        used_bytes: 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bin() -> BinInfo {
        BinInfo {
            root: "C:\\".into(),
            has_bin: true,
            nuke_on_delete: false,
            max_bytes: Some(1000),
            max_is_estimate: false,
            used_bytes: 0,
        }
    }

    #[test]
    fn blocks_only_what_would_be_destroyed() {
        assert!(bin().blocks(1000).is_none(), "exactly the limit still fits");
        assert!(bin().blocks(1001).unwrap().contains("bigger than"));
        assert!(BinInfo { has_bin: false, ..bin() }.blocks(1).unwrap().contains("no Recycle Bin"));
        assert!(BinInfo { nuke_on_delete: true, ..bin() }.blocks(1).unwrap().contains("right away"));
        assert!(BinInfo { max_bytes: None, ..bin() }.blocks(u64::MAX).is_none(), "unknown limit: don't guess");
    }

    /// Prints what each drive's bin looks like: `cargo test show_drives -- --ignored --nocapture`
    #[cfg(windows)]
    #[test]
    #[ignore]
    fn show_drives() {
        for root in ["C:\\", "D:\\"] {
            let i = info(Path::new(root));
            println!(
                "{}: has_bin={} nuke={} max={:?} (estimate {}) used={} | 30 GB folder blocked: {:?}",
                i.root,
                i.has_bin,
                i.nuke_on_delete,
                i.max_bytes.map(human),
                i.max_is_estimate,
                human(i.used_bytes),
                i.blocks(30 * 1024 * 1024 * 1024),
            );
        }
    }

    #[cfg(windows)]
    #[test]
    fn reads_the_system_drive() {
        let windir = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into());
        let info = info(Path::new(&windir));
        assert!(info.root.ends_with('\\'));
        assert!(info.has_bin, "the system drive is a fixed drive");
        assert!(info.max_bytes.unwrap_or(0) > 0);
    }
}
