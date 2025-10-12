
FROM node:20-alpine AS build
WORKDIR /app


COPY scoreboard/package*.json ./scoreboard/
WORKDIR /app/scoreboard
RUN npm ci || npm install


COPY scoreboard/ .


RUN npx -y -p @angular/cli@20 ng build -c production



FROM nginx:alpine
WORKDIR /usr/share/nginx/html


RUN rm -rf ./*


COPY --from=build /app/scoreboard/dist/scoreboard/browser/ ./


COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
