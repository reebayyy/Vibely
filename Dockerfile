# API image for Back4App Containers (Express + Socket.IO).
FROM node:22-alpine

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server

EXPOSE 8080

CMD ["npm", "run", "server"]
