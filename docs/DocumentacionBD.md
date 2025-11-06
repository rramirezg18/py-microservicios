
# Documentacion de BD
## Proyecto: Marcador de Baloncesto (py‑microservicios)


## 1) Resumen ejecutivo
El proyecto está compuesto por varios microservicios, cada uno con su propia base de datos y modelo. Este documento explica cómo funciona en conjunto la capa de datos, qué entidades existen por servicio, cómo se relacionan lógicamente entre sí (sin FKs entre motores), y cómo se implementa el ETL para reportería y analítica (tablas de posiciones, históricos, PDFs).

**Objetivos de la arquitectura de datos:**
- Aislar el dominio de cada servicio (autonomía y escalabilidad).
- Evitar acoplamientos duros entre motores (no hay FKs cruzadas).
- Exponer un modelo analítico unificado vía ETL (esquema estrella) para consultas rápidas.
- Usar Redis para acelerar reportes PDF y evitar N+1 al consultar múltiples servicios.

---

## 1) Mapa de servicios, motores y límites de datos

| Servicio             | Motor        | Esquema/BD        | Objetivo principal                                        |
|---------------------|--------------|-------------------|-----------------------------------------------------------|
| **auth-service**    | SQL Server   | `authDb`          | Usuarios, Roles, Menús y asignación Rol↔Menú              |
| **matches-service** | SQL Server   | `matchesDb`       | Partidos, eventos de puntuación, faltas, ganador          |
| **tournament-service** | SQL Server| `tournamentDb`    | Torneos, grupos, llave (brackets) y vínculo a partidos    |
| **teams-service**   | PostgreSQL   | `teamsDb`         | Equipos (catalogación y metadatos)                        |
| **players-service** | MySQL        | `playersDb`       | Jugadores (por equipo)                                    |
| **report-service**  | Redis        | `redis`           | Caché de consultas agregadas y payloads de PDF            |
| **(opcional) etl-service** | SQL Server | `reporting`  | Zona de DW (staging + dimensiones + hechos)           |

> **Clave:** `Teams` y `Players` viven fuera de SQL Server. En `matchesDb` sólo hay referencias externas (`TeamId`, `PlayerId`) sin FK.

---

## 2) Estrategia de IDs, timestamps y consistencia
- **IDs locales:** cada servicio administra sus PK autoincrementales (`INT IDENTITY` en SQL Server, `SERIAL/BIGSERIAL` en Postgres, `AUTO_INCREMENT` en MySQL).  
- **Referencias externas:** `Match.HomeTeamId` y `AwayTeamId` apuntan a `teams-service`, `ScoreEvents.PlayerId`/`Fouls.PlayerId` apuntan a `players-service`. No hay FK cruzadas.  
- **Timestamps (UTC):** columnas como `CreatedAt/UpdatedAt` o `DateRegister` se almacenan en UTC para facilitar el ETL incremental.  
- **Estados y concurrencia:** `Matches.Status` (scheduled|live|finished|canceled|suspended) y `RowVersion` (SQL Server) para concurrencia optimista.

---

## 3) Modelo lógico global (sin FKs cruzadas)
- **Usuarios/Roles/Menús** (Auth) controlan permisos a nivel de UI/API.  
- **Partidos** (Matches) se enlazan lógicamente con **Equipos** (Teams) y **Jugadores** (Players).  
- **Torneos** (Tournament) organizan **grupos y llaves** y pueden apuntar a partidos reales vía `ExternalMatchId`.  
- **Reportes** leen de un **DW (reporting)** o, cuando no existe, realizan _fan‑out_ (consultas a múltiples servicios) y cachean en **Redis**.

---

## 4) ER por servicio (resumen)

### 4.1 Auth‑Service (SQL Server, `authDb`)
- **Users(Id, Username, PasswordHash, RoleId, CreatedAt, UpdatedAt, …)**  
- **Roles(Id, Name, …)**  
- **Menus(Id, Name, Url, …)**  
- **RoleMenus(Id, RoleId, MenuId)** con **UNIQUE(RoleId, MenuId)**

Relaciones internas: `Roles 1–N Users`, `Roles 1–N RoleMenus`, `Menus 1–N RoleMenus`.

### 4.2 Matches‑Service (SQL Server, `matchesDb`)
- **Matches(Id, HomeTeamId*, AwayTeamId*, HomeScore, AwayScore, DateMatch, Period, QuarterDurationSeconds, Status, RowVersion)**  
- **ScoreEvents(Id, MatchId, TeamId*, PlayerId*, Points, Note, DateRegister)**  
- **Fouls(Id, MatchId, TeamId*, PlayerId*, Type, DateRegister)**  
- **TeamWins(Id, MatchId, TeamId*, DateRegistered)** con **UNIQUE(MatchId)**

