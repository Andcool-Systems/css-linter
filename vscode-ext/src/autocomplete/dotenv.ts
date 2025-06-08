import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

export function getEnvKeys(workspacePath: string): string[] {
    const envPath = path.join(workspacePath, '.env');
    let env: string[] = [];
    if (fs.existsSync(envPath)) {
        const file = fs.readFileSync(envPath);
        env = Object.keys(dotenv.parse(file));
    }
    return env;
}

export class DotenvCompletionProvider implements vscode.CompletionItemProvider {
    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.CompletionItem[] | null | undefined> {
        const line = document.lineAt(position);
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!line.text.endsWith('process.env.') || !workspacePath) return;

        return getEnvKeys(workspacePath).map(key => {
            const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Variable);
            return item;
        });
    }
}
