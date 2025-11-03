# PROYECTO 4 – DESARROLLO WEB
## 🏀 MARCADOR DE BALONCESTO

**Integrantes**
- Roberto Antonio Ramírez Gómez — 7690-22-12700
- Jean Klaus Castañeda Santos — 7690-22-892
- Jonathan Joel Chan Cuellar — 7690-22-1805

---

# Manual Técnico – Backend (Microservicios )

---

## Tabla de contenidos
1. [Introducción](#1-introducción)  
2. [Alcance](#2-alcance)  
3. [Arquitectura general](#3-arquitectura-general)  
4. [Estructura del repositorio](#4-estructura-del-repositorio)  
5. [Configuración y variables de entorno](#5-configuración-y-variables-de-entorno)  
6. [Seguridad (AuthN/AuthZ & JWT)](#6-seguridad-authnauthz--jwt)  
7. [Bases de datos](#7-bases-de-datos)  
8. [.NET Program.cs y middleware](#8-net-programcs-y-middleware)  
9. [Contratos y Endpoints por servicio](#9-contratos-y-endpoints-por-servicio)  
10. [Paginación y filtros](#10-paginación-y-filtros)  
11. [Tiempo real (SignalR)](#11-tiempo-real-signalr)  
12. [Manejo de errores](#12-manejo-de-errores-problem-details)  
13. [Validaciones clave](#13-validaciones-clave)  
14. [Logs, healthchecks y observabilidad](#14-logs-healthchecks-y-observabilidad)  
15. [Ejecución local (sin Docker)](#15-ejecución-local-sin-docker)  
16. [Docker & Nginx (despliegue)](#16-docker--nginx-despliegue)  
17. [Pruebas rápidas (curl/Postman)](#17-pruebas-rápidas-curlpostman)  
18. [Troubleshooting](#18-troubleshooting)  
19. [Respaldo y restauración](#19-respaldo-y-restauración)  
20. [Versionado, licencias y cambios](#20-versionado-licencias-y-cambios)  
21. [Anexos](#21-anexos)

---

## 1) Introducción
El backend del marcador evolucionó a una arquitectura de microservicios. Cada dominio se implementa y despliega de forma independiente y se integra a través de HTTP (REST) y SignalR* para eventos en tiempo real. El *Nginx gateway expone un único *edge** (`/api/*`, `/hub/matches`) hacia el frontend Angular.

---

## 2) Alcance
- Autenticación, roles y menús.  
- Equipos y jugadores (CRUD y consultas).  
- Partidos, anotaciones, faltas, cronómetro y periodos (tiempo real).  
- Torneos (grupos/slots y vínculo con partidos).  
- Reportes agregados (*standings*, resúmenes) servidos por * FAST API

---

## 3) Arquitectura general
**Servicios y puertos internos (por defecto en Compose):**
- **auth-service** — ASP.NET 8 + SQL Server (**:8080**; expuesto **:5000** en host opcional)  
- **matches-service** — ASP.NET 8 + SignalR + SQL Server (**:8081**; expuesto **:5002**)  
- **tournament-service** — ASP.NET 8 + SQL Server (**:8083**)  
- **teams-service** — Spring Boot + PostgreSQL (**:8082**)  
- **players-service** — Node/Express + MySQL (**:3000**)  
- **report-service** — FastAPI + MongoDB (**:8080**; expuesto **:8084**)  
- **Nginx (web)** — Frontend estático y reverse proxy (**:80**)

**Bases de datos:**
- SQL Server 2022 (auth, matches, tournaments)  
- PostgreSQL 16 (teams)  
- MySQL 8 (players)  
- MongoDB 6 (reports/ETL)

**Diagrama (alto nivel)**
```
Angular (Nginx)
  ├─ /api/auth ─────────────► auth-service (.NET, SQL Server)
  ├─ /api/matches ──────────► matches-service (.NET, SignalR, SQL Server)
  │                            └─ Hub interno: /hub/score
  ├─ /api/teams ─────────────► teams-service (Spring Boot, PostgreSQL)
  ├─ /api/players ───────────► players-service (Node/Express, MySQL)
  ├─ /api/tournaments ───────► tournament-service (.NET, SQL Server)
  └─ /api/reports ───────────► report-service (FastAPI, Mongo)
                                     ▲
                                     └─ Leer APIs base (teams/players/matches)
```

**WebSockets/Hubs**
```
Cliente → Nginx: /hub/matches   → matches-service: /hub/score
negotiate: /hub/matches/negotiate → /hub/score/negotiate
```

---

## 4) Estructura del repositorio
```
/auth-service/            # ASP.NET 8 (JWT, Roles, Menú, OAuth opcional)
/matches-service/         # ASP.NET 8 + SignalR (hub: /hub/score)
/tournament-service/      # ASP.NET 8 (torneos)
/teams-service/           # Spring Boot (JPA/Hibernate) puerto 8082
/players-service/         # Node/Express (Joi) puerto 3000
/report-service/          # FastAPI (JSON/PDF, agregados) prefijo /reports interno
/web/                     # Nginx (frontend + proxy)
docker-compose.yml
```

---

## 5) Configuración y variables de entorno


### 5.1 Variables comunes
| Variable | Ejemplo | Nota |
|---|---|---|
| `JWT__ISSUER` | `auth-service` | Emisor uniforme |
| `JWT__AUDIENCE` | `py-microservices` | Audiencia |
| `JWT__KEY` | `CHANGEME-32bytes-min` | HS256 compartida (ver recomendaciones) |
| `CORS__ALLOWED_ORIGINS__0` | `http://localhost` | Orígenes frontend |
| `CORS__ALLOWED_ORIGINS__1` | `https://proyectosdw.lat` | Prod |

### 5.2 Por servicio
**auth-service (.NET)**  
- `ASPNETCORE_URLS=http://+:8080`  
- `ConnectionStrings__DefaultConnection=Server=db,1433;Database=authDb;User Id=sa;Password=...;TrustServerCertificate=True;Encrypt=False`  
- `Jwt__Issuer=auth-service` · `Jwt__Audience=py-microservices` · `Jwt__Key=...` · `Jwt__ExpiresInMinutes=60`  
- (OAuth opc.) `Authentication__GitHub__ClientId/ClientSecret`

**matches-service (.NET)**  
- `ASPNETCORE_URLS=http://+:8081`  
- `ConnectionStrings__DefaultConnection=Server=db,1433;Database=matchesDb;User Id=sa;Password=...;Encrypt=False;TrustServerCertificate=True`  
- `Jwt__*` mismos valores que auth

**tournament-service (.NET)**  
- `ASPNETCORE_URLS=http://+:8083`  
- `ConnectionStrings__DefaultConnection=Server=db,1433;Database=tournamentsDb;User Id=sa;Password=...;Encrypt=False;TrustServerCertificate=True`

**teams-service (Spring Boot)**  
- `SPRING_DATASOURCE_URL=jdbc:postgresql://teams-db:5432/teamsdb`  
- `SPRING_DATASOURCE_USERNAME=postgres` · `SPRING_DATASOURCE_PASSWORD=...`  
- `security.jwt.secret=...` (HS256)  
- `server.port=8082`

**players-service (Node/Express)**  
- `PORT=3000`  
- `DB_HOST=players-db` · `DB_USER=...` · `DB_PASSWORD=...` · `DB_NAME=playersDb`  
- `AUTH_HS256_SECRET=...`

**report-service (FastAPI)**  
- `SERVICE_PORT=8080`  
- `MONGO_URL=mongodb://mongo:27017` · `REPORTS_DB=reports`  
- `AUTH_HS256_SECRET=...` · `JWT_ISSUER=auth-service` · `JWT_AUDIENCE=py-microservices`  
- `TEAMS_API_BASE=http://teams-service:8082/api` · `PLAYERS_API_BASE=http://players-service:3000/api` · `MATCHES_API_BASE=http://matches-service:8081/api`



---

## 6) Seguridad (AuthN/AuthZ & JWT)
- Emisión de JWT por `auth-service`.  
- Verificación del token en cada gateway /api/ y en los servicios.  
- Rutas de administración (roles/menú/reportes sensibles) requieren `role=admin`.  
- Bearer interno*opcional para `/api/reports/*` (inyectado por Nginx) con `role=admin`.

Cabecera estándar:
```
Authorization: Bearer <JWT>
```

---

## 7) Bases de datos
| Servicio | Motor | BD | Notas |
|---|---|---|---|
| auth-service | SQL Server | `authDb` | usuarios/roles/menú |
| matches-service | SQL Server | `matchesDb` | partidos, eventos, timer |
| tournament-service | SQL Server | `tournamentsDb` | grupos/slots |
| teams-service | PostgreSQL | `teamsdb` | equipos, relaciones |
| players-service | MySQL | `playersDb` | jugadores |
| report-service | MongoDB | `reports` | documentos agregados/ETL |


---

## 8) .NET Program.cs y middleware
- **Swagger** (dev) protegido en prod.  
- **CORS** (dominios del frontend).  
- **UseAuthentication/UseAuthorization** con **JWT**.  
- **DbContext** SQL Server.  
- **SignalR** (matches-service):  
```csharp
app.MapHub<ScoreHub>("/hub/score");
```

---

## 9) Contratos y Endpoints por servicio
> Los de escritura requieren JWT y, si corresponde, rol `admin`.

### 9.1 auth-service (`/api/auth`, `/api/role`, `/api/menu`)
- `POST /api/auth/login` → `{ token, expires, role, userId }`  
- Roles: `GET/POST/PUT/DELETE /api/role/*`  
- Menú: `GET /api/menu`, `GET /api/menu/{roleId}`, `POST /api/menu/role/{roleId}`, `GET /api/menu/mine`

### 9.2 teams-service (`/api/teams`)
- `GET /api/teams`, `GET /api/teams/{id}`, `POST /api/teams`, `PUT /api/teams/{id}`, `DELETE /api/teams/{id}`  
- `GET /api/teams/{id}/players`, `GET /api/teams/name/{name}/players`

### 9.3 players-service (`/api/players`)
- `GET /api/players`, `GET /api/players/{id}`, `GET /api/players/team/{teamId}`  
- `POST /api/players`, `PUT /api/players/{id}`, `DELETE /api/players/{id}`

### 9.4 matches-service (`/api/matches`)
- `GET /api/matches`, `GET /api/matches/{id}`  
- `GET /api/matches/proximos`, `GET /api/matches/rango?from=...&to=...`  
- `POST /api/matches/programar`  
- **Marcador**: `POST /api/matches/{id}/score`  
- **Faltas**: `POST /api/matches/{id}/foul`, `POST /api/matches/{id}/fouls` (+ `/adjust`)  
- **Tiempo**: `POST /api/matches/{id}/timer/{{start|pause|resume|reset}}`  
- **Periodo**: `POST /api/matches/{id}/quarters/{{advance|auto-advance}}`  
- **Estado**: `POST /api/matches/{id}/{{finish|cancel|suspend}}`  
- `GET /health`

### 9.5 tournament-service (`/api/tournaments`)
- `GET /api/tournaments`, `GET /api/tournaments/{id}`  
- `PUT /api/tournaments/{id}/groups/{{groupKey}}/slots/{{slotIndex}}`  
- `PATCH /api/tournaments/{id}/matches/{{matchId}}`

### 9.6 report-service (externo: `/api/reports` → interno: `/reports`)
- `GET /api/reports/standings`  
- `GET /api/reports/stats/summary`

---

## 10) Paginación y filtros
```
GET /api/players?page=1&pageSize=20&sort=name:asc&teamId=12
```
Respuesta
```json
{ "items":[], "page":1, "pageSize":20, "total":133, "hasNext":true }
```

---

## 11) Tiempo real (SignalR)
- **Ruta interna**: `/hub/score` (matches-service)  
- **A través de Nginx**: `/hub/matches` y `/hub/matches/negotiate`  
- **Grupos**: `match:{{id}}`

Cliente (JS):
```js
const conn = new signalR.HubConnectionBuilder()
  .withUrl("/hub/matches?matchId=2006")
  .withAutomaticReconnect()
  .build();
await conn.start();
```

---

## 12) Manejo de errores (Problem Details)
Errores REST en `application/problem+json` (RFC 7807):
```json
{ "type":"https://httpstatuses.com/400","title":"Bad Request","status":400,"detail":"Equipo duplicado","instance":"/api/teams" }
```

---

## 13) Validaciones clave
- Unicidad de equipos/jugadores.  
- Prohibir eventos tras **finalizado**.  
- Puntos válidos (1/2/3).  
- Partidos con **fecha no pasada**.  
- IDs válidos y referenciales en torneos.

---

## 14) Logs, healthchecks y observabilidad
- **Serilog** (servicios .NET) → consola; mínimo `Information`.  
- **Spring Actuator** en teams (`/actuator/health`).  
- **Morgan** o logs propios en players-service.  
- **Uvicorn** logs en report-service.  
- Health endpoints: `/health`, `/actuator/health`, `/reports/health`.  
- Compose con `healthcheck` para dependencias.

---

## 15) Ejecución local (sin Docker)
- **.NET**: `dotnet restore && dotnet build && dotnet run`  
- **Spring**: `./mvnw spring-boot:run`  
- **Node**: `npm install && npm run dev`  
- **FastAPI**: `uvicorn app.main:app --reload --port 8080`

---

## 16) Docker & Nginx (despliegue)
**Puertos host típicos**: `80(web) · 1433(SQL Server) · 5435(Postgres) · 3300(MySQL) · 8084(report-service)`

**Gateway Nginx (fragmento)**
```nginx
# /etc/nginx/conf.d/gateway.conf
map $http_upgrade $connection_upgrade {{ default: close, 'websocket': upgrade }};

server {{
  listen 80;
  server_name _;

  # API por prefijo
  location /api/auth/        {{ proxy_pass http://auth-service:8080/;        proxy_http_version 1.1; }}
  location /api/matches/     {{ proxy_pass http://matches-service:8081/;     proxy_http_version 1.1; }}
  location /api/teams/       {{ proxy_pass http://teams-service:8082/;       proxy_http_version 1.1; }}
  location /api/players/     {{ proxy_pass http://players-service:3000/;     proxy_http_version 1.1; }}
  location /api/tournaments/ {{ proxy_pass http://tournament-service:8083/;  proxy_http_version 1.1; }}

  # Reportes (opcional: inyectar Bearer interno)
  location /api/reports/ {{
    proxy_pass http://report-service:8080/;
    proxy_http_version 1.1;
    # proxy_set_header Authorization "Bearer $RS_TOKEN"; # usar si se requiere
  }}

  # SignalR (WS público → hub interno)
  location = /hub/matches/negotiate {{ proxy_pass http://matches-service:8081/hub/score/negotiate; proxy_http_version 1.1; }}
  location ^~ /hub/matches {{ proxy_pass http://matches-service:8081/hub/score; proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host; }}

  # Headers comunes
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_read_timeout 600s;
}}
```

**Compose (fragmento)**
```yaml
services:
  web:
    image: nginx:1.27-alpine
    volumes:
      - ./web/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./front/dist/:/usr/share/nginx/html:ro
    ports: ["80:80"]
    depends_on: [api, matches-service, teams-service, players-service, report-service]

  auth-service:
    build: ./auth-service
    environment:
      ASPNETCORE_URLS: http://+:8080
      ConnectionStrings__DefaultConnection: Server=db,1433;Database=authDb;User Id=sa;Password=${{SA_PASSWORD}};Encrypt=False;TrustServerCertificate=True
      Jwt__Issuer: auth-service
      Jwt__Audience: py-microservices
      Jwt__Key: ${{JWT_KEY}}
    depends_on: [db]

  matches-service:
    build: ./matches-service
    environment:
      ASPNETCORE_URLS: http://+:8081
      ConnectionStrings__DefaultConnection: Server=db,1433;Database=matchesDb;User Id=sa;Password=${{SA_PASSWORD}};Encrypt=False;TrustServerCertificate=True
      Jwt__Issuer: auth-service
      Jwt__Audience: py-microservices
      Jwt__Key: ${{JWT_KEY}}
    depends_on: [db]

  teams-service:
    build: ./teams-service
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://teams-db:5432/teamsdb
      SPRING_DATASOURCE_USERNAME: postgres
      SPRING_DATASOURCE_PASSWORD: ${{POSTGRES_PASSWORD}}
      security.jwt.secret: ${{JWT_KEY}}
    depends_on: [teams-db]

  players-service:
    build: ./players-service
    environment:
      PORT: 3000
      DB_HOST: players-db
      DB_USER: ${{MYSQL_USER}}
      DB_PASSWORD: ${{MYSQL_PASSWORD}}
      DB_NAME: playersDb
      AUTH_HS256_SECRET: ${{JWT_KEY}}
    depends_on: [players-db]

  report-service:
    build: ./report-service
    environment:
      SERVICE_PORT: 8080
      MONGO_URL: mongodb://mongo:27017
      REPORTS_DB: reports
      AUTH_HS256_SECRET: ${{JWT_KEY}}
      TEAMS_API_BASE: http://teams-service:8082/api
      PLAYERS_API_BASE: http://players-service:3000/api
      MATCHES_API_BASE: http://matches-service:8081/api
    depends_on: [mongo]
```

---

## 17) Pruebas rápidas (curl/Postman)
**Login**
```bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login -H "Content-Type: application/json" -d '{{"username":"admin","password":"admin"}}' | jq -r .token)
```

**Listar equipos**
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost/api/teams
```

**Negociación SignalR**
```bash
curl -i "http://localhost/hub/matches/negotiate?negotiateVersion=1&matchId=2006"
```

---

## 18) Troubleshooting
- **502 /api/reports/** → `report-service` caído o falta/incorrecto `Authorization` interno; validar `AUTH_HS256_SECRET` y `*API_BASE`.  
- **404 negotiate** → confirmar mapeo `/hub/matches/negotiate` → `/hub/score/negotiate`.  
- **CORS** → agregar dominio del frontend en cada servicio.  
- **401/403** → token ausente/expirado; roles insuficientes.  
- **SQL Server/Postgres/MySQL** → credenciales/puertos y `healthcheck`.  
- **WebSockets** → headers `Upgrade/Connection` en gateway.

---

## 19) Respaldo y restauración
**SQL Server (.bak dentro del contenedor)**
```bash
/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -Q "BACKUP DATABASE matchesDb TO DISK='/var/opt/mssql/backup/matchesDb.bak'"
```

**PostgreSQL**
```bash
pg_dump -h teams-db -U postgres -d teamsdb > teamsdb.sql
```

**MySQL**
```bash
mysqldump -h players-db -u $MYSQL_USER -p$MYSQL_PASSWORD playersDb > playersDb.sql
```

**MongoDB**
```bash
mongodump --uri="mongodb://mongo:27017" -d reports -o backup_reports/
```

---

## 20) Versionado, licencias y cambios
- **SemVer** y etiquetas por servicio.  
- Cambios clave vs. monolito: separación por dominio, **Nginx gateway**, **SignalR** aislado en matches-service, reportería aparte (FastAPI).

---

## 21) Anexos
**Roles/Permisos (resumen)**
| Recurso         | GET        | POST  | PUT   | DELETE |
|-----------------|------------|-------|-------|--------|
| Teams           | user/admin | admin | admin | admin  |
| Players         | user/admin | admin | admin | admin  |
| Matches         | user/admin | admin | admin | admin  |
| Tournaments     | user/admin | admin | admin | admin  |
| Reports         | admin      | –     | –     | –      |
| Roles & Menú    | admin      | admin | admin | admin  |

**Plantilla .env (ejemplo base)**
```env
# JWT
JWT_KEY=CHANGEME-32bytes-min
JWT_ISSUER=auth-service
JWT_AUDIENCE=py-microservices

# SQL Server
SA_PASSWORD=YourStrong!Passw0rd

# Postgres / MySQL
POSTGRES_PASSWORD=postgrespass
MYSQL_USER=jonathan
MYSQL_PASSWORD=mysqlpass
```

---
---

##  Bibliotecas y librerías utilizadas

| Microservicio | Lenguaje / Framework | Librerías principales | Propósito |
|----------------|----------------------|------------------------|------------|
| **auth-service** | ASP.NET Core 8 | `Microsoft.EntityFrameworkCore`, `Microsoft.AspNetCore.Authentication.JwtBearer`, `Serilog`, `Swashbuckle.AspNetCore` | Manejo de autenticación, roles, emisión de tokens JWT y Swagger para pruebas. |
| **matches-service** | ASP.NET Core 8 + SignalR | `Microsoft.AspNetCore.SignalR`, `EntityFrameworkCore`, `Serilog`, `AutoMapper` | Control de partidos, cronómetro y marcador en tiempo real mediante WebSockets. |
| **tournament-service** | ASP.NET Core 8 | `EntityFrameworkCore`, `FluentValidation`, `Serilog` | Gestión de torneos, grupos y emparejamientos. |
| **teams-service** | Java Spring Boot | `Spring Web`, `Spring Data JPA`, `Hibernate`, `Lombok`, `Spring Boot Actuator`, `jjwt` | Administración de equipos y conexión con PostgreSQL. |
| **players-service** | Node.js (Express) | `express`, `mysql2`, `sequelize`, `joi`, `cors`, `morgan`, `dotenv` | CRUD de jugadores y validaciones con conexión MySQL. |
| **report-service** | Python (FastAPI) | `fastapi`, `uvicorn`, `pydantic`, `pymongo`, `reportlab`, `requests` | Generación de reportes PDF y agregados estadísticos desde MongoDB. |
| **frontend (Angular)** | Angular 20 + TypeScript | `@angular/core`, `@angular/material`, `rxjs`, `signalr`, `jspdf`, `ngx-toastr` | Interfaz web, conexión al hub de tiempo real y descarga de reportes. |
| **gateway (Nginx)** | Nginx 1.27-alpine | — | Reverse proxy para microservicios y túnel de WebSockets (`/hub/matches`). |

---

> **Nota:** Cada microservicio utiliza su propio conjunto de dependencias específicas, pero todos comparten un esquema común de comunicación REST con autenticación JWT y CORS habilitado hacia el dominio del frontend (`https://proyectosdw.lat`).