\* = **referencia externa** (sin FK) a otros motores.

### 4.3 Tournament‑Service (SQL Server, `tournamentDb`)
- **Tournaments(Id, Code, Name, Season, Location, Venue, UpdatedUtc, FinalMatchId?)**  
- **Groups(Id, Key, Name, Color?, TournamentId)**  
- **BracketMatches(Id, TournamentId, GroupId?, Round, SlotIndex?, Label, ExternalMatchId?, Status, ScheduledAtUtc?)**

`ExternalMatchId` enlaza con `Matches.Id` (lógico).

### 4.4 Teams‑Service (PostgreSQL, `teamsDb`)
- **Teams(Id, Name, Color, City?, Coach?, CreatedAt, UpdatedAt)**  
Índices: `UX_Teams_Name` y de búsqueda por `Color/Name`.

### 4.5 Players‑Service (MySQL, `playersDb`)
- **Players(Id, TeamId, Number, Name, Position?, Height?, BirthDate?, CreatedAt, UpdatedAt)**  
Índices: `(TeamId, Number)` único, búsqueda por `Name`.

### 4.6 Report‑Service (Redis)
- Namespaces de claves recomendados:
  - `report:standings:{season}`
  - `report:team:{teamId}:players`
  - `report:matches:history:{from}:{to}`
  - `report:match:{matchId}:roster`
- Valores: JSON comprimido (opcional) con **TTL 300–900s**.  
- Invalida al **terminar partido** o al cambiar roster de equipo.

---

## 5) ETL / Data Warehouse (reporting)
### 5.1 Objetivo
Unificar datos de Teams (PostgreSQL), Players (MySQL) y Matches (SQL Server) en un esquema estrella para consultas de reportería y analítica (standings, históricos, KPIs).

### 5.2 Topología y opciones de extracción
- **Pull por API**: el `etl-service` llama a endpoints internos `/api/*` de cada servicio con token interno. *Ventaja:* seguridad y contratos.  
- **Pull directo a BD (read-only)**: conexiones ODBC/JDBC a cada motor con usuario de sólo lectura. *Ventaja:* mayor rendimiento.

> En producción, se recomienda API + caché para estabilidad; para cargas nocturnas pesadas, read‑only DB.

### 5.3 Staging y esquema estrella (propuesto en SQL Server `reporting`)
- **Staging (`stg_*`)**: tablas espejo para ingesta incremental (con columnas `source`, `extracted_utc`, `hash`/`checksum`).  
- **Dimensiones (`dim_*`)**: `dim_team`, `dim_player`, `dim_date` (opcional).  
- **Hechos (`fact_*`)**: `fact_match`, `fact_score_event`, `fact_foul`.

```
mermaid
erDiagram
  DIM_TEAM ||--o{ FACT_MATCH : "Team SK"
  DIM_TEAM ||--o{ FACT_SCORE_EVENT : "Team SK"
  DIM_PLAYER ||--o{ FACT_SCORE_EVENT : "Player SK"
  FACT_MATCH ||--o{ FACT_SCORE_EVENT : "by Match SK"
  FACT_MATCH ||--o{ FACT_FOUL : "by Match SK"

  DIM_TEAM {
    int TeamSK PK
    int TeamId "Id en teams-service (PostgreSQL)"
    string Name
    string Color
    datetime ValidFromUtc
    datetime ValidToUtc
    boolean IsCurrent
  }
  DIM_PLAYER {
    int PlayerSK PK
    int PlayerId "Id en players-service (MySQL)"
    int TeamId
    string Name
    int Number
    datetime ValidFromUtc
    datetime ValidToUtc
    boolean IsCurrent
  }
  FACT_MATCH {
    bigint MatchSK PK
    int MatchId "Id en matches-service (SQL Server)"
    int HomeTeamSK
    int AwayTeamSK
    int HomeScore
    int AwayScore
    datetime DateMatchUtc
    string Status
  }
  FACT_SCORE_EVENT {
    bigint Id PK
    bigint MatchSK
    int TeamSK
    int? PlayerSK
    int Points
    datetime EventUtc
  }
  FACT_FOUL {
    bigint Id PK
    bigint MatchSK
    int TeamSK
    int? PlayerSK
    string Type
    datetime EventUtc
  }
```

