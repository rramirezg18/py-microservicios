# frontend/Dockerfile (VERSIÓN FINAL)

# ===== Build Angular =====
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY . . 
RUN npm ci || npm install

# -------------------------------------------------------------
# CORRECCIÓN CLAVE: Usamos --output-path y --configuration (o -c)
# 1. Creamos la salida directamente en /app/dist/frontend-app.
# 2. Especificamos la configuración 'production' (o 'development' si ese es el nombre de tu config).
# -------------------------------------------------------------
RUN npx -y -p @angular/cli@20 ng build --output-path=./dist/frontend-app --configuration production

# ===== Nginx (runtime) =====
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
RUN rm -rf ./*

# -------------------------------------------------------------
# CORRECCIÓN EN LA COPIA: Ahora usamos la ruta de salida explícita
# -------------------------------------------------------------
# La ruta de origen es: /app/dist/frontend-app/browser/
COPY --from=build /app/dist/frontend-app/browser/ ./

# Copia tu configuración directa de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf