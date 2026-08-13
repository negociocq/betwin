FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY packages/frontend/package*.json packages/frontend/
COPY packages/shared/package*.json packages/shared/

RUN npm install

# Copy source code
COPY packages/frontend/src packages/frontend/src
COPY packages/frontend/*.config.* packages/frontend/
COPY packages/frontend/index.html packages/frontend/
COPY packages/shared/src packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/

EXPOSE 5173

CMD ["npm", "run", "dev", "--workspace=@betwin/frontend"]
