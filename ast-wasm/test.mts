#!/usr/bin/env node --experimental-strip-types

/**
 * Simple test script to verify WASM variant works correctly
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_DIR = dirname(fileURLToPath(import.meta.url));

async function runTest() {
  console.log("🧪 Testing WASM AST Parser variant...\n");

  // Step 1: Check if emscripten is available
  console.log("1. Checking Emscripten installation...");
  try {
    execSync("which emcc", { stdio: "pipe" });
    const version = execSync("emcc --version", { encoding: "utf8" });
    console.log(`   ✓ Emscripten found: ${version.split('\n')[0]}`);
  } catch (error) {
    console.log("   ✗ Emscripten not found. Please install emscripten first.");
    console.log("   See README.md for installation instructions.");
    process.exit(1);
  }

  // Step 2: Check test files exist
  console.log("\n2. Checking test files...");
  const testFiles = ["a.tst", "b.tst", "c.tst"];
  for (const file of testFiles) {
    const path = join(BASE_DIR, "example", file);
    if (existsSync(path)) {
      const content = readFileSync(path, "utf8");
      console.log(`   ✓ ${file} exists (${content.length} chars)`);
    } else {
      console.log(`   ✗ ${file} missing`);
      process.exit(1);
    }
  }

  // Step 3: Build WASM module
  console.log("\n3. Building WASM module...");
  try {
    execSync("make build", { 
      cwd: BASE_DIR, 
      stdio: "inherit" 
    });
    console.log("   ✓ WASM module built successfully");
  } catch (error) {
    console.log("   ✗ Failed to build WASM module");
    process.exit(1);
  }

  // Step 4: Check generated files
  console.log("\n4. Checking generated files...");
  const generatedFiles = ["c/wasm_ast.js", "c/wasm_ast.wasm"];
  for (const file of generatedFiles) {
    const path = join(BASE_DIR, file);
    if (existsSync(path)) {
      console.log(`   ✓ ${file} generated`);
    } else {
      console.log(`   ✗ ${file} missing`);
      process.exit(1);
    }
  }

  // Step 5: Run a simple test
  console.log("\n5. Running simple functionality test...");
  try {
    const result = execSync("npx tsx ast.mts", { 
      cwd: join(BASE_DIR, "js"),
      encoding: "utf8",
      stdio: "pipe"
    });
    
    const parsed = JSON.parse(result);
    if (typeof parsed.parse === "number" && typeof parsed.marshal === "number") {
      console.log(`   ✓ WASM variant works! Parse: ${parsed.parse.toFixed(2)}ms, Marshal: ${parsed.marshal.toFixed(2)}ms`);
    } else {
      console.log("   ✗ Unexpected output format");
      console.log("   Output:", result);
      process.exit(1);
    }
  } catch (error) {
    console.log("   ✗ Failed to run WASM variant");
    console.error("   Error:", error);
    process.exit(1);
  }

  // Step 6: Check output file
  console.log("\n6. Checking output file...");
  const outputPath = join(BASE_DIR, "js", "ast-wasm.json");
  if (existsSync(outputPath)) {
    const output = readFileSync(outputPath, "utf8");
    try {
      const ast = JSON.parse(output);
      if (ast.type === 0) { // NODE_PROGRAM
        console.log("   ✓ AST output file generated and valid");
      } else {
        console.log("   ✗ AST output file invalid structure");
        process.exit(1);  
      }
    } catch (error) {
      console.log("   ✗ AST output file is not valid JSON");
      process.exit(1);
    }
  } else {
    console.log("   ✗ AST output file not generated");
    process.exit(1);
  }

  console.log("\n🎉 All tests passed! WASM variant is working correctly.");
  console.log("\nNext steps:");
  console.log("- Run 'make run' to execute the benchmark");
  console.log("- Run 'node --experimental-strip-types run.mts' to compare with JavaScript");
  console.log("- Run 'make test' to compare outputs");
}

runTest().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
