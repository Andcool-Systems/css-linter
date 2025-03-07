use std::{env, fs, process};

use anyhow::Result;

use crate::parsers::extract_classes;

pub fn get_defined_classes() -> Result<()> {
    const COLOR_RED: &str = "\x1b[31m";
    const COLOR_RESET: &str = "\u{001B}[0m";

    let args: Vec<String> = env::args().collect();
    let path = match args.get(2) {
        Some(path) if !path.ends_with(".module.css") => {
            eprintln!("{}Error{}: Invalid file extension.", COLOR_RED, COLOR_RESET);
            process::exit(1);
        }
        Some(path) => path,
        None => {
            eprintln!("Path to the file must be provided");
            process::exit(1);
        }
    };

    let code = fs::read_to_string(path)?;
    let imported_css = extract_classes(&code);

    imported_css
        .iter()
        .try_for_each(|class_name| -> Result<()> {
            println!(
                "{}:{}:{}",
                class_name.class_name, class_name.line_index, class_name.column_index
            );
            Ok(())
        })?;
    Ok(())
}
