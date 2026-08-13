FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY packages/backend/package*.json packages/backend/
COPY packages/shared/package*.json packages/shared/

RUN npm install

# Copy source code
COPY packages/backend/src packages/backend/src
COPY packages/shared/src packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/
COPY packages/backend/tsconfig.json packages/backend/

# Build
RUN npm run build:shared
RUN npm run build --workspace=@betwin/backend

EXPOSE 3000

CMD ["npm", "start", "--workspace=@betwin/backend"]
