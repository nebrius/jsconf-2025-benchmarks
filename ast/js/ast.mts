import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const DIRNAME = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(DIRNAME, "..", "output", "js");
const fileA = readFileSync(join(DIRNAME, "../example/a.tst"), "utf-8");
const fileB = readFileSync(join(DIRNAME, "../example/b.tst"), "utf-8");
const fileC = readFileSync(join(DIRNAME, "../example/c.tst"), "utf-8");

// Token types enum
enum TokenType {
  EOF = 0,
  // Keywords
  VAR = 1,
  IF = 2,
  ELSE = 3,
  WHILE = 4,
  // Separators
  LPAREN = 5,
  RPAREN = 6,
  LBRACE = 7,
  RBRACE = 8,
  SEMICOLON = 9,
  // Operators
  PLUS = 10,
  MINUS = 11,
  MULTIPLY = 12,
  DIVIDE = 13,
  GREATER = 14,
  LESS = 15,
  EQUAL = 16,
  // Literals
  NUMBER = 17,
  STRING = 18,
  // Identifiers
  IDENTIFIER = 19
}

// Node types enum
enum NodeType {
  PROGRAM = 0,
  STATEMENT_BLOCK = 1,
  VARIABLE_STATEMENT = 2,
  IF_STATEMENT = 3,
  WHILE_STATEMENT = 4,
  ASSIGNMENT_STATEMENT = 5,
  CONDITION = 6,
  EXPRESSION = 7
}

const KEYWORDS = ["var", "if", "else", "while"] as const;
type Keyword = (typeof KEYWORDS)[number];

// Direct character classification functions (much faster than regex)
function isAlpha(char: string): boolean {
  const code = char.charCodeAt(0);
  return (code >= 97 && code <= 122) || (code >= 65 && code <= 90) || char === '_';
}

function isDigit(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 48 && code <= 57;
}

// Helper function to get token type from keyword
function getKeywordTokenType(keyword: string): TokenType {
  switch (keyword) {
    case "var": return TokenType.VAR;
    case "if": return TokenType.IF;
    case "else": return TokenType.ELSE;
    case "while": return TokenType.WHILE;
    default: return TokenType.IDENTIFIER;
  }
}

type TokenizeState = "searching" | "string" | "number" | "identifier";
type Token = {
  type: TokenType;
  value: string;
  line: number;
  column: number;
};

