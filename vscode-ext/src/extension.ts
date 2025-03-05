import * as vscode from 'vscode';
import { join } from 'path';
import { binaries, install } from './installer';
import os from 'os';
import { CssModuleDefinitionProvider } from './definition.provider';
import { CssFixProvider } from './fix.provider';
import { run_diag } from './diagnostics';

export function activate(context: vscode.ExtensionContext) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('css-linter-diags');
    const config = vscode.workspace.getConfiguration('next-css-lint');
    const enabled = config.get<boolean>('enabled', true);

    const platform = os.platform();
    const binary = binaries[platform];
    const homedir = os.homedir();
    const exec_path = join(homedir, '.css-linter', binary);

    const fixProvider = new CssFixProvider(diagnosticCollection);
    let save_evt = vscode.workspace.onDidSaveTextDocument(() =>
        run_diag(exec_path, diagnosticCollection)
    );
    let code_action = vscode.languages.registerCodeActionsProvider('css', fixProvider, {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    });

    const enable_command = vscode.commands.registerCommand('next-css-lint.enable', async () => {
        await config.update('enabled', true, vscode.ConfigurationTarget.Workspace);
        save_evt = vscode.workspace.onDidSaveTextDocument(() =>
            run_diag(exec_path, diagnosticCollection)
        );
        code_action = vscode.languages.registerCodeActionsProvider('css', fixProvider, {
            providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
        });

        install()
            .then(() => {
                context.subscriptions.push(save_evt, code_action);
                run_diag(exec_path, diagnosticCollection);
            })
            .catch(e => console.error(`[CSS-linter][ERROR]: ${e}`));
    });

    const disable_command = vscode.commands.registerCommand('next-css-lint.disable', async () => {
        await config.update('enabled', false, vscode.ConfigurationTarget.Workspace);

        save_evt.dispose();
        code_action.dispose();
        diagnosticCollection.clear();
    });

    const provider = vscode.languages.registerDefinitionProvider(
        { scheme: 'file', language: 'typescriptreact' },
        new CssModuleDefinitionProvider()
    );

    context.subscriptions.push(diagnosticCollection, enable_command, disable_command, provider);

    if (enabled) {
        install()
            .then(() => {
                context.subscriptions.push(save_evt, code_action);
                run_diag(exec_path, diagnosticCollection);
            })
            .catch(e => console.error(`[CSS-linter][ERROR]: ${e}`));
    }
}

export function deactivate() {}

