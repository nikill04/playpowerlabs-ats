FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

ENV PORT=4000
ENV FRONTEND_URL=http://localhost:5173

EXPOSE 4000

CMD ["node", "index.js"]
