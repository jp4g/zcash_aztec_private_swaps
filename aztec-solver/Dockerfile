# Stage 1: Build contracts
FROM aztecprotocol/aztec:latest AS builder

WORKDIR /build

# Copy contract sources
COPY deps/aztec-standards ./deps/aztec-standards
COPY contract ./contract

# Build token contract (outputs to deps/aztec-standards/artifacts)
WORKDIR /build/deps/aztec-standards
RUN /usr/src/noir/noir-repo/target/release/nargo compile
RUN /usr/src/aztec-postprocess-contract/transpile_contract_and_gen_vks.sh
RUN node /usr/src/yarn-project/aztec/dest/bin/index.js codegen -o ./artifacts target

# Build main contract (outputs to contract/artifacts)
WORKDIR /build/contract
RUN /usr/src/noir/noir-repo/target/release/nargo compile
RUN /usr/src/aztec-postprocess-contract/transpile_contract_and_gen_vks.sh
RUN node /usr/src/yarn-project/aztec/dest/bin/index.js codegen -o ./artifacts target

# Stage 2: Runtime
FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY aztec-solver/package.json aztec-solver/bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy application source
COPY aztec-solver/src ./src
COPY aztec-solver/tsconfig.json ./
COPY aztec-solver/deployment.json ./

# Copy built contract artifacts from builder stage
COPY --from=builder /build/deps/aztec-standards/artifacts ./artifacts
COPY --from=builder /build/contract/artifacts ./artifacts

# Copy target directories (referenced by artifacts)
COPY --from=builder /build/deps/aztec-standards/target ./target
COPY --from=builder /build/contract/target ./target

# Expose port
EXPOSE 4000

# Set environment variables
ENV NODE_URL=http://aztec-sandbox:8080
ENV PORT=4000

# Start the server
CMD ["bun", "run", "src/app.ts"]
