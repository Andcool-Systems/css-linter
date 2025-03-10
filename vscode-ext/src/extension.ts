import * as vscode from 'vscode';
import { install } from './installer';
import { CssModuleDefinitionProvider } from './definitions';
import { CssFixProvider } from './diagnostics/fix.provider';
import { run_diag } from './diagnostics';
import { CssCompletionProvider } from './autocomplete';
import { CSSHoverProvider } from './hover';
import { convert_css } from './convert';
import { CSSReferenceProvider } from './usages';

const fileFilter = [
    { scheme: 'file', language: 'javascriptreact' },
    { scheme: 'file', language: 'typescriptreact' }
];

export function activate(context: vscode.ExtensionContext) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('css-linter-diags');
    const config = vscode.workspace.getConfiguration('next-css-lint');
    const enabled = config.get<boolean>('enabled', true);

    const fix_provider = new CssFixProvider(diagnosticCollection);
    const code_action_type = {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    };
    const css_definition = new CssModuleDefinitionProvider();
    const css_completion = new CssCompletionProvider();
    const css_hover = new CSSHoverProvider();
    const css_references = new CSSReferenceProvider();

    let save_evt = vscode.workspace.onDidSaveTextDocument(() => run_diag(diagnosticCollection));
    let code_action = vscode.languages.registerCodeActionsProvider(
        'css',
        fix_provider,
        code_action_type
    );
    let definition_provider = vscode.languages.registerDefinitionProvider(
        fileFilter,
        css_definition
    );
    let completion_provider = vscode.languages.registerCompletionItemProvider(
        fileFilter,
        css_completion,
        '.'
    );
    let hover_provider = vscode.languages.registerHoverProvider(fileFilter, css_hover);
    let extractor = vscode.commands.registerCommand('next-css-lint.convert-inline', convert_css);
    let css_reference_provider = vscode.languages.registerReferenceProvider('css', css_references);

    const enable_command = vscode.commands.registerCommand('next-css-lint.enable', async () => {
        await config.update('enabled', true, vscode.ConfigurationTarget.Workspace);
        save_evt = vscode.workspace.onDidSaveTextDocument(() => run_diag(diagnosticCollection));
        hover_provider = vscode.languages.registerHoverProvider(fileFilter, css_hover);
        extractor = vscode.commands.registerCommand('next-css-lint.convert-inline', convert_css);
        css_reference_provider = vscode.languages.registerReferenceProvider('css', css_references);
        code_action = vscode.languages.registerCodeActionsProvider(
            'css',
            fix_provider,
            code_action_type
        );
        definition_provider = vscode.languages.registerDefinitionProvider(
            fileFilter,
            css_definition
        );
        completion_provider = vscode.languages.registerCompletionItemProvider(
            fileFilter,
            css_completion,
            '.'
        );

        install()
            .then(() => {
                context.subscriptions.push(
                    save_evt,
                    code_action,
                    definition_provider,
                    completion_provider,
                    hover_provider,
                    extractor,
                    css_reference_provider
                );
                run_diag(diagnosticCollection);
            })
            .catch(e => console.error(`[CSS-linter][ERROR]: ${e}`));
    });

    const disable_command = vscode.commands.registerCommand('next-css-lint.disable', async () => {
        await config.update('enabled', false, vscode.ConfigurationTarget.Workspace);

        save_evt.dispose();
        code_action.dispose();
        definition_provider.dispose();
        completion_provider.dispose();
        hover_provider.dispose();
        extractor.dispose();
        diagnosticCollection.clear();
    });

    context.subscriptions.push(diagnosticCollection, enable_command, disable_command);

    if (enabled) {
        install()
            .then(() => {
                context.subscriptions.push(
                    save_evt,
                    code_action,
                    definition_provider,
                    completion_provider,
                    hover_provider,
                    extractor,
                    css_reference_provider
                );
                run_diag(diagnosticCollection);
            })
            .catch(e => console.error(`[CSS-linter][ERROR]: ${e}`));
    }
}

export function deactivate() {}

