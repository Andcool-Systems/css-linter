use std::collections::HashSet;

fn is_char(c: char) -> bool {
    c.is_alphabetic() || c.is_numeric() || c == '_' || c == '-'
}

fn is_first_char_numeric(buffer: &str) -> bool {
    buffer.chars().next().map_or(false, |c| c.is_numeric())
}

#[derive(Eq, Hash, PartialEq, Clone)]
pub struct ClassName {
    pub class_name: String,
    pub line_index: usize,
    pub column_index: usize,
}

pub fn extract_classes(css_content: &str) -> HashSet<ClassName> {
    let mut defined_classes: HashSet<ClassName> = HashSet::new();
    const DISABLE_RULE_FLAG: &str = "css-lint-disable-rule ";
    let mut skip_lines_remaining = 0;

    for (index, line) in css_content.split('\n').enumerate() {
        let stripped_line = line.trim_start();

        if stripped_line.starts_with("/*") {
            let comment_content = stripped_line
                .trim_start_matches("/*")
                .trim_end_matches("*/")
                .trim();

            if let Some(rest) = comment_content.strip_prefix(DISABLE_RULE_FLAG) {
                if rest.trim_start().starts_with("unused-class") {
                    skip_lines_remaining = 2;
                }
            }
        }
        if skip_lines_remaining != 0 {
            skip_lines_remaining -= 1;
            continue;
        }

        if !stripped_line.starts_with('.') {
            continue;
        }

        let mut buffer: String = String::new();
        let mut is_class = true;
        let mut start_index = 0;
        for (column_index, symbol) in stripped_line.chars().enumerate() {
            match symbol {
                '.' => {
                    if !buffer.is_empty() && !is_first_char_numeric(&buffer) {
                        defined_classes.insert(ClassName {
                            class_name: buffer.clone(),
                            line_index: index,
                            column_index: start_index,
                        });
                    }
                    buffer.clear();
                    start_index = column_index;
                    is_class = true;
                }
                char_i => {
                    if is_class && is_char(char_i) {
                        buffer.push(char_i);
                    } else if !buffer.is_empty() {
                        if !is_first_char_numeric(&buffer) {
                            defined_classes.insert(ClassName {
                                class_name: buffer.clone(),
                                line_index: index,
                                column_index: start_index,
                            });
                        }
                        buffer.clear();
                        is_class = false;
                    }
                }
            }
        }
        if !buffer.is_empty() && !is_first_char_numeric(&buffer) {
            defined_classes.insert(ClassName {
                class_name: buffer,
                line_index: index,
                column_index: start_index,
            });
        }
    }

    defined_classes
}
