FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .

RUN bun x prisma generate
RUN bun run build

EXPOSE 3001

CMD ["sh", "-c", "bun x prisma db push --skip-generate && bun run server.tsx"]
