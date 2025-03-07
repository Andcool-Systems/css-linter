use std::{env, fs, path::Path, process};

use anyhow::Result;
use serde_json::json;
use std::collections::HashMap;

use crate::{
    config::get_compiler_options,
    parsers::extract_default_css_imports,
    utils::{process_relative_import, replace_aliases},
};

pub fn get_styles_imports() -> Result<()> {
    const COLOR_RED: &str = "\x1b[31m";
    const COLOR_RESET: &str = "\u{001B}[0m";

    let args: Vec<String> = env::args().collect();

    let path = match args.get(2) {
        Some(path) if !path.ends_with(".tsx") && !path.ends_with(".jsx") => {
            eprintln!("{}Error{}: Invalid file extension.", COLOR_RED, COLOR_RESET);
            process::exit(1);
        }
        Some(path) => path,
        None => {
            eprintln!("Path to the file must be provided");
            process::exit(1);
        }
    };

    let tsconfig = get_compiler_options().unwrap_or_else(|e| {
        eprintln!(
            "\n{}Error{}: Could not load tsconfig.json. Is the provided directory a typescript project? ({})",
            COLOR_RED, COLOR_RESET, e
        );
        process::exit(1);
    });

    let code = fs::read_to_string(path)?;
    let imported_css = extract_default_css_imports(&code)?;

    let mut imports_map = HashMap::new();

    imported_css
        .iter()
        .try_for_each(|(style_path, class_name)| -> Result<()> {
            let mut style_path = style_path.clone();
            process_relative_import(Path::new(path), &mut style_path)?;
            replace_aliases(&mut style_path, tsconfig.compiler_options.paths.clone());

            imports_map.insert(style_path, class_name.clone());
            Ok(())
        })?;

    let json_output = json!(imports_map);
    print!("{}", json_output);
    Ok(())
}
