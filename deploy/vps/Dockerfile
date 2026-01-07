# Base image
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

# 1. Builder stage
FROM base AS builder
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy all files for installation and build
# (pnpm workspaces require all package.json files to be present)
COPY . .

# Set build-time arguments
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_ALLOW_REGISTRATION
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_ALLOW_REGISTRATION=$NEXT_PUBLIC_ALLOW_REGISTRATION

# Install dependencies and build
RUN CI=true pnpm install
RUN pnpm run build

# 2. Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create a non-privileged user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --create-home --home-dir /home/nextjs -g nodejs nextjs

# Set environment variables for corepack and pnpm
ENV COREPACK_HOME=/home/nextjs/.corepack
ENV PNPM_HOME=/home/nextjs/.pnpm
ENV PATH=$PNPM_HOME:$PATH

# Copy necessary files from builder
COPY --from=builder --chown=nextjs:nodejs /app /app

# Ensure start.sh is in the root and executable
RUN cp deploy/vps/start.sh ./start.sh && \
    chmod +x ./start.sh && \
    mkdir -p apps/web/public/uploads && \
    chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Command to run migrations, provisioning and start the app
CMD ["./start.sh"]

