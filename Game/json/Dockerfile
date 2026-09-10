FROM node:26-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

EXPOSE 3000

ENTRYPOINT ["npx", "json-server"]