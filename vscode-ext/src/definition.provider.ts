import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import * as vscode from 'vscode';

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

        const definitions: vscode.Location[] = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trimStart();
            if (line.match(new RegExp(`\\.${propertyName}(?![a-zA-Z0-9-_])`))) {
                const definitionUri = vscode.Uri.file(resolvedPath);
                const definitionPosition = new vscode.Position(i, 0);
                definitions.push(new vscode.Location(definitionUri, definitionPosition));
            }
        }

        return definitions;
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
