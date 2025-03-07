use std::{env, process};

use anyhow::Result;
use modules::{
    css_class::get_class_body, defined_classes::get_defined_classes, linter,
    styles_imports::get_styles_imports,
};

mod config;
mod modules;
mod parsers;
mod utils;

fn main() -> Result<()> {
    const COLOR_RED: &str = "\x1b[31m";
    const COLOR_RESET: &str = "\u{001B}[0m";

    let args: Vec<String> = env::args().collect();
    if let Ok(cwd) = std::env::var("cwd") {
        env::set_current_dir(cwd)?;
    }

    match args.get(1) {
        Some(arg) if arg == "-v" => {
            print!("v{}", env!("CARGO_PKG_VERSION"));
            process::exit(0);
        }
        Some(arg) if arg == "--lint" => linter::lint()?,
        Some(arg) if arg == "--imports" => get_styles_imports()?,
        Some(arg) if arg == "--classes" => get_defined_classes()?,
        Some(arg) if arg == "--class" => get_class_body()?,
        Some(arg) => {
            eprintln!(
                "{}Error{}: Invalid argument: {}",
                COLOR_RED, COLOR_RESET, arg
            );
            process::exit(1);
        }
        None => todo!(),
    };

    Ok(())
}