**Notas clave:**
- `TeamSK`/`PlayerSK` son claves sustitutas (surrogate keys) para soportar cambios históricos (SCD tipo 2: `ValidFromUtc`/`ValidToUtc`, `IsCurrent`).  
- `MatchSK` apunta a `Matches.MatchId` (sincronizado por ETL).  

### 5.4 Reglas de transformación 
- **DimTeam**: agrupar por `Teams.Id`; si cambian `Name/Color`, cerrar versión anterior y crear una nueva (`IsCurrent=false`).  
- **DimPlayer**: SCD2 para `TeamId`, `Number`, `Name`.  
- **FactMatch**: cargar desde `matchesDb.Matches`; mapear `HomeTeamId/AwayTeamId → TeamSK`.  
- **FactScoreEvent**/**FactFoul**: cargar desde `matchesDb`; mapear `TeamId → TeamSK` y `PlayerId → PlayerSK (nullable)`.

### 5.5 Incrementalidad e idempotencia
- Ingestar por `UpdatedAt/DateRegister` y/o mayor `Id`.  
- Usar MERGE (UPSERT) para dimensiones y hechos.  
- Mantener un watermark por tabla (`_etl_last_success`), guardado en `reporting.__control`.

### 5.6 Orquestación
- Contenedor `etl-service` (Python/.NET) con **cron** (ej.: cada 5 min en vivo, carga completa nocturna).  
- Estrategia event‑driven (opcional)**: publicar eventos “MatchFinished”, “RosterChanged” para disparar micro‑cargas y limpiar caché Redis.

### 5.7 Calidad y auditoría
- Chequeos: conteo de filas por rango de fechas, duplicados por `MatchId`, nulos en `TeamId`.  
- Auditoría: tabla `reporting.__runs(run_id, start_utc, end_utc, status, rows_ingested, details)`.

---

## 6) Consultas de referencia (DW)
### 6.1 Standings (victorias/derrotas)
```sql
SELECT
  t.Name AS Team,
  SUM(CASE WHEN m.HomeScore > m.AwayScore AND m.HomeTeamSK = t.TeamSK THEN 1
           WHEN m.AwayScore > m.HomeScore AND m.AwayTeamSK = t.TeamSK THEN 1
           ELSE 0 END) AS Wins,
  SUM(CASE WHEN m.HomeScore < m.AwayScore AND m.HomeTeamSK = t.TeamSK THEN 1
           WHEN m.AwayScore < m.HomeScore AND m.AwayTeamSK = t.TeamSK THEN 1
           ELSE 0 END) AS Losses
FROM reporting.FACT_MATCH m
JOIN reporting.DIM_TEAM t
  ON t.TeamSK IN (m.HomeTeamSK, m.AwayTeamSK) AND t.IsCurrent = 1
WHERE m.Status = 'finished'
GROUP BY t.Name
ORDER BY Wins DESC, Losses ASC;
```

### 6.2 Top anotadores por partido
```sql
SELECT TOP 10
  p.Name AS Player,
  tm.Name AS Team,
  m.MatchId,
  SUM(se.Points) AS Pts
FROM reporting.FACT_SCORE_EVENT se
JOIN reporting.DIM_PLAYER p ON p.PlayerSK = se.PlayerSK AND p.IsCurrent = 1
JOIN reporting.DIM_TEAM tm   ON tm.TeamSK   = se.TeamSK   AND tm.IsCurrent = 1
JOIN reporting.FACT_MATCH m  ON m.MatchSK   = se.MatchSK
GROUP BY p.Name, tm.Name, m.MatchId
ORDER BY Pts DESC;
```

---

## 7) Seguridad y accesos
- Cuentas read‑only para ETL: usuarios dedicados por motor (mínimos privilegios).  
- En producción, enmascarar columnas sensibles (si aplica) y cifrar secretos (variables de entorno).  
- Redis: claves de reporte con TTL y no almacenar datos sensibles.

---

## 8) Backup y restauración (Docker)
**SQL Server (auth/matches/tournament)**
```bash
# backup (dentro del contenedor)
/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P '***' -Q "BACKUP DATABASE matchesDb TO DISK='/var/opt/mssql/backup/matchesDb.bak'"
```

**PostgreSQL (teams)**
```bash
pg_dump -h localhost -U postgres -d teamsDb > /backup/teamsDb_$(date +%F).sql
```

**MySQL (players)**
```bash
mysqldump -h localhost -u root -p playersDb > /backup/playersDb_$(date +%F).sql
```

Redis (report cache)** → eeeneralmente no se respalda (caché).

---

## 9) Operación y monitoreo
- Healthchcks por servicio (incluye BD).  
- Métricas de ETL: latencia de última carga, filas por minuto, tasas de fallos.  
- Alertas cuando `reporting` se desincroniza (> X minutos) o Redis tenga miss rate alto.

---

## 10) Glosario
- **SCD2**: técnica de historial en dimensiones con intervalos de validez.  
- **Surrogate Key (SK)**: clave sustituta generada en DW (independiente del `Id` del servicio).  
- **Watermark**: marca de progreso del ETL incremental.  
- **Fan‑out**: múltiples llamadas a servicios para armar un resultado.

---

## 11) Apéndice: DDL de arranque (reporting)
```sql
-- Esquema
CREATE SCHEMA reporting;

-- Control de corridas
CREATE TABLE reporting.__control(
  source_table  sysname PRIMARY KEY,
  watermark_utc datetime2 NULL,
  watermark_id  bigint    NULL
);

-- Dimensiones (simplificadas)
CREATE TABLE reporting.DIM_TEAM(
  TeamSK        INT IDENTITY(1,1) PRIMARY KEY,
  TeamId        INT NOT NULL,
  Name          NVARCHAR(150) NOT NULL,
  Color         NVARCHAR(50)  NULL,
  ValidFromUtc  DATETIME2 NOT NULL,
  ValidToUtc    DATETIME2 NULL,
  IsCurrent     BIT NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX UX_DIM_TEAM_BK ON reporting.DIM_TEAM(TeamId, ValidFromUtc);

CREATE TABLE reporting.DIM_PLAYER(
  PlayerSK      INT IDENTITY(1,1) PRIMARY KEY,
  PlayerId      INT NOT NULL,
  TeamId        INT NOT NULL,
  Name          NVARCHAR(150) NOT NULL,
  Number        INT NULL,
  ValidFromUtc  DATETIME2 NOT NULL,
  ValidToUtc    DATETIME2 NULL,
  IsCurrent     BIT NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX UX_DIM_PLAYER_BK ON reporting.DIM_PLAYER(PlayerId, ValidFromUtc);

-- Hechos (simplificados)
CREATE TABLE reporting.FACT_MATCH(
  MatchSK       BIGINT IDENTITY(1,1) PRIMARY KEY,
  MatchId       INT NOT NULL,
  HomeTeamSK    INT NOT NULL,
  AwayTeamSK    INT NOT NULL,
  HomeScore     INT NOT NULL,
  AwayScore     INT NOT NULL,
  DateMatchUtc  DATETIME2 NOT NULL,
  Status        NVARCHAR(24) NOT NULL,
  CONSTRAINT FK_FM_HT FOREIGN KEY (HomeTeamSK) REFERENCES reporting.DIM_TEAM(TeamSK),
  CONSTRAINT FK_FM_AT FOREIGN KEY (AwayTeamSK) REFERENCES reporting.DIM_TEAM(TeamSK)
);

CREATE TABLE reporting.FACT_SCORE_EVENT(
  Id            BIGINT IDENTITY(1,1) PRIMARY KEY,
  MatchSK       BIGINT NOT NULL,
  TeamSK        INT NOT NULL,
  PlayerSK      INT NULL,
  Points        INT NOT NULL,
  EventUtc      DATETIME2 NOT NULL,
  CONSTRAINT FK_FSE_M  FOREIGN KEY (MatchSK) REFERENCES reporting.FACT_MATCH(MatchSK),
  CONSTRAINT FK_FSE_T  FOREIGN KEY (TeamSK)  REFERENCES reporting.DIM_TEAM(TeamSK),
  CONSTRAINT FK_FSE_P  FOREIGN KEY (PlayerSK) REFERENCES reporting.DIM_PLAYER(PlayerSK)
);

CREATE TABLE reporting.FACT_FOUL(
  Id            BIGINT IDENTITY(1,1) PRIMARY KEY,
  MatchSK       BIGINT NOT NULL,
  TeamSK        INT NOT NULL,
  PlayerSK      INT NULL,
  Type          NVARCHAR(50) NULL,
  EventUtc      DATETIME2 NOT NULL,
  CONSTRAINT FK_FF_M   FOREIGN KEY (MatchSK) REFERENCES reporting.FACT_MATCH(MatchSK),
  CONSTRAINT FK_FF_T   FOREIGN KEY (TeamSK)  REFERENCES reporting.DIM_TEAM(TeamSK),
  CONSTRAINT FK_FF_P   FOREIGN KEY (PlayerSK) REFERENCES reporting.DIM_PLAYER(PlayerSK)
);
```
