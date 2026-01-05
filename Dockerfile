# skill-ninja-mcp-server Dockerfile
# Glama.ai compatible Docker configuration

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --production

# Copy built files and resources
COPY dist ./dist
COPY resources ./resources

# Set environment variables
ENV NODE_ENV=production

# Entry point for MCP server
ENTRYPOINT ["node", "dist/index.js"]
