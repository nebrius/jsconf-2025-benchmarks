#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE __attribute__((used))
#endif


// Token types enum
typedef enum {
    TOKEN_EOF,
    // Keywords
    TOKEN_VAR,
    TOKEN_IF,
    TOKEN_ELSE,
    TOKEN_WHILE,
    // Separators
    TOKEN_LPAREN,
    TOKEN_RPAREN,
    TOKEN_LBRACE,
    TOKEN_RBRACE,
    TOKEN_SEMICOLON,
    // Operators
    TOKEN_PLUS,
    TOKEN_MINUS,
    TOKEN_MULTIPLY,
    TOKEN_DIVIDE,
    TOKEN_GREATER,
    TOKEN_LESS,
    TOKEN_EQUAL,
    // Literals
    TOKEN_NUMBER,
    TOKEN_STRING,
    // Identifiers
    TOKEN_IDENTIFIER
} TokenType;

// Token structure
typedef struct {
    TokenType type;
    char* value;
    int line;
    int column;
} Token;

// Tokenizer state enum
typedef enum {
    STATE_SEARCHING,
    STATE_STRING,
    STATE_NUMBER,
    STATE_IDENTIFIER
} TokenizeState;

// Token array structure
typedef struct {
    Token* tokens;
    int count;
    int capacity;
} TokenArray;

// AST Node types
typedef enum {
    NODE_PROGRAM,
    NODE_STATEMENT_BLOCK,
    NODE_VARIABLE_STATEMENT,
    NODE_IF_STATEMENT,
    NODE_WHILE_STATEMENT,
    NODE_ASSIGNMENT_STATEMENT,
    NODE_CONDITION,
    NODE_EXPRESSION
} NodeType;

typedef struct ASTNode ASTNode;
typedef struct StatementList StatementList;

// Forward declarations
struct ASTNode {
    NodeType type;
    union {
        struct {
            ASTNode* block;
        } program;
        struct {
            StatementList* statements;
        } statement_block;
        struct {
            char* identifier;
        } variable_statement;
        struct {
            ASTNode* condition;
            ASTNode* block;
            ASTNode* else_block;
        } if_statement;
        struct {
            ASTNode* condition;
            ASTNode* block;
        } while_statement;
        struct {
            char* identifier;
            ASTNode* value;
        } assignment_statement;
        struct {
            ASTNode* left;
            char* operator;
            ASTNode* right;
        } condition;
        struct {
            Token* left_token;
            char* operator;
            ASTNode* right;
        } expression;
    } data;
};

struct StatementList {
    ASTNode** statements;
    int count;
    int capacity;
};

// Global parser state
typedef struct {
    Token* tokens;
    int token_count;
    int current_token_index;
    Token* current_token;
} Parser;

// Helper functions

int is_digit(char c) {
    return c >= '0' && c <= '9';
}

int is_alpha(char c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_';
}

int is_whitespace(char c) {
    return c == ' ' || c == '\n' || c == '\t';
}

// Get line and column from index
void get_location_from_index(int index, const char* input, int* line, int* column) {
    *line = 1;
    *column = 1;
    for (int i = 0; i < index; i++) {
        if (input[i] == '\n') {
            (*line)++;
            *column = 1;
        } else {
            (*column)++;
        }
    }
}

// Token array management
void init_token_array(TokenArray* arr) {
    arr->tokens = malloc(1000 * sizeof(Token));
    arr->count = 0;
    arr->capacity = 1000;
}

void add_token(TokenArray* arr, TokenType type, const char* value, int line, int column) {
    if (arr->count >= arr->capacity) {
        arr->capacity *= 2;
        arr->tokens = realloc(arr->tokens, arr->capacity * sizeof(Token));
    }

    Token* token = &arr->tokens[arr->count];
    token->type = type;
    // Value is already in arena, just use the pointer directly
    token->value = (char*)value;
    token->line = line;
    token->column = column;
    arr->count++;
}

// Check if string is a keyword
TokenType get_keyword_type(const char* str) {
    if (strcmp(str, "var") == 0) return TOKEN_VAR;
    if (strcmp(str, "if") == 0) return TOKEN_IF;
    if (strcmp(str, "else") == 0) return TOKEN_ELSE;
    if (strcmp(str, "while") == 0) return TOKEN_WHILE;
    return TOKEN_IDENTIFIER;
}

// Tokenizer function
TokenArray tokenize(const char* input) {
    TokenArray tokens;
    init_token_array(&tokens);

    TokenizeState state = STATE_SEARCHING;
    int state_start = 0;
    int state_start_line = 1, state_start_column = 1;
    int current_line = 1, current_column = 1;
    int i = 0;
    int input_len = 0;

    // Calculate input length
    while (input[input_len]) input_len++;

    while (i < input_len) {
        char c = input[i];
        int no_dynamic_next = 0;

        switch (state) {
            case STATE_SEARCHING: {
                state_start = i;
                if (c == '"') {
                    if (no_dynamic_next) {
                        fprintf(stderr, "Unexpected character: %c\n", c);
                        exit(1);
                    }
                    state_start_line = current_line;
                    state_start_column = current_column;
                    state = STATE_STRING;
                } else if (c == '(' || c == ')' || c == ';' || c == '{' || c == '}') {

                    TokenType type;
                    switch (c) {
                        case '(': type = TOKEN_LPAREN; break;
                        case ')': type = TOKEN_RPAREN; break;
                        case ';': type = TOKEN_SEMICOLON; break;
                        case '{': type = TOKEN_LBRACE; break;
                        case '}': type = TOKEN_RBRACE; break;
                    }

                    char str[2] = {c, '\0'};
                    add_token(&tokens, type, str, current_line, current_column);
                    state = STATE_SEARCHING;
                } else if (c == '+' || c == '-' || c == '*' || c == '/' ||
                          c == '>' || c == '<' || c == '=') {
                    TokenType type;
                    switch (c) {
                        case '+': type = TOKEN_PLUS; break;
                        case '-': type = TOKEN_MINUS; break;
                        case '*': type = TOKEN_MULTIPLY; break;
                        case '/': type = TOKEN_DIVIDE; break;
                        case '>': type = TOKEN_GREATER; break;
                        case '<': type = TOKEN_LESS; break;
                        case '=': type = TOKEN_EQUAL; break;
                    }

                    char str[2] = {c, '\0'};
                    add_token(&tokens, type, str, current_line, current_column);
                    state = STATE_SEARCHING;
                } else if (is_digit(c)) {
                    if (no_dynamic_next) {
                        fprintf(stderr, "Unexpected character: %c\n", c);
                        exit(1);
                    }
                    state_start_line = current_line;
                    state_start_column = current_column;
                    state = STATE_NUMBER;
                } else if (is_alpha(c)) {
                    if (no_dynamic_next) {
                        fprintf(stderr, "Unexpected character: %c\n", c);
                        exit(1);
                    }
                    state_start_line = current_line;
                    state_start_column = current_column;
                    state = STATE_IDENTIFIER;
                } else if (is_whitespace(c)) {
                    // Do nothing
                } else {
                    fprintf(stderr, "Unexpected character: %c\n", c);
                    exit(1);
                }
                no_dynamic_next = 0;

                // Update position tracking after processing character
                if (c == '\n') {
                    current_line++;
                    current_column = 1;
                } else {
                    current_column++;
                }
                i++;
                break;
            }
            case STATE_IDENTIFIER: {
                if (!is_alpha(c)) {
                    // Extract token value using standard allocation
                    int len = i - state_start;
                    char* token_value = malloc(len + 1);
                    if (!token_value) {
                        fprintf(stderr, "Memory allocation failed in tokenizer\n");
                        exit(1);
                    }
                    for (int j = 0; j < len; j++) {
                        token_value[j] = input[state_start + j];
                    }
                    token_value[len] = '\0';

                    TokenType type = get_keyword_type(token_value);
                    add_token(&tokens, type, token_value, state_start_line, state_start_column);

                    // Note: token_value now uses malloc, will need proper cleanup
                    no_dynamic_next = 1;
                    state = STATE_SEARCHING;
                } else {
                    i++;
                }
                break;
            }
            case STATE_STRING: {
                if (c == '"') {
                    // Extract string value (without quotes) using standard allocation
                    int len = i - state_start;
                    char* token_value = malloc(len + 1);
                    if (!token_value) {
                        fprintf(stderr, "Memory allocation failed in tokenizer\n");
                        exit(1);
                    }
                    for (int j = 0; j < len; j++) {
                        token_value[j] = input[state_start + j];
                    }
                    token_value[len] = '\0';

                    add_token(&tokens, TOKEN_STRING, token_value, state_start_line, state_start_column);

                    // Note: token_value now uses malloc, will need proper cleanup
                    no_dynamic_next = 1;
                    state = STATE_SEARCHING;
                }
                i++;
                break;
            }
            case STATE_NUMBER: {
                if (!is_digit(c)) {
                    // Extract number value using standard allocation
                    int len = i - state_start;
                    char* token_value = malloc(len + 1);
                    if (!token_value) {
                        fprintf(stderr, "Memory allocation failed in tokenizer\n");
                        exit(1);
                    }
                    for (int j = 0; j < len; j++) {
                        token_value[j] = input[state_start + j];
                    }
                    token_value[len] = '\0';

                    add_token(&tokens, TOKEN_NUMBER, token_value, state_start_line, state_start_column);

                    // Note: token_value now uses malloc, will need proper cleanup
                    no_dynamic_next = 1;
                    state = STATE_SEARCHING;
                } else {
                    i++;
                }
                break;
            }
        }
    }

    // Add EOF token
    add_token(&tokens, TOKEN_EOF, "EOF", current_line, current_column);

    return tokens;
}

// Parser functions
void init_statement_list(StatementList* list) {
    list->statements = malloc(100 * sizeof(ASTNode*));
    list->count = 0;
    list->capacity = 100;
}

void add_statement(StatementList* list, ASTNode* stmt) {
    if (list->count >= list->capacity) {
        list->capacity *= 2;
        list->statements = realloc(list->statements, list->capacity * sizeof(ASTNode*));
    }
    list->statements[list->count++] = stmt;
}

ASTNode* create_node(NodeType type) {
    ASTNode* node = malloc(sizeof(ASTNode));
    node->type = type;
    return node;
}

void parser_error(Parser* parser, const char* message) {
    fprintf(stderr, "%s (%d:%d): unexpected symbol\n",
            message, parser->current_token->line, parser->current_token->column);
    exit(1);
}

void next_token(Parser* parser) {
    parser->current_token_index++;
    if (parser->current_token_index >= parser->token_count) {
        fprintf(stderr, "Unexpected end of input\n");
        exit(1);
    }
    parser->current_token = &parser->tokens[parser->current_token_index];
}

int accept(Parser* parser, TokenType token_type) {
    if (parser->current_token->type == token_type) {
        next_token(parser);
        return 1;
    }
    return 0;
}

int peek(Parser* parser, TokenType token_type) {
    return parser->current_token->type == token_type;
}

void expect(Parser* parser, TokenType token_type) {
    if (!accept(parser, token_type)) {
        parser_error(parser, "expect");
    }
}

// Forward declarations
ASTNode* parse_program(Parser* parser);
ASTNode* parse_statement_block(Parser* parser);
ASTNode* parse_statement(Parser* parser);
ASTNode* parse_condition(Parser* parser);
ASTNode* parse_expression(Parser* parser);

ASTNode* parse_expression(Parser* parser) {
    Token* left_token = parser->current_token;

    if (accept(parser, TOKEN_NUMBER) || accept(parser, TOKEN_STRING) || accept(parser, TOKEN_IDENTIFIER)) {
        ASTNode* node = create_node(NODE_EXPRESSION);
        node->data.expression.left_token = left_token;
        node->data.expression.operator = NULL;
        node->data.expression.right = NULL;

        if (accept(parser, TOKEN_PLUS)) {
            node->data.expression.operator = "+";
            node->data.expression.right = parse_expression(parser);
        } else if (accept(parser, TOKEN_MINUS)) {
            node->data.expression.operator = "-";
            node->data.expression.right = parse_expression(parser);
        } else if (accept(parser, TOKEN_MULTIPLY)) {
            node->data.expression.operator = "*";
            node->data.expression.right = parse_expression(parser);
        } else if (accept(parser, TOKEN_DIVIDE)) {
            node->data.expression.operator = "/";
            node->data.expression.right = parse_expression(parser);
        }

        return node;
    } else {
        parser_error(parser, "expression");
        return NULL;
    }
}

ASTNode* parse_condition(Parser* parser) {
    ASTNode* left_node = parse_expression(parser);
    ASTNode* node = create_node(NODE_CONDITION);
    node->data.condition.left = left_node;

    if (accept(parser, TOKEN_GREATER)) {
        node->data.condition.operator = ">";
        node->data.condition.right = parse_expression(parser);
    } else if (accept(parser, TOKEN_LESS)) {
        node->data.condition.operator = "<";
        node->data.condition.right = parse_expression(parser);
    } else if (accept(parser, TOKEN_EQUAL)) {
        node->data.condition.operator = "=";
        node->data.condition.right = parse_expression(parser);
    } else {
        parser_error(parser, "condition");
    }

    return node;
}

ASTNode* parse_statement(Parser* parser) {
    if (accept(parser, TOKEN_VAR)) {
        char* identifier = strdup(parser->current_token->value);
        expect(parser, TOKEN_IDENTIFIER);

        ASTNode* node = create_node(NODE_VARIABLE_STATEMENT);
        node->data.variable_statement.identifier = identifier;
        return node;
    } else if (accept(parser, TOKEN_IF)) {
        expect(parser, TOKEN_LPAREN);
        ASTNode* condition_node = parse_condition(parser);
        expect(parser, TOKEN_RPAREN);
        expect(parser, TOKEN_LBRACE);
        ASTNode* block_node = parse_statement_block(parser);
        expect(parser, TOKEN_RBRACE);

        ASTNode* else_block_node = NULL;
        if (accept(parser, TOKEN_ELSE)) {
            expect(parser, TOKEN_LBRACE);
            else_block_node = parse_statement_block(parser);
            expect(parser, TOKEN_RBRACE);
        }

        ASTNode* node = create_node(NODE_IF_STATEMENT);
        node->data.if_statement.condition = condition_node;
        node->data.if_statement.block = block_node;
        node->data.if_statement.else_block = else_block_node;
        return node;
    } else if (accept(parser, TOKEN_WHILE)) {
        expect(parser, TOKEN_LPAREN);
        ASTNode* condition_node = parse_condition(parser);
        expect(parser, TOKEN_RPAREN);
        expect(parser, TOKEN_LBRACE);
        ASTNode* block_node = parse_statement_block(parser);
        expect(parser, TOKEN_RBRACE);

        ASTNode* node = create_node(NODE_WHILE_STATEMENT);
        node->data.while_statement.condition = condition_node;
        node->data.while_statement.block = block_node;
        return node;
    } else if (peek(parser, TOKEN_IDENTIFIER)) {
        char* identifier = strdup(parser->current_token->value);
        accept(parser, TOKEN_IDENTIFIER);
        expect(parser, TOKEN_EQUAL);
        ASTNode* expression_node = parse_expression(parser);

        ASTNode* node = create_node(NODE_ASSIGNMENT_STATEMENT);
        node->data.assignment_statement.identifier = identifier;
        node->data.assignment_statement.value = expression_node;
        return node;
    } else {
        parser_error(parser, "statement");
        return NULL;
    }
}

ASTNode* parse_statement_block(Parser* parser) {
    StatementList* statements = malloc(sizeof(StatementList));
    init_statement_list(statements);

    do {
        add_statement(statements, parse_statement(parser));
    } while (accept(parser, TOKEN_SEMICOLON));

    ASTNode* node = create_node(NODE_STATEMENT_BLOCK);
    node->data.statement_block.statements = statements;
    return node;
}

ASTNode* parse_program(Parser* parser) {
    ASTNode* block = parse_statement_block(parser);

    if (parser->current_token->type != TOKEN_EOF) {
        parser_error(parser, "program");
    }

    ASTNode* node = create_node(NODE_PROGRAM);
    node->data.program.block = block;
    return node;
}

ASTNode* parse(TokenArray* token_array) {
    Parser parser;
    parser.tokens = token_array->tokens;
    parser.token_count = token_array->count;
    parser.current_token_index = 0;
    parser.current_token = &parser.tokens[0];

    return parse_program(&parser);
}

char* json_result = NULL;
int json_capacity = 0;
int json_length = 0;

void json_append(const char* str) {
    int len = strlen(str);
    if (json_length + len >= json_capacity) {
        json_capacity = (json_capacity == 0) ? 4096 : json_capacity * 2;
        while (json_length + len >= json_capacity) json_capacity *= 2;
        json_result = realloc(json_result, json_capacity);
    }
    strcpy(json_result + json_length, str);
    json_length += len;
}

// JSON serialization functions
void json_append_escaped_string(const char* str) {
    json_append("\"");
    while (*str) {
        unsigned char c = (unsigned char)*str;
        if (c == '"') json_append("\\\"");
        else if (c == '\\') json_append("\\\\");
        else if (c == '\n') json_append("\\n");
        else if (c == '\t') json_append("\\t");
        else if (c == '\r') json_append("\\r");
        else if (c == '\b') json_append("\\b");
        else if (c == '\f') json_append("\\f");
        else if (c < 32) {
            // Escape all control characters (0-31) using unicode escape
            char temp[7];
            sprintf(temp, "\\u%04x", c);
            json_append(temp);
        }
        else {
            char temp[2] = {*str, '\0'};
            json_append(temp);
        }
        str++;
    }
    json_append("\"");
}

void json_append_int(int value) {
    char temp[32];
    sprintf(temp, "%d", value);
    json_append(temp);
}

void serialize_token(Token* token) {
    json_append("{\n    \"type\": ");
    json_append_int(token->type);
    json_append(",\n    \"value\": ");
    json_append_escaped_string(token->value);
    json_append(",\n    \"line\": ");
    json_append_int(token->line);
    json_append(",\n    \"column\": ");
    json_append_int(token->column);
    json_append("\n  }");
}

void serialize_ast(ASTNode* node);

void serialize_statement_list(StatementList* list) {
    json_append("[\n");
    for (int i = 0; i < list->count; i++) {
        json_append("    ");
        serialize_ast(list->statements[i]);
        if (i < list->count - 1) json_append(",");
        json_append("\n");
    }
    json_append("  ]");
}

void serialize_ast(ASTNode* node) {
    if (!node) {
        json_append("null");
        return;
    }

    json_append("{\n  \"type\": ");
    json_append_int(node->type);
    json_append(",\n  \"data\": ");

    switch (node->type) {
        case NODE_PROGRAM:
            json_append("{\n    \"block\": ");
            serialize_ast(node->data.program.block);
            json_append("\n  }");
            break;
        case NODE_STATEMENT_BLOCK:
            json_append("{\n    \"statements\": ");
            serialize_statement_list(node->data.statement_block.statements);
            json_append("\n  }");
            break;
        case NODE_VARIABLE_STATEMENT:
            json_append("{\n    \"identifier\": ");
            json_append_escaped_string(node->data.variable_statement.identifier);
            json_append("\n  }");
            break;
        case NODE_IF_STATEMENT:
            json_append("{\n    \"condition\": ");
            serialize_ast(node->data.if_statement.condition);
            json_append(",\n    \"block\": ");
            serialize_ast(node->data.if_statement.block);
            json_append(",\n    \"elseBlock\": ");
            serialize_ast(node->data.if_statement.else_block);
            json_append("\n  }");
            break;
        case NODE_WHILE_STATEMENT:
            json_append("{\n    \"condition\": ");
            serialize_ast(node->data.while_statement.condition);
            json_append(",\n    \"block\": ");
            serialize_ast(node->data.while_statement.block);
            json_append("\n  }");
            break;
        case NODE_ASSIGNMENT_STATEMENT:
            json_append("{\n    \"identifier\": ");
            json_append_escaped_string(node->data.assignment_statement.identifier);
            json_append(",\n    \"value\": ");
            serialize_ast(node->data.assignment_statement.value);
            json_append("\n  }");
            break;
        case NODE_CONDITION:
            json_append("{\n    \"left\": ");
            serialize_ast(node->data.condition.left);
            json_append(",\n    \"operator\": ");
            json_append_escaped_string(node->data.condition.operator);
            json_append(",\n    \"right\": ");
            serialize_ast(node->data.condition.right);
            json_append("\n  }");
            break;
        case NODE_EXPRESSION:
            json_append("{\n    \"leftToken\": ");
            serialize_token(node->data.expression.left_token);
            json_append(",\n    \"operator\": ");
            if (node->data.expression.operator) {
                json_append_escaped_string(node->data.expression.operator);
            } else {
                json_append("null");
            }
            json_append(",\n    \"right\": ");
            serialize_ast(node->data.expression.right);
            json_append("\n  }");
            break;
    }
    json_append("\n}");
}

// Main WASM export function
EMSCRIPTEN_KEEPALIVE
char* generateAst(const char* input) {
    // Reset JSON buffer
    if (json_result) {
        free(json_result);
        json_result = NULL;
    }
    json_capacity = 0;
    json_length = 0;

    // Tokenize
    TokenArray tokens = tokenize(input);

    // Parse
    Parser parser = {0};
    parser.tokens = tokens.tokens;
    parser.token_count = tokens.count;
    parser.current_token_index = 0;
    parser.current_token = &tokens.tokens[0];

    ASTNode* ast = parse_program(&parser);

    // Serialize to JSON
    serialize_ast(ast);

    // Null terminate
    json_append("\0");

    return json_result;
}
