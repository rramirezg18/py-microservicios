# Guía de Despliegue en VPS — Proyecto py-microservicios
## Angular (Frontend) + Nginx (Gateway) + .NET / Spring Boot / Node / FastAPI + DBs

> Preparada para Ubuntu 22.04/24.04 LTS o 24.04 LTS (VPS sin interfaz gráfica).  
> El sistema expone /api/ (REST) y /hub/matches (SignalR, mapeado al hub interno /hub/score del `matches-service`).  
> Frontend como SPA estática detrás de Nginx (recomendado) o SSR (Node/Express) opcional.

---

## Integrantes
- **Roberto Antonio Ramírez Gómez** — 7690-22-12700  
- **Jean Klaus Castañeda Santos** — 7690-22-892  
- **Jonathan Joel Chan Cuellar** — 7690-22-1805

---

## 0) Requisitos previos

- Usuario con sudo y acceso SSH por llave.
- **DNS** apuntando al VPS (p. ej. `proyectosdw.lat`).
- **Docker + Docker Compose**:
  ```bash
  sudo apt update
  sudo apt install -y docker.io
  sudo usermod -aG docker $USER   # cerrar sesión y volver a entrar
  ```
- (Si usarás Nginx en el host para servir SPA/SSR y TLS)
  ```bash
  sudo apt install -y nginx
  sudo apt install -y certbot python3-certbot-nginx  # opcional TLS
  ```
- (Solo si compilarás SSR en el VPS) **Node.js 20**:
  ```bash
  sudo apt install -y curl && curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
  ```

> La app usa rutas relativas (`/api`, `/api/reports`, `/hub/matches`), por lo que no necesitas recompilar al cambiar de dominio si el proxy/gateway está bien configurado.

---

## 1) Pasos generales de principio a fin

1) **Conectarse por SSH**
```bash
ssh -i ~/.ssh/tu_llave.pem usuario@IP_PUBLICA
```

2) **Clonar o actualizar el repo**
```bash
cd /opt
sudo git clone https://github.com/rramirezg18/py-microservicios.git
# si ya existe:
cd /opt/py-microservicios && git pull
```

3) **Variables de entorno (.env)**
Crea/actualiza un `.env` en la raíz (si tu `docker-compose.yml` lo usa) con claves reales:
```env
# JWT
JWT_KEY=CHANGEME-32bytes-min
JWT_ISSUER=auth-service
JWT_AUDIENCE=py-microservices

# SQL Server
SA_PASSWORD=YourStrong!Passw0rd

# Postgres / MySQL
POSTGRES_PASSWORD=postgrespass
MYSQL_USER=appuser
MYSQL_PASSWORD=mysqlpass
```

4) **Levantar todos los servicios (Docker Compose)**
Desde la carpeta donde está **docker-compose.yml**:
```bash
docker compose pull          # opcional, para traer imágenes nuevas
docker compose up -d         # inicia todo en segundo plano
docker compose ps            # estado de contenedores
```

5) **Ver estado y logs**
```bash
docker compose logs -f web                 # Nginx gateway + frontend
docker compose logs -f auth-service        # .NET Auth
docker compose logs -f matches-service     # .NET Matches + SignalR
docker compose logs -f teams-service       # Spring Boot Teams
docker compose logs -f players-service     # Node/Express
docker compose logs -f report-service      # FastAPI Reports
docker compose logs -f tournament-service  # .NET Tournaments (si está en compose)
```

6) **Pruebas rápidas**
```bash
curl -I http://proyectosdw.lat
curl -i "http://proyectosdw.lat/hub/matches/negotiate?negotiateVersion=1&matchId=1"
```

7) **TLS con Nginx (host, opcional pero recomendado)**
```bash
sudo certbot --nginx -d proyectosdw.lat -m tu-correo@dominio.com --agree-tos --redirect
```

---

## 2) Estructura esperada en VPS

