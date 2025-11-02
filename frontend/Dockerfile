# ===== Build Angular =====
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
RUN npx -y -p @angular/cli@20 ng build --output-path=./dist/frontend-app --configuration production

# ===== Nginx (runtime) =====
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
RUN rm -rf ./*

# Copia el build Angular
COPY --from=build /app/dist/frontend-app/browser/ ./

# Copia configs correctas de Nginx
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/gateway.conf /etc/nginx/conf.d/gateway.conf
RUN rm -f /etc/nginx/conf.d/default.conf

EXPOSE 80

