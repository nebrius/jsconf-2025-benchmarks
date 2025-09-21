#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <sys/time.h>

#define MAX_DATA_SIZE 100000
#define MAX_LINE_SIZE 1024

// Global arrays
int original_data[MAX_DATA_SIZE];
int work_data[MAX_DATA_SIZE];
int expected_data[MAX_DATA_SIZE];
int data_size = 0;
int iterations = 10;

// Timing utilities for macOS
double get_time_ms() {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return tv.tv_sec * 1000.0 + tv.tv_usec / 1000.0;
}

// Simple JSON parser for our specific data format
int parse_data_json(const char* filename) {
    FILE* file = fopen(filename, "r");
    if (!file) {
        printf("Error: Cannot open %s\n", filename);
        return 0;
    }

    char line[MAX_LINE_SIZE];
    data_size = 0;
    int in_array = 0;

    while (fgets(line, sizeof(line), file)) {
        char* ptr = line;
        while (*ptr) {
            if (*ptr == '[') {
                in_array = 1;
            } else if (*ptr == ']') {
                break;
            } else if (in_array && (*ptr >= '0' && *ptr <= '9')) {
                int num = 0;
                while (*ptr >= '0' && *ptr <= '9') {
                    num = num * 10 + (*ptr - '0');
                    ptr++;
                }
                original_data[data_size++] = num;
                ptr--; // Adjust for the increment at end of loop
            }
            ptr++;
        }
    }

    fclose(file);
    return data_size;
}

int parse_config_json(const char* filename) {
    FILE* file = fopen(filename, "r");
    if (!file) {
        printf("Error: Cannot open %s\n", filename);
        return 0;
    }

    char line[MAX_LINE_SIZE];
    while (fgets(line, sizeof(line), file)) {
        char* ptr = strstr(line, "\"iterations\"");
        if (ptr) {
            ptr = strchr(ptr, ':');
            if (ptr) {
                ptr++;
                while (*ptr == ' ' || *ptr == '\t') ptr++;
                iterations = atoi(ptr);
                break;
            }
        }
    }

    fclose(file);
    return 1;
}

// Copy array
void copy_array(int* dest, int* src, int size) {
    for (int i = 0; i < size; i++) {
        dest[i] = src[i];
    }
}

// Check if results match expected sorted data
int check_results(int* data, int size) {
    for (int i = 0; i < size; i++) {
        if (data[i] != expected_data[i]) {
            printf("Error: Mismatch at index %d. Expected %d, got %d\n", i, expected_data[i], data[i]);
            return 0;
        }
    }
    return 1;
}

// Bubble Sort (no stdlib)
void bubble_sort(int* data, int size) {
    int temp;
    for (int i = 0; i < size; i++) {
        for (int j = 0; j < size - i - 1; j++) {
            if (data[j] > data[j + 1]) {
                temp = data[j];
                data[j] = data[j + 1];
                data[j + 1] = temp;
            }
        }
    }
}

// Radix Sort (no stdlib) - using decimal base-10
void counting_sort_for_radix(int* arr, int size, int exp) {
    int output[MAX_DATA_SIZE];
    int count[10] = {0};

    // Store count of occurrences
    for (int i = 0; i < size; i++) {
        count[(arr[i] / exp) % 10]++;
    }

    // Change count[i] to actual position
    for (int i = 1; i < 10; i++) {
        count[i] += count[i - 1];
    }

    // Build output array
    for (int i = size - 1; i >= 0; i--) {
        output[count[(arr[i] / exp) % 10] - 1] = arr[i];
        count[(arr[i] / exp) % 10]--;
    }

    // Copy output array to arr
    for (int i = 0; i < size; i++) {
        arr[i] = output[i];
    }
}

void radix_sort(int* data, int size) {
    // Find maximum number to know number of digits
    int max = data[0];
    for (int i = 1; i < size; i++) {
        if (data[i] > max) {
            max = data[i];
        }
    }

    // Do counting sort for every digit
    for (int exp = 1; max / exp > 0; exp *= 10) {
        counting_sort_for_radix(data, size, exp);
    }
}

// QuickSort (no stdlib) - replacement for built-in sort
int partition(int* arr, int low, int high) {
    int pivot = arr[high];
    int i = low - 1;

    for (int j = low; j <= high - 1; j++) {
        if (arr[j] <= pivot) {
            i++;
            int temp = arr[i];
            arr[i] = arr[j];
            arr[j] = temp;
        }
    }
    int temp = arr[i + 1];
    arr[i + 1] = arr[high];
    arr[high] = temp;
    return i + 1;
}

void quick_sort_recursive(int* arr, int low, int high) {
    if (low < high) {
        int pi = partition(arr, low, high);
        quick_sort_recursive(arr, low, pi - 1);
        quick_sort_recursive(arr, pi + 1, high);
    }
}

void quick_sort(int* data, int size) {
    quick_sort_recursive(data, 0, size - 1);
}

// Benchmark runner
void run_benchmark(const char* name, void (*sort_func)(int*, int)) {
    double iterations_times[1000]; // Max iterations

    for (int i = 0; i < iterations; i++) {
        copy_array(work_data, original_data, data_size);

        double start = get_time_ms();
        sort_func(work_data, data_size);
        double end = get_time_ms();

        double duration = end - start;

        if (!check_results(work_data, data_size)) {
            printf("Error: %s failed validation on iteration %d\n", name, i + 1);
            return;
        }

        iterations_times[i] = duration;
        printf("%s iteration %d completed in %.2fms\n", name, i + 1, duration);
    }

    // Calculate median
    for (int i = 0; i < iterations - 1; i++) {
        for (int j = 0; j < iterations - i - 1; j++) {
            if (iterations_times[j] > iterations_times[j + 1]) {
                double temp = iterations_times[j];
                iterations_times[j] = iterations_times[j + 1];
                iterations_times[j + 1] = temp;
            }
        }
    }

    double median = iterations_times[iterations / 2];
    printf("%s: %.2fms\n", name, median);
}

int main() {
    // Parse data and config files
    if (!parse_data_json("../data.json")) {
        printf("Failed to parse data.json\n");
        return 1;
    }

    if (!parse_config_json("../config.json")) {
        printf("Failed to parse config.json\n");
        return 1;
    }

    printf("Loaded %d data points, running %d iterations\n", data_size, iterations);

    // Create expected sorted data using quicksort
    copy_array(expected_data, original_data, data_size);
    quick_sort(expected_data, data_size);

    // Run benchmarks
    run_benchmark("Bubble sort", bubble_sort);
    run_benchmark("Radix sort", radix_sort);
    run_benchmark("Quick sort", quick_sort);

    return 0;
}