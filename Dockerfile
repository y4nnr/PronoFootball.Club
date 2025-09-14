# Build stage
FROM node:20-bullseye AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
#RUN npm run build
CMD ["npm", "run", "dev"]
# Production stage
FROM node:20-bullseye-slim

WORKDIR /app

# Copy necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma/
#COPY --from=builder /app/.next ./.next
#COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "dev"]

