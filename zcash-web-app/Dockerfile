# Stage 1: Build WASM packages
FROM rustlang/rust:nightly AS wasm-builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    clang \
    llvm \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install nightly toolchain and wasm-pack
RUN rustup toolchain install nightly-2025-01-06
RUN rustup default nightly-2025-01-06
RUN rustup target add wasm32-unknown-unknown
RUN cargo install wasm-pack just

WORKDIR /build

# Copy zcash-rust-client for WASM building
COPY deps/zcash-rust-client ./deps/zcash-rust-client

# Build WASM packages
WORKDIR /build/deps/zcash-rust-client
RUN just build

# Stage 2: Runtime - Vite dev server
FROM oven/bun:latest

WORKDIR /app

# Copy built WASM packages from builder
COPY --from=wasm-builder /build/deps/zcash-rust-client/packages ./deps/zcash-rust-client/packages

# Copy root package.json for workspace catalog
COPY package.json ./

# Copy zcash-web-app source
COPY zcash-web-app/package.json zcash-web-app/bun.lock* ./zcash-web-app/

# Install dependencies
WORKDIR /app/zcash-web-app
RUN bun install --frozen-lockfile

# Copy rest of application
WORKDIR /app
COPY zcash-web-app/ ./zcash-web-app/

WORKDIR /app/zcash-web-app

# Expose Vite dev server port
EXPOSE 5173

# Run Vite dev server with host flag to allow external access
CMD ["bun", "run", "dev", "--", "--host", "0.0.0.0"]
