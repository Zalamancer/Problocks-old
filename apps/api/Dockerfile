FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY src/ ./src/
COPY tsconfig.json ./

RUN mkdir -p data

EXPOSE 5000

CMD ["node", "--import", "tsx/esm", "src/index.ts"]
