FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

RUN mkdir -p /app/data

ENV PORT=8787
EXPOSE 8787

CMD ["npm", "start"]
