class Message {
	name: string;
	content: string;
	isSelection: boolean;

	constructor(name:string, content:string, isSelection: boolean) {
		this.name = name;
		this.content = content;
		this.isSelection = isSelection;
	}
}

export function getMessages(text: string): Message[]  {
	if(text == undefined) {
		return [];
	}
	// Find all messages in the file
	let messagePattern = /\[(msg|sel) ([A-Za-z0-9_ ']+)(?: \[([A-Za-z0-9_ ']+)\])?(?:\s*top)?\]/g;
	let match: RegExpExecArray | null;
	let messages: Message[] = [];
	let lastIndex = 0;

	while ((match = messagePattern.exec(text))) {
		if(lastIndex > 0) {
			messages[messages.length-1].content = text.substring(lastIndex, match.index);
		}
		messages.push(new Message(match[2], "", match[1] == "sel"));
		lastIndex = match.index + match[0].length;
	}
	if(messages.length > 0)
		messages[messages.length - 1].content = text.substring(lastIndex);

	return messages;
}