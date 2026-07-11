FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN bun x prisma generate

# Build frontend
RUN bun run build

# Expose port
EXPOSE 3001

# Start server
CMD ["bun", "run", "start"]
