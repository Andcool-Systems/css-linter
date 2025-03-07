import * as vscode from 'vscode';
import { join } from 'path';
import { execAsync, getExecPath } from '../utils';

export const run_diag = async (diagnosticCollection: vscode.DiagnosticCollection) => {
    const exec_path = getExecPath();
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
        return;
    }

    const stdout = await execAsync(`${exec_path} --lint ${workspacePath} --minify`);
    console.info(`[CSS-linter][INFO]: ${stdout}`);
    diagnosticCollection.clear();

    const error_lines = stdout.split('\n');
    if (error_lines.length === 0) return;

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
        const message = frags.slice(4).join(':');

        const range = new vscode.Range(line, col, line, col + len);
        const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
        diagnostic.source = 'next-css-linter';

        const diagnostics = diagnosticsMap.get(filePath) || [];
        diagnostics.push(diagnostic);
        diagnosticsMap.set(filePath, diagnostics);
    }

    diagnosticsMap.forEach((diags, file) => {
        const fileUri = vscode.Uri.file(join(workspacePath, file.replace(new RegExp(`^./`), '')));
        diagnosticCollection.set(fileUri, diags);
    });
};
