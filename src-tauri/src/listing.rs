//! Reads one folder's entries, with both the logical size of each file and
//! the space it actually takes on disk.
//!
//! On Windows this asks the file system for whole batches of directory
//! entries at once (`FileIdExtdDirectoryInfo`, or `FileIdBothDirectoryInfo`
//! where that isn't supported), which carry the allocation size, attributes
//! and file ID alongside the usual details, so none of them costs an extra
//! call per file.

use std::io;
use std::path::Path;

pub struct Item {
    pub name: String,
    pub is_dir: bool,
    /// A symlink, junction or other name surrogate; never followed.
    pub is_link: bool,
    pub logical: u64,
    pub allocated: u64,
    /// Last write time, in milliseconds since the Unix epoch.
    pub modified: i64,
    /// Last access time, the same way. Windows updates it at most hourly, and
    /// only when last-access tracking is on (it is by default).
    pub accessed: i64,
    /// Identifies the file's data on its volume; hard links share it. 0 when unknown.
    /// 128 bits, as ReFS needs; NTFS IDs fit in the low 64.
    pub file_id: u128,
    /// A cloud placeholder (OneDrive and similar) whose data isn't on this drive.
    pub online_only: bool,
}

/// The fields Disq Studio needs, common to both directory-info layouts.
#[cfg(windows)]
struct Fields {
    next: u32,
    attrs: u32,
    reparse_tag: u32,
    end_of_file: i64,
    allocation: i64,
    last_write: i64,
    last_access: i64,
    file_id: u128,
    name: String,
}

