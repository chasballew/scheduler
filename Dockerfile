FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
WORKDIR /app/frontend
RUN npm ci && npm run build
RUN cp -r dist/* ../public/
WORKDIR /app
EXPOSE 3000
CMD ["node", "src/index.js"]