function getLocFromIndex(index: number, input: string) {
  let line = 1;
  let column = 1;
  for (let i = 0; i < index; i++) {
    if (input[i] === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}

function tokenize(input: string) {
  let state: TokenizeState = "searching";
  let stateStart = 0;
  let stateStartLine = 1;
  let stateStartColumn = 1;
  let currentLine = 1;
  let currentColumn = 1;
  const tokens: Token[] = [];

  let i = 0;
  while (i < input.length) {
    const char = input[i]!;
    let noDynamicNext = false;
    switch (state) {
      case "searching": {
        stateStart = i;
        if (char === "(") {
          tokens.push({
            type: TokenType.LPAREN,
            value: char,
            line: currentLine,
            column: currentColumn,
          });
          state = "searching";
        } else if (char === ")") {
          tokens.push({
            type: TokenType.RPAREN,
            value: char,
            line: currentLine,
            column: currentColumn,
          });
          state = "searching";
        } else if (char === "{") {
          tokens.push({
            type: TokenType.LBRACE,
            value: char,
            line: currentLine,
            column: currentColumn,
          });
          state = "searching";
        } else if (char === "}") {
          tokens.push({
            type: TokenType.RBRACE,
            value: char,
            line: currentLine,
            column: currentColumn,
          });
          state = "searching";
        } else if (char === ";") {
          tokens.push({
            type: TokenType.SEMICOLON,
            value: char,
            line: currentLine,
            column: currentColumn,
          });
          state = "searching";
        } else if (char === "+" || char === "-" || char === "*" || char === "/" ||
                   char === ">" || char === "<" || char === "=") {
          let tokenType: TokenType;
          switch (char) {
            case "+": tokenType = TokenType.PLUS; break;
            case "-": tokenType = TokenType.MINUS; break;
            case "*": tokenType = TokenType.MULTIPLY; break;
            case "/": tokenType = TokenType.DIVIDE; break;
            case ">": tokenType = TokenType.GREATER; break;
            case "<": tokenType = TokenType.LESS; break;
            case "=": tokenType = TokenType.EQUAL; break;
            default: throw new Error(`Unexpected operator: ${char}`);
          }
          tokens.push({
            type: tokenType,
            value: char,
            line: currentLine,
            column: currentColumn,
          });
          state = "searching";
        } else if (isDigit(char)) {
          if (noDynamicNext) {
            throw new Error(`Unexpected character: ${char}`);
          }
          stateStartLine = currentLine;
          stateStartColumn = currentColumn;
          state = "number";
        } else if (char === '"') {
          if (noDynamicNext) {
            throw new Error(`Unexpected character: ${char}`);
          }
          stateStartLine = currentLine;
          stateStartColumn = currentColumn;
          state = "string";
        } else if (isAlpha(char)) {
          if (noDynamicNext) {
            throw new Error(`Unexpected character: ${char}`);
          }
          stateStartLine = currentLine;
          stateStartColumn = currentColumn;
          state = "identifier";
        } else if (char === " " || char === "\n" || char === "\t") {
          // Do nothing
        } else {
          throw new Error(`Unexpected character: ${char}`);
        }
        noDynamicNext = false;

        // Update position tracking after processing character
        if (char === "\n") {
          currentLine++;
          currentColumn = 1;
        } else {
          currentColumn++;
        }
        i++;
        break;
      }
      case "identifier": {
        if (!isAlpha(char)) {
          const tokenValue = input.slice(stateStart, i);
          const tokenType = KEYWORDS.includes(tokenValue as Keyword)
            ? getKeywordTokenType(tokenValue)
            : TokenType.IDENTIFIER;

          tokens.push({
            type: tokenType,
            value: tokenValue,
            line: stateStartLine,
            column: stateStartColumn,
          });
          noDynamicNext = true;
          state = "searching";
        } else {
          i++;
        }
        break;
      }
      case "string": {
        if (char === '"') {
          tokens.push({
            type: TokenType.STRING,
            value: input.slice(stateStart, i),
            line: stateStartLine,
            column: stateStartColumn,
          });
          noDynamicNext = true;
          state = "searching";
        }
        i++;
        break;
      }
      case "number": {
        if (!isDigit(char)) {
          tokens.push({
            type: TokenType.NUMBER,
            value: input.slice(stateStart, i),
            line: stateStartLine,
            column: stateStartColumn,
          });
          noDynamicNext = true;
          state = "searching";
        } else {
          i++;
        }
        break;
      }
    }
  }

  // Add EOF token
  tokens.push({
    type: TokenType.EOF,
    value: "",
    line: currentLine,
    column: currentColumn,
  });

  return tokens;
}

// AST Types
type ASTNode = {
  type: NodeType;
  data: any;
};

// Parser state
let tokens: Token[];
let currentTokenIndex = 0;
let currentToken: Token;

function getTokenType(token: Token, tokenType: TokenType) {
  return token.type === tokenType;
}

function peek(tokenType: TokenType) {
  return getTokenType(currentToken, tokenType);
}

function accept(tokenType: TokenType) {
  if (peek(tokenType)) {
    currentTokenIndex++;
    currentToken = tokens[currentTokenIndex]!;
    return true;
  }
  return false;
}

function expect(tokenType: TokenType) {
  if (!accept(tokenType)) {
    throw new Error(
      `${currentToken.line}:${currentToken.column}: unexpected symbol ${currentToken.type}`
    );
  }
}

function parse(tokenArray: Token[]): ASTNode {
  tokens = tokenArray;
  currentTokenIndex = 0;
  currentToken = tokens[0]!;

  function parseExpression(): ASTNode {
    const leftToken = currentToken;

    if (accept(TokenType.NUMBER) || accept(TokenType.STRING) || accept(TokenType.IDENTIFIER)) {
      if (accept(TokenType.PLUS)) {
        const rightNode = parseExpression();
        return {
          type: NodeType.EXPRESSION,
          data: {
            leftToken: leftToken,
            operator: "+",
            right: rightNode,
          },
        };
      } else if (accept(TokenType.MINUS)) {
        const rightNode = parseExpression();
        return {
          type: NodeType.EXPRESSION,
          data: {
            leftToken: leftToken,
            operator: "-",
            right: rightNode,
          },
        };
      } else if (accept(TokenType.MULTIPLY)) {
        const rightNode = parseExpression();
        return {
          type: NodeType.EXPRESSION,
          data: {
            leftToken: leftToken,
            operator: "*",
            right: rightNode,
          },
        };
      } else if (accept(TokenType.DIVIDE)) {
        const rightNode = parseExpression();
        return {
          type: NodeType.EXPRESSION,
          data: {
            leftToken: leftToken,
            operator: "/",
            right: rightNode,
          },
        };
      } else {
        return {
          type: NodeType.EXPRESSION,
          data: {
            leftToken: leftToken,
            operator: null,
            right: null
          }
        };
      }
    } else {
      throw new Error(
        `expression (${currentToken.line}:${currentToken.column}): unexpected symbol ${currentToken.type}`
      );
    }
  }

  function parseCondition(): ASTNode {
    const leftNode = parseExpression();

    if (accept(TokenType.GREATER)) {
      return {
        type: NodeType.CONDITION,
        data: {
          left: leftNode,
          operator: ">",
          right: parseExpression(),
        },
      };
    } else if (accept(TokenType.LESS)) {
      return {
        type: NodeType.CONDITION,
        data: {
          left: leftNode,
          operator: "<",
          right: parseExpression(),
        },
      };
    } else if (accept(TokenType.EQUAL)) {
      return {
        type: NodeType.CONDITION,
        data: {
          left: leftNode,
          operator: "=",
          right: parseExpression(),
        },
      };
    } else {
      throw new Error(
        `condition (${currentToken.line}:${currentToken.column}): unexpected symbol ${currentToken.type}`
      );
    }
  }

  function parseStatement(): ASTNode {
    if (accept(TokenType.VAR)) {
      const identifier = currentToken.value;
      expect(TokenType.IDENTIFIER);
      return {
        type: NodeType.VARIABLE_STATEMENT,
        data: {
          identifier: identifier,
        },
      };
    } else if (accept(TokenType.IF)) {
      expect(TokenType.LPAREN);
      const conditionNode = parseCondition();
      expect(TokenType.RPAREN);
      expect(TokenType.LBRACE);
      const blockNode = parseStatementBlock();
      expect(TokenType.RBRACE);

      let elseBlockNode: ASTNode | null = null;
      if (accept(TokenType.ELSE)) {
        expect(TokenType.LBRACE);
        elseBlockNode = parseStatementBlock();
        expect(TokenType.RBRACE);
      }

      return {
        type: NodeType.IF_STATEMENT,
        data: {
          condition: conditionNode,
          block: blockNode,
          elseBlock: elseBlockNode,
        },
      };
    } else if (accept(TokenType.WHILE)) {
      expect(TokenType.LPAREN);
      const conditionNode = parseCondition();
      expect(TokenType.RPAREN);
      expect(TokenType.LBRACE);
      const blockNode = parseStatementBlock();
      expect(TokenType.RBRACE);

      return {
        type: NodeType.WHILE_STATEMENT,
        data: {
          condition: conditionNode,
          block: blockNode,
        },
      };
    } else if (peek(TokenType.IDENTIFIER)) {
      const identifier = currentToken.value;
      accept(TokenType.IDENTIFIER);
      expect(TokenType.EQUAL);
      const valueNode = parseExpression();

      return {
        type: NodeType.ASSIGNMENT_STATEMENT,
        data: {
          identifier: identifier,
          value: valueNode,
        },
      };
    } else {
      throw new Error(
        `statement (${currentToken.line}:${currentToken.column}): unexpected symbol ${currentToken.type}`
      );
    }
  }

  function parseStatementBlock(): ASTNode {
    const statements: ASTNode[] = [];

    do {
      statements.push(parseStatement());
    } while (accept(TokenType.SEMICOLON));

    return {
      type: NodeType.STATEMENT_BLOCK,
      data: {
        statements: statements,
      },
    };
  }

  function parseProgram(): ASTNode {
    const block = parseStatementBlock();

    if (currentToken.type !== TokenType.EOF) {
      throw new Error(
        `program (${currentToken.line}:${currentToken.column}): unexpected symbol ${currentToken.type}`
      );
    }

    return {
      type: NodeType.PROGRAM,
      data: {
        block: block,
      },
    };
  }

  return parseProgram();
}

let parseTotal = 0;
let marshalTotal = 0;
let iteration = 0;

function parseFile(fileContents: string, outputFilename: string) {
  const start = performance.now();
  const tokens = tokenize(fileContents);
  const ast = parse(tokens);
  const endParse = performance.now();
  const astJson = JSON.stringify(ast, null, '  ');
  const end = performance.now();
  writeFileSync(join(OUTPUT_DIR, outputFilename), astJson);
  const durationParse = endParse - start;
  const durationMarshal = end - endParse;
  parseTotal += durationParse;
  marshalTotal += durationMarshal;
  iteration++;
}

mkdirSync(OUTPUT_DIR, { recursive: true });
parseFile(fileA, "a.json");
parseFile(fileB, "b.json");
parseFile(fileC, "c.json");

const results = {
  parse: parseTotal,
  marshal: marshalTotal,
};
console.log(JSON.stringify(results, null, '  '));