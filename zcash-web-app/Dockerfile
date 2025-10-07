# Stage 1: Build WASM packages
FROM rustlang/rust:nightly AS wasm-builder

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
FROM node:20-slim

WORKDIR /app

# Copy built WASM packages from builder
COPY --from=wasm-builder /build/deps/zcash-rust-client/packages ./deps/zcash-rust-client/packages

# Copy zcash-web-app source
COPY zcash-web-app/package.json zcash-web-app/package-lock.json ./

# Install dependencies
RUN npm ci

# Copy rest of application
COPY zcash-web-app/ ./

# Expose Vite dev server port
EXPOSE 5173

# Run Vite dev server with host flag to allow external access
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
