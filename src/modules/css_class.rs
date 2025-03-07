use std::{env, fs, process};

use anyhow::Result;
use regex::Regex;

pub fn get_class_body() -> Result<()> {
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

    let class_name = args.get(3).unwrap_or_else(|| {
        eprintln!("Class name must be provided");
        process::exit(1);
    });

    let code = fs::read_to_string(path)?;
    let pattern = format!(
        r"\.{}[^A-Za-z0-9_-][^{{}}]*\{{[^}}]*\}}",
        regex::escape(class_name)
    );
    let re = Regex::new(&pattern)?;

    for m in re.find_iter(&code) {
        if m.as_str().starts_with(&format!(".{}", class_name)) {
            let trimmed = m.as_str().trim_start();

            match trimmed {
                s if s.starts_with('.') || s.ends_with('}') => print!("{}", trimmed),
                _ => print!("    {}", trimmed),
            }
            break;
        }
    }
    Ok(())
}
