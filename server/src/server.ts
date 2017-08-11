'use strict';

import {
	IPCMessageReader, IPCMessageWriter,
	createConnection, IConnection, TextDocumentSyncKind,
	TextDocuments, TextDocument, Diagnostic, DiagnosticSeverity,
	InitializeParams, InitializeResult, TextDocumentPositionParams,
	CompletionItem, CompletionItemKind, Position, Range, Location,
	Definition
} from 'vscode-languageserver';

// import * as fs from 'fs';

// Create a connection for the server. The connection uses Node's IPC as a transport
let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// After the server has started the client sends an initialize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilities. 
let workspaceRoot: string;
connection.onInitialize((params): InitializeResult => {
	workspaceRoot = params.rootPath;
	return {
		capabilities: {
			// Tell the client that the server works in FULL text document sync mode
			textDocumentSync: documents.syncKind,
			// Tell the client that the server support code complete
			completionProvider: {
				resolveProvider: true,
			},
			definitionProvider : true
		}
	}
});

// The settings interface describe the server relevant settings part
interface Settings {
	languageServerExample: ExampleSettings;
}

// These are the example settings we defined in the client's package.json
// file
interface ExampleSettings {
	maxNumberOfProblems: number;
}

//TODO: Traverse included files also
// let included = fs.readFileSync('Functions.asp').toString();

connection.onDefinition((textDocumentPositionParams: TextDocumentPositionParams): Definition => {

	let docHelper = new DocumentHelper(documents.get(textDocumentPositionParams.textDocument.uri));
	let wordToFindDefinition = docHelper.getWordAtPosition(textDocumentPositionParams.position);
	
	// Underline word for debugging purposes
	// underlineWord(wordToFindDefinition)
	
	let definition = docHelper.getDefinition(wordToFindDefinition);
	return definition;
});

// Listen on the connection
connection.listen();


function underlineWord(word: Word){
	let diagnostics: Diagnostic[] = [];
	diagnostics.push({
		severity: DiagnosticSeverity.Warning,
		range: word.location.range,
		message: `Start: ${word.location.range.start} | End: ${word.location.range.end}`,
		source: 'ex'
	});
	connection.sendDiagnostics({ uri: word.location.uri, diagnostics });
}


class DocumentHelper {
	private _textDocument: TextDocument;
	private _text: string;

	constructor(textDocument: TextDocument) {
		this._textDocument = textDocument
		this._text = textDocument.getText().toLowerCase();
	}

	public getWordAtPosition(position: Position, separatorIn?: RegExp): Word {
		// Find start, add 1 because of zerobased characteristic 
		let start = this._getLimit(position, /\n|\W/, n => n - 1);
		start.character += 1;

		// Find End
		let end = this._getLimit(position, /\n|\W/, n => n + 1);
		
		let location = Location.create(this._textDocument.uri, Range.create(start, end));
		let text = this._text.substring(this._textDocument.offsetAt(start), this._textDocument.offsetAt(end))

		return new Word(location, text);
	}

	public getDefinition(word: Word): Location {
		
		let declarationTypes = ['function', 'sub', 'class', 'property get', 'property set', 'dim', 'private', 'public'];

		let definition = null;
		let type = '';
		let foundMatch = false;
		let iterator = 0;
		while(!foundMatch && iterator < declarationTypes.length){
			type = declarationTypes[iterator]; 

			let declaration = `${type} ${word.text}`;
			
			definition = this._text.search(new RegExp(`\\b${declaration}\\b`));

			if(definition >= 0)
				foundMatch = true;				

			iterator++;
		}

		// Skip over declaration type and start definition at word we are looking for
		definition += type.length + 1;

		return foundMatch ? Location.create(this._textDocument.uri, 
			Range.create(
				this._textDocument.positionAt(definition),
				this._textDocument.positionAt(definition + word.text.length)
			)
		) : null;
	}

	public search(regex: RegExp): number{
		return this._text.search(regex);
	}

	private _getCharacterAt(position: Position): string{
		return this._text[this._textDocument.offsetAt(position)];
	}

	private _getLimit(position: Position, regex: RegExp, incrementer: (n: number) => number): Position {
		
		let curPosition = Position.create(position.line, position.character);
		
		while(!regex.test(this._getCharacterAt(curPosition))){
			curPosition.character = incrementer(curPosition.character);
		}

		return curPosition;
	}

}

class Word {
	constructor(public location: Location, public text: string) {
	}

}