import * as vscode from 'vscode';
import { execAsync, getExecPath } from '../utils';
import { join } from 'path';

export class CSSReferenceProvider implements vscode.ReferenceProvider {
    async provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.ReferenceContext,
        token: vscode.CancellationToken
    ): Promise<vscode.Location[] | null | undefined> {
        const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z0-9_-]+/);
        if (!wordRange) return null;

        const exec_path = getExecPath();
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) {
            return null;
        }

        const className = document.getText(wordRange);
        const used_classes = await execAsync(
            `${exec_path} --usages ${document.uri.fsPath} ${className}`,
            {
                cwd: workspacePath
            }
        );
        console.log(used_classes);
        return used_classes
            .split('\n')
            .filter(Boolean)
            .map(line => line.split(':'))
            .map(usage => {
                let path = usage[0];
                if (usage[0].startsWith('.')) {
                    path = join(workspacePath, usage[0]);
                }
                const file = vscode.Uri.file(path);
                const line = parseInt(usage[1]) - 1;
                const col = parseInt(usage[2]) + 1;
                const len = parseInt(usage[3]);
                return new vscode.Location(file, new vscode.Range(line, col, line, col + len));
            });
    }
}
