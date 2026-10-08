//! Kernel-owned advisory locks on persistent sidecar files.
//!
//! Never unlink a sidecar: replacing its inode would let a new caller lock a
//! different file while another process still owns the previous lock.

use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Condvar, LazyLock, Mutex, Weak};

pub(super) struct FileLock {
    _file: File,
    /// Acquired before the kernel lock and released in Drop, so same-process
    /// competitors queue here instead of hitting the kernel lock.
    process_slot: Arc<KeyedSlot>,
}

impl Drop for FileLock {
    fn drop(&mut self) {
        // Explicit release, NOT Arc-destruction-triggered: waiting contenders
        // hold their own Arc to the slot, so the slot can outlive the lock by
        // design and must be released by the holder, not by the last Arc.
        self.process_slot.release();
    }
}

/// One slot per canonical lock path. A std MutexGuard borrows its mutex and
/// cannot travel inside FileLock, so the slot is a tiny manual lock instead:
/// a bool under a Mutex plus a Condvar, released by FileLock::drop.
struct KeyedSlot {
    locked: Mutex<bool>,
    released: Condvar,
}

impl KeyedSlot {
    fn acquire(self: &Arc<Self>) -> Arc<Self> {
        let mut locked = self.locked.lock().unwrap_or_else(|e| e.into_inner());
        while *locked {
            locked = self.released.wait(locked).unwrap_or_else(|e| e.into_inner());
        }
        *locked = true;
        self.clone()
    }

    fn release(&self) {
        let mut locked = self.locked.lock().unwrap_or_else(|e| e.into_inner());
        *locked = false;
        self.released.notify_one();
    }
}

static PROCESS_SLOTS: LazyLock<Mutex<HashMap<PathBuf, Weak<KeyedSlot>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// Windows fails a conflicting byte-range lock from the SAME process
/// immediately (ERROR_LOCK_VIOLATION) instead of blocking, and every storage
/// command runs on the spawn_blocking pool — so concurrent same-process
/// callers must queue on a process slot before touching the kernel lock.
/// Unix flock blocks correctly, but one code path keeps the semantics
/// identical across platforms.
fn acquire_process_slot(path: &Path) -> Arc<KeyedSlot> {
    let key = path
        .parent()
        .and_then(|parent| dunce::canonicalize(parent).ok())
        .unwrap_or_else(|| path.to_path_buf())
        .join(path.file_name().unwrap_or_default());
    let mut map = PROCESS_SLOTS.lock().unwrap_or_else(|e| e.into_inner());
    // Reap entries whose last FileLock was dropped so the map cannot grow
    // with the number of lock paths ever seen.
    map.retain(|_, weak| weak.strong_count() > 0);
    let slot = map
        .get(&key)
        .and_then(Weak::upgrade)
        .unwrap_or_else(|| {
            let slot = Arc::new(KeyedSlot { locked: Mutex::new(false), released: Condvar::new() });
            map.insert(key, Arc::downgrade(&slot));
            slot
        });
    // Block OUTSIDE the map lock: our Arc keeps the slot alive against reaping,
    // and Drop only touches the slot itself, so a holder can always release
    // while another thread waits here.
    drop(map);
    slot.acquire()
}

pub(super) fn exclusive(path: &Path) -> Result<FileLock, String> {
    let process_slot = acquire_process_slot(path);
    match exclusive_with_slot_held(path) {
        Ok(file) => Ok(FileLock { _file: file, process_slot }),
        // A failed open/stat must not strand the slot locked: every future
        // locker of this path would queue behind nobody.
        Err(error) => {
            process_slot.release();
            Err(error)
        }
    }
}

fn exclusive_with_slot_held(path: &Path) -> Result<File, String> {
    let parent = path.parent().ok_or_else(|| format!("lock has no parent: {}", path.display()))?;
    fs::create_dir_all(parent).map_err(|e| format!("mkdir {}: {e}", parent.display()))?;
    let mut options = OpenOptions::new();
    options.read(true).write(true).create(true).truncate(false);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600).custom_flags(libc::O_NOFOLLOW);
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        // Open the reparse point itself so it can be rejected, not followed.
        // Readers/writers may share the sidecar; deletion must never race it.
        options.custom_flags(0x0020_0000).share_mode(0x0000_0003);
    }
    let file = options.open(path).map_err(|e| format!("open lock {}: {e}", path.display()))?;
    let metadata = file.metadata().map_err(|e| format!("stat lock {}: {e}", path.display()))?;
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return Err(format!("lock is a reparse point: {}", path.display()));
        }
    }
    if !metadata.is_file() {
        return Err(format!("lock is not a regular file: {}", path.display()));
    }
    fs2::FileExt::lock_exclusive(&file).map_err(|e| format!("lock {}: {e}", path.display()))?;
    // Closing the handle releases the lock, including on panic/process exit.
    Ok(file)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn same_process_locks_serialize_instead_of_erroring() {
        // Windows fails a same-process conflicting kernel lock immediately;
        // the process slot must make the second caller block instead.
        let dir = std::env::temp_dir().join(format!("ccgui-lock-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("x.lock");
        let first = exclusive(&path).unwrap();
        let (tx, rx) = std::sync::mpsc::channel();
        let contender = {
            let path = path.clone();
            std::thread::spawn(move || {
                let _second = exclusive(&path).unwrap();
                tx.send(()).unwrap();
            })
        };
        assert!(
            rx.recv_timeout(Duration::from_millis(200)).is_err(),
            "second lock acquired while the first was held"
        );
        drop(first);
        rx.recv_timeout(Duration::from_secs(10))
            .expect("second lock never acquired after release");
        contender.join().unwrap();
        let _ = std::fs::remove_dir_all(&dir);
    }
}
