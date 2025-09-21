package main

import (
	"encoding/json"
	"fmt"
	"syscall/js"
)

// TokenType represents the type of a token
type TokenType int

const (
	TokenEOF TokenType = iota
	// Keywords
	TokenVar
	TokenIf
	TokenElse
	TokenWhile
	// Separators
	TokenLParen
	TokenRParen
	TokenLBrace
	TokenRBrace
	TokenSemicolon
	// Operators
	TokenPlus
	TokenMinus
	TokenMultiply
	TokenDivide
	TokenGreater
	TokenLess
	TokenEqual
	// Literals
	TokenNumber
	TokenString
	// Identifiers
	TokenIdentifier
)

// Token represents a single token
type Token struct {
	Type   TokenType `json:"type"`
	Value  string    `json:"value"`
	Line   int       `json:"line"`
	Column int       `json:"column"`
}

// TokenizeState represents the state of the tokenizer
type TokenizeState int

const (
	StateSearching TokenizeState = iota
	StateString
	StateNumber
	StateIdentifier
)

// NodeType represents the type of an AST node
type NodeType int

const (
	NodeProgram NodeType = iota
	NodeStatementBlock
	NodeVariableStatement
	NodeIfStatement
	NodeWhileStatement
	NodeAssignmentStatement
	NodeCondition
	NodeExpression
)

// ASTNode represents a node in the abstract syntax tree
type ASTNode struct {
	Type NodeType    `json:"type"`
	Data interface{} `json:"data"`
}

// Specific node data structures
type ProgramData struct {
	Block *ASTNode `json:"block"`
}

type StatementBlockData struct {
	Statements []*ASTNode `json:"statements"`
}

type VariableStatementData struct {
	Identifier string `json:"identifier"`
}

type IfStatementData struct {
	Condition *ASTNode `json:"condition"`
	Block     *ASTNode `json:"block"`
	ElseBlock *ASTNode `json:"elseBlock"`
}

type WhileStatementData struct {
	Condition *ASTNode `json:"condition"`
	Block     *ASTNode `json:"block"`
}

type AssignmentStatementData struct {
	Identifier string   `json:"identifier"`
	Value      *ASTNode `json:"value"`
}

type ConditionData struct {
	Left     *ASTNode `json:"left"`
	Operator string   `json:"operator"`
	Right    *ASTNode `json:"right"`
}

type ExpressionData struct {
	LeftToken *Token   `json:"leftToken"`
	Operator  string   `json:"operator"`
	Right     *ASTNode `json:"right"`
}

// Parser represents parser state
type Parser struct {
	tokens            []Token
	currentTokenIndex int
	currentToken      *Token
}

// Character checking functions using direct comparisons (much faster than regex)
func isAlpha(char rune) bool {
	return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char == '_'
}

func isDigit(char rune) bool {
	return char >= '0' && char <= '9'
}

func isWhitespace(char rune) bool {
	return char == ' ' || char == '\n' || char == '\t'
}

// isKeyword checks if a string is a keyword
func isKeyword(s string) TokenType {
	switch s {
	case "var":
		return TokenVar
	case "if":
		return TokenIf
	case "else":
		return TokenElse
	case "while":
		return TokenWhile
	default:
		return TokenIdentifier
	}
}

