import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { join } from 'path';

const DIRNAME = dirname(fileURLToPath(import.meta.url));

const data = JSON.parse(readFileSync(join(DIRNAME, '../data.json'), 'utf-8'));
const config = JSON.parse(readFileSync(join(DIRNAME, '../config.json'), 'utf-8'));

const expectedData = [...data].sort((a, b) => a > b ? 1 : -1);
function checkResults(data) {
  if (data.length !== expectedData.length) {
    throw new Error('Length mismatch');
  }

  for (let i = 0; i < data.length; i++) {
    if (data[i] !== expectedData[i]) {
      throw new Error(`Mismatch at index ${i}. Expected ${expectedData[i]}, got ${data[i]}`);
    }
  }
}

function runBenchmark(name, cb) {
  const iterations = [];
  for (let i = 0; i < config.iterations; i++) {
    const clonedData = [...data];
    const start = performance.now();
    cb(clonedData);
    const end = performance.now();
    const duration = end - start;
    checkResults(clonedData);
    iterations.push(duration);
    console.log(`${name} iteration ${i + 1} completed in ${duration.toFixed(2)}ms`);
  }
  console.log(`${name}: ${iterations.sort()[Math.floor(iterations.length / 2)].toFixed(2)}ms`);
}

// Bubble sort
runBenchmark("Bubble sort", (data) => {
  let temp;
  for (let i = 0; i < data.length; i++) {
    for (let j = 0; j < data.length - i - 1; j++) {
      if (data[j] > data[j + 1]) {
        temp = data[j];
        data[j] = data[j + 1];
        data[j + 1] = temp;
      }
    }
  }
});

// Radix sort
runBenchmark("Radix sort", (data) => {
  function countingSort(arr, exp) {
    const output = new Array(arr.length);
    const count = new Array(10).fill(0);

    // Store count of occurrences
    for (let i = 0; i < arr.length; i++) {
      count[Math.floor(arr[i] / exp) % 10]++;
    }

    // Change count[i] to actual position
    for (let i = 1; i < 10; i++) {
      count[i] += count[i - 1];
    }

    // Build output array
    for (let i = arr.length - 1; i >= 0; i--) {
      output[count[Math.floor(arr[i] / exp) % 10] - 1] = arr[i];
      count[Math.floor(arr[i] / exp) % 10]--;
    }

    // Copy output array to arr
    for (let i = 0; i < arr.length; i++) {
      arr[i] = output[i];
    }
  }

  // Do counting sort for every digit
  const max = Math.max(...data);
  for (let exp = 1; Math.floor(max / exp) > 0; exp *= 10) {
    countingSort(data, exp);
  }
});

// Built-in sort
runBenchmark("Built-in sort", (data) => {
  data.sort((a, b) => a > b ? 1 : -1);
});
