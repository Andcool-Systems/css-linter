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

pub fn get_compiler_options() -> Properties {
    let tsconfig_contents = fs::read_to_string("tsconfig.json")
        .expect("Could not load tsconfig. Is the provided directory is typescript project?");

    let v: Properties = match serde_json::from_str(&tsconfig_contents) {
        Ok(res) => res,
        Err(err) => panic!("{}", err),
    };

    v
}
