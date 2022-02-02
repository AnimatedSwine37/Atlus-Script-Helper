import { existsSync, readdirSync, readFileSync } from 'fs';
import { fileURLToPath, pathToFileURL, URL } from 'url';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver/node';
import { getFileText } from './utils';
import * as path from 'path';
import { getFunctions } from './flowscript';
import { getMessages, MessageLibraryFunction, Parameter } from './messagescript';

// Load all of the functions from the library jsons
export function loadLibrary(scriptToolsPath: string): CompletionItem[] | null {
	let modulesPath: URL = pathToFileURL(scriptToolsPath + "\\Libraries\\Persona4Golden\\Modules\\");
	let completionItems: CompletionItem[] = loadFlowFunctions(modulesPath);

	completionItems.push(
		{
			label: 'import',
			kind: CompletionItemKind.Function,
			data: 1,
			documentation: "Import statement for a .bf or .msg file relative to the current file.",
			detail: "import(string filePath)",
		}
	)
	return completionItems;
}

function loadFlowFunctions(modulesPath: URL): CompletionItem[] {
	// Get all functions
	let modules: String[] = [];
	let functions: any[] = [];
	if (existsSync(modulesPath)) {
		modules = readdirSync(modulesPath);
	} else {
		return [];
	}
	modules.forEach(module => {
		let jsonPath = pathToFileURL(modulesPath.pathname.substring(1) + module + "/Functions.json");
		if (existsSync(jsonPath)) {
			let moduleFunctions = (JSON.parse(readFileSync(jsonPath).toString()));
			moduleFunctions.forEach((moduleFunction: any) => {
				functions.push(moduleFunction);
			});
		}
	});
	// Convert the functions into the list used in completion items
	let completionItems: CompletionItem[] = [];
	functions.forEach(item => {
		let documentation: string = item.Parameters.map((parameter: any) =>
			parameter.Description != "" ? "\n" + parameter.Name + " - " + parameter.Description : "");
		if (item.Description != "") {
			documentation = documentation != "" ? item.Description + "\n" + documentation : item.Description;
		}
		documentation = documentation.toString().replace(",", "");
		let detail: string = item.Name + `(${item.Parameters.map((parameter: any) => (parameter.Type + " " + parameter.Name))})`;
		detail = detail.replace(",", ", ");
		completionItems.push({
			label: item.Name,
			kind: CompletionItemKind.Function,
			data: item.Name,
			documentation: documentation,
			detail: detail,
		})
	});
	return completionItems;
}

export function loadMessageFunctions(scriptToolsPath: string): CompletionItem[] {
	let messageFunctionsPath: URL = pathToFileURL(scriptToolsPath + "\\Libraries\\Persona4Golden\\MessageScriptLibrary.json");
	let completionItems: CompletionItem[] = [];
	if(!existsSync(messageFunctionsPath)) {
		return completionItems;
	}
	
	let messageFunctions = JSON.parse(readFileSync(messageFunctionsPath).toString());
	messageFunctions.forEach((major: MessageLibraryFunction) => {
		major.Functions?.forEach(((msgFunction: MessageLibraryFunction) => {
			// Skip unused functions
			if(msgFunction.Semantic == "Unused")
				return;
			// Convert message function json into strings for completion item
			let name: string = msgFunction.Name != "" ? msgFunction.Name : `f ${major.Index} ${msgFunction.Index}`;
			let documentationArr: string[] | undefined = msgFunction.Parameters?.map((parameter: Parameter, index: number) =>
				parameter.Description != "" ? `\n${parameter.Name != "" ? parameter.Name : `param${index}`} - ${parameter.Description}` : "");
			let documentation: string = documentationArr != undefined ? documentationArr.toString().replace(/\,/g, "") : "";
			if (msgFunction.Description != "") {
				documentation = documentation != "" ? msgFunction.Description + "\n" + documentation : msgFunction.Description;
			}
			let detail: string = `[${name}${msgFunction.Parameters?.map((parameter: Parameter, index: number) => (" " + (parameter.Name != "" ? parameter.Name : `param${index}`)))}]`;
			detail = detail.replace(",", ", ");
			// Add message function completion item to list
			completionItems.push({
				label: `[${name}]`,
				kind: CompletionItemKind.Function,
				data: name,
				documentation: documentation,
				detail: detail,
			})

		}));
	})
	return completionItems;
}

// TODO remove the imported from ... and allow alt clicking or whatever to go the the function instead
export function loadFunctions(text: string, fileName: string): CompletionItem[] {
	let functions = getFunctions(text);
	return functions.map((x) => {
		return {
			label: x.name,
			kind: CompletionItemKind.Function,
			data: x.name,
			documentation: x.documentation == "" ? x.documentation : `Imported from ${fileName}\n${x.documentation}`,
			detail: x.name + `(${x.parameters})`,
		}
	});
}

export function loadMessages(text: string, fileName: string): CompletionItem[] {
	let messages = getMessages(text);
	return messages.map((x) => {
		return {
			label: x.name,
			kind: CompletionItemKind.Variable,
			data: `${x.name}-${x.isSelection ? "sel" : "msg"}`,
			documentation: `Imported from ${fileName}\n${x.content}`,
		}
	})
	// TODO have filename be hyperlinked to the file
}

export function getImportCompletionItems(completionItems: Map<string, CompletionItem[]>, documentUri: string, documentImports: Map<string, string[]>, loadFunction: Function, fileExtension: string): Map<string, CompletionItem[]> {
	let currentImports = documentImports.get(documentUri);
	if (currentImports != undefined && currentImports.length > 0) {
		let loadedImports = currentImports.filter(x => path.extname(x) == fileExtension);
		if (loadedImports.length > 0) {
			loadedImports.forEach(x => {
				let filePath = fileURLToPath(path.dirname(documentUri) + "/" + x);
				loadFunction(getFileText(filePath), path.basename(path.basename(filePath))).forEach((item: CompletionItem) => {
					let documentCompletionItems = completionItems.get(path.dirname(documentUri) + "/" + x);
					if (documentCompletionItems == undefined) {
						completionItems.set(path.dirname(documentUri) + "/" + x, [item]);
					}
					else if (documentCompletionItems.filter(x => x.data == item.data).length <= 0) {
						documentCompletionItems.push(item);
					}
				});
			});
		}
	}
	return completionItems;
}