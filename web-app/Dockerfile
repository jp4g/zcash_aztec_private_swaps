FROM oven/bun:latest

WORKDIR /app

# Copy root package.json for workspace catalog
COPY package.json ../

# Copy web-app package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source files
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run Vite dev server with host flag to allow external access
CMD ["bun", "run", "dev", "--", "--host", "0.0.0.0"]
