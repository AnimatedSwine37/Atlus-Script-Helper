/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	Hover,
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';
import { validateImport } from './validation'
import { cursorInFunction, getPositionText, getWord } from './utils';
import { getImportCompletionItems, loadFunctions, loadLibrary, loadMessages, loadSelections } from './imports';
import * as path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
let documentImports: Map<string, string[]> = new Map();


let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true
			},
			"hoverProvider": true
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

interface Settings {
	scriptToolsPath: string;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: Settings = { scriptToolsPath: "" };
let globalSettings: Settings = defaultSettings;

let libraryCompletionItems: CompletionItem[] | null = null;

let functionCompletionItems: Map<string, CompletionItem[]> = new Map();
let messageCompletionItems: Map<string, CompletionItem[]>  = new Map();
let selectionCompletionItems: Map<string, CompletionItem[]> = new Map();

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<Settings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <Settings>(
			(change.settings.atlusScriptHelper || defaultSettings)
		);
	}

	// Revalidate all open text documents and reload library functions in case the path changed
	libraryCompletionItems = null;
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<Settings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'atlusScriptHelper'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

connection.onDidOpenTextDocument((params) => {
	// A text document was opened in VS Code.
	// params.uri uniquely identifies the document. For documents stored on disk, this is a file URI.
	// params.text the initial full content of the document.
	const document = documents.get(params.textDocument.uri);
	if(document != undefined) {
		validateTextDocument(document);
	}
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	let settings = await getDocumentSettings(textDocument.uri);

	if (libraryCompletionItems == null) {
		libraryCompletionItems = loadLibrary(settings.scriptToolsPath);
		if(libraryCompletionItems == null) {
			connection.sendNotification("flowscript/error", "The entered Atlus script tools do not exist. Please change the path in settings.");
		}
	}

	// The validator creates diagnostics for all uppercase words length 2 and more
	let text = textDocument.getText();
	let importPattern = /import\("(.*)"\);/g;
	let match: RegExpExecArray | null;

	let diagnostics: Diagnostic[] = [];
	let imports: string[] = [];
	if (documentImports.get(textDocument.uri) != undefined) {
		let currentImports = documentImports.get(textDocument.uri);
		if (currentImports != undefined) {
			imports = currentImports;
		}
	}
	while ((match = importPattern.exec(text))) {
		let diagnostic = validateImport(textDocument, match, hasDiagnosticRelatedInformationCapability);
		if (diagnostic != null) {
			diagnostics.push(diagnostic);
		} else {
			if(path.extname(match[1]) == ".bf") {
				if (!imports.includes(`${match[1]}.flow`) && !imports.includes(`${match[1]}.msg`)) {
					// Check if the decompiled flowscript and/or messagescript exists
					let flowPath = fileURLToPath(path.dirname(textDocument.uri) + "/" + match[1] + ".flow");
					let msgPath = fileURLToPath(path.dirname(textDocument.uri) + "/" + match[1] + ".msg");
					let decompiled = false;
					if(existsSync(msgPath)) {
						imports.push(`${match[1]}.msg`);
						decompiled = true;
					}
					if (existsSync(flowPath)) {
						imports.push(`${match[1]}.flow`);
						decompiled = true;
					}
					if(!decompiled) {
						connection.sendNotification("flowscript/decompileRequired", fileURLToPath(path.dirname(textDocument.uri) + "/" + match[1]));
					}
				}
			}
			// The import is valid and should be added if it doesn't already exist
			if (!imports.includes(match[1])) {
				imports.push(match[1]);
			}
		}
	}
	// Update the imports for the document
	let currentImports = documentImports.get(textDocument.uri);
	if (currentImports != undefined) {
		currentImports = imports;
	} else {
		imports.push(path.basename(textDocument.uri));
		documentImports.set(textDocument.uri, imports);
	}

	// TODO don't redo the message items every time the document is validated, only when new ones are actually added
	messageCompletionItems = getImportCompletionItems(messageCompletionItems, textDocument.uri, documentImports, loadMessages, ".msg");
	selectionCompletionItems = getImportCompletionItems(selectionCompletionItems, textDocument.uri, documentImports, loadSelections, ".msg");
	functionCompletionItems = getImportCompletionItems(functionCompletionItems, textDocument.uri, documentImports, loadFunctions, ".flow");

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

connection.onHover(({ textDocument, position }): Hover | undefined => {
	const document = documents.get(textDocument.uri);
	if (document != undefined) {
		let { text, index } = getPositionText(document, position);
		const word = getWord(text, index);
		let item = libraryCompletionItems?.find(x => x.label == word);
		if (item != undefined) {
			let value: string = (item.detail + "\n" + item.documentation);
			value = value.replace(/\n/g, "\n\n");
			return {
				contents: {
					kind: "markdown",
					value: value,
				},
			};
		}
		// TODO properly implement hovering (details about variables and whatnot)
		if (word !== '') {
			return {
				contents: {
					kind: 'markdown',
					value: `Current word: **${word}**.`,
				},
			};
		}
	}
	return undefined;
})

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(params: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		let completionItems: CompletionItem[] = [];
		const document = documents.get(params.textDocument.uri);
		if (document != undefined) {
			let { text, index } = getPositionText(document, params.position);
			let currentImports = documentImports.get(params.textDocument.uri);
			if (currentImports != undefined && messageCompletionItems != null && (cursorInFunction(text, index, "MSG") || cursorInFunction(text, index, "HELP_MSG"))) {
				currentImports.forEach(x => {
					let gotItems = messageCompletionItems.get(path.dirname(params.textDocument.uri) + "/" + x);
					if (gotItems != undefined)
						completionItems = completionItems.concat(gotItems)
				});
			}
			else if (currentImports != undefined && selectionCompletionItems != null && (cursorInFunction(text, index, "SEL") || cursorInFunction(text, index, "ADV_SEL"))) {
				currentImports.forEach(x => {
					let gotItems = selectionCompletionItems.get(path.dirname(params.textDocument.uri) + "/" + x);
					if (gotItems != undefined)
						completionItems = completionItems.concat(gotItems)
				});
			}
			else {
				// Library functions
				if (libraryCompletionItems != null)
					completionItems = completionItems.concat(libraryCompletionItems);
				// Imported functions
				if (currentImports != undefined && functionCompletionItems != null) {
					currentImports.forEach(x => {
						let gotItems = functionCompletionItems.get(path.dirname(params.textDocument.uri) + "/" + x);
						if (gotItems != undefined)
							completionItems = completionItems.concat(gotItems)
					});
				}
			}
		}
		return completionItems;
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		return item;
	}
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
