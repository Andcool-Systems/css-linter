use std::{env, fs, path::Path, process};

use anyhow::Result;

use crate::{
    config::get_compiler_options,
    parsers::{extract_default_css_imports, extract_used_classes},
    utils::{list_files_in_directory, process_relative_import, replace_aliases},
};

pub fn get_class_usages() -> Result<()> {
    const COLOR_RED: &str = "\x1b[31m";
    const COLOR_RESET: &str = "\u{001B}[0m";

    let args: Vec<String> = env::args().collect();

    let file = args.get(2).unwrap_or_else(|| {
        eprintln!("Path to the file must be provided");
        process::exit(1);
    });

    let workplace_path = env::current_dir()?;
    let target_file = match Path::new(file).strip_prefix(workplace_path) {
        Ok(f) => f,
        Err(_) => {
            eprintln!("Path to the file must be relative to the current directory");
            process::exit(1);
        }
    };

    let class_name = args.get(3).unwrap_or_else(|| {
        eprintln!("Class name must be provided");
        process::exit(1);
    });

    let tsconfig = get_compiler_options().unwrap_or_else(|e| {
        eprintln!(
            "\n{}Error{}: Could not load tsconfig.json. Is the provided directory a typescript project? ({})",
            COLOR_RED, COLOR_RESET, e
        );
        process::exit(1);
    });

    let dir = list_files_in_directory(Path::new(".").to_path_buf(), tsconfig.exclude);
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

                if target_file.to_string_lossy().replace("\\", "/") != style_path.replace("./", "")
                {
                    continue;
                }

                let used_fields = extract_used_classes(&code, &class_names, path.clone())
                    .unwrap_or_else(|e| {
                        eprintln!("Could not parse file: {}\n{}", entry, e);
                        process::exit(1);
                    });

                for field in used_fields {
                    if field.class_name == *class_name {
                        println!(
                            "{}:{}:{}:{}",
                            path,
                            field.line,
                            field.column,
                            field.class_name.len()
                        );
                    }
                }
            }
        }
    }
    Ok(())
}