// tokenize converts input string into tokens
func tokenize(input string) []Token {
	var tokens []Token
	state := StateSearching
	stateStart := 0
	stateStartLine, stateStartColumn := 1, 1
	currentLine, currentColumn := 1, 1
	i := 0

	for i < len(input) {
		char := rune(input[i])
		noDynamicNext := false

		switch state {
		case StateSearching:
			stateStart = i
			if char == '"' {
				stateStartLine = currentLine
				stateStartColumn = currentColumn
				if noDynamicNext {
					panic(fmt.Sprintf("Unexpected character: %c", char))
				}
				state = StateString
			} else if char == '(' || char == ')' || char == ';' || char == '{' || char == '}' {
				var tokenType TokenType
				switch char {
				case '(':
					tokenType = TokenLParen
				case ')':
					tokenType = TokenRParen
				case ';':
					tokenType = TokenSemicolon
				case '{':
					tokenType = TokenLBrace
				case '}':
					tokenType = TokenRBrace
				}
				tokens = append(tokens, Token{
					Type:   tokenType,
					Value:  string(char),
					Line:   currentLine,
					Column: currentColumn,
				})
				state = StateSearching
			} else if char == '+' || char == '-' || char == '*' || char == '/' ||
				char == '>' || char == '<' || char == '=' {
				var tokenType TokenType
				switch char {
				case '+':
					tokenType = TokenPlus
				case '-':
					tokenType = TokenMinus
				case '*':
					tokenType = TokenMultiply
				case '/':
					tokenType = TokenDivide
				case '>':
					tokenType = TokenGreater
				case '<':
					tokenType = TokenLess
				case '=':
					tokenType = TokenEqual
				}
				tokens = append(tokens, Token{
					Type:   tokenType,
					Value:  string(char),
					Line:   currentLine,
					Column: currentColumn,
				})
				state = StateSearching
			} else if isDigit(char) {
				if noDynamicNext {
					panic(fmt.Sprintf("Unexpected character: %c", char))
				}
				stateStartLine = currentLine
				stateStartColumn = currentColumn
				state = StateNumber
			} else if isAlpha(char) {
				if noDynamicNext {
					panic(fmt.Sprintf("Unexpected character: %c", char))
				}
				stateStartLine = currentLine
				stateStartColumn = currentColumn
				state = StateIdentifier
			} else if isWhitespace(char) {
				// Do nothing
			} else {
				panic(fmt.Sprintf("Unexpected character: %c", char))
			}
			noDynamicNext = false

			// Update position tracking after processing character
			if char == '\n' {
				currentLine++
				currentColumn = 1
			} else {
				currentColumn++
			}
			i++

		case StateIdentifier:
			if !isAlpha(char) {
				tokenValue := input[stateStart:i]
				tokenType := isKeyword(tokenValue)
				tokens = append(tokens, Token{
					Type:   tokenType,
					Value:  tokenValue,
					Line:   stateStartLine,
					Column: stateStartColumn,
				})
				noDynamicNext = true
				state = StateSearching
			} else {
				i++
			}

		case StateString:
			if char == '"' {
				tokenValue := input[stateStart:i]
				tokens = append(tokens, Token{
					Type:   TokenString,
					Value:  tokenValue,
					Line:   stateStartLine,
					Column: stateStartColumn,
				})
				noDynamicNext = true
				state = StateSearching
			}
			i++

		case StateNumber:
			if !isDigit(char) {
				tokenValue := input[stateStart:i]
				tokens = append(tokens, Token{
					Type:   TokenNumber,
					Value:  tokenValue,
					Line:   stateStartLine,
					Column: stateStartColumn,
				})
				noDynamicNext = true
				state = StateSearching
			} else {
				i++
			}
		}
	}

	// Add EOF token
	tokens = append(tokens, Token{
		Type:   TokenEOF,
		Value:  "EOF",
		Line:   currentLine,
		Column: currentColumn,
	})

	return tokens
}

// Parser methods
func (p *Parser) nextToken() {
	p.currentTokenIndex++
	if p.currentTokenIndex >= len(p.tokens) {
		panic("Unexpected end of input")
	}
	p.currentToken = &p.tokens[p.currentTokenIndex]
}

func (p *Parser) accept(tokenType TokenType) bool {
	if p.currentToken.Type == tokenType {
		p.nextToken()
		return true
	}
	return false
}

func (p *Parser) peek(tokenType TokenType) bool {
	return p.currentToken.Type == tokenType
}

func (p *Parser) expect(tokenType TokenType) {
	if !p.accept(tokenType) {
		panic(fmt.Sprintf("expect (%d:%d): unexpected symbol %d",
			p.currentToken.Line, p.currentToken.Column, p.currentToken.Type))
	}
}

func (p *Parser) parseExpression() *ASTNode {
	leftToken := *p.currentToken

	if p.accept(TokenNumber) || p.accept(TokenString) || p.accept(TokenIdentifier) {
		node := &ASTNode{
			Type: NodeExpression,
			Data: &ExpressionData{
				LeftToken: &leftToken,
				Operator:  "",
				Right:     nil,
			},
		}

		data := node.Data.(*ExpressionData)
		if p.accept(TokenPlus) {
			data.Operator = "+"
			data.Right = p.parseExpression()
		} else if p.accept(TokenMinus) {
			data.Operator = "-"
			data.Right = p.parseExpression()
		} else if p.accept(TokenMultiply) {
			data.Operator = "*"
			data.Right = p.parseExpression()
		} else if p.accept(TokenDivide) {
			data.Operator = "/"
			data.Right = p.parseExpression()
		}

		return node
	} else {
		panic(fmt.Sprintf("expression (%d:%d): unexpected symbol %d",
			p.currentToken.Line, p.currentToken.Column, p.currentToken.Type))
	}
}

