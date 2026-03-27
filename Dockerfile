FROM node:20-slim

WORKDIR /app

# Install root dependencies
COPY package.json package-lock.json ./
RUN npm ci --production

# Install client dependencies and build
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci
COPY client/ ./client/
RUN cd client && npx vite build

# Copy server
COPY server/ ./server/

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "server/index.js"]
