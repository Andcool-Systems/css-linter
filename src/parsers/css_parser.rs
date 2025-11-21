use std::collections::HashSet;

fn is_char(c: char) -> bool {
    c.is_alphabetic() || c.is_numeric() || c == '_' || c == '-'
}

fn is_first_char_numeric(buffer: &str) -> bool {
    buffer.chars().next().map_or(false, |c| c.is_numeric())
}

fn contains_forbidden_characters(string: &str) -> bool {
    string
        .chars()
        .filter(|char| ['\'', '"', '=', '(', '['].contains(char))
        .collect::<Vec<char>>()
        .len()
        != 0
}

#[derive(Eq, Hash, PartialEq, Clone, Debug)]
pub struct ClassName {
    pub class_name: String,
    pub line_index: usize,
    pub column_index: usize,
}

// TODO: Do normal CSS parser
pub fn extract_classes(css_content: &str) -> HashSet<ClassName> {
    let mut defined_classes: HashSet<ClassName> = HashSet::new();
    const DISABLE_RULE_FLAG: &str = "css-lint-disable-rule ";
    let mut skip_lines_remaining = 0;
    let mut in_multiline_comment = false;

    for (index, line) in css_content.split('\n').enumerate() {
        let stripped_line = line.trim_start();
        let trimmed_line_indent = line.len() - stripped_line.len();

        // Check for disable-rule directive before removing comments
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

        // Remove comments from the line
        let line_without_comments = remove_css_comments(stripped_line, &mut in_multiline_comment);

        if !line_without_comments.contains('.') || contains_forbidden_characters(&line_without_comments) {
            continue;
        }

        let mut buffer: String = String::new();
        let mut is_class = false;
        let mut start_index = 0;
        for (column_index, symbol) in line_without_comments.chars().enumerate() {
            match symbol {
                '.' => {
                    if !buffer.is_empty() && !is_first_char_numeric(&buffer) {
                        defined_classes.insert(ClassName {
                            class_name: buffer.clone(),
                            line_index: index,
                            column_index: start_index + trimmed_line_indent,
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
                                column_index: start_index + trimmed_line_indent,
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
                column_index: start_index + trimmed_line_indent,
            });
        }
    }

    defined_classes
}

fn remove_css_comments(line: &str, in_comment: &mut bool) -> String {
    let mut result = String::new();
    let mut chars = line.chars().peekable();

    while let Some(ch) = chars.next() {
        if *in_comment {
            // Inside a comment, look for */
            if ch == '*' && chars.peek() == Some(&'/') {
                chars.next(); // consume '/'
                *in_comment = false;
            }
        } else {
            // Outside a comment
            if ch == '/' && chars.peek() == Some(&'*') {
                chars.next(); // consume '*'
                *in_comment = true;
            } else {
                result.push(ch);
            }
        }
    }

    result
}
