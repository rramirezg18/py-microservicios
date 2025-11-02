# PROYECTO 4 – DESARROLLO WEB
## 🏀 MARCADOR DE BALONCESTO

**Integrantes**
- Roberto Antonio Ramírez Gómez — 7690-22-12700
- Jean Klaus Castañeda Santos — 7690-22-892
- Jonathan Joel Chan Cuellar — 7690-22-1805

---

# Documentación General Del Backend

## 1) Introducción

El backend evolucionó de un monolito a una arquitectura de microserviciosos dominios se separan en servicios independientes que se comunican vía HTTP y, para tiempo real, con SignalR. La orquestación se realiza con Docker Compose, y las bases de datos están desacopladas por servicio
:
- **Auth** (.NET 8 + EF Core + SQL Server) — autenticación, emisión de JWT y Menú/Roles.
- **Matches** (.NET 8 + EF Core + SQL Server + SignalR)* partidos, cronómetro, marcador en vivo y hub de tiempo real.
- **Teams** (Spring Boot + PostgreSQL) — equipos y consultas relacionadas.
- **Players** (Node.js/Express + MySQL) — jugadores con validación Joi
- **Tournaments** (.NET 8 + SQL Server) — torneos y programación agregada.
- **Reports** (FastAPI + MongoDB) — *standings* y estadísticas agregadas (JSON/PDF).
- **ETL** (Python) — consolidación periódica hacia MongoDB.

.

---

## 2) Arquitectura general
- **Tipo:** Microservicios
- **Patrones (por tipo de servicio):**
  - **.NET**: Controllers + Services + Repositories · **SignalR** en *Matches*
  - **Spring Boot**: Controller + Service + Repository (JPA/Hibernate)
  - **Node/Express**: Rutas + Controladores + Middlewares (Auth/JWT + **Joi**)
  - **FastAPI**: Routers + Dependencias (autorización) + Agregadores
  - **ETL**: Tarea periódica (intervalo configurable) hacia Mongo
- **Seguridad:** **JWT** (Issuer `auth-service`, Audience `py-microservices`). Los servicios validan el token en endpoints protegidos.

### Mapa de componentes (alto nivel)
```
Angular (Nginx) ──────────────────────────────────────────────────────────┐
   ├─ /api/auth          → auth-service         (.NET 8, SQL Server)
   ├─ /api/matches       → matches-service      (.NET 8, SQL Server, SignalR)
   │                        └─ Hub interno: /hub/score  (SignalR)
   ├─ /api/teams         → teams-service        (Spring Boot, PostgreSQL)
   ├─ /api/players       → players-service      (Node/Express, MySQL)
   ├─ /api/tournaments   → tournament-service   (.NET 8, SQL Server)
   └─ /api/reports       → report-service       (FastAPI, MongoDB)
                                     └─ Prefijo interno: /reports
```

---

## 3) Estructura del backend (carpetas principales)
```
/auth-service/           # ASP.NET Core 8 (Auth, Roles, Menú, OAuth GitHub)
/matches-service/        # ASP.NET Core 8 + SignalR (hub: /hub/score)
/teams-service/          # Spring Boot (JPA) - puerto 8082
/players-service/        # Node/Express (Joi, middlewares) - puerto 3000
/tournament-service/     # ASP.NET Core 8 (Torneos)
/report-service/         # FastAPI (JSON/PDF, agregados) - prefijo interno /reports
/etl-service/            # Python ETL → MongoDB
/docker-compose.yml      # Orquestación (servicios + bases de datos)
```

---

## 4) Entradas y middleware (resumen por servicio)
- **Auth (.NET)**: Swagger, CORS (perfil *frontend*), `UseAuthentication` + `UseAuthorization`, Controllers.  
- **Matches (.NET)**: Swagger/CORS/JWT + `MapHub<ScoreHub>("/hub/score")`.  
- **Teams (Spring)**: CORS/JWT via `SecurityConfig`, `Actuator /health`.  
- **Players (Node)**: CORS restrictivo, middlewares `requireAuth/requireRole`, validación con **Joi**.  
- **Reports (FastAPI)**: `include_router(..., prefix="/reports")`, dependencias `require_admin` (autorización).  
- **ETL (Python)**: programa intervalado por env (`ETL_INTERVAL_SECONDS`).



---

## 5) Configuración (variables por servicio)


