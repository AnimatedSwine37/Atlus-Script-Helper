
export function getMessages(text:string):string[] {
	if(text == undefined) {
		[];
	}
	// Find all messages in the file
	let messagePattern = /\[msg ([A-Za-z0-9_]+)(?: \[([A-Za-z0-9_ ]+)\])?\]/g;
	let match: RegExpExecArray | null;

	let messages: string[] = [];
	while ((match = messagePattern.exec(text))) {
		messages.push(match[1]);
	}
	return messages;
}

export function getSelections(text:string):{name:string, options:string[]}[] {
	// TODO convert message variables colours, etc. found to human readable versions
	if(text == undefined) {
		[];
	}
	// Find all selections in the file
	let selectionPattern = /\[sel ([A-Za-z0-9_]+)(?: \[([A-Za-z0-9_ ]+)\])?\](?:\s+\[f 0 5 -258\]\[f 2 1\](.*)\[e\])+/g;
	let optionsPattern = /\[f 0 5 -258\]\[f 2 1\](.*)\[e\]/g;
	let match: RegExpExecArray | null;
	
	let selections: {name:string, options:string[]}[] = [];
	while ((match = selectionPattern.exec(text))) {
		let name = match[1];
		let optionsMatch: RegExpExecArray | null;
		let options:string[] = [];
		while ((optionsMatch = optionsPattern.exec(match[0]))) {
			options.push(optionsMatch[1]);
		}
		selections.push({name, options})
	}
	return selections;
}