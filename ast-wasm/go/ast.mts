import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const DIRNAME = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(DIRNAME, "..", "output", "go");
const fileA = readFileSync(join(DIRNAME, "../example/a.tst"), "utf-8");
const fileB = readFileSync(join(DIRNAME, "../example/b.tst"), "utf-8");
const fileC = readFileSync(join(DIRNAME, "../example/c.tst"), "utf-8");

// Import Go WASM module (will be generated)
let wasmModule: any = null;

// Initialize Go WASM module
async function initWasm() {
  if (wasmModule) return wasmModule;

  try {
    // Load the WASM execution environment
    const wasmExecPath = join(DIRNAME, "wasm_exec.js");
    const wasmExecCode = readFileSync(wasmExecPath, 'utf-8');
    
    // Create a new function to evaluate the wasm_exec.js code
    const wasmExecFunc = new Function('require', 'module', 'exports', '__dirname', '__filename', 'global', 'process', wasmExecCode);
    
    // Create a mock module object to capture the Go class
    const mockModule = { exports: {} };
    const mockRequire = (id: string) => {
      if (id === 'fs') return require('fs');
      if (id === 'crypto') return require('crypto');
      if (id === 'util') return require('util');
      throw new Error(`Module '${id}' not found`);
    };
    
    // Execute the wasm_exec.js code to define the Go class
    wasmExecFunc(mockRequire, mockModule, mockModule.exports, DIRNAME, wasmExecPath, globalThis, process);
    
    // Get the Go constructor from global
    const Go = (globalThis as any).Go;
    const go = new Go();
    
    // Load the WASM file
    const wasmBinary = readFileSync(join(DIRNAME, "main.wasm"));
    const result = await WebAssembly.instantiate(wasmBinary, go.importObject);
    
    // Run the Go program
    go.run(result.instance);
    
    wasmModule = globalThis;
    return wasmModule;
  } catch (error) {
    console.error("Failed to load Go WASM module:", error);
    throw error;
  }
}

// WASM wrapper function that calls the Go generateAst function
async function parse(fileContents: string): Promise<any> {
  const module = await initWasm();
  
  // Call the Go WASM generateAst function
  const jsonString = module.generateAst(fileContents);
  
  if (typeof jsonString !== 'string' || jsonString.startsWith('Error:')) {
    throw new Error(`WASM error: ${jsonString}`);
  }
  
  // Parse the JSON result
  return JSON.parse(jsonString);
}

let parseTotal = 0;
let iteration = 0;

async function parseFile(fileContents: string, outputFilename: string) {
  const start = performance.now();
  const ast = await parse(fileContents);
  const endParse = performance.now();
  const astJson = JSON.stringify(ast, null, "  ");
  writeFileSync(join(OUTPUT_DIR, outputFilename), astJson);
  const durationParse = endParse - start;
  parseTotal += durationParse;
  iteration++;
}

// Main execution
mkdirSync(OUTPUT_DIR, { recursive: true });
await parseFile(fileA, "a.json");
await parseFile(fileB, "b.json");
await parseFile(fileC, "c.json");

const results = {
  parse: parseTotal,
};
console.log(JSON.stringify(results, null, "  "));
