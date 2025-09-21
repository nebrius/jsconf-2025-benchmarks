import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const DIRNAME = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(DIRNAME, "..", "output", "c");
const fileA = readFileSync(join(DIRNAME, "../example/a.tst"), "utf-8");
const fileB = readFileSync(join(DIRNAME, "../example/b.tst"), "utf-8");
const fileC = readFileSync(join(DIRNAME, "../example/c.tst"), "utf-8");

// Import WASM module (will be generated)
let wasmModule: any = null;

// Initialize WASM module
async function initWasm() {
  if (wasmModule) return wasmModule;

  try {
    // Dynamic import the WASM module
    const wasmPath = join(DIRNAME, "wasm_ast.js");
    const Module = await import(wasmPath);
    wasmModule = await Module.default();
    return wasmModule;
  } catch (error) {
    console.error("Failed to load WASM module:", error);
    throw error;
  }
}

// WASM wrapper function that combines tokenize and parse
async function parse(fileContents: string): Promise<any> {
  const module = await initWasm();

  // Allocate memory for the input string
  const inputLength = new TextEncoder().encode(fileContents).length;
  const inputPtr = module._malloc(inputLength + 1);

  // Copy the string to WASM memory
  module.stringToUTF8(fileContents, inputPtr, inputLength + 1);

  // Call the WASM parse function
  const resultPtr = module._generateAst(inputPtr);

  // Convert the result back to JavaScript string
  const jsonString = module.UTF8ToString(resultPtr);

  // Free the allocated memory
  module._free(inputPtr);
  // Note: resultPtr is managed by the WASM module and should not be freed here

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