**Auth (.NET)**
- `ASPNETCORE_URLS=http://+:8080`
- `ConnectionStrings__DefaultConnection=Server=db,1433;Database=authDb;User Id=sa;Password=***;TrustServerCertificate=true;`
- `Jwt__Issuer=auth-service` · `Jwt__Audience=py-microservices` · `Jwt__Key=***` · `Jwt__ExpiresInMinutes=60`
- `Frontend__OAuthRedirect=http://<dominio>/oauth/callback`
- (Opcional OAuth GitHub) `Authentication__GitHub__ClientId`, `ClientSecret`, `CallbackPath=/signin-github`

**Matches (.NET)**
- `ASPNETCORE_URLS=http://+:8081`
- `ConnectionStrings__DefaultConnection=Server=db,1433;Database=matchesDb;User Id=sa;Password=***;TrustServerCertificate=true;Encrypt=False`
- `Jwt__Issuer`, `Jwt__Audience`, `Jwt__Key` (mismos valores)

**Teams * 

- `SPRING_DATASOURCE_URL=jdbc:postgresql://teams-db:5432/teamsdb`
- `SPRING_DATASOURCE_USERNAME=postgres` · `SPRING_DATASOURCE_PASSWORD=***`
- `security.jwt.secret=***` (HS256)  
- `players.service.base-url=http://players-service:3000/api` *(ajusta al puerto real del servicio Players)*

**Players (Node/Express)**
- `PORT=3000`
- `DB_HOST=players-db` · `DB_USER=jonathan` · `DB_PASSWORD=***` · `DB_NAME=playersDb`
- `AUTH_HS256_SECRET=***` (validación JWT)

**Tournaments (.NET)**
- `ASPNETCORE_URLS=http://+:8083`
- `ConnectionStrings__DefaultConnection=Server=db,1433;Database=tournamentsDb;User Id=sa;Password=***;TrustServerCertificate=true;`

**Reports (FastAPI)**
- `SERVICE_PORT=8080`
- `MONGO_URL=mongodb://mongo:27017` · `REPORTS_DB=reports`
- `JWT_ISSUER=auth-service` · `JWT_AUDIENCE=py-microservices`
- `AUTH_HS256_SECRET=***` (o `AUTH_PUBLIC_KEY_PEM` si migras a RS256)
- `TEAMS_API_BASE=http://teams-service:8082/api`
- `PLAYERS_API_BASE=http://players-service:3000/api`
- `MATCHES_API_BASE=http://matches-service:8081/api`

**ETL (Python)**
- `MONGO_URL=mongodb://mongo:27017` · `REPORTS_DB=reports`
- `ETL_INTERVAL_SECONDS=120` · `RUN_ONCE=0/1`
- `*_API_BASE` + `*_API_TOKEN` (si el ETL consume APIs autenticadas)

---

## 6) Ejecución local (sin Docker)
> **Requisitos**: .NET 8 SDK, JDK 17+, Node 18+, Python 3.12, y acceso a las bases correspondientes.

- **Auth/Matches/Tournaments (.NET)**  
  ```bash
  cd <service>
  dotnet restore && dotnet build && dotnet run
  ```
- **Teams (Spring Boot)**
  ```bash
  cd teams-service
  ./mvnw spring-boot:run
  ```
- **Players (Node/Express)**
  ```bash
  cd players-service
  npm install
  npm run dev  # o npm start
  ```
- **Reports (FastAPI)**
  ```bash
  cd report-service
  uvicorn app.main:app --reload --port 8080
  ```
- **ETL (Python)**
  ```bash
  cd etl-service
  python etl.py
  ```

---

## 7) Ejecución con Docker Compose
Archivo: `docker-compose.yml`

**Puertos expuestos (compose actual):**
- **web** `80:80` (Nginx + SPA)
- **auth-service** `5000:8080`
- **matches-service** `5002:8081`
- **tournament-service** `8083:8083`
- **teams-service** *(ruteado internamente; base `8082`)*
- **players-service** `3000:3000`
- **report-service** `8084:8080`
- **db (SQL Server)** `1433:1433`
- **teams-db (PostgreSQL)** `5435:5432`
- **players-db (MySQL)** `3300:3306`
- **mongo (MongoDB)** `27017:27017`

**Comandos**
```bash
docker compose up -d --build
docker compose logs -f <servicio>
docker compose down
```

---

