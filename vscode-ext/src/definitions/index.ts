import { join } from 'path';
import * as vscode from 'vscode';
import { execAsync, getExecPath } from '../utils';

export class CssModuleDefinitionProvider implements vscode.DefinitionProvider {
    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | null> {
        const exec_path = getExecPath();
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) return null;

        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) {
            return null;
        }

        const linePrefix = document.lineAt(position).text.slice(0, position.character);
        const match = linePrefix.match(/([\w$]+)\.(\w+)$/);
        const word = document.getText(wordRange);
        if (!match) return null;

        const imported_css_res = await execAsync(`${exec_path} --imports ${document.uri.fsPath}`, {
            cwd: workspacePath
        });

        const imported_css = JSON.parse(imported_css_res) as {
            [key: string]: string;
        };
        const class_path = Object.entries(imported_css).find(([_, v]) => v === match[1]);
        if (!class_path) return null;

        const defined_classes = await execAsync(`${exec_path} --classes ${class_path[0]}`, {
            cwd: workspacePath
        });

        return defined_classes
            .split('\n')
            .filter(Boolean)
            .map(css_class => css_class.split(':'))
            .filter(css_class => css_class[0] === word)
            .sort((a, b) => parseInt(a[1]) - parseInt(b[1]))
            .map(css_class => {
                let path = class_path[0];
                if (class_path[0].startsWith('.')) {
                    path = join(workspacePath, class_path[0]);
                }

                const definitionUri = vscode.Uri.file(path);
                const definitionPosition = new vscode.Position(
                    parseInt(css_class[1]),
                    parseInt(css_class[2])
                );
                return new vscode.Location(definitionUri, definitionPosition);
            });
    }
}
