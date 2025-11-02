# PROYECTO 4 – DESARROLLO WEB
## 🏀 MARCADOR DE BALONCESTO

**Integrantes**
- Roberto Antonio Ramírez Gómez — 7690-22-12700
- Jean Klaus Castañeda Santos — 7690-22-892
- Jonathan Joel Chan Cuellar — 7690-22-1805

---

# Documentación Genreral del Frontend 

## 1) Descripción General
Frontend SPA desarrollado con angular 20 (Standalone Components) para visualizar y administrar equipos, jugadores, torneos y partidos con actualización en tiempo real mediante signalR. El frontend se sirve estáticamente detrás de Nginx y consume los microservicios del backend a través de un reverse proxy (`/api/*`) y un hub público (`/hub/matches`).

---

## 2) Tecnologías y paquetes
- **Angular 20** (Standalone, Router, HttpClient)
- **TypeScript 5+**, **RxJS 7+**
- **Angular Material** (o Bootstrap 5) para componentes UI
- **@microsoft/signalr** (cliente SignalR)
- **SweetAlert2 / MatSnackBar** para feedback
- **SCSS** (encapsulación por componente)

**Requisitos de entorno**
```bash
# versiones recomendadas
node -v    # >= 18.x (recomendado 20.x LTS)
npm -v
npm i -g @angular/cli
```

---

## 3) Estructura del proyecto
Ubicación típica del cliente:

```
front/scoreboard/
└─ src/
   ├─ app/
   │  ├─ core/                 # servicios base, interceptores, guards
   │  │  ├─ api/               # servicios HTTP (auth, teams, players, matches, tournaments, reports)
   │  │  ├─ realtime/          # servicio de SignalR
   │  │  ├─ services/          # AuthenticationService, StorageService, etc.
   │  │  ├─ guards/            # AuthGuard, RoleGuard
   │  │  └─ interceptors/      # AuthInterceptor (JWT)
   │  ├─ pages/                # vistas (scoreboard, matches, teams, players, tournaments, programar, admin)
   │  ├─ shared/               # componentes compartidos (topbar, timer, team-panel, fouls-panel, etc.)
   │  ├─ app.routes.ts         # ruteo principal (Standalone)
   │  └─ app.config.ts         # providers (HttpClient, Interceptors, etc.)
   ├─ assets/                  # imágenes, fuentes, estilos globales
   ├─ environments/            # environment.ts / environment.prod.ts
   ├─ main.ts                  # bootstrap de la app
   ├─ styles.scss              # estilos globales
   ├─ index.html
   ├─ angular.json
   ├─ package.json
   └─ proxy.conf.json          # proxy de dev para /api y /hub
```

**Pantallas clave**
- `scoreboard` (marcador en vivo)
- `programar` (programación de partido; usa Teams y Matches)
- `teams`, `players`, `matches`, `tournaments`
- `admin` (roles/menú; restringido por rol)

---

## 4) Enrutamiento (Standalone)
Ejemplo de definición con *guards* y *lazy loading*:
```ts
// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'scoreboard', pathMatch: 'full' },

  { path: 'scoreboard', loadComponent: () => import('./pages/scoreboard/scoreboard')
      .then(m => m.ScoreboardComponent) },

  { path: 'programar', canActivate: [AuthGuard, RoleGuard],
    loadComponent: () => import('./pages/programar/programar')
      .then(m => m.ProgramarComponent), data: { roles: ['Admin','Control'] } },

  { path: 'teams', canActivate: [AuthGuard],
    loadComponent: () => import('./pages/teams/teams').then(m => m.TeamsComponent) },

  { path: 'players', canActivate: [AuthGuard],
    loadComponent: () => import('./pages/players/players').then(m => m.PlayersComponent) },

  { path: 'matches', canActivate: [AuthGuard],
    loadComponent: () => import('./pages/matches/matches').then(m => m.MatchesComponent) },

  { path: 'tournaments', canActivate: [AuthGuard],
    loadComponent: () => import('./pages/tournaments/tournaments').then(m => m.TournamentsComponent) },

  { path: 'admin', canActivate: [AuthGuard, RoleGuard],
    loadComponent: () => import('./pages/admin/admin').then(m => m.AdminComponent),
    data: { roles: ['Admin'] } },

  { path: '**', redirectTo: 'scoreboard' }
];
```

---

## 5) Comunicación con el backend
### 5.1 Environments
```ts
// src/environments/environment.ts
export const environment = {
  production: false,
  apiBasePath: '/api',
  hubPublicPath: '/hub/matches',     // Nginx mapea al hub interno (/hub/score)
  apiOrigin: ''                      // opcional: forzar origen (por defecto window.location.origin)
};
```

```ts
// src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiBasePath: '/api',
  hubPublicPath: '/hub/matches',
  apiOrigin: ''  // si el frontend se sirve en el mismo dominio, dejar vacío
};
```

### 5.2 Proxy de desarrollo
```json
// proxy.conf.json
{
  "/api": {
    "target": "http://localhost",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "debug"
  },
  "/hub": {
    "target": "http://localhost",
    "secure": false,
    "ws": true,
    "logLevel": "debug"
  }
}
```
Ejecutar con proxy:
```bash
ng serve --proxy-config proxy.conf.json
```

