use serde::{Deserialize, Serialize};
use std::fs;
use std::time::Instant;

// Token types enum
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[repr(u8)]
#[serde(into = "u8", from = "u8")]
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
    IDENTIFIER = 19,
}

impl From<TokenType> for u8 {
    fn from(token_type: TokenType) -> u8 {
        token_type as u8
    }
}

impl From<u8> for TokenType {
    fn from(value: u8) -> TokenType {
        match value {
            0 => TokenType::EOF,
            1 => TokenType::VAR,
            2 => TokenType::IF,
            3 => TokenType::ELSE,
            4 => TokenType::WHILE,
            5 => TokenType::LPAREN,
            6 => TokenType::RPAREN,
            7 => TokenType::LBRACE,
            8 => TokenType::RBRACE,
            9 => TokenType::SEMICOLON,
            10 => TokenType::PLUS,
            11 => TokenType::MINUS,
            12 => TokenType::MULTIPLY,
            13 => TokenType::DIVIDE,
            14 => TokenType::GREATER,
            15 => TokenType::LESS,
            16 => TokenType::EQUAL,
            17 => TokenType::NUMBER,
            18 => TokenType::STRING,
            19 => TokenType::IDENTIFIER,
            _ => panic!("Invalid TokenType value: {}", value),
        }
    }
}

// Node types enum
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[repr(u8)]
#[serde(into = "u8", from = "u8")]
#[allow(non_camel_case_types)]
enum NodeType {
    PROGRAM = 0,
    STATEMENT_BLOCK = 1,
    VARIABLE_STATEMENT = 2,
    IF_STATEMENT = 3,
    WHILE_STATEMENT = 4,
    ASSIGNMENT_STATEMENT = 5,
    CONDITION = 6,
    EXPRESSION = 7,
}

impl From<NodeType> for u8 {
    fn from(node_type: NodeType) -> u8 {
        node_type as u8
    }
}

