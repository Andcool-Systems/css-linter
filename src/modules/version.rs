use anyhow::Result;
use std::process;

pub fn get_version() -> Result<()> {
    print!("v{}", env!("CARGO_PKG_VERSION"));
    process::exit(0);
}