use std::env;

use anyhow::Result;
use modules::{
    css_class::get_class_body, defined_classes::get_defined_classes, help::print_help, linter,
    styles_imports::get_styles_imports, version::get_version,
};

mod config;
mod modules;
mod parsers;
mod utils;

fn main() -> Result<()> {
    if let Ok(cwd) = std::env::var("cwd") {
        env::set_current_dir(cwd)?;
    }

    let args: Vec<String> = env::args().collect();
    match args.get(1) {
        Some(arg) if arg == "-v" => get_version()?,
        Some(arg) if arg == "--lint" => linter::lint()?,
        Some(arg) if arg == "--imports" => get_styles_imports()?,
        Some(arg) if arg == "--classes" => get_defined_classes()?,
        Some(arg) if arg == "--class" => get_class_body()?,
        Some(_) => print_help(),
        None => print_help(),
    };

    Ok(())
}
