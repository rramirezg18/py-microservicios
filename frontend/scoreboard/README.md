# Scoreboard Frontend (Angular)

Aplicación web en Angular para mostrar y administrar el marcador en vivo de los partidos de la liga. Incluye:

- **Marcador en vivo** con panel HUD, posesión, período y reloj principal/tiempos muertos.
- **Panel de control** para operarios con controles de reloj, posesión, puntos y faltas.
- **Panel administrativo** con accesos rápidos a jugadores, equipos, torneos y panel de control.
- **Autenticación** con registro/inicio de sesión y protección por roles (usuarios y administradores).
- **Vistas de marcador públicas** y vistas de gestión detrás de autenticación.

## Requisitos

- Node.js 20+
- npm 10+

## Scripts disponibles

Instala dependencias:

```bash
npm install
```

Servidor de desarrollo (escucha en `http://localhost:4200/`):

```bash
npm run dev
# o
npm start
```

Compilación de producción (artefactos en `dist/scoreboard`):

```bash
npm run build
```

Previsualización de la build de producción:

```bash
npm run preview
```

Pruebas unitarias con Karma:

```bash
npm test
```

Chequeo rápido de tipos (útil como lint liviano):

```bash
npm run lint
```

## Estructura destacada

- `src/app/core`: Servicios de autenticación, estado del marcador, utilidades y guards.
- `src/app/features`: Componentes autónomos para cada vista (marcador, panel de control, login, etc.).
- `src/app/shared`: Componentes reutilizables como HUD, paneles del marcador, etc.
- `src/styles.css`: Variables y estilos globales del proyecto.

## Integración con backend

Las solicitudes de autenticación consumen el backend mediante las variables de entorno opcionales:

- `NG_APP_API_BASE_URL` (o `VITE_API_BASE_URL`) para la URL base.
- `NG_APP_DEV_API_FALLBACK` (o `VITE_DEV_API_FALLBACK`) como fallback durante desarrollo cuando se usa una ruta relativa.

Si no se definen, se utiliza `/api` como base (ideal cuando el frontend se sirve detrás del mismo dominio que los servicios).

---

Este proyecto fue generado con Angular CLI 20 y adaptado para reemplazar la anterior implementación en React.