#[cfg(windows)]
pub fn list(dir: &Path) -> io::Result<Vec<Item>> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::{
        CloseHandle, GetLastError, ERROR_INVALID_PARAMETER, ERROR_NOT_SUPPORTED, ERROR_NO_MORE_FILES,
        INVALID_HANDLE_VALUE,
    };
    use windows_sys::Win32::Storage::FileSystem::{
        CreateFileW, FileIdBothDirectoryInfo, FileIdBothDirectoryRestartInfo, FileIdExtdDirectoryInfo,
        FileIdExtdDirectoryRestartInfo, GetFileInformationByHandleEx, FILE_ATTRIBUTE_COMPRESSED,
        FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_OFFLINE, FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS,
        FILE_ATTRIBUTE_RECALL_ON_OPEN, FILE_ATTRIBUTE_REPARSE_POINT, FILE_ATTRIBUTE_SPARSE_FILE,
        FILE_FLAG_BACKUP_SEMANTICS, FILE_ID_BOTH_DIR_INFO, FILE_ID_EXTD_DIR_INFO, FILE_LIST_DIRECTORY,
        FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING,
    };

    /// Reparse tags with this bit point somewhere else (symlinks, junctions, mount points).
    const NAME_SURROGATE: u32 = 0x2000_0000;
    /// Set on files whose data lives in the cloud and is fetched when opened.
    const ONLINE_ONLY: u32 =
        FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS | FILE_ATTRIBUTE_RECALL_ON_OPEN | FILE_ATTRIBUTE_OFFLINE;
    /// FILETIME of 1970-01-01, in 100 ns ticks since 1601.
    const UNIX_EPOCH_TICKS: i64 = 116_444_736_000_000_000;

    let wide: Vec<u16> = verbatim(dir).encode_wide().chain(std::iter::once(0)).collect();
    let handle = unsafe {
        CreateFileW(
            wide.as_ptr(),
            FILE_LIST_DIRECTORY,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            std::ptr::null(),
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS,
            std::ptr::null_mut(),
        )
    };
    if handle == INVALID_HANDLE_VALUE {
        return Err(io::Error::last_os_error());
    }

    // u64 storage keeps the buffer 8-byte aligned, as the entries expect.
    let mut buf = vec![0u64; 8 * 1024];
    let mut items = Vec::new();
    // The extended layout carries 128-bit IDs (ReFS); FAT and some network
    // drives only know the older one.
    let mut extended = true;
    let mut class = FileIdExtdDirectoryRestartInfo;
    let mut first = true;
    let result = loop {
        let ok = unsafe {
            GetFileInformationByHandleEx(handle, class, buf.as_mut_ptr().cast(), (buf.len() * 8) as u32)
        };
        if ok == 0 {
            let err = unsafe { GetLastError() };
            if first && extended && (err == ERROR_INVALID_PARAMETER || err == ERROR_NOT_SUPPORTED) {
                extended = false;
                class = FileIdBothDirectoryRestartInfo;
                continue;
            }
            break if err == ERROR_NO_MORE_FILES { Ok(()) } else { Err(io::Error::from_raw_os_error(err as i32)) };
        }
        first = false;
        class = if extended { FileIdExtdDirectoryInfo } else { FileIdBothDirectoryInfo };

        let base = buf.as_ptr().cast::<u8>();
        let mut offset = 0usize;
        loop {
            // SAFETY: the system filled the buffer with a chain of records of the
            // class asked for; `offset` only ever follows NextEntryOffset within it.
            let f = unsafe {
                if extended {
                    let info = &*base.add(offset).cast::<FILE_ID_EXTD_DIR_INFO>();
                    let name_ptr = std::ptr::addr_of!(info.FileName).cast::<u16>();
                    Fields {
                        next: info.NextEntryOffset,
                        attrs: info.FileAttributes,
                        reparse_tag: info.ReparsePointTag,
                        end_of_file: info.EndOfFile,
                        allocation: info.AllocationSize,
                        last_write: info.LastWriteTime,
                        last_access: info.LastAccessTime,
                        file_id: u128::from_le_bytes(info.FileId.Identifier),
                        name: String::from_utf16_lossy(std::slice::from_raw_parts(
                            name_ptr,
                            info.FileNameLength as usize / 2,
                        )),
                    }
                } else {
                    let info = &*base.add(offset).cast::<FILE_ID_BOTH_DIR_INFO>();
                    let name_ptr = std::ptr::addr_of!(info.FileName).cast::<u16>();
                    Fields {
                        next: info.NextEntryOffset,
                        attrs: info.FileAttributes,
                        // For reparse points, EaSize holds the reparse tag instead.
                        reparse_tag: info.EaSize,
                        end_of_file: info.EndOfFile,
                        allocation: info.AllocationSize,
                        last_write: info.LastWriteTime,
                        last_access: info.LastAccessTime,
                        file_id: info.FileId as u64 as u128,
                        name: String::from_utf16_lossy(std::slice::from_raw_parts(
                            name_ptr,
                            info.FileNameLength as usize / 2,
                        )),
                    }
                }
            };

            if f.name != "." && f.name != ".." {
                let attrs = f.attrs;
                let is_link = attrs & FILE_ATTRIBUTE_REPARSE_POINT != 0 && f.reparse_tag & NAME_SURROGATE != 0;
                let is_dir = attrs & FILE_ATTRIBUTE_DIRECTORY != 0;
                let online_only = !is_dir && attrs & ONLINE_ONLY != 0;
                let mut allocated = if is_dir { 0 } else { f.allocation.max(0) as u64 };
                // Directory entries can lag behind for compressed and sparse files
                // that changed recently; ask the file itself for those.
                if !is_dir && !online_only && attrs & (FILE_ATTRIBUTE_COMPRESSED | FILE_ATTRIBUTE_SPARSE_FILE) != 0 {
                    if let Some(actual) = compressed_size(&dir.join(&f.name)) {
                        allocated = actual;
                    }
                }
                let ms = |ticks: i64| if ticks > UNIX_EPOCH_TICKS { (ticks - UNIX_EPOCH_TICKS) / 10_000 } else { 0 };
                items.push(Item {
                    is_dir,
                    is_link,
                    logical: if is_dir { 0 } else { f.end_of_file.max(0) as u64 },
                    allocated,
                    modified: ms(f.last_write),
                    accessed: ms(f.last_access),
                    file_id: if is_dir { 0 } else { f.file_id },
                    online_only,
                    name: f.name,
                });
            }

            if f.next == 0 {
                break;
            }
            offset += f.next as usize;
        }
    };
    unsafe { CloseHandle(handle) };
    result.map(|_| items)
}

