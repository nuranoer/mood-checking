# Node.js Dockerfile for Mood Check-In API
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* .npmrc* ./ 2>/dev/null || true
RUN npm install --production
COPY . .
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD [ "sh", "-c", "node src/index.js --init-db && node src/index.js" ]
