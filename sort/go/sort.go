package main

import (
	"encoding/json"
	"fmt"
	"os"
	"slices"
	"sort"
	"time"
)

type Config struct {
	Iterations int `json:"iterations"`
}

// Helper functions
func copySlice(src []int) []int {
	dst := make([]int, len(src))
	copy(dst, src)
	return dst
}

func checkResults(data, expected []int) {
	if len(data) != len(expected) {
		panic(fmt.Sprintf("Length mismatch: got %d, expected %d", len(data), len(expected)))
	}

	for i := 0; i < len(data); i++ {
		if data[i] != expected[i] {
			panic(fmt.Sprintf("Mismatch at index %d. Expected %d, got %d", i, expected[i], data[i]))
		}
	}
}

func runBenchmark(name string, data []int, expected []int, iterations int, sortFn func([]int)) {
	var durations []time.Duration

	for i := 0; i < iterations; i++ {
		clonedData := copySlice(data)
		start := time.Now()
		sortFn(clonedData)
		end := time.Now()
		duration := end.Sub(start)
		checkResults(clonedData, expected)
		durations = append(durations, duration)
		fmt.Printf("%s iteration %d completed in %.2fms\n", name, i+1, float64(duration.Nanoseconds())/1000000)
	}

	// Calculate median
	sort.Slice(durations, func(i, j int) bool {
		return durations[i] < durations[j]
	})
	median := durations[len(durations)/2]
	fmt.Printf("%s: %.2fms\n", name, float64(median.Nanoseconds())/1000000)
}

func bubbleSort(data []int) {
	n := len(data)
	var temp int
	for i := 0; i < n; i++ {
		for j := 0; j < n-i-1; j++ {
			if data[j] > data[j+1] {
				temp = data[j]
				data[j] = data[j+1]
				data[j+1] = temp
			}
		}
	}
}

func radixSort(data []int) {
	if len(data) == 0 {
		return
	}

	// Find maximum value
	max := data[0]
	for _, v := range data {
		if v > max {
			max = v
		}
	}

	// Do counting sort for every digit
	for exp := 1; max/exp > 0; exp *= 10 {
		countingSort(data, exp)
	}
}

func countingSort(data []int, exp int) {
	n := len(data)
	output := make([]int, n)
	count := make([]int, 10)

	// Store count of occurrences
	for i := 0; i < n; i++ {
		count[(data[i]/exp)%10]++
	}

	// Change count[i] to actual position
	for i := 1; i < 10; i++ {
		count[i] += count[i-1]
	}

	// Build output array
	for i := n - 1; i >= 0; i-- {
		output[count[(data[i]/exp)%10]-1] = data[i]
		count[(data[i]/exp)%10]--
	}

	// Copy output array to data
	for i := 0; i < n; i++ {
		data[i] = output[i]
	}
}

func builtinSort(data []int) {
	slices.Sort(data)
}

func main() {
	// Read data.json
	dataFile, err := os.ReadFile("../data.json")
	if err != nil {
		fmt.Printf("Error reading data.json: %v\n", err)
		return
	}

	var data []int
	err = json.Unmarshal(dataFile, &data)
	if err != nil {
		fmt.Printf("Error parsing data.json: %v\n", err)
		return
	}

	// Read config.json
	configFile, err := os.ReadFile("../config.json")
	if err != nil {
		fmt.Printf("Error reading config.json: %v\n", err)
		return
	}

	var config Config
	err = json.Unmarshal(configFile, &config)
	if err != nil {
		fmt.Printf("Error parsing config.json: %v\n", err)
		return
	}

	// Create expected sorted data for validation
	expected := copySlice(data)
	slices.Sort(expected)

	// Run benchmarks
	runBenchmark("Bubble sort", data, expected, config.Iterations, bubbleSort)
	runBenchmark("Radix sort", data, expected, config.Iterations, radixSort)
	runBenchmark("Built-in sort", data, expected, config.Iterations, builtinSort)
}
