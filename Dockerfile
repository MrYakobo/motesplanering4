# Stage 1: Build Vue frontend
FROM node:20-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY server.js .
COPY lib/ lib/
COPY data.sample.json .
COPY --from=frontend /build/dist frontend/dist/
RUN if [ ! -f data_prod.json ]; then cp data.sample.json data_prod.json; fi
RUN mkdir -p uploads backups
EXPOSE 3000
CMD ["node", "server.js"]
