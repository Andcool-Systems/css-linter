import * as vscode from 'vscode';
import { exec } from 'child_process';
import { join } from 'path';
import { binaries, install } from './installer';
import os from 'os';

export function activate(context: vscode.ExtensionContext) {
	const extension = vscode.extensions.getExtension('AndcoolSystems.next-css-lint');
	const version = extension!.packageJSON.version;

	const diagnosticCollection = vscode.languages.createDiagnosticCollection('css-linter-diags');
	context.subscriptions.push(diagnosticCollection);

	const platform = os.platform();
	const binary = binaries[platform];

	const homedir = os.homedir();
	const exec_path = join(homedir, '.css-linter', binary);

	function run_diag() {
		const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!workspacePath) {
			return;
		}

		exec(`${exec_path} ${workspacePath} --minify`, (error, stdout, stderr) => {
			if (error || stderr) {
				console.error(`CSS-lint error: ${error || stderr}`);
				return;
			}

			console.log(stdout);

			diagnosticCollection.clear();
			const error_lines = stdout.split('\n');

			if (error_lines.length === 0) {
				return;
			}

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
				const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);

				const diagnostics = diagnosticsMap.get(filePath) || [];
				diagnostics.push(diagnostic);
				diagnosticsMap.set(filePath, diagnostics);
			}

			diagnosticsMap.forEach((diags, file) => {
				const fileUri = vscode.Uri.file(join(workspacePath, file.replace(new RegExp(`^./`), '')));
				diagnosticCollection.set(fileUri, diags);
			});
		});
	}

	const save_evt = vscode.workspace.onDidSaveTextDocument(() => {
		run_diag();
	});

	const code_action = vscode.languages.registerCodeActionsProvider("css", new CssFixProvider(diagnosticCollection), {
		providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
	});

	install(version)
		.then(() => {
			context.subscriptions.push(save_evt);
			context.subscriptions.push(code_action);
			run_diag();
		})
		.catch((e) => console.error(`[CSS-linter][ERROR]: ${e}`));
}

class CssFixProvider implements vscode.CodeActionProvider {
	constructor(private diagnostics: vscode.DiagnosticCollection) { }

	provideCodeActions(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction[] {
		const actions: vscode.CodeAction[] = [];
		const disable_rule = '/* css-lint-disable-rule unused-class*/';

		const diagnostics = this.diagnostics.get(document.uri) || [];
		for (const diagnostic of diagnostics) {
			if (diagnostic.range.intersection(range)) {
				const fix = new vscode.CodeAction(`Add ${disable_rule}`, vscode.CodeActionKind.QuickFix);
				fix.edit = new vscode.WorkspaceEdit();

				fix.edit.insert(document.uri, new vscode.Position(diagnostic.range.start.line, 0), `${disable_rule}\n`);
				fix.diagnostics = [diagnostic];
				fix.isPreferred = true;

				actions.push(fix);
			}
		}

		return actions;
	}
}

export function deactivate() { }
