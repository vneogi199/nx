use std::path::PathBuf;

use crate::native::utils::glob::build_glob_set;
use crate::native::utils::path::Normalize;
use crate::native::walker::nx_walker_sync;

#[napi]
/// Expands the given entries into a list of existing directories and files.
/// This is used for copying outputs to and from the cache
pub fn expand_outputs(directory: String, entries: Vec<String>) -> anyhow::Result<Vec<String>> {
    let directory: PathBuf = directory.into();

    let (existing_paths, not_found): (Vec<_>, Vec<_>) = entries.into_iter().partition(|entry| {
        let path = directory.join(entry);
        path.exists()
    });

    if not_found.is_empty() {
        return Ok(existing_paths);
    }

    let glob_set = build_glob_set(&not_found)?;
    let found_paths = nx_walker_sync(directory)
        .filter_map(|path| {
            if glob_set.is_match(&path) {
                Some(path.to_normalized_string())
            } else {
                None
            }
        })
        .chain(existing_paths);

    Ok(found_paths.collect())
}

#[napi]
/// Expands the given outputs into a list of existing files.
/// This is used when hashing outputs
pub fn get_files_for_outputs(
    directory: String,
    entries: Vec<String>,
) -> anyhow::Result<Vec<String>> {
    let directory: PathBuf = directory.into();

    let mut globs: Vec<String> = vec![];
    let mut files: Vec<String> = vec![];
    let mut directories: Vec<String> = vec![];
    for entry in entries.into_iter() {
        let path = directory.join(&entry);

        if !path.exists() {
            globs.push(entry);
        } else if path.is_dir() {
            directories.push(entry);
        } else {
            files.push(entry);
        }
    }

    if !globs.is_empty() {
        let glob_set = build_glob_set(&globs)?;
        let found_paths = nx_walker_sync(&directory).filter_map(|path| {
            if glob_set.is_match(&path) {
                Some(path.to_normalized_string())
            } else {
                None
            }
        });

        files.extend(found_paths);
    }

    if !directories.is_empty() {
        for dir in directories {
            let dir = PathBuf::from(dir);
            let dir_path = directory.join(&dir);
            let files_in_dir: Vec<String> = nx_walker_sync(&dir_path)
                .filter_map(|e| {
                    let path = dir_path.join(&e);

                    if path.is_file() {
                        Some(dir.join(e).to_normalized_string())
                    } else {
                        None
                    }
                })
                .collect();
            files.extend(files_in_dir);
        }
    }

    files.sort();

    Ok(files)
}

#[cfg(test)]
mod test {
    use super::*;
    use assert_fs::prelude::*;
    use assert_fs::TempDir;
    use std::{assert_eq, vec};

    fn setup_fs() -> TempDir {
        let temp = TempDir::new().unwrap();
        temp.child("test.txt").touch().unwrap();
        temp.child("foo.txt").touch().unwrap();
        temp.child("bar.txt").touch().unwrap();
        temp.child("baz").child("qux.txt").touch().unwrap();
        temp.child("nested")
            .child("deeply")
            .child("nx.darwin-arm64.node")
            .touch()
            .unwrap();
        temp.child("folder").child("nested-folder").touch().unwrap();
        temp.child("packages")
            .child("nx")
            .child("src")
            .child("native")
            .child("nx.darwin-arm64.node")
            .touch()
            .unwrap();
        temp.child("multi").child("file.js").touch().unwrap();
        temp.child("multi").child("src.ts").touch().unwrap();
        temp.child("multi").child("file.map").touch().unwrap();
        temp.child("multi").child("file.txt").touch().unwrap();
        temp
    }
    #[test]
    fn should_expand_outputs() {
        let temp = setup_fs();
        let entries = vec![
            "packages/nx/src/native/*.node".to_string(),
            "folder/nested-folder".to_string(),
            "test.txt".to_string(),
        ];
        let mut result = expand_outputs(temp.display().to_string(), entries).unwrap();
        result.sort();
        assert_eq!(
            result,
            vec![
                "folder/nested-folder",
                "packages/nx/src/native/nx.darwin-arm64.node",
                "test.txt"
            ]
        );
    }

    #[test]
    fn should_handle_multiple_extensions() {
        let temp = setup_fs();
        let entries = vec!["multi/*.{js,map,ts}".to_string()];
        let mut result = expand_outputs(temp.display().to_string(), entries).unwrap();
        result.sort();
        assert_eq!(
            result,
            vec!["multi/file.js", "multi/file.map", "multi/src.ts"]
        );
    }
}
