use serde::Deserialize;
use std::fs;
use std::time::Instant;

#[derive(Deserialize)]
struct Config {
    iterations: usize,
}

fn copy_vec(src: &[i16]) -> Vec<i16> {
    src.to_vec()
}

fn check_results(data: &[i16], expected: &[i16]) {
    if data.len() != expected.len() {
        panic!(
            "Length mismatch: got {}, expected {}",
            data.len(),
            expected.len()
        );
    }

    for (i, (&actual, &expected_val)) in data.iter().zip(expected.iter()).enumerate() {
        if actual != expected_val {
            panic!(
                "Mismatch at index {}. Expected {}, got {}",
                i, expected_val, actual
            );
        }
    }
}

fn run_benchmark<F>(name: &str, data: &[i16], expected: &[i16], iterations: usize, mut sort_fn: F)
where
    F: FnMut(&mut [i16]),
{
    let mut durations = Vec::new();

    for i in 0..iterations {
        let mut cloned_data = copy_vec(data);
        let start = Instant::now();
        sort_fn(&mut cloned_data);
        let end = Instant::now();
        let duration = end.duration_since(start);
        check_results(&cloned_data, expected);
        durations.push(duration);
        println!(
            "{} iteration {} completed in {:.2}ms",
            name,
            i + 1,
            duration.as_secs_f64() * 1000.0
        );
    }

    // Calculate median
    durations.sort();
    let median = durations[durations.len() / 2];
    println!("{}: {:.2}ms", name, median.as_secs_f64() * 1000.0);
}

fn bubble_sort(data: &mut [i16]) {
    let n = data.len();
    let mut temp: i16;
    for i in 0..n {
        for j in 0..n - i - 1 {
            if data[j] > data[j + 1] {
                temp = data[j];
                data[j] = data[j + 1];
                data[j + 1] = temp;
            }
        }
    }
}

fn radix_sort(data: &mut [i16]) {
    if data.is_empty() {
        return;
    }

    // Find maximum value
    let max = *data.iter().max().unwrap() as i32;

    // Do counting sort for every digit
    let mut exp = 1i32;
    while max / exp > 0 {
        counting_sort(data, exp);
        exp *= 10;
    }
}

fn counting_sort(data: &mut [i16], exp: i32) {
    let n = data.len();
    let mut output = vec![0; n];
    let mut count = vec![0; 10];

    // Store count of occurrences
    for &val in data.iter() {
        count[((val as i32 / exp) % 10) as usize] += 1;
    }

    // Change count[i] to actual position
    for i in 1..10 {
        count[i] += count[i - 1];
    }

    // Build output array
    for &val in data.iter().rev() {
        let digit = ((val as i32 / exp) % 10) as usize;
        count[digit] -= 1;
        output[count[digit]] = val;
    }

    // Copy output array to data
    data.copy_from_slice(&output);
}

fn builtin_sort(data: &mut [i16]) {
    data.sort();
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Read data.json
    let data_contents = fs::read_to_string("../data.json")?;
    let data: Vec<i16> = serde_json::from_str(&data_contents)?;

    // Read config.json
    let config_contents = fs::read_to_string("../config.json")?;
    let config: Config = serde_json::from_str(&config_contents)?;

    // Create expected sorted data for validation
    let mut expected = copy_vec(&data);
    expected.sort();

    // Run benchmarks
    run_benchmark(
        "Bubble sort",
        &data,
        &expected,
        config.iterations,
        bubble_sort,
    );
    run_benchmark(
        "Radix sort",
        &data,
        &expected,
        config.iterations,
        radix_sort,
    );
    run_benchmark(
        "Built-in sort",
        &data,
        &expected,
        config.iterations,
        builtin_sort,
    );

    Ok(())
}
