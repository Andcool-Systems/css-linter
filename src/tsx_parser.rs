use std::collections::HashSet;
use swc_common::{sync::Lrc, FileName, SourceMap};
use swc_ecma_ast::{ImportSpecifier, Module, ModuleDecl};
use swc_ecma_parser::{Parser, StringInput, Syntax, TsSyntax};
use swc_ecma_visit::{Visit, VisitWith};

pub fn module_parser(tsx_code: &str) -> (Module, Lrc<SourceMap>) {
    let cm: Lrc<SourceMap> = Default::default();
    let fm = cm.new_source_file(FileName::Custom("input.tsx".into()).into(), tsx_code.into());

    let syntax = Syntax::Typescript(TsSyntax {
        tsx: true,
        decorators: false,
        dts: false,
        no_early_errors: false,
        disallow_ambiguous_jsx_like: false,
    });

    let mut parser = Parser::new(syntax, StringInput::from(&*fm), None);

    (parser.parse_module().expect("Failed to parse"), cm)
}

#[derive(Eq, PartialEq, Hash, Debug)]
pub struct UsedClassName {
    pub class_name: String,
    pub file_name: String,
    pub line: usize,
    pub column: usize,
}

struct PropertyFinder {
    variable_name: String,
    file_name: String,
    properties: HashSet<UsedClassName>,
    source_map: Lrc<SourceMap>,
}

impl Visit for PropertyFinder {
    fn visit_member_expr(&mut self, node: &swc_ecma_ast::MemberExpr) {
        if let swc_ecma_ast::Expr::Ident(ref obj) = *node.obj {
            if obj.sym == self.variable_name {
                if let swc_ecma_ast::MemberProp::Ident(ref prop) = node.prop {
                    let loc = self.source_map.lookup_char_pos(node.span.lo());
                    self.properties.insert(UsedClassName {
                        class_name: prop.sym.to_string(),
                        file_name: self.file_name.clone(),
                        line: loc.line,
                        column: self.variable_name.len() + loc.col.0,
                    });
                }
            }
        }

        node.visit_children_with(self);
    }
}

pub fn extract_used_classes(
    tsx_code: &str,
    variable_name: &str,
    file_name: String,
) -> HashSet<UsedClassName> {
    let (module, source_map) = module_parser(tsx_code);

    let mut finder = PropertyFinder {
        variable_name: variable_name.to_string(),
        file_name,
        properties: HashSet::new(),
        source_map: source_map.clone(),
    };

    module.visit_with(&mut finder);

    finder.properties
}

struct DefaultCssImportFinder {
    imported_variables: HashSet<(String, String)>,
}

impl Visit for DefaultCssImportFinder {
    fn visit_module(&mut self, node: &Module) {
        for stmt in &node.body {
            if let swc_ecma_ast::ModuleItem::ModuleDecl(ModuleDecl::Import(import)) = stmt {
                if import.src.value.ends_with(".module.css") {
                    for specifier in &import.specifiers {
                        if let ImportSpecifier::Default(default) = specifier {
                            self.imported_variables.insert((
                                import.src.value.to_string(),
                                default.local.sym.to_string(),
                            ));
                        }
                    }
                }
            }
        }
    }
}

pub fn extract_default_css_imports(tsx_code: &str) -> HashSet<(String, String)> {
    let (module, _) = module_parser(tsx_code);

    let mut finder = DefaultCssImportFinder {
        imported_variables: HashSet::new(),
    };

    module.visit_with(&mut finder);

    finder.imported_variables
}
