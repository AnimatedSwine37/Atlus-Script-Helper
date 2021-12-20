import { existsSync } from 'fs';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { URI, Utils } from 'vscode-uri';

export function validateImport(textDocument: TextDocument, match: RegExpExecArray, hasDiagnosticRelatedInformationCapability: boolean) : Diagnostic | null{
	// Check if the file is valid (.bf or .msg)
	let extension: String = match[1].substr(match[1].lastIndexOf("."));
	if(!(extension == ".bf" || extension == ".msg")) {
		let diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Error,
			range: {
				start: textDocument.positionAt(match.index),
				end: textDocument.positionAt(match.index + match[0].length)
			},
			message: `The file ${match[1]} does is not valid (must be a .bf or .msg)`,
			source: 'ex'
		};
		return diagnostic;
	}
	let path = Utils.dirname(URI.parse(textDocument.uri)).fsPath + "/" + match[1];
	// Check if the file exists
	if(!existsSync(path)) {
		let diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Error,
			range: {
				start: textDocument.positionAt(match.index),
				end: textDocument.positionAt(match.index + match[0].length)
			},
			message: `The file ${match[1]} does not exist.`,
			source: 'ex'
		};
		if (hasDiagnosticRelatedInformationCapability) {
			diagnostic.relatedInformation = [
				{
					location: {
						uri: textDocument.uri,
						range: Object.assign({}, diagnostic.range)
					},
					message: 'Particularly for names'
				}
			];
		}
		return diagnostic;
	}
	return null;
}