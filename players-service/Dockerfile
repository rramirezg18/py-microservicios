FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
# Si no usas dependencias dev en runtime:
# npm ci --omit=dev || si no tienes lock, usa npm install --omit=dev
RUN npm ci || npm install

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/app.js"]
