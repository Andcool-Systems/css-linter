import * as vscode from 'vscode';
import { execAsync, getExecPath } from '../utils';

export class CssCompletionProvider implements vscode.CompletionItemProvider {
    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.CompletionItem[] | null | undefined> {
        const exec_path = getExecPath();
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) {
            return;
        }

        const linePrefix = document.lineAt(position).text.slice(0, position.character);
        const match = linePrefix.match(/([\w$]+)\.$/);
        if (!match) return [];

        const imported_css_res = await execAsync(`${exec_path} --imports ${document.uri.fsPath}`, {
            cwd: workspacePath
        });

        const imported_css = JSON.parse(imported_css_res) as {
            [key: string]: string;
        };
        const class_path = Object.entries(imported_css).find(([_, v]) => v === match[1]);
        if (!class_path) return [];

        const defined_classes = await execAsync(`${exec_path} --classes ${class_path[0]}`, {
            cwd: workspacePath
        });

        const classes_list = defined_classes
            .split('\n')
            .filter(Boolean)
            .map(css_class => css_class.split(':')[0]);

        const completionItems: vscode.CompletionItem[] = [];
        new Set(classes_list.sort()).forEach(css_class => {
            const item = new vscode.CompletionItem(css_class, vscode.CompletionItemKind.Variable);
            item.detail = `.${css_class} CSS class`;
            item.insertText = css_class;
            completionItems.push(item);
        });

        return completionItems;
    }
}
