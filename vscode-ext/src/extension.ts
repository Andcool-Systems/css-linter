import * as vscode from 'vscode';
import { exec } from 'child_process';
import { join, resolve } from 'path';
import { binaries, install } from './installer';
import os from 'os';
import { existsSync, readFileSync } from 'fs';

export function activate(context: vscode.ExtensionContext) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('css-linter-diags');
    context.subscriptions.push(diagnosticCollection);

    const platform = os.platform();
    const binary = binaries[platform];

    const homedir = os.homedir();
    const exec_path = join(homedir, '.css-linter', binary);

    function run_diag() {
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) {
            return;
        }

        exec(`${exec_path} --lint ${workspacePath} --minify`, (error, stdout, stderr) => {
            if (error || stderr) {
                console.error(`[CSS-linter][ERROR]: ${error || stderr}`);
                return;
            }
            console.info(`[CSS-linter][INFO]: ${stdout}`);

            diagnosticCollection.clear();
            const error_lines = stdout.split('\n');

            if (error_lines.length === 0) {
                return;
            }

            const diagnosticsMap: Map<string, vscode.Diagnostic[]> = new Map();
            for (let e_line of error_lines) {
                let frags = e_line.split(':');
                if (frags.length < 4) {
                    continue;
                }

                const filePath = frags[0];
                const line = parseInt(frags[1]) - 1;
                const col = parseInt(frags[2]);
                const len = parseInt(frags[3]);
                const message = frags[4];

                const range = new vscode.Range(line, col, line, col + len);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    message,
                    vscode.DiagnosticSeverity.Warning
                );

                diagnostic.source = 'next-css-linter';

                const diagnostics = diagnosticsMap.get(filePath) || [];
                diagnostics.push(diagnostic);
                diagnosticsMap.set(filePath, diagnostics);
            }

            diagnosticsMap.forEach((diags, file) => {
                const fileUri = vscode.Uri.file(
                    join(workspacePath, file.replace(new RegExp(`^./`), ''))
                );
                diagnosticCollection.set(fileUri, diags);
            });
        });
    }

    const save_evt = vscode.workspace.onDidSaveTextDocument(() => {
        run_diag();
    });

    const code_action = vscode.languages.registerCodeActionsProvider(
        'css',
        new CssFixProvider(diagnosticCollection),
        {
            providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
        }
    );

    install()
        .then(() => {
            context.subscriptions.push(save_evt);
            context.subscriptions.push(code_action);
            run_diag();
        })
        .catch(e => console.error(`[CSS-linter][ERROR]: ${e}`));

    const provider = vscode.languages.registerDefinitionProvider(
        { scheme: 'file', language: 'typescriptreact' },
        new CssModuleDefinitionProvider()
    );

    context.subscriptions.push(provider);
}

class CssFixProvider implements vscode.CodeActionProvider {
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

export class CssModuleDefinitionProvider implements vscode.DefinitionProvider {
    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | null> {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) return null;

        const word = document.getText(wordRange);
        const text = document.getText();
        const lineText = document.lineAt(position.line).text;

        const regex = /(\w+)\.(\w+)/g;
        let match;
        const matches: { objectName: string; propertyName: string }[] = [];

        while ((match = regex.exec(lineText)) !== null) {
            matches.push({ objectName: match[1], propertyName: match[2] });
        }

        const matchData = matches.find(m => m.propertyName === word);
        if (!matchData) return null;

        const { objectName, propertyName } = matchData;
        if (propertyName !== word) return null;

        const importRegex = new RegExp(`import\\s+${objectName}\\s+from\\s+['"](.*?)['"]`);
        const importMatch = text.match(importRegex);
        if (!importMatch) return null;

        const importPath = importMatch[1];
        const resolvedPath = this.resolveImportPath(document, importPath);
        if (!resolvedPath) return null;

        const allowedExtensions = ['.module.css', '.module.scss'];
        if (!allowedExtensions.some(ext => resolvedPath.endsWith(ext))) return null;

        const fileContent = readFileSync(resolvedPath, 'utf-8');
        const lines = fileContent.split('\n');

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(`.${propertyName}`)) {
                const definitionUri = vscode.Uri.file(resolvedPath);
                const definitionPosition = new vscode.Position(i, 0);
                return new vscode.Location(definitionUri, definitionPosition);
            }
        }

        return null;
    }

    private resolveImportPath(document: vscode.TextDocument, importPath: string): string | null {
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) return null;

        const tsConfigPath = join(workspacePath, 'tsconfig.json');
        let aliasMap: Record<string, string> = {};
        if (existsSync(tsConfigPath)) {
            const tsConfig = JSON.parse(readFileSync(tsConfigPath, 'utf-8'));
            if (tsConfig.compilerOptions?.paths) {
                aliasMap = this.parseTsConfigPaths(tsConfig.compilerOptions.paths, workspacePath);
            }
        }

        for (const alias in aliasMap) {
            if (importPath.startsWith(alias)) {
                return importPath.replace(alias, aliasMap[alias]);
            }
        }

        if (importPath.startsWith('.')) {
            const currentDir = join(document.uri.fsPath, '..');
            return resolve(currentDir, importPath);
        }

        return join(workspacePath, importPath);
    }

    private parseTsConfigPaths(
        paths: Record<string, string[]>,
        workspacePath: string
    ): Record<string, string> {
        const aliasMap: Record<string, string> = {};
        for (const alias in paths) {
            const targetPaths = paths[alias];
            if (targetPaths.length > 0) {
                const cleanedAlias = alias.replace(/\*$/, ''); // "@/*" → "@/"
                const cleanedPath = targetPaths[0].replace(/\*$/, ''); // "./src/*" → "./src/"
                aliasMap[cleanedAlias] = join(workspacePath, cleanedPath);
            }
        }
        return aliasMap;
    }
}

export function deactivate() {}