### 5.3 Interceptor JWT
```ts
// src/app/core/interceptors/auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` }}) : req;
  return next(authReq);
};
```

### 5.4 Servicios API 
```ts
// src/app/core/api/teams.api.ts
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TeamsApi {
  private http = inject(HttpClient);
  private base = `${environment.apiBasePath}/teams`;

  list() { return this.http.get(this.base); }
  get(id: number) { return this.http.get(`${this.base}/${id}`); }
  create(dto: any) { return this.http.post(this.base, dto); }
  update(id: number, dto: any) { return this.http.put(`${this.base}/${id}`, dto); }
  remove(id: number) { return this.http.delete(`${this.base}/${id}`); }
}
```

### 5.5 Servicio SignalR (resumen)
```ts
// src/app/core/realtime/realtime.service.ts
import * as signalR from '@microsoft/signalr';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private connection?: signalR.HubConnection;

  async connect(matchId: number) {
    const origin = environment.apiOrigin || window.location.origin;
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${origin}${environment.hubPublicPath}?matchId=${matchId}`)
      .withAutomaticReconnect()
      .build();

    this.connection.on('scoreChanged', (payload) => {
      // TODO: propagar cambios a un store/servicio de estado
      console.log('scoreChanged', payload);
    });

    await this.connection.start();
  }

  disconnect() { return this.connection?.stop(); }
}
```

---

## 6) Autenticación y autorización (frontend)
- **Login**: `AuthenticationService` llama a `/api/auth/login` y almacena **token** + **claims** (rol) en `localStorage`.
- **AuthGuard**: bloquea rutas sin token válido (opcional validar expiración).
- **RoleGuard**: verifica `data.roles` en la ruta vs. roles del usuario (p. ej. `Admin`).
- **Feedback**: `MatSnackBar` o `SweetAlert2` para errores de autenticación.

```ts
// src/app/core/guards/auth.guard.ts
import { CanActivateFn } from '@angular/router';
export const AuthGuard: CanActivateFn = () => !!localStorage.getItem('token');
```

---

## 7) Estilos y diseño
- Tema **oscuro** con indigo/morado (bokeh, glassmorphism) según el tema **“estilos”** del proyecto.
- **Encapsulación por componente** para evitar fugas de estilos.
- **Grid/Responsive** con Material o Bootstrap.
- **Accesibilidad**: contraste suficiente, foco visible, etiquetas ARIA.

Ejemplo rápido (Bootstrap):
```html
<div class="container py-3">
  <div class="row g-3">
    <div class="col-12 col-md-6">Equipo Local</div>
    <div class="col-12 col-md-6">Equipo Visitante</div>
  </div>
</div>
```

---

## 8) Instalación y ejecución
```bash
# en front/scoreboard
npm install

# desarrollo (con proxy a /api y /hub)
ng serve --proxy-config proxy.conf.json

# producción
ng build --configuration production
# salida: dist/<nombre-app>/
```

---

## 9) Despliegue (Nginx + Docker)
**Dockerfile (multi-stage)**
```Dockerfile
# Build
FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration production

# Runtime
FROM nginx:1.27-alpine
COPY --from=build /app/dist/ /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**nginx.conf (frontend + proxy básicos)**
```nginx
server {
  listen 80;
  server_name _;

  # SPA estática
  root /usr/share/nginx/html;
  index index.html;

  # API (reverse proxy)
  location ^~ /api/ {
    proxy_pass http://api-gateway;   # o http://api:8080 según tu compose
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # SignalR (negociación y WS)
  location = /hub/matches/negotiate {
    proxy_pass http://matches-service:8081/hub/score/negotiate;
    proxy_set_header Host $host;
    proxy_http_version 1.1;
  }

  location ^~ /hub/matches {
    proxy_pass http://matches-service:8081/hub/score;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }

  # Fallback SPA
  location / { try_files $uri $uri/ /index.html; }
}
```

> En producción real, ajusta los upstreams (nombres de servicio/puertos) para que apunten a tus microservicios o a tu gateway.

---

## 10) Buenas prácticas implementadas
- **pages / shared / core** para separar responsabilidades
- **Interfaces** TS para modelos fuertemente tipados
- **Interceptors** para tokens/errores
- **Environments** para URLs/hubs
- **Lazy loading** por ruta
- **Encapsulación de estilos** por componente

---

## 11) Troubleshooting
- **CORS**: usar `proxy.conf.json` en dev; agregar dominio al backend en prod.
- **401/403**: token faltante/expirado; revisar interceptor y almacenamiento.
- **SignalR 404/502**: validar rutas `/hub/matches/*` en Nginx y que el hub interno es `/hub/score`.
- **404 al refrescar**: asegurar `try_files ... /index.html` en Nginx.
- **Angular Material**: importar módulos necesarios (errores de componentes no declarados).
- **Incompatibilidades**: alinear Node/CLI con Angular 20.

---

## 12) Mapa de pantallas (resumen)
- **Login** → autenticación JWT
- **Scoreboard** → marcador en vivo (timer, periodo, faltas, puntos)
- **Programar** → programar partido (Equipos + Matches)
- **Teams** → CRUD equipos
- **Players** → CRUD jugadores
- **Matches** → calendario/gestión
- **Tournaments** → gestión de torneos
- **Admin** → menú/roles (según permisos)


