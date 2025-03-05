import * as vscode from 'vscode';

export class CssFixProvider implements vscode.CodeActionProvider {
    constructor(private diagnostics: vscode.DiagnosticCollection) {}

    provideCodeActions(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];
        const disable_rule = '/* css-lint-disable-rule unused-class*/';

        const diagnostics = this.diagnostics.get(document.uri) || [];
        for (const diagnostic of diagnostics) {
            if (diagnostic.range.intersection(range)) {
                const fix = new vscode.CodeAction(
                    `Add ${disable_rule}`,
                    vscode.CodeActionKind.QuickFix
                );
                fix.edit = new vscode.WorkspaceEdit();

                fix.edit.insert(
                    document.uri,
                    new vscode.Position(diagnostic.range.start.line, 0),
                    `${disable_rule}\n`
                );
                fix.diagnostics = [diagnostic];
                fix.isPreferred = true;

                actions.push(fix);
            }
        }

        return actions;
    }
}
