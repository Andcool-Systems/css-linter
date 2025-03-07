use std::{
    collections::HashMap,
    fs,
    path::{Component, Path, PathBuf},
};

use anyhow::Result;

pub fn replace_aliases(s: &mut String, aliases: HashMap<String, Vec<String>>) {
    for (from, to) in aliases {
        if to.is_empty() {
            continue;
        }
        *s = s.replace(&from.replace('*', ""), &to[0].replace('*', ""));
    }
}

fn normalize_path(requester_path: &Path, destination_path: &Path) -> PathBuf {
    let mut components = requester_path.components().collect::<Vec<_>>();
    for component in destination_path.components() {
        match component {
            Component::ParentDir => {
                components.pop();
            }
            Component::CurDir => {}
            _ => components.push(component),
        }
    }
    components.iter().collect()
}

pub fn process_relative_import(requester_path: &Path, destination_path: &mut String) -> Result<()> {
    let orig_path = Path::new(destination_path);

    if destination_path.starts_with(".") {
        if let Some(parent) = requester_path.parent() {
            let normalized = normalize_path(&parent, orig_path);
            *destination_path = normalized.to_string_lossy().into_owned().replace("\\", "/");
        }
    }

    Ok(())
}

pub fn list_files_in_directory(path: PathBuf, exclude: Vec<String>) -> Vec<String> {
    let mut files = Vec::new();

    if let Ok(entries) = fs::read_dir(&path) {
        for entry in entries.flatten() {
            let path = entry.path();

            if path.is_dir() {
                if let Some(p) = path.file_name() {
                    let p_str = p.to_string_lossy();
                    if p_str.starts_with('.') || exclude.iter().any(|i| p_str == *i) {
                        continue;
                    }
                }
                files.extend(list_files_in_directory(path, exclude.clone()));
            } else if path.is_file() {
                if let Some(path_str) = path.to_str() {
                    files.push(path_str.to_string());
                }
            }
        }
    } else {
        eprintln!("Cannot open target dir: {:?}", path);
    }

    files
}
