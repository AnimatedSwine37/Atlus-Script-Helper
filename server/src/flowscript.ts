export function getFunctions(text: string): {name:string, parameters:string, documentation:string}[] {
	let pattern = /(?:\/\/(.*)\r\n)?void ([a-zA-z_]+)\((.*)\)/g;
	let match: RegExpExecArray | null;

	let functions: { name: string, parameters: string, documentation: string }[] = [];
	while ((match = pattern.exec(text))) {
		functions.push({name: match[2], parameters: match[3], documentation:match[1] != undefined ? match[1] : "" });
	}
	return functions;
}