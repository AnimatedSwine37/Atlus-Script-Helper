import { readFileSync, existsSync } from 'fs';
import { URL } from 'url';
import { Position, TextDocument } from 'vscode-languageserver-textdocument';

export function getFileText(filePath:string | URL) {
	 if(!existsSync(filePath)) {
	 	return "";
	 }

	let text:string = readFileSync(filePath).toString();
	return text;
}

export function getPositionText(document: TextDocument, position:Position) {
	  const start = {
      line: position.line,
      character: 0,
    };
    const end = {
      line: position.line + 1,
      character: 0,
    };
	const text = document.getText({ start, end });
	const index = document.offsetAt(position) - document.offsetAt(start);
	return {text, index};
}

export function getWord(text: string, index: number) {
	let pattern = /[A-Za-z_0-9]+/g;
	let match: RegExpExecArray | null;
	while (match = pattern.exec(text)) {
		if(match != null) {
			if(index >= text.indexOf(match[0]) && index < text.indexOf(match[0]) + match[0].length) {
				// Check for comments
				let test = text.indexOf("//");
				if(!(text.indexOf("//") >= 0 && index >= text.indexOf("//"))){
					return match[0];
				}
			}
		}
	}
	return "";
}

// Checks whether the current positon is within the brackets of a specified function
export function cursorInFunction(text: string, index: number, functionName: string): Boolean {
	let pattern = RegExp(`${functionName}\((.+)\)`, "g");
	let match: RegExpExecArray | null;
	while (match = pattern.exec(text)) {
		if (match != null) {
			if (index > text.indexOf(match[1]) && index < text.indexOf(match[1]) + match[1].length) {
				// Check for comments
				if (!(text.indexOf("//") >= 0 && index >= text.indexOf("//"))) {
					return true;
				}
			}
		}
	}
	return false;
}