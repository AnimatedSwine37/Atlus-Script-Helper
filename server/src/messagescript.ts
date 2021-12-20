class Message {
	name: string;
	content: string;

	constructor(name:string, content:string) {
		this.name = name;
		this.content = content;
	}
}

export function getMessages(text: string): Message[]  {
	if(text == undefined) {
		return [];
	}
	// Find all messages in the file
	let messagePattern = /\[msg ([A-Za-z0-9_ ']+)(?: \[([A-Za-z0-9_ ']+)\])?(?:top)?\]/g;
	let match: RegExpExecArray | null;
	let messages: Message[] = [];
	let lastIndex = 0;
	
	while ((match = messagePattern.exec(text))) {
		if(lastIndex > 0) {
			messages[messages.length-1].content = text.substring(lastIndex, match.index);
		}
		messages.push(new Message(match[1], ""));
		lastIndex = match.index + match[0].length;
	}
	return messages;
}

export function getSelections(text:string):{name:string, options:string[]}[] {
	// TODO convert message variables colours, etc. found to human readable versions
	if(text == undefined) {
		return [];
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