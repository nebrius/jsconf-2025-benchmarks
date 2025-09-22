# JSConf 2025 Benchmarks

This directory contains benchmarks for my JSConf 2025 talk [Creating Radical Performance Improvements: Rust is Not a Silver Bullet](https://nebri.us/talk/jsconf-us-2025-creating-radical-performance-improvements-rust-is-not-a-silver-bullet.html).

## Build tools

Here are the versions of the build tools I used to run these programs.
- Node.js 24.8.0
- Go 1.25.1
- Rust 1.89.0
- Clang: 17.0.0
  - Note: vanilla GCC is noticeably slower

If you want to run the benchmarks yourself, you should use the same versions of
these tools. Most importantly, make sure your Node.js major version is the same,
because Node.js upgrades V8 between major versions, which usually has a big
impact on performance.

Also note that I ran my benchmarks on an M4 CPU running macOS Sequoia. Different
CPU architectures and speeds will produce different results.
