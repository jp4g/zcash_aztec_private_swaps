FROM rustlang/rust:nightly AS builder

RUN rustup toolchain install nightly-2025-01-06
RUN rustup default nightly-2025-01-06

WORKDIR /app
COPY Cargo.toml ./
COPY src ./src

RUN cargo +nightly-2025-01-06 build --release

FROM debian:bookworm-slim
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libssl3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/zcash-client .

EXPOSE 8080
CMD ["./zcash-client"]