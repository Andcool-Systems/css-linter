pub fn print_help() {
    println!(
        "Usage: css-linter [OPTION]\
        \n\nOptions:\
        \n  -v\t\t\t\t\t Print version information\
        \n  --lint <project path>\t\t\t Lint CSS and TSX files\
        \n  --imports <file path>\t\t\t Get all CSS imports in file\
        \n  --classes <file path>\t\t\t Get all defined CSS classes\
        \n  --class <file path> <class name>\t Get CSS class body\
        "
    );
}
