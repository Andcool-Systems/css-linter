use std::{collections::HashMap, fs};

use serde::Deserialize;

#[derive(Deserialize, Debug)]
pub struct CompilerOptions {
    pub paths: HashMap<String, Vec<String>>,
}

#[derive(Deserialize, Debug)]
pub struct Properties {
    #[serde(rename(deserialize = "compilerOptions"))]
    pub compiler_options: CompilerOptions,
    pub exclude: Vec<String>,
}

pub fn get_compiler_options() -> anyhow::Result<Properties> {
    let tsconfig_contents = fs::read_to_string("tsconfig.json")?;

    Ok(serde_json::from_str(&tsconfig_contents)?)
}