/// The bytes a compressed or sparse file really takes, straight from the file.
#[cfg(windows)]
fn compressed_size(path: &Path) -> Option<u64> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::{GetLastError, NO_ERROR};
    use windows_sys::Win32::Storage::FileSystem::{GetCompressedFileSizeW, INVALID_FILE_SIZE};

    let wide: Vec<u16> = verbatim(path).encode_wide().chain(std::iter::once(0)).collect();
    let mut high = 0u32;
    let low = unsafe { GetCompressedFileSizeW(wide.as_ptr(), &mut high) };
    // INVALID_FILE_SIZE is also a valid low half, so check the error too.
    if low == INVALID_FILE_SIZE && unsafe { GetLastError() } != NO_ERROR {
        return None;
    }
    Some(((high as u64) << 32) | low as u64)
}

/// Adds the `\\?\` prefix so paths longer than 260 characters still open.
#[cfg(windows)]
pub fn verbatim(path: &Path) -> std::ffi::OsString {
    let s = path.as_os_str().to_string_lossy().replace('/', "\\");
    let out = if s.starts_with(r"\\?\") {
        s
    } else if let Some(unc) = s.strip_prefix(r"\\") {
        format!(r"\\?\UNC\{unc}")
    } else {
        format!(r"\\?\{s}")
    };
    out.into()
}

#[cfg(not(windows))]
pub fn list(dir: &Path) -> io::Result<Vec<Item>> {
    use std::os::unix::fs::MetadataExt;
    use std::time::UNIX_EPOCH;

    let mut items = Vec::new();
    for entry in std::fs::read_dir(dir)?.flatten() {
        let Ok(file_type) = entry.file_type() else { continue };
        let meta = entry.metadata().ok();
        let is_dir = file_type.is_dir();
        items.push(Item {
            file_id: if is_dir { 0 } else { meta.as_ref().map(|m| m.ino() as u128).unwrap_or(0) },
            online_only: false,
            name: entry.file_name().to_string_lossy().into_owned(),
            is_dir,
            is_link: file_type.is_symlink(),
            logical: if is_dir { 0 } else { meta.as_ref().map(|m| m.len()).unwrap_or(0) },
            // st_blocks is always counted in 512-byte units.
            allocated: if is_dir { 0 } else { meta.as_ref().map(|m| m.blocks() * 512).unwrap_or(0) },
            modified: meta
                .as_ref()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0),
            accessed: meta
                .and_then(|m| m.accessed().ok())
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0),
        });
    }
    Ok(items)
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    /// A compressed file's entry must report what it really takes, not its length.
    #[test]
    fn compressed_files_report_their_real_size() {
        let dir = std::env::temp_dir().join(format!("disk-studio-compress-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("zeros.bin");
        std::fs::write(&file, vec![0u8; 1024 * 1024]).unwrap();
        let ok = std::process::Command::new("compact")
            .args(["/c", "/q"])
            .arg(&file)
            .output()
            .is_ok_and(|o| o.status.success());

        let item = list(&dir).unwrap().into_iter().find(|i| i.name == "zeros.bin").unwrap();
        assert_eq!(item.logical, 1024 * 1024);
        assert_eq!(item.allocated, compressed_size(&file).unwrap());
        if ok {
            assert!(item.allocated < 512 * 1024, "compressed to {}", item.allocated);
        }
        assert_ne!(item.file_id, 0);
        std::fs::remove_dir_all(dir).unwrap();
    }
}