```
/opt/py-microservicios/
  ├─ docker-compose.yml
  ├─ web/                         # Nginx gateway (conf de proxy y estáticos del front)
  │   └─ nginx.conf               # archivo de configuración usado por el contenedor 'web'
  ├─ frontend/                    # código Angular (si construyes en VPS)
  ├─ auth-service/                # ASP.NET 8
  ├─ matches-service/             # ASP.NET 8 + SignalR (hub interno: /hub/score)
  ├─ teams-service/               # Spring Boot (8082)
  ├─ players-service/             # Node/Express (3000)
  ├─ report-service/              # FastAPI (8080)
  ├─ tournament-service/          # ASP.NET 8 (8083) (si está activo)
  └─ docs/                        # documentación (.md)
```

---

## 3) Gateway Nginx en contenedor **web** 

> Este archivo se monta en el contenedor `web` (Nginx) y sirve el frontend + hace proxy a los microservicios.

**Ruta sugerida:** `/opt/py-microservicios/web/nginx.conf`
```nginx
# /etc/nginx/conf.d/default.conf   (montado por el servicio 'web')

map $http_upgrade $connection_upgrade { default close; websocket upgrade; }

server {
  listen 80;
  server_name _;

  # === Frontend SPA (build estático incluido en la imagen o montado como volumen) ===
  root /usr/share/nginx/html;
  index index.html;

  # === API por prefijo (nombres reales de contenedores) ===
  location /api/auth/        { proxy_pass http://auth-service:8080/;        proxy_http_version 1.1; }
  location /api/matches/     { proxy_pass http://matches-service:8081/;     proxy_http_version 1.1; }
  location /api/teams/       { proxy_pass http://teams-service:8082/;       proxy_http_version 1.1; }
  location /api/players/     { proxy_pass http://players-service:3000/;     proxy_http_version 1.1; }
  location /api/tournaments/ { proxy_pass http://tournament-service:8083/;  proxy_http_version 1.1; }  # si aplica
  location /api/reports/     {
    proxy_pass http://report-service:8080/;
    proxy_http_version 1.1;
    # Si tu report-service exige Bearer interno, descomenta y coloca un JWT válido:
    # proxy_set_header Authorization "Bearer <JWT_RS_INTERNO>";
  }

  # === SignalR público → hub interno ===
  location = /hub/matches/negotiate { proxy_pass http://matches-service:8081/hub/score/negotiate; proxy_http_version 1.1; }
  location ^~ /hub/matches {
    proxy_pass         http://matches-service:8081/hub/score;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection $connection_upgrade;
    proxy_set_header   Host $host;
    proxy_read_timeout 600s;
  }

  # === SPA fallback ===
  location / { try_files $uri $uri/ /index.html; }

  # === Cache de estáticos (opcional) ===
  location ~* \.(?:js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
    expires 7d;
    access_log off;
  }
}
```

> Reiniciar el servicio `web` tras cambios:
```bash
docker compose restart web
docker compose logs -f web
```

---

## 4) Frontend (Angular) — Build y modos

### A) **SPA estática**
- El Dockerfile del frontend suele copiar `dist/<app>/browser` a `/usr/share/nginx/html` dentro del contenedor `web`.
- Para reconstruir solo el front:
  ```bash
  cd /opt/py-microservicios/frontend
  npm ci
  npm run build -- --configuration production
  # Reempaquetar imagen del 'web' si tu pipeline lo hace, o copiar el 'dist' como volumen.
  ```

### B) **SSR (opcional)** con Node/Express
- Build:
  ```bash
  cd /opt/py-microservicios/frontend
  npm ci
  npm run build      # genera browser + server
  # dist/<app>/browser  y  dist/<app>/server/server.mjs
  ```
- Servicio systemd (si lo sirves en el host):
  ```ini
  # /etc/systemd/system/frontend-ssr.service
  [Unit]
  Description=Frontend SSR
  After=network.target

  [Service]
  Type=simple
  User=www-data
  WorkingDirectory=/opt/py-microservicios/frontend
  Environment=PORT=4000
  ExecStart=/usr/bin/node dist/scoreboard/server/server.mjs
  Restart=always

  [Install]
  WantedBy=multi-user.target
  ```
