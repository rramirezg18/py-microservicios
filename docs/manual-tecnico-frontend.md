# PROYECTO 4 – DESARROLLO WEB
## 🏀 MARCADOR DE BALONCESTO

**Integrantes**
- Roberto Antonio Ramírez Gómez — 7690-22-12700
- Jean Klaus Castañeda Santos — 7690-22-892
- Jonathan Joel Chan Cuellar — 7690-22-1805

---

# Manual Técnico – Frontend Angular (Microservicios / Gateway Nginx)

---

## Tabla de contenidos
1. [Descripción General](#1-descripción-general)  
2. [Stack y Versiones](#2-stack-y-versiones)  
3. [Estructura del Proyecto](#3-estructura-del-proyecto)  
4. [Configuración de Entornos](#4-configuración-de-entornos)  
5. [Rutas y Guards](#5-rutas-y-guards)  
6. [Interceptors](#6-interceptors)  
7. [Servicios API](#7-servicios-api)  
8. [Tiempo Real (SignalR)](#8-tiempo-real-signalr)  
9. [UI/Estilos](#9-uiestilos)  
10. [Ejecución Local](#10-ejecución-local)  
11. [Despliegue (Nginx + SPA / SSR)](#11-despliegue-nginx--spa--ssr)  
12. [Reportería desde el Frontend](#12-reportería-desde-el-frontend)  
13. [Seguridad en Frontend](#13-seguridad-en-frontend)  
14. [Observabilidad y UX de Errores](#14-observabilidad-y-ux-de-errores)  
15. [Troubleshooting](#15-troubleshooting)  


---

## 1) Descripción General
SPA en Angular 20 (Standalone Components) que consume la API REST del gateway (`/api/*`) y el servicio de reportes (`/api/reports/*`).  
La actualización en tiempo real del marcador se realiza vía SignalR con hub público en `/hub/matches` (Nginx) → hub interno `matches-service:/hub/score`.

El frontend puede desplegarse como SPA estática detrás de Nginx o, opcionalmente, usando SSR (Node/Express).

---

## 2) Stack y Versiones
- **Angular**: 20.x (`@angular/core`, `@angular/router`, `@angular/ssr`)  
- **Angular Material/CDK**: 20.x  
- **TypeScript**: `~5.8.x`  
- **RxJS**: `~7.8.x`  
- **SignalR cliente**: `@microsoft/signalr ^9.x`  
- **SweetAlert2**: `^11.x`  
- **Node**: 20+ recomendado; Angular CLI alineada a Angular 20.  
- **Scripts** (`package.json`): `start` (dev), `build`, `serve:ssr` (sirve `dist/scoreboard/server/server.mjs`).

---

## 3) Estructura del Proyecto
Raíz del frontend: `front/scoreboard/`
```
front/scoreboard/
 ├─ angular.json
 ├─ package.json
 ├─ proxy.conf.json
 ├─ public/
 └─ src/
    ├─ app/
    │  ├─ core/                 # api.ts, realtime.ts, guards, interceptors, services
    │  ├─ components/           # componentes reutilizables
    │  ├─ features/             # scoreboard, teams, matches, admin, tournaments
    │  ├─ pages/                # vistas (login, admin/reports, etc.)
    │  ├─ models/               # interfaces TS
    │  ├─ app.routes.ts         # ruteo principal (Standalone)
    │  ├─ app.config.ts         # providers globales (HttpClient, interceptors, ...)
    │  ├─ app.html / app.scss   # app shell
    │  └─ app.ts                # bootstrap
    ├─ enviroments/             # ⚠️ carpeta con typo: enviroments.ts / enviroments.prod.ts
    ├─ index.html
    ├─ main.ts                  # bootstrap browser
    ├─ main.server.ts           # bootstrap SSR
    ├─ server.ts                # Express para SSR
    └─ styles.scss              # estilos globales
```

---

## 4) Configuración de Entornos
Archivo: `src/enviroments/enviroments.ts`
```ts
export const environment = {
  production: false,
  apiBase: '/api',
  hubPublicPath: '/hub/matches' // Nginx → matches-service:/hub/score
};
```

Producción (`enviroments.prod.ts`):
```ts
export const environment = {
  production: true,
  apiBase: '/api',
  hubPublicPath: '/hub/matches'
};
```

**Proxy de desarrollo** – `proxy.conf.json` (si el backend corre en :8080 local)
```json
{
  "/api":  { "target": "http://localhost:8080", "secure": false, "changeOrigin": true, "logLevel": "debug" },
  "/hub":  { "target": "http://localhost:8080", "ws": true, "secure": false, "changeOrigin": true }
}
```
Ejecutar con proxy:
```bash
ng serve --proxy-config proxy.conf.json
```

---

## 5) Rutas y Guards
`src/app/app.routes.ts` (extracto)
```ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  { path: 'login', loadComponent: () => import('./pages/login/login').then(m => m.LoginComponent) },

  // Administración de reportes (solo Admin)
  {
    path: 'admin/reports',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin/reports/reports-page').then(m => m.ReportsPage)
  },

  // Scoreboard (autenticado)
  {
    path: 'score/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/scoreboard/scoreboard/scoreboard').then(m => m.ScoreboardComponent),
  },

  // Otros: teams, matches, tournaments...
  { path: '**', redirectTo: 'login' },
];
```

**Guards** (`core/guards/*.ts`)  
- `authGuard`: requiere token en storage; si falta, redirige a `/login`.  
- `adminGuard`: valida `role=admin` del JWT (usar `jwt-decode` o claims guardados).

---

## 6) Interceptors
`core/interceptors/auth-token.interceptor.ts`  
- Agrega `Authorization: Bearer <token>` a todas las peticiones.  
- Ante 401, opcionalmente redirige a `/login?returnUrl=`.

```ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from '../services/authentication.service';

export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthenticationService);
  const router = inject(Router);
  const token = auth.getToken();
  const cloned = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(cloned);
};
```
Registrar en `app.config.ts` con `provideHttpClient` y `withInterceptors`.

---

## 7) Servicios API
### 7.1 API base
`core/api.ts`
```ts
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = '/api'; // funciona detrás del gateway

  getTeams()        { return this.http.get(`${this.base}/teams`); }
  getPlayersByTeam(teamId: number) { return this.http.get(`${this.base}/players/team/${teamId}`); }
  getMatch(id: number) { return this.http.get(`${this.base}/matches/${id}`); }
  // ...otros endpoints (auth, tournaments, standings, etc).
}
```

### 7.2 Auth
`core/services/authentication.service.ts`  
- `login()` → `/api/auth/login` y guarda `token`/`user` en `localStorage`.  
- `getToken()`, `isAdmin()`; `logout()` limpia storage.

### 7.3 Reportes
`core/services/reports.service.ts` (gateway → report-service)
```ts
downloadStandings()            { return this.http.get('/api/reports/standings.pdf', { responseType: 'blob' }); }
downloadTeamPlayers(id: number){ return this.http.get(`/api/reports/team/${id}/players.pdf`, { responseType: 'blob' }); }
```
Usar `FileSaver` o enlace `Blob` para descarga.

---

## 8) Tiempo Real (SignalR)
`core/realtime.ts`
```ts
import * as signalR from '@microsoft/signalr';
import { environment } from '../enviroments/enviroments';

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private connection?: signalR.HubConnection;

  async connect(matchId: number) {
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.hubPublicPath}?matchId=${matchId}`)
      .withAutomaticReconnect()
      .build();

    this.connection.on('scoreUpdated', payload => {/* actualizar estado */});
    this.connection.on('foulCommitted', payload => {/* actualizar estado */});

    await this.connection.start();
  }

  disconnect() { return this.connection?.stop(); }
}
```
> Asegúrate que el **gateway Nginx** tenga `Upgrade/Connection` para WebSockets en `/hub/matches`.

---

## 9) UI/Estilos
- Angular Material como base; estilos globales en `styles.scss`.  
- Componentes reutilizables para paneles (`team-panel`, `timer`, `quarter-indicator`, `fouls-panel`).  
- Seguir el tema visual “ estilos” (oscuro indigo/morado, glass, bokeh) cuando aplique.

---

## 10) Ejecución Local
```bash
cd front/scoreboard
npm ci
# Desarrollo con proxy (API+WS):
ng serve --proxy-config proxy.conf.json
# Build producción (SPA estática):
npm run build
# SSR (si se usa):
npm run build && npm run serve:ssr
```
Salidas de build:  
- SPA: `dist/scoreboard/browser/`  
- SSR: `dist/scoreboard/server/server.mjs`

---

## 11) Despliegue (Nginx + SPA / SSR)
### A) SPA estática (recomendada)
**Dockerfile**
```dockerfile
FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration production

FROM nginx:alpine
COPY --from=build /app/dist/scoreboard/browser/ /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx","-g","daemon off;"]
```

**nginx.conf** (SPA + gateway)
```nginx
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  # API principal
  location /api/ { proxy_pass http://api:8080/; proxy_http_version 1.1; }

  # Reportes (FastAPI)
  location /api/reports/ { proxy_pass http://report-service:8080/; proxy_http_version 1.1; }

  # SignalR público → hub interno
  location /hub/matches {
    proxy_pass         http://api:8080/hub/score;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host $host;
    proxy_read_timeout 600s;
  }

  # SPA fallback
  location / { try_files $uri $uri/ /index.html; }
}
```

### B) SSR (opcional)
- Serve `dist/scoreboard/server/server.mjs` en `:4000`.  
- Nginx como proxy a SSR para `/` y a gateway para `/api/*`, `/api/reports/*`, `/hub/matches`.

---

## 12) Reportería desde el Frontend
Página: `pages/admin/reports/reports-page.*`  
- Botones de descarga invocan `ReportsService` y guardan `Blob`.  
- Manejo de errores típico:
```ts
if (e.status === 401) show('No autorizado (token).');
else if (e.status === 502) show('Gateway error (¿JWT interno RS?).');
else show('Error del servidor de reportes.');
```

---

## 13) Seguridad en Frontend
- **Storage**: token/usuario en `localStorage` (navegador).  
- **Guards**: `authGuard` exige token; `adminGuard` exige `role=admin`.  
- **Interceptor**: agrega `Authorization` y puede redirigir en `401`.  
- No exponer secretos en el bundle; usar rutas relativas al gateway (`/api`, `/hub/matches`).

---

## 14) Observabilidad y UX de Errores
- Notificaciones: `MatSnackBar` o SweetAlert2.  
- Reducir logs en **prod** (`environment.production`).  
- Mostrar estados de carga / skeletons en páginas con llamadas concurrentes.

---

## 15) Troubleshooting
- **CORS dev**: usar `proxy.conf.json`; en prod, configurar CORS en backend.  
- **401 loop**: token vencido o mal guardado → limpiar storage y relogin.  
- **WS falla**: revisar Nginx (cabeceras `Upgrade/Connection`) y que el hub sea **`/hub/matches`**.  
- **404 al refrescar**: falta `try_files /index.html` en Nginx.  
- **PDF 502/401**: gateway sin Bearer interno o `report-service` caído.

---

---

##  Bibliotecas y librerías utilizadas

| Categoría | Paquete / Librería | Propósito o uso principal |
|------------|--------------------|----------------------------|
| **Framework base** | `@angular/core`, `@angular/router`, `@angular/common`, `@angular/forms` | Núcleo de Angular, enrutamiento, formularios reactivos y standalone components. |
| **UI / Estilos** | `@angular/material`, `@angular/cdk`, `@angular/animations` | Componentes de interfaz, diálogos, tablas y animaciones. |
| **Comunicación HTTP** | `@angular/common/http`, `rxjs` | Peticiones REST, interceptores, Observables y flujos reactivos. |
| **Autenticación y seguridad** | `jwt-decode`, `@auth0/angular-jwt` (opcional) | Decodificación de JWT y validación de roles en el frontend. |
| **Tiempo real** | `@microsoft/signalr` | Cliente de SignalR para conexión al hub `/hub/matches` y sincronización del marcador. |
| **Alertas y UX** | `sweetalert2`, `ngx-toastr`, `MatSnackBar` | Notificaciones y mensajes al usuario. |
| **Reportería / Archivos** | `file-saver`, `jspdf`, `html2canvas` | Descarga y visualización de reportes PDF. |
| **SSR (opcional)** | `@angular/ssr`, `express`, `compression` | Renderizado del lado del servidor para SEO y performance. |
| **Herramientas y DevOps** | `typescript`, `eslint`, `prettier`, `zone.js`, `tslib` | Tipado, linting, optimización y compatibilidad Angular CLI. |
| **Proxy / Gateway local** | `proxy.conf.json` (Angular CLI) | Redirección local de `/api/*` y `/hub/*` hacia los microservicios en desarrollo. |

---

> **Nota:** Todas las librerías se instalan automáticamente mediante `npm ci` o `npm install` en la raíz del proyecto.  
> El uso de dependencias externas sigue las mejores prácticas de Angular 20, evitando paquetes obsoletos o inseguros.

