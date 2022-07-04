# Atlus Script Helper
A WIP VS Code extension that adds support for the flowscript and messagescript languages used in Atlus games.

## Current Features
- Compile flows and decompile bfs by right-clicking on them and using the new context menu options.
- Autocomplete and hover suggestions for:
	- flowscript and messagescript functions based off the json files in the AtlusScriptCompiler library folders. This includes function arguments and any documentation specified in these json files.
	- messages and selections when typing inside the brackets of a MSG or SEL function (this may not work for all type of message or selection function currently)
	- functions from imported bfs and flows
- Works with any game by changing the option to the left of the vscode status bar.
	- This currently only works if you have a workspace open (File -> Open Folder) if you have just a file open pressing it won't actually change the game that it's using.
	- You can also change the default game in the extension's configuration (search for Atlus in vscode settings and you'll find it).
- Syntax highlighting. This is essentially the same as what you'd get if you set the language to C or C++ however, some features like autoclosing brackets don't work currently
- Validate imports, this is currently the only kind of actual error detection. 

## Planned Features
- Flowscript validation with errors and warnings like you'd have with other languages
- Integration with Aemulus, allowing for quick building of loadouts and launching of games (possibly by automatically configured vscode tasks)
- More stuff probably, basically anything you'd expect from a language extension