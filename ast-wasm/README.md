# AST Parser WASM Variant

This is a WebAssembly (WASM) variant of the AST benchmark. It implements the core tokenizer and parser functions in C (compiled to WASM) while using JavaScript for everything else.

## Architecture

- **C (`c/wasm_ast.c`)**: Contains the `tokenize` and `parse` functions compiled to WASM
- **JavaScript (`js/ast.mts`)**: Wrapper that calls WASM functions and handles the rest of the benchmark logic
- **WASM Export**: Single `parse` function that takes a string and returns JSON AST

## Requirements

- [Emscripten](https://emscripten.org/) for compiling C to WASM
- Node.js with TypeScript support

## Installation

1. Install Emscripten:
   ```bash
   # Install emscripten (see https://emscripten.org/docs/getting_started/downloads.html)
   git clone https://github.com/emscripten-core/emsdk.git
   cd emsdk
   ./emsdk install latest
   ./emsdk activate latest
   source ./emsdk_env.sh
   ```

2. Check installation:
   ```bash
   make check-emscripten
   ```

## Building

```bash
# Build the WASM module
make build

# Clean build artifacts
make clean
```

## Running

```bash
# Run the benchmark
make run

# Test against original JavaScript version
make test
```

## Implementation Details

The WASM variant follows the same algorithm as the original JavaScript implementation but:

1. **Tokenization and Parsing**: Implemented in C and compiled to WASM
2. **JSON Serialization**: Done in C and returned as a string to JavaScript
3. **File I/O and Timing**: Done in JavaScript (same as original)
4. **Memory Management**: WASM module manages its own memory

The exported WASM function signature:
```c
char* parse(const char* input)
```

This function:
1. Tokenizes the input string
2. Parses tokens into an AST
3. Serializes AST to JSON string
4. Returns the JSON string pointer

## Performance

This variant allows comparing the performance of:
- Pure JavaScript implementation (original)
- C compiled to WASM for core parsing logic
- JavaScript handling I/O and orchestration

Expected performance characteristics:
- WASM should be faster for CPU-intensive parsing
- JavaScript-WASM boundary may add some overhead
- Memory allocation patterns may differ between variants