## 8) Endpoints / APIs (resumen)
> Escrituras requieren *JWT y rol autorizado.

### Auth (`/api/auth`)
- `POST /login` · `POST /register` *(si habilitado)*
- `GET /github/login` · `GET /github/callback` (OAuth GitHub)
- `GET /validate` (validación de token/estado)  
- **Menú** (`/api/menu`): `GET /`, `GET /{roleId:int}`, `POST /role/{roleId:int}`, `GET /mine`  
- **Roles** (`/api/role`): `GET /`, `POST /`, `PUT /{id:int}`, `DELETE /{id:int}`

### Teams (`/api/teams`)
- `GET /`, `GET /{id}`, `POST /`, `PUT /{id}`, `DELETE /{id}`
- `GET /{id}/players` · `GET /name/{teamName}/players`

### Players (`/api/players`)
- `GET /players`, `GET /players/{id}`, `GET /players/team/{teamId}`
- `POST /players`, `PUT /players/{id}`, `DELETE /players/{id}`

### Matches (`/api/matches`)
- `GET /` · `GET /list` · `GET /{id:int}`
- `GET /proximos` · `GET /rango`
- `POST /programar`
- **Marcador**: `POST /{id:int}/score`
- **Faltas**: `POST /{id:int}/foul` · `POST /{id:int}/fouls` · *ajustes*: `POST /{id:int}/foul/adjust`, `POST /{id:int}/fouls/adjust`
- **Tiempo**: `POST /{id:int}/timer/start|pause|resume|reset`
- **Periodo**: `POST /{id:int}/quarters/advance|auto-advance`
- **Estado**: `POST /{id:int}/finish|cancel|suspend`
- **Health**: `GET /health`
- **SignalR Hub interno**: `/hub/score` (negociación/WS mapeados vía Nginx)

### Tournaments (`/api/tournaments`)
- `GET /` · `GET /{id}`
- `PUT /{tournamentId}/groups/{groupKey}/slots/{slotIndex}`
- `PATCH /{tournamentId}/matches/{matchId}` (actualizaciones parciales)

### Reports (externo: `/api/reports` → interno: `/reports`)
- `GET /standings`
- `GET /stats/summary`

---

## 9) Validaciones y manejo de errores
- **Auth/Seguridad**: JWT válido y roles (Admin/Control).  
- **Players**: validación **Joi** en creación/edición.  
- **Matches**: no permitir anotar/faltar cuando el partido finalizó; control de temporizador.  
- **Teams/Tournaments**: integridad referencial (IDs válidos, slots/grupos).  
- **Reports**: manejo de *timeouts* y errores al consultar servicios base; autorización `require_admin` para rutas sensibles.  

**Códigos HTTP** estándar: `200/201/400/401/403/404/409/500` según caso.

---

## 10) Bases de datos
- **SQL Server**: `authDb`, `matchesDb`, `tournamentsDb`  
- **PostgreSQL**: `teamsdb`  
- **MySQL**: `playersDb`  
- **MongoDB**: `reports` (ETL + agregados de reportes)



---

## 11) Lógica de negocio (visión general)
- **Autenticación/Roles/Menú** (Auth).  
- **Partidos en vivo** con **SignalR** (Matches): puntos, faltas, periodos, temporizador.  
- **Equipos/Jugadores** (Teams/Players) con relaciones básicas.  
- **Torneos**: grupos/slots y vínculo con partidos.  
- **Reportes**: *standings* y métricas agregadas desde servicios base, persistidas/caché en Mongo por **ETL**.

---

## 12) Despliegue (VPS, dominio y certificados)
- Ejecutar servicios con Docker Compose en el VPS.  
- Reverse-proxy con Nginx/Traefik/Caddy y HTTPS (Let’s Encrypt).  
- Ajustar CORS en cada servicio al dominio público.  
- Variables sensibles por entorno/secretos, no en repositorio.

---

## 13) Troubleshooting
- **401/403**: token ausente/expirado/rol insuficiente.  
- **CORS**: falta incluir el dominio del frontend en políticas.  
- **502/Bad Gateway** (p.ej. Reports): upstream caído o token interno inválido.  
- **SignalR 404/WS**: revisar mapeo Nginx hacia `/hub/score` (Matches) y headers `Upgrade`.  
- **BBDD**: credenciales/host/puerto y *healthchecks* en Compose.  

---