- Nginx (host) → SSR:
  ```nginx
  server {
    listen 80;
    server_name proyectosdw.lat;
    location / { proxy_pass http://127.0.0.1:4000/; proxy_http_version 1.1; }
    location /api/          { proxy_pass http://127.0.0.1:8080/; proxy_http_version 1.1; }
    location /api/reports/  { proxy_pass http://127.0.0.1:8080/; proxy_http_version 1.1; }
    location = /hub/matches/negotiate { proxy_pass http://127.0.0.1:8080/hub/score/negotiate; proxy_http_version 1.1; }
    location ^~ /hub/matches {
      proxy_pass         http://127.0.0.1:8080/hub/score;
      proxy_http_version 1.1;
      proxy_set_header   Upgrade $http_upgrade;
      proxy_set_header   Connection "upgrade";
      proxy_set_header   Host $host;
      proxy_read_timeout 600s;
    }
  }
  ```

---

## 5) Operación con Docker Compose 

```bash
# Arrancar todo
docker compose up -d

# Estado
docker compose ps

# Logs en vivo (ejemplos)
docker compose logs -f web
docker compose logs -f matches-service
docker compose logs -f report-service

# Reiniciar un servicio
docker compose restart matches-service

# Actualizar código e imágenes y redeploy
git pull
docker compose pull
docker compose up -d

# Apagar
docker compose down
```

---

## 6) Checklist de verificación

- **Sitio responde:**  
  `curl -I http://proyectosdw.lat` → `200 OK`.
- **Auth/health (si existe endpoint):**  
  `curl -i http://proyectosdw.lat/api/auth/health`
- **Reportes:**  
  Descargar `http://proyectosdw.lat/api/reports/*.pdf` → **200 OK**  
  - **401/502** → revisar token interno (si aplica) o estado de `report-service`.
- **Tiempo real:**  
  En el navegador → *DevTools → Network → WS* → ver **101 Switching Protocols** a `/hub/matches`.  
  Negociación:
  ```bash
  curl -i "http://proyectosdw.lat/hub/matches/negotiate?negotiateVersion=1&matchId=1"
  ```

---

## 7) Problemas comunes y solución rápida

- **502 en `/api/reports/`**  
  `report-service` caído o proxy mal configurado. Si exige **Bearer interno**, añade en el gateway:  
  `proxy_set_header Authorization "Bearer <JWT_RS_INTERNO>";`
- **401/403**  
  Token vencido o rol insuficiente. Re-login y valida claims/roles.
- **WebSockets no conectan**  
  Falta `Upgrade/Connection` en la ruta `/hub/matches` o el mapeo a `/hub/score`.
- **404 al refrescar (SPA)**  
  Falta `try_files $uri $uri/ /index.html;` en Nginx.
- **CORS en desarrollo**  
  Usar `ng serve --proxy-config proxy.conf.json`; en prod, configurar CORS en cada servicio.

---

## 8) Rollback rápido

- Mantén una **tag**/commit estable del repo o una copia del **dist** del frontend.
- Volver a versión anterior:
  ```bash
  docker compose down
  git checkout <tag_o_commit_estable>
  docker compose up -d
  ```
- En SSR (host):
  ```bash
  sudo systemctl restart frontend-ssr
  ```

---

## 9) Datos útiles

- **Logs Nginx (host):** `/var/log/nginx/access.log`, `/var/log/nginx/error.log`  
- **Probar Nginx (host):** `sudo nginx -t`  
- **Abrir puertos:** `sudo ufw allow 80,443/tcp`  
- **Estado de servicios:**
  - Host: `systemctl status nginx` (y `frontend-ssr` si aplica)
  - Docker: `docker compose ps` / `docker compose logs -f <servicio>`

---
