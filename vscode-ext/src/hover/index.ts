import * as vscode from 'vscode';
import { execAsync, getExecPath } from '../utils';

export class CSSHoverProvider implements vscode.HoverProvider {
    async provideHover(document: vscode.TextDocument, position: vscode.Position) {
        const exec_path = getExecPath();
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) return null;

        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) return null;

        const word = document.getText(wordRange);
        const linePrefix = document.lineAt(position).text.slice(0, position.character);
        const match = linePrefix.match(/([\w$]+)\.(\w+)$/);
        if (!match) return null;

        const imported_css_res = await execAsync(`${exec_path} --imports ${document.uri.fsPath}`, {
            cwd: workspacePath
        });

        const imported_css = JSON.parse(imported_css_res) as {
            [key: string]: string;
        };
        const class_path = Object.entries(imported_css).find(([_, v]) => v === match[1]);
        if (!class_path) return null;

        const class_body = await execAsync(`${exec_path} --class ${class_path[0]} ${word}`, {
            cwd: workspacePath
        });

        if (!class_body) return null;
        return new vscode.Hover(`CSS class\n \`\`\`css \n ${class_body} \n \`\`\``);
    }
}