func (p *Parser) parseCondition() *ASTNode {
	leftNode := p.parseExpression()
	node := &ASTNode{
		Type: NodeCondition,
		Data: &ConditionData{
			Left:     leftNode,
			Operator: "",
			Right:    nil,
		},
	}

	data := node.Data.(*ConditionData)
	if p.accept(TokenGreater) {
		data.Operator = ">"
		data.Right = p.parseExpression()
	} else if p.accept(TokenLess) {
		data.Operator = "<"
		data.Right = p.parseExpression()
	} else if p.accept(TokenEqual) {
		data.Operator = "="
		data.Right = p.parseExpression()
	} else {
		panic(fmt.Sprintf("condition (%d:%d): unexpected symbol %d",
			p.currentToken.Line, p.currentToken.Column, p.currentToken.Type))
	}

	return node
}

func (p *Parser) parseStatement() *ASTNode {
	if p.accept(TokenVar) {
		identifier := p.currentToken.Value
		p.expect(TokenIdentifier)
		return &ASTNode{
			Type: NodeVariableStatement,
			Data: &VariableStatementData{
				Identifier: identifier,
			},
		}
	} else if p.accept(TokenIf) {
		p.expect(TokenLParen)
		conditionNode := p.parseCondition()
		p.expect(TokenRParen)
		p.expect(TokenLBrace)
		blockNode := p.parseStatementBlock()
		p.expect(TokenRBrace)

		var elseBlockNode *ASTNode
		if p.accept(TokenElse) {
			p.expect(TokenLBrace)
			elseBlockNode = p.parseStatementBlock()
			p.expect(TokenRBrace)
		}

		return &ASTNode{
			Type: NodeIfStatement,
			Data: &IfStatementData{
				Condition: conditionNode,
				Block:     blockNode,
				ElseBlock: elseBlockNode,
			},
		}
	} else if p.accept(TokenWhile) {
		p.expect(TokenLParen)
		conditionNode := p.parseCondition()
		p.expect(TokenRParen)
		p.expect(TokenLBrace)
		blockNode := p.parseStatementBlock()
		p.expect(TokenRBrace)

		return &ASTNode{
			Type: NodeWhileStatement,
			Data: &WhileStatementData{
				Condition: conditionNode,
				Block:     blockNode,
			},
		}
	} else if p.peek(TokenIdentifier) {
		identifier := p.currentToken.Value
		p.accept(TokenIdentifier)
		p.expect(TokenEqual)
		expressionNode := p.parseExpression()

		return &ASTNode{
			Type: NodeAssignmentStatement,
			Data: &AssignmentStatementData{
				Identifier: identifier,
				Value:      expressionNode,
			},
		}
	} else {
		panic(fmt.Sprintf("statement (%d:%d): unexpected symbol %d",
			p.currentToken.Line, p.currentToken.Column, p.currentToken.Type))
	}
}

func (p *Parser) parseStatementBlock() *ASTNode {
	var statements []*ASTNode

	for {
		statements = append(statements, p.parseStatement())
		if !p.accept(TokenSemicolon) {
			break
		}
	}

	return &ASTNode{
		Type: NodeStatementBlock,
		Data: &StatementBlockData{
			Statements: statements,
		},
	}
}

func (p *Parser) parseProgram() *ASTNode {
	block := p.parseStatementBlock()

	if p.currentToken.Type != TokenEOF {
		panic(fmt.Sprintf("program (%d:%d): unexpected symbol %d",
			p.currentToken.Line, p.currentToken.Column, p.currentToken.Type))
	}

	return &ASTNode{
		Type: NodeProgram,
		Data: &ProgramData{
			Block: block,
		},
	}
}

// parse creates an AST from tokens
func parse(tokens []Token) *ASTNode {
	parser := &Parser{
		tokens:            tokens,
		currentTokenIndex: 0,
		currentToken:      &tokens[0],
	}

	return parser.parseProgram()
}

// generateAst is the WASM export function that combines tokenize and parse
func generateAst(this js.Value, args []js.Value) interface{} {
	if len(args) < 1 {
		return js.ValueOf("Error: missing input argument")
	}

	input := args[0].String()

	// Tokenize
	tokens := tokenize(input)

	// Parse
	ast := parse(tokens)

	// Serialize to JSON
	jsonBytes, err := json.Marshal(ast)
	if err != nil {
		return js.ValueOf(fmt.Sprintf("Error: %v", err))
	}

	return js.ValueOf(string(jsonBytes))
}

func main() {
	// Register the generateAst function for WASM
	js.Global().Set("generateAst", js.FuncOf(generateAst))

	// Keep the program running
	select {}
}