impl From<u8> for NodeType {
    fn from(value: u8) -> NodeType {
        match value {
            0 => NodeType::PROGRAM,
            1 => NodeType::STATEMENT_BLOCK,
            2 => NodeType::VARIABLE_STATEMENT,
            3 => NodeType::IF_STATEMENT,
            4 => NodeType::WHILE_STATEMENT,
            5 => NodeType::ASSIGNMENT_STATEMENT,
            6 => NodeType::CONDITION,
            7 => NodeType::EXPRESSION,
            _ => panic!("Invalid NodeType value: {}", value),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Token {
    r#type: TokenType,
    value: String,
    line: usize,
    column: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ASTNode {
    r#type: NodeType,
    data: ASTNodeData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
enum ASTNodeData {
    Program(ProgramData),
    StatementBlock(StatementBlockData),
    VariableStatement(VariableStatementData),
    IfStatement(IfStatementData),
    WhileStatement(WhileStatementData),
    AssignmentStatement(AssignmentStatementData),
    Condition(ConditionData),
    Expression(ExpressionData),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ProgramData {
    block: Box<ASTNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StatementBlockData {
    statements: Vec<ASTNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct VariableStatementData {
    identifier: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct IfStatementData {
    condition: Box<ASTNode>,
    block: Box<ASTNode>,
    #[serde(rename = "elseBlock")]
    else_block: Option<Box<ASTNode>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WhileStatementData {
    condition: Box<ASTNode>,
    block: Box<ASTNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AssignmentStatementData {
    identifier: String,
    value: Box<ASTNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ConditionData {
    left: Box<ASTNode>,
    operator: String,
    right: Box<ASTNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ExpressionData {
    #[serde(rename = "leftToken")]
    left_token: Token,
    operator: Option<String>,
    right: Option<Box<ASTNode>>,
}

// Config struct removed - no longer using config.json

const KEYWORDS: &[&str] = &["var", "if", "else", "while"];

fn get_keyword_token_type(keyword: &str) -> TokenType {
    match keyword {
        "var" => TokenType::VAR,
        "if" => TokenType::IF,
        "else" => TokenType::ELSE,
        "while" => TokenType::WHILE,
        _ => TokenType::IDENTIFIER,
    }
}

fn get_loc_from_index(index: usize, input: &str) -> (usize, usize) {
    let mut line = 1;
    let mut column = 1;
    for (i, ch) in input.char_indices() {
        if i >= index {
            break;
        }
        if ch == '\n' {
            line += 1;
            column = 1;
        } else {
            column += 1;
        }
    }
    (line, column)
}

#[derive(Debug)]
enum TokenizeState {
    Searching,
    String,
    Number,
    Identifier,
}

fn tokenize(input: &str) -> Vec<Token> {
    let mut state = TokenizeState::Searching;
    let mut state_start = 0;
    let mut state_start_line = 1;
    let mut state_start_column = 1;
    let mut current_line = 1;
    let mut current_column = 1;
    let mut tokens = Vec::new();
    let chars: Vec<char> = input.chars().collect();

    let mut i = 0;
    while i < chars.len() {
        let ch = chars[i];
        let mut no_dynamic_next = false;

        match state {
            TokenizeState::Searching => {
                state_start = i;
                match ch {
                    '(' => {
                        tokens.push(Token {
                            r#type: TokenType::LPAREN,
                            value: ch.to_string(),
                            line: current_line,
                            column: current_column,
                        });
                        state = TokenizeState::Searching;
                    }
                    ')' => {
                        tokens.push(Token {
                            r#type: TokenType::RPAREN,
                            value: ch.to_string(),
                            line: current_line,
                            column: current_column,
                        });
                        state = TokenizeState::Searching;
                    }
                    '{' => {
                        tokens.push(Token {
                            r#type: TokenType::LBRACE,
                            value: ch.to_string(),
                            line: current_line,
                            column: current_column,
                        });
                        state = TokenizeState::Searching;
                    }
                    '}' => {
                        tokens.push(Token {
                            r#type: TokenType::RBRACE,
                            value: ch.to_string(),
                            line: current_line,
                            column: current_column,
                        });
                        state = TokenizeState::Searching;
                    }
                    ';' => {
                        tokens.push(Token {
                            r#type: TokenType::SEMICOLON,
                            value: ch.to_string(),
                            line: current_line,
                            column: current_column,
                        });
                        state = TokenizeState::Searching;
                    }
                    '+' | '-' | '*' | '/' | '>' | '<' | '=' => {
                        let token_type = match ch {
                            '+' => TokenType::PLUS,
                            '-' => TokenType::MINUS,
                            '*' => TokenType::MULTIPLY,
                            '/' => TokenType::DIVIDE,
                            '>' => TokenType::GREATER,
                            '<' => TokenType::LESS,
                            '=' => TokenType::EQUAL,
                            _ => panic!("Unexpected operator: {}", ch),
                        };
                        tokens.push(Token {
                            r#type: token_type,
                            value: ch.to_string(),
                            line: current_line,
                            column: current_column,
                        });
                        state = TokenizeState::Searching;
                    }
                    '"' => {
                        if no_dynamic_next {
                            panic!("Unexpected character: {}", ch);
                        }
                        state_start_line = current_line;
                        state_start_column = current_column;
                        state = TokenizeState::String;
                    }
                    c if c.is_ascii_digit() => {
                        if no_dynamic_next {
                            panic!("Unexpected character: {}", ch);
                        }
                        state_start_line = current_line;
                        state_start_column = current_column;
                        state = TokenizeState::Number;
                    }
                    c if c.is_ascii_alphabetic() || c == '_' => {
                        if no_dynamic_next {
                            panic!("Unexpected character: {}", ch);
                        }
                        state_start_line = current_line;
                        state_start_column = current_column;
                        state = TokenizeState::Identifier;
                    }
                    ' ' | '\n' | '\t' => {
                        // Do nothing
                    }
                    _ => panic!("Unexpected character: {}", ch),
                }
                no_dynamic_next = false;
                
                // Update position tracking after processing character
                if ch == '\n' {
                    current_line += 1;
                    current_column = 1;
                } else {
                    current_column += 1;
                }
                i += 1;
            }
            TokenizeState::Identifier => {
                if !ch.is_ascii_alphabetic() && ch != '_' {
                    let token_value: String = chars[state_start..i].iter().collect();
                    let token_type = if KEYWORDS.contains(&token_value.as_str()) {
                        get_keyword_token_type(&token_value)
                    } else {
                        TokenType::IDENTIFIER
                    };

                    tokens.push(Token {
                        r#type: token_type,
                        value: token_value,
                        line: state_start_line,
                        column: state_start_column,
                    });
                    no_dynamic_next = true;
                    state = TokenizeState::Searching;
                } else {
                    i += 1;
                }
            }
            TokenizeState::String => {
                if ch == '"' {
                    let token_value: String = chars[state_start..i].iter().collect();
                    tokens.push(Token {
                        r#type: TokenType::STRING,
                        value: token_value,
                        line: state_start_line,
                        column: state_start_column,
                    });
                    no_dynamic_next = true;
                    state = TokenizeState::Searching;
                }
                i += 1;
            }
            TokenizeState::Number => {
                if !ch.is_ascii_digit() {
                    let token_value: String = chars[state_start..i].iter().collect();
                    tokens.push(Token {
                        r#type: TokenType::NUMBER,
                        value: token_value,
                        line: state_start_line,
                        column: state_start_column,
                    });
                    no_dynamic_next = true;
                    state = TokenizeState::Searching;
                } else {
                    i += 1;
                }
            }
        }
    }

    // Add EOF token
    tokens.push(Token {
        r#type: TokenType::EOF,
        value: String::new(),
        line: current_line,
        column: current_column,
    });

    tokens
}

struct Parser {
    tokens: Vec<Token>,
    current_token_index: usize,
}

impl Parser {
    fn new(tokens: Vec<Token>) -> Self {
        Parser {
            tokens,
            current_token_index: 0,
        }
    }

    fn current_token(&self) -> &Token {
        &self.tokens[self.current_token_index]
    }

    fn peek(&self, token_type: TokenType) -> bool {
        self.current_token().r#type == token_type
    }

    fn accept(&mut self, token_type: TokenType) -> bool {
        if self.peek(token_type) {
            self.current_token_index += 1;
            true
        } else {
            false
        }
    }

    fn expect(&mut self, token_type: TokenType) {
        if !self.accept(token_type) {
            panic!(
                "{}:{}: unexpected symbol {:?}",
                self.current_token().line,
                self.current_token().column,
                self.current_token().r#type
            );
        }
    }

    fn parse_expression(&mut self) -> ASTNode {
        let left_token = self.current_token().clone();

        if self.accept(TokenType::NUMBER)
            || self.accept(TokenType::STRING)
            || self.accept(TokenType::IDENTIFIER)
        {
            if self.accept(TokenType::PLUS) {
                let right_node = self.parse_expression();
                ASTNode {
                    r#type: NodeType::EXPRESSION,
                    data: ASTNodeData::Expression(ExpressionData {
                        left_token,
                        operator: Some("+".to_string()),
                        right: Some(Box::new(right_node)),
                    }),
                }
            } else if self.accept(TokenType::MINUS) {
                let right_node = self.parse_expression();
                ASTNode {
                    r#type: NodeType::EXPRESSION,
                    data: ASTNodeData::Expression(ExpressionData {
                        left_token,
                        operator: Some("-".to_string()),
                        right: Some(Box::new(right_node)),
                    }),
                }
            } else if self.accept(TokenType::MULTIPLY) {
                let right_node = self.parse_expression();
                ASTNode {
                    r#type: NodeType::EXPRESSION,
                    data: ASTNodeData::Expression(ExpressionData {
                        left_token,
                        operator: Some("*".to_string()),
                        right: Some(Box::new(right_node)),
                    }),
                }
            } else if self.accept(TokenType::DIVIDE) {
                let right_node = self.parse_expression();
                ASTNode {
                    r#type: NodeType::EXPRESSION,
                    data: ASTNodeData::Expression(ExpressionData {
                        left_token,
                        operator: Some("/".to_string()),
                        right: Some(Box::new(right_node)),
                    }),
                }
            } else {
                ASTNode {
                    r#type: NodeType::EXPRESSION,
                    data: ASTNodeData::Expression(ExpressionData {
                        left_token,
                        operator: None,
                        right: None,
                    }),
                }
            }
        } else {
            panic!(
                "expression ({}:{}): unexpected symbol {:?}",
                self.current_token().line,
                self.current_token().column,
                self.current_token().r#type
            );
        }
    }

    fn parse_condition(&mut self) -> ASTNode {
        let left_node = self.parse_expression();
        
        if self.accept(TokenType::GREATER) {
            ASTNode {
                r#type: NodeType::CONDITION,
                data: ASTNodeData::Condition(ConditionData {
                    left: Box::new(left_node),
                    operator: ">".to_string(),
                    right: Box::new(self.parse_expression()),
                }),
            }
        } else if self.accept(TokenType::LESS) {
            ASTNode {
                r#type: NodeType::CONDITION,
                data: ASTNodeData::Condition(ConditionData {
                    left: Box::new(left_node),
                    operator: "<".to_string(),
                    right: Box::new(self.parse_expression()),
                }),
            }
        } else if self.accept(TokenType::EQUAL) {
            ASTNode {
                r#type: NodeType::CONDITION,
                data: ASTNodeData::Condition(ConditionData {
                    left: Box::new(left_node),
                    operator: "=".to_string(),
                    right: Box::new(self.parse_expression()),
                }),
            }
        } else {
            panic!(
                "condition ({}:{}): unexpected symbol {:?}",
                self.current_token().line,
                self.current_token().column,
                self.current_token().r#type
            );
        }
    }

    fn parse_statement(&mut self) -> ASTNode {
        if self.accept(TokenType::VAR) {
            let identifier = self.current_token().value.clone();
            self.expect(TokenType::IDENTIFIER);
            ASTNode {
                r#type: NodeType::VARIABLE_STATEMENT,
                data: ASTNodeData::VariableStatement(VariableStatementData {
                    identifier,
                }),
            }
        } else if self.accept(TokenType::IF) {
            self.expect(TokenType::LPAREN);
            let condition_node = self.parse_condition();
            self.expect(TokenType::RPAREN);
            self.expect(TokenType::LBRACE);
            let block_node = self.parse_statement_block();
            self.expect(TokenType::RBRACE);

            let else_block_node = if self.accept(TokenType::ELSE) {
                self.expect(TokenType::LBRACE);
                let else_block = self.parse_statement_block();
                self.expect(TokenType::RBRACE);
                Some(else_block)
            } else {
                None
            };

            ASTNode {
                r#type: NodeType::IF_STATEMENT,
                data: ASTNodeData::IfStatement(IfStatementData {
                    condition: Box::new(condition_node),
                    block: Box::new(block_node),
                    else_block: else_block_node.map(Box::new),
                }),
            }
        } else if self.accept(TokenType::WHILE) {
            self.expect(TokenType::LPAREN);
            let condition_node = self.parse_condition();
            self.expect(TokenType::RPAREN);
            self.expect(TokenType::LBRACE);
            let block_node = self.parse_statement_block();
            self.expect(TokenType::RBRACE);

            ASTNode {
                r#type: NodeType::WHILE_STATEMENT,
                data: ASTNodeData::WhileStatement(WhileStatementData {
                    condition: Box::new(condition_node),
                    block: Box::new(block_node),
                }),
            }
        } else if self.peek(TokenType::IDENTIFIER) {
            let identifier = self.current_token().value.clone();
            self.accept(TokenType::IDENTIFIER);
            self.expect(TokenType::EQUAL);
            let value_node = self.parse_expression();

            ASTNode {
                r#type: NodeType::ASSIGNMENT_STATEMENT,
                data: ASTNodeData::AssignmentStatement(AssignmentStatementData {
                    identifier,
                    value: Box::new(value_node),
                }),
            }
        } else {
            panic!(
                "statement ({}:{}): unexpected symbol {:?}",
                self.current_token().line,
                self.current_token().column,
                self.current_token().r#type
            );
        }
    }

    fn parse_statement_block(&mut self) -> ASTNode {
        let mut statements = Vec::new();

        loop {
            statements.push(self.parse_statement());
            if !self.accept(TokenType::SEMICOLON) {
                break;
            }
        }

        ASTNode {
            r#type: NodeType::STATEMENT_BLOCK,
            data: ASTNodeData::StatementBlock(StatementBlockData {
                statements,
            }),
        }
    }

    fn parse_program(&mut self) -> ASTNode {
        let block = self.parse_statement_block();

        if self.current_token().r#type != TokenType::EOF {
            panic!(
                "program ({}:{}): unexpected symbol {:?}",
                self.current_token().line,
                self.current_token().column,
                self.current_token().r#type
            );
        }

        ASTNode {
            r#type: NodeType::PROGRAM,
            data: ASTNodeData::Program(ProgramData {
                block: Box::new(block),
            }),
        }
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create output directory
    let output_dir = "../output/rust";
    fs::create_dir_all(output_dir)?;

    // Read test files
    let file_a = std::fs::read_to_string("../example/a.tst")
        .expect("Could not read example/a.tst");
    let file_b = std::fs::read_to_string("../example/b.tst")
        .expect("Could not read example/b.tst");
    let file_c = std::fs::read_to_string("../example/c.tst")
        .expect("Could not read example/c.tst");

    let mut parse_total = 0.0;
    let mut marshal_total = 0.0;
    let mut iteration = 0;

    fn parse_file(file_contents: &str, output_filename: &str, iteration: &mut i32, parse_total: &mut f64, marshal_total: &mut f64) -> Result<(), Box<dyn std::error::Error>> {
        let start = Instant::now();
        let tokens = tokenize(file_contents);
        let mut parser = Parser::new(tokens);
        let ast = parser.parse_program();
        let end_parse = Instant::now();

        let ast_json = serde_json::to_string_pretty(&ast)?;
        let end = Instant::now();

        fs::write(output_filename, &ast_json)?;

        let duration_parse = end_parse.duration_since(start).as_nanos() as f64 / 1_000_000.0;
        let duration_marshal = end.duration_since(end_parse).as_nanos() as f64 / 1_000_000.0;
        *parse_total += duration_parse;
        *marshal_total += duration_marshal;

        *iteration += 1;
        Ok(())
    }

    parse_file(&file_a, "../output/rust/a.json", &mut iteration, &mut parse_total, &mut marshal_total)?;
    parse_file(&file_b, "../output/rust/b.json", &mut iteration, &mut parse_total, &mut marshal_total)?;
    parse_file(&file_c, "../output/rust/c.json", &mut iteration, &mut parse_total, &mut marshal_total)?;

    let results = serde_json::json!({
        "parse": parse_total,
        "marshal": marshal_total
    });
    println!("{}", serde_json::to_string_pretty(&results)?);

    Ok(())
}
