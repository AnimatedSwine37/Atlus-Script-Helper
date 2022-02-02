/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { workspace, ExtensionContext, commands, window, Terminal, StatusBarAlignment, StatusBarItem, ConfigurationTarget } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;
let statusBarItem: StatusBarItem;

// A list of any requests for decompiling a file that have been ignored (based on file uri)
let ignoreDecompileRequest: string[] = [];

const scriptCompilerArgs: Map<string, {outFormat: string, library:string, encoding:string}> = new Map([
	["SMT 3 Nocturne", { outFormat: "V1", library: "SMT3", encoding: "P3" }],
	["SMT Digital Devil Saga", { outFormat: "V1DDS", library: "DDS", encoding: "P3" }],
	["Persona 3 Portable", { outFormat: "V1", library: "P3P", encoding: "P3" }],
	["Persona 3", { outFormat: "V1", library: "P3", encoding: "P3" }],
	["Persona 3 FES", { outFormat: "V1", library: "P3F", encoding: "P3" }],
	["Persona 4", { outFormat: "V1", library: "P4", encoding: "P4" }],
	["Persona 4 Golden", {outFormat: "V1", library: "P4G", encoding:"P4"}],
	["Persona 5", { outFormat: "V3BE", library: "P5", encoding: "P5" }],
	["Persona 5 Royal", { outFormat: "V3BE", library: "P5R", encoding: "P5" }],
	["Persona Q2", { outFormat: "V1", library: "PQ2", encoding: "SJ" }]
]);

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	let serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for flow and msg files
		documentSelector: [{ scheme: 'file', language: 'Flowscript' }, { scheme: 'file', language: 'Messagescript'}],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'atlusScriptHelper',
		'Atlus Script Helper',
		serverOptions,
		clientOptions
	);
	client.onReady().then(() => {
		client.onNotification("flowscript/decompileRequired", (filePath:string) => {
			if(!ignoreDecompileRequest.includes(filePath))
				window.showWarningMessage(`${path.basename(filePath)} does not appear to be decompiled. Please decompile it to allow messages and functions to be read from it.`, `Decompile ${path.basename(filePath)}`).then(selection => {
				if(selection != undefined) {
					decompileFlowscript({fsPath: filePath});
				} else {
					ignoreDecompileRequest.push(filePath);
				}
			});
		});
	});

	client.onReady().then(() => {
		client.onNotification("flowscript/error", (message:string) => {
			window.showErrorMessage(message);
		})
	})

	// Start the client. This will also launch the server
	client.start();

	// Register commands
	const compileFlowscript = (context: any) => {
		let terminal:Terminal = window.createTerminal("Atlus Script Tools");
		terminal.show(true);
		let toolsPath:string = workspace.getConfiguration("atlusScriptHelper").get("scriptToolsPath");
		let selectedGame: string = workspace.getConfiguration("atlusScriptHelper").get("defaultGame");
		let args = scriptCompilerArgs.get(selectedGame);
		terminal.sendText(`& "${toolsPath}\\AtlusScriptCompiler.exe" "${context.fsPath}" -Compile -OutFormat ${args.outFormat} -Library ${args.library} -Encoding ${args.encoding} -Hook`, true);
	}
	context.subscriptions.push(commands.registerCommand("flowscript.compile", compileFlowscript));

	const decompileFlowscript = (context: any) => {
		let terminal:Terminal = window.createTerminal("Atlus Script Tools");
		terminal.show(true);
		let toolsPath:string = workspace.getConfiguration("atlusScriptHelper").get("scriptToolsPath");
		let selectedGame:string = workspace.getConfiguration("atlusScriptHelper").get("defaultGame");
		let args = scriptCompilerArgs.get(selectedGame);
		terminal.sendText(`& "${toolsPath}\\AtlusScriptCompiler.exe" "${context.fsPath}" -Decompile -Library ${args.library} -Encoding ${args.encoding} -Hook`, true);
	}
	context.subscriptions.push(commands.registerCommand("flowscript.decompile", decompileFlowscript));

	// Create status bar for choosing games
	const selectGame = () => {
		window.showQuickPick(["SMT3 Nocturne", "SMT Digital Devil Saga", "Persona 3 Portable", "Persona 3", "Persona 3 FES", "Persona 4",
		"Persona 4 Golden", "Persona 5", "Persona 5 Royal", "Persona Q2"], {placeHolder: "Select a compatible game..."})
		.then((selection: string) => {
			workspace.getConfiguration("atlusScriptHelper").update("defaultGame", selection, ConfigurationTarget.Workspace)
		});
		// TODO see if you can fix configurationtarget.WorkspaceFolder breaking (have to just use workspace otherwise)
	}
	
	context.subscriptions.push(commands.registerCommand("flowscript.selectGame", selectGame));
	statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 50);
	statusBarItem.command = "flowscript.selectGame";
	context.subscriptions.push(statusBarItem);
	context.subscriptions.push(window.onDidChangeActiveTextEditor(updateStatusBarItem));
	context.subscriptions.push(workspace.onDidChangeConfiguration(updateStatusBarItem));
	updateStatusBarItem();
}

function updateStatusBarItem(): void { 
	if(window.activeTextEditor.document.languageId == "Flowscript") {
		let selectedGame:string = workspace.getConfiguration("atlusScriptHelper").get("defaultGame");
		statusBarItem.text = selectedGame;
		statusBarItem.show();
	} else {
		statusBarItem.hide();
	}
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}