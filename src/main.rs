use std::{
    collections::{HashMap, HashSet},
    env, fs,
    path::{Path, PathBuf},
    process,
};

use anyhow::Result;
use config::get_compiler_options;
use css_parser::{extract_classes, ClassName};
use tsx_parser::{extract_default_css_imports, extract_used_classes, UsedClassName};
use utils::{process_relative_import, replace_aliases};

mod config;
mod css_parser;
mod tsx_parser;
mod utils;

fn list_files_in_directory(path: PathBuf, exclude: Vec<String>) -> Vec<String> {
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

fn main() -> Result<()> {
    const COLOR_BLUE: &str = "\x1b[34m";
    const COLOR_YELLOW: &str = "\x1b[33m";
    const COLOR_GREEN: &str = "\x1b[32m";
    const COLOR_RED: &str = "\x1b[31m";
    const COLOR_RESET: &str = "\u{001B}[0m";

    let args: Vec<String> = env::args().collect();
    let path = args.get(1).unwrap_or_else(|| {
        eprintln!(
            "\n{}Error{}: Linting path must be specified",
            COLOR_RED, COLOR_RESET
        );
        process::exit(1);
    });

    if let Err(e) = env::set_current_dir(Path::new(path)) {
        eprintln!(
            "\n{}Error{}: Failed to set current directory: {}",
            COLOR_RED, COLOR_RESET, e
        );
        process::exit(1);
    }
    let tsconfig = get_compiler_options().unwrap_or_else(|e| {
        eprintln!(
            "\n{}Error{}: Could not load tsconfig.json. Is the provided directory a typescript project? ({})",
            COLOR_RED, COLOR_RESET, e
        );
        process::exit(1);
    });

    let dir = list_files_in_directory(Path::new(".").to_path_buf(), tsconfig.exclude);

    let mut used_classnames: HashMap<String, HashSet<UsedClassName>> = Default::default();
    let mut defined_classnames: HashMap<String, HashSet<ClassName>> = Default::default();

    for entry in &dir {
        let path = entry.replace("\\", "/");

        if path.ends_with(".tsx") {
            let code = fs::read_to_string(entry)?;
            let imported_css = extract_default_css_imports(&code);

            for (mut style_path, class_names) in imported_css {
                process_relative_import(Path::new(entry), &mut style_path)?;
                replace_aliases(&mut style_path, tsconfig.compiler_options.paths.clone());

                let used_fields = extract_used_classes(&code, &class_names, path.clone());
                used_classnames
                    .entry(style_path)
                    .or_insert_with(HashSet::new)
                    .extend(used_fields);
            }
        } else if path.ends_with(".module.css") {
            let code = fs::read_to_string(entry)?;
            let classes = extract_classes(&code);
            defined_classnames
                .entry(path)
                .or_insert_with(HashSet::new)
                .extend(classes);
        }
    }

    let mut files_count = 0;
    let mut errors_count = 0;

    for (css_file, mut classes_tsx) in defined_classnames.clone() {
        if let Some(used_css) = used_classnames.get(&css_file) {
            let used_css_flatten: Vec<String> =
                used_css.iter().map(|v| v.class_name.clone()).collect();
            classes_tsx.retain(|v| !used_css_flatten.contains(&v.class_name));
        }

        if classes_tsx.is_empty() {
            continue;
        }

        files_count += 1;
        errors_count += classes_tsx.len();

        println!("{}{}{}", COLOR_BLUE, css_file, COLOR_RESET);
        for extra in classes_tsx {
            println!(
                "{}{}:{}  {}Warn{}: Unused class `{}` found",
                COLOR_YELLOW,
                extra.line_index + 1,
                extra.column_index + 1,
                COLOR_YELLOW,
                COLOR_RESET,
                extra.class_name
            );
        }

        println!();
    }

    let mut undefined_classes: HashMap<String, HashSet<UsedClassName>> = HashMap::new();

    for (tsx_file, mut classes) in used_classnames {
        if let Some(defined_css) = defined_classnames.get(&tsx_file) {
            let defined_css: HashSet<String> =
                defined_css.iter().map(|v| v.class_name.clone()).collect();
            classes.retain(|v| !defined_css.contains(v.class_name.as_str()));
        }

        if classes.is_empty() {
            continue;
        }

        files_count += 1;
        errors_count += classes.len();

        for extra in classes {
            undefined_classes
                .entry(extra.file_name.clone())
                .or_insert_with(HashSet::new)
                .insert(extra);
        }
    }

    for undefined in undefined_classes {
        println!("{}{}{}", COLOR_BLUE, undefined.0, COLOR_RESET);
        for extra in undefined.1 {
            println!(
                "{}{}:{}  {}Warn{}: Undefined class `{}` used",
                COLOR_YELLOW,
                extra.line,
                extra.column + 1,
                COLOR_YELLOW,
                COLOR_RESET,
                extra.class_name
            );
        }

        println!();
    }

    if errors_count == 0 {
        println!("{}✔{} No CSS lint warnings found", COLOR_GREEN, COLOR_RESET);
    } else {
        println!(
            "Found {}{} warnings{} in {} files",
            COLOR_YELLOW, errors_count, COLOR_RESET, files_count
        );
    }

    Ok(())
}
