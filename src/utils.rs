use std::{
    collections::HashMap,
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
