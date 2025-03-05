import { exec } from 'child_process';
import * as vscode from 'vscode';
import { join } from 'path';

export const run_diag = (exec_path: string, diagnosticCollection: vscode.DiagnosticCollection) => {
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
};
