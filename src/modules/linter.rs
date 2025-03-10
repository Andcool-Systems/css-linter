use std::{
    collections::{HashMap, HashSet},
    env, fs,
    path::Path,
    process,
};

use anyhow::Result;

use crate::{
    config::get_compiler_options,
    parsers::{
        extract_classes, extract_default_css_imports, extract_used_classes, ClassName,
        UsedClassName,
    },
    utils::{list_files_in_directory, process_relative_import, replace_aliases},
};

pub fn lint() -> Result<()> {
    const COLOR_RED: &str = "\x1b[31m";
    const COLOR_RESET: &str = "\u{001B}[0m";

    let args: Vec<String> = env::args().collect();

    let path = args.get(2).unwrap_or_else(|| {
        eprintln!("Path to the workplace must be provided");
        process::exit(1);
    });

    let minify = match args.get(3) {
        Some(v) if v == "--minify" => true,
        _ => false,
    };

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

        if path.ends_with(".tsx") || path.ends_with(".jsx") {
            let code = fs::read_to_string(entry)?;
            let imported_css = extract_default_css_imports(&code).unwrap_or_else(|e| {
                eprintln!("Could not parse file: {}\n{}", entry, e);
                process::exit(1);
            });

            for (mut style_path, class_names) in imported_css {
                process_relative_import(Path::new(entry), &mut style_path)?;
                replace_aliases(&mut style_path, tsconfig.compiler_options.paths.clone());

                let used_fields = extract_used_classes(&code, &class_names, path.clone())
                    .unwrap_or_else(|e| {
                        eprintln!("Could not parse file: {}\n{}", entry, e);
                        process::exit(1);
                    });

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

    if minify {
        print_results_minified(defined_classnames, used_classnames);
    } else {
        print_results(defined_classnames, used_classnames);
    }

    Ok(())
}

fn print_results(
    defined_classnames: HashMap<String, HashSet<ClassName>>,
    used_classnames: HashMap<String, HashSet<UsedClassName>>,
) {
    const COLOR_BLUE: &str = "\x1b[34m";
    const COLOR_YELLOW: &str = "\x1b[33m";
    const COLOR_GREEN: &str = "\x1b[32m";
    const COLOR_RESET: &str = "\u{001B}[0m";

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
                "{}{}:{}  {}Warn{}: Unused class `{}` found.",
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
                "{}{}:{}  {}Warn{}: Undefined class `{}` was used.",
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
}

fn print_results_minified(
    defined_classnames: HashMap<String, HashSet<ClassName>>,
    used_classnames: HashMap<String, HashSet<UsedClassName>>,
) {
    for (css_file, mut classes_tsx) in defined_classnames.clone() {
        if let Some(used_css) = used_classnames.get(&css_file) {
            let used_css_flatten: Vec<String> =
                used_css.iter().map(|v| v.class_name.clone()).collect();
            classes_tsx.retain(|v| !used_css_flatten.contains(&v.class_name));
        }

        if classes_tsx.is_empty() {
            continue;
        }

        for extra in classes_tsx {
            println!(
                "{}:{}:{}:{}:\"{}\": Unused class found.",
                css_file,
                extra.line_index + 1,
                extra.column_index + 1,
                extra.class_name.len(),
                extra.class_name
            );
        }
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

        for extra in classes {
            undefined_classes
                .entry(extra.file_name.clone())
                .or_insert_with(HashSet::new)
                .insert(extra);
        }
    }

    for undefined in undefined_classes {
        for extra in undefined.1 {
            println!(
                "{}:{}:{}:{}:\"{}\": Undefined class was used.",
                undefined.0,
                extra.line,
                extra.column + 1,
                extra.class_name.len(),
                extra.class_name
            );
        }
    }
}
