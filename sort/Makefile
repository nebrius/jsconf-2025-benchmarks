run: run-js run-c run-go run-rust

run-js:
	node js/sort.mjs

run-c:
	cd c && mkdir -p build && gcc -O3 -o build/sort sort.c && ./build/sort

run-go:
	cd go && go run sort.go

run-rust:
	cd rust && cargo run --release

clean:
	rm -rf c/build
