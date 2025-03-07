import * as vscode from 'vscode';
import * as json5 from 'json5';
import { execAsync, getExecPath } from '../utils';
import { join } from 'path';

export const convert_css = async () => {
    const exec_path = getExecPath();

    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
        return null;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) return false;

    const selection = editor.document.getText(editor.selection);
    const style = extractStyleString(selection);

    if (!style) return false;
    const parsed_css = json5.parse(style) as { [key: string]: string };

    const css = Object.keys(parsed_css)
        .map((property: string) => {
            const cssProperty = property.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
            let value = parsed_css[property];
            return `    ${cssProperty}: ${value}`;
        })
        .join(';\n');

    const imported_css_res = await execAsync(
        `${exec_path} --imports ${editor.document.uri.fsPath}`,
        {
            cwd: workspacePath
        }
    );

    const imported_css = JSON.parse(imported_css_res) as {
        [key: string]: string;
    };

    const items = Object.keys(imported_css).map(css => ({ label: imported_css[css], path: css }));
    const selected_file = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select CSS file to insert extracted style',
        canPickMany: false
    });
    if (!selected_file) return false;

    let newClassName = await vscode.window.showInputBox({
        prompt: 'Enter new CSS class name:',
        placeHolder: 'extracted_class'
    });

    newClassName = newClassName?.replace(/[^a-zA-Z0-9_]/g, '')?.replace(/^\d+/, '');
    if (!newClassName) return false;

    await editor.edit(edit_bundler =>
        edit_bundler.replace(editor.selection, `className={${selected_file.label}.${newClassName}}`)
    );
    await editor.document.save();

    const css_document = await vscode.workspace.openTextDocument(
        vscode.Uri.file(convert_path(selected_file.path))
    );
    const css_editor = await vscode.window.showTextDocument(css_document, { preview: true });

    await css_editor.edit(edit_bundler =>
        edit_bundler.insert(new vscode.Position(0, 0), `.${newClassName} {\n${css};\n}\n\n`)
    );
    await css_document.save();
    return true;
};

const extractStyleString = (selection: string): string | null => {
    selection = selection.trim();
    if (!selection.startsWith('style={{')) {
        return null;
    }
    if (!selection.endsWith('}}')) {
        return null;
    }

    const style = selection.match(/style=\{\{([^}]*)\}\}/);
    if (!style) {
        return null;
    }

    return `{${style[1]}}`;
};

const convert_path = (path: string) => {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) return path;

    if (path.startsWith('.')) {
        return join(workspacePath, path);
    }

    return path;
};
