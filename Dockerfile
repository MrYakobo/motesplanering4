FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY . .
RUN if [ ! -f data_prod.json ]; then cp data.sample.json data_prod.json; fi
EXPOSE 3000
CMD ["node", "server.js"]
