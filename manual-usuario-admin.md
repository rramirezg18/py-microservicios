# Manual de Usuario — **Rol Administrativo**
## 🏀 Tablero de Baloncesto (Frontend Angular)


---

## Tabla de contenidos
1. [Ingreso y rol](#1-ingreso-y-rol)  
2. [Navegación general](#2-navegación-general)  
3. [Gestión de equipos y jugadores](#3-gestión-de-equipos-y-jugadores)  
4. [Gestión de partidos](#4-gestión-de-partidos)  
5. [Marcador en vivo (SignalR)](#5-marcador-en-vivo-signalr)  
6. [Reportería (PDF)](#6-reportería-pdf)  
7. [Gestión de roles y menús](#7-gestión-de-roles-y-menús)  
8. [Sesión y seguridad](#8-sesión-y-seguridad)  
9. [Solución de problemas](#9-solución-de-problemas)  
10. [Checklist previo a demo](#10-checklist-previo-a-demo)  
11. [FAQ rápidas](#11-faq-rápidas)

---

## 1) Ingreso y rol
1. Abre el sitio: `https://proyectosdw.lat` → opción Login**.  }
2. Ingresa tu usuario y contraseña.  
3. Al iniciar sesión correctamente, el sistema guarda un token de acceso en tu navegador y desbloquea las rutas de administración.  
4. Verifica que tu usuario tenga rol Admin (si no, solicita la asignación).

> Si la sesión expira verás respuestas **401** al usar el sistema. Inicia sesión otra vez.

---

## 2) Navegación general
- **Menú principal** (puede variar por versión): *Scoreboard*, *Teams*, *Players*, *Matches*, *Admin / Reports*.  
- **Encabezado**: botón para cerrar sesión y (según layout) un indicador de conexión en tiempo real.  
- **Rutas clave**:  
  - `/score/:id` → marcador en vivo del partido id  
  - `/admin/reports` → centro de reportería (solo Admin).

> **Tip:** Usa el buscador y los encabezados de tabla para filtrar y ordenar registros rápidamente.

---

## 3) Gestión de equipos y jugadores
### 3.1 Equipos
- **Crear**: *Teams* → **Nuevo** → completa *Nombre*, *Ciudad*, etc. → **Guardar**.  
- **Editar/Eliminar**: desde el listado, usa **Editar** o **Eliminar**.  
- **Buscar/Ordenar**: con el buscador y los encabezados de la tabla.

### 3.2 Jugadores
- **Crear**: *Players* → **Nuevo** → asigna el **equipo** y completa los datos → **Guardar**.  
- **Editar/Eliminar**: igual que en equipos.  
- **Validaciones**: evita duplicados; un jugador pertenece a **un** equipo a la vez.

> **Nota:** Algunos campos son obligatorios (marcados con *). Si faltan, la app mostrará un mensaje de validación.

---

## 4) Gestión de partidos
1. Ir a **Matches** → **Nuevo** → define **equipo local/visitante**, **fecha/hora**, **lugar**.  
2. **Programar** el partido (estado *Planificado*).  
3. En el momento del juego, abre el Scoreboard del partido (ruta `/score/:id`).  
4. Acciones administrativas (si están disponibles): **Suspender**, **Cancelar** o **Finalizar** partido.

> Evita programar partidos con **fecha pasada** y revisa conflictos de horario/equipos antes de guardar.

---

## 5) Marcador en vivo (SignalR)
- El marcador usa WebSockets/SignalR a través del gateway en `/hub/matches`** 
  (que mapea al hub interno del servicio de partidos `/hub/score`).  
- Desde `/score/:id`, la página se conecta al hub y se une al grupo del partido automáticamente.

Acciones típicas (los nombres de botones pueden variar por UI):  
- **Iniciar / Pausar / Reanudar / Reiniciar** el **reloj** del periodo.  
- Cambiar **periodo/cuartos**.  
- Registrar **anotaciones** (+1 / +2 / +3) y **faltas** por jugador.  
- **Finalizar** el partido (cierra el flujo en vivo y bloquea más eventos).

> Si la conexión WebSocket cae, la app reintenta. Si no reconecta, revisa Nginx (cabeceras *Upgrade/Connection*) y tu conexión a internet.

---

## 6) Reportería (PDF)
Ruta: **Admin → Reports** (`/admin/reports`). Descargas disponibles (según implementación actual):  
- **Equipos** → `teams.pdf`  
- **Jugadores por equipo** → `team/{id}/players.pdf`  
- **Historial de partidos** (con filtros `from`/`to`) → `matches/history.pdf`  
- **Roster por partido** → `matches/{id}/roster.pdf`  
- **Tabla de posiciones** → `standings.pdf`

**Cómo descargar**  
1. Elige el reporte y (si aplica) define filtros (equipo/partido/fechas).  
2. Presiona **Descargar**.  
3. El archivo se guardará como `*.pdf`. Revisa que el navegador permita la descarga.

> **Errores comunes:**  
> - **401/403**: sesión expirada o sin permisos. Inicia sesión de nuevo.  
> - **502**: el gateway no está inyectando el **JWT interno** o el `report-service` está caído.

---

## 7) Gestión de roles y menús
- **Roles:** por defecto existe *admin*. Para administración y reportes se requiere admin.  
- **Menús:** asigna accesos por rol desde *Admin → Menú* (si la UI lo incluye).  
- **Buenas prácticas:** usa cuentas nominativas; evita compartir contraseñas; revoca accesos cuando un usuario egresa.

---

## 8) Sesión y seguridad
- Cierra sesión desde el menú al terminar.  
- El token se guarda en LocalStorage del navegador;no lo compartas.  
- Cambia la contraseña periódicamente (si la UI lo soporta) y usa credenciales fuertes.  
- No abras el sistema en equipos públicos sin cerrar sesión.

---

## 9) Solución de problemas
- **No puedo entrar a /admin/reports** → confirma que tu usuario tenga *ol admin.  
- **Descargas fallan (401/502)** → renueva sesión; valida Nginx y el token interno de reportes.  
- **Marcador no actualiza** → revisa que el hub público sea **`/hub/matches`** y que Nginx permita **WebSockets**.  
- **CORS en desarrollo** → usa `ng serve --proxy-config proxy.conf.json` (solo para entorno local).

---

## 10) Checklist previo a demo
- [ ] Equipos y jugadores  **cargados**.  
- [ ] Partidos  **programados** para hoy (o la fecha de la demo).  
- [ ] Scoreboard probado en **dos navegadores** (ver reflejo en tiempo real).  
- [ ] Reportes descargan **OK** (sin 401/502).  
- [ ] Dominio/SSL y CORS **correctos**.

---

## 11) FAQ rápidas
- **¿Puedo editar un partido ya finalizado?** No recomendado; crea uno nuevo o reabre solo si tu flujo lo permite.  
- **¿Usuarios sin rol admin ven reportes?** No; por diseño son solo para **admin**.  
- **¿Puedo usar el sistema desde el móvil?** Sí; la interfaz es **responsive**.  
- **¿Debo cambiar URLs al mover a producción?** No, si usas rutas relativas (`/api`, `/hub/matches`) detrás del gateway.

---

### 
- **Login** con credenciales válidas.  
- **Listado de equipos** con botón *Nuevo*.  
- **Programar partido** (formulario con fecha/hora).  
- **Scoreboard** en vivo mostrando puntos y faltas.  
- **Descarga de reportes** en `/admin/reports`.

---
