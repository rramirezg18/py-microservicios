# Manual de Usuario — **Rol Administrativo**
## 🏀 Tablero de Baloncesto (Frontend Angular)

---

## Introducción
El sistema Tablero de Baloncesto es una aplicación web desarrollada con Angular 20 (frontend) y un conjunto de microservicios .NET, Java, Node.js y Python (backend).  
Su objetivo es digitalizar la gestión de torneos de baloncesto, permitiendo registrar equipos, jugadores y partidos, visualizar marcadores en tiempo real mediante SignalR, y generar reportes administrativos en PDF.  
El rol Administrativo tiene acceso total a la gestión del sistema, reportería y control en tiempo real.

---

## Requisitos del sistema
- Navegador actualizado (**Google Chrome**, **Edge**, **Firefox**, **Safari**).  
- Conexión estable a Internet.  
- Resolución mínima recomendada: **1366×768 px**.  
- Cookies y almacenamiento local habilitados (para guardar el token de sesión).  
- Permitir descargas de archivos PDF.  
- URL oficial de acceso: [`https://proyectosdw.lat`](https://proyectosdw.lat)

---

## Tabla de Contenidos
1. [Ingreso y rol](#1-ingreso-y-rol)  
2. [Navegación general](#2-navegación-general)  
3. [Gestión de equipos y jugadores](#3-gestión-de-equipos-y-jugadores)  
4. [Gestión de partidos](#4-gestión-de-partidos)  
5. [Marcador en vivo (SignalR)](#5-marcador-en-vivo-signalr)  
6. [Reportería (PDF)](#6-reportería-pdf)  
7. [Gestión de roles y menús](#7-gestión-de-roles-y-menús)  
8. [Sesión y seguridad](#8-sesión-y-seguridad)  
9. [Solución de problemas](#9-solución-de-problemas)  
10. [Checklist previo a la demo](#10-checklist-previo-a-la-demo)  
11. [FAQ rápidas](#11-faq-rápidas)

---

## 1) Ingreso y rol
1. Abre el sitio: [`https://proyectosdw.lat`](https://proyectosdw.lat) → opción Login.  
2. Ingresa tu usuario y contraseña.  
3. Al iniciar sesión correctamente, el sistema guarda un token de acceso en tu navegador y desbloquea las rutas de administración.  
4. Verifica que tu usuario tenga el rol Admin (si no, solicita la asignación).

> Si la sesión expira verás errores 401 (No autorizado) al usar el sistema. Solo inicia sesión de nuevo.

---

## 2) Navegación general
- **Menú principal** (puede variar por versión): *Scoreboard*, *Teams*, *Players*, *Matches*, *Admin / Reports*.  
- **Encabezado:** contiene el botón para **cerrar sesión** y (según el diseño) un **indicador de conexión en tiempo real**.  
- **Rutas clave:**  
  - `/score/:id` → marcador en vivo del partido indicado.  
  - `/admin/reports` → centro de reportería (solo Admin).

> 💡 **Tip:** Usa el buscador y los encabezados de tabla para filtrar y ordenar registros rápidamente.

---

## 3) Gestión de equipos y jugadores

### 3.1 Equipos
- **Crear:** *Teams* → **Nuevo** → completa *Nombre*, *Ciudad*, etc. → **Guardar**.  
- **Editar o eliminar:** desde el listado, usa **Editar** o **Eliminar**.  
- **Buscar/ordenar:** con el buscador y los encabezados de la tabla.

### 3.2 Jugadores
- **Crear:** *Players* → **Nuevo** → asigna el **equipo** y completa los datos → **Guardar**.  
- **Editar o eliminar:** igual que en equipos.  
- **Validaciones:** evita duplicados; un jugador pertenece a **un solo equipo** a la vez.

> **Nota:** Algunos campos son obligatorios (marcados con *). Si faltan datos, la app mostrará un mensaje de validación.

---

## 4) Gestión de partidos
1. Ir a **Matches** → **Nuevo** → define **equipo local**, **visitante**, **fecha/hora** y **lugar**.  
2. Guarda el partido con estado **Planificado**.  
3. En el momento del juego, abre el marcador (ruta `/score/:id`).  
4. Acciones administrativas disponibles: **Suspender**, **Cancelar** o **Finalizar** partido.

> ⚠️ Evita programar partidos con **fecha pasada** y revisa conflictos de horario o equipos antes de guardar.

---

## 5) Marcador en vivo (SignalR)
- El marcador utiliza **WebSockets / SignalR** a través del gateway `/hub/matches`, que se conecta internamente al servicio de partidos (`/hub/score`).  
- Desde `/score/:id`, la página se conecta automáticamente al hub y se une al grupo del partido.

**Acciones disponibles:**  
- **Iniciar / Pausar / Reanudar / Reiniciar** el **reloj** del periodo.  
- Cambiar **periodo/cuartos**.  
- Registrar **anotaciones** (+1 / +2 / +3) y **faltas** por jugador.  
- **Finalizar** el partido (bloquea los eventos en vivo).

> 🔄 Si la conexión WebSocket se cae, la app intentará reconectarse.  
> Si no reconecta, revisa la configuración de **Nginx** (cabeceras *Upgrade/Connection*) o tu conexión a Internet.

---

## 6) Reportería (PDF)
Ruta: **Admin → Reports** (`/admin/reports`)  

Reportes disponibles (según versión):

| Tipo de reporte | Endpoint / Archivo | Descripción |
|------------------|--------------------|--------------|
| Equipos | `teams.pdf` | Lista de equipos registrados |
| Jugadores por equipo | `team/{id}/players.pdf` | Detalle de jugadores por equipo |
| Historial de partidos | `matches/history.pdf` | Filtrable por fechas (`from` / `to`) |
| Roster por partido | `matches/{id}/roster.pdf` | Lista de jugadores de un partido |
| Tabla de posiciones | `standings.pdf` | Clasificación general del torneo |

**Cómo descargar:**  
1. Selecciona el reporte y (si aplica) define filtros (equipo/partido/fechas).  
2. Presiona **Descargar**.  
3. El archivo se guardará como `.pdf`. Revisa que tu navegador permita descargas.

> **Errores comunes:**  
> - **401/403:** sesión expirada o sin permisos. Inicia sesión de nuevo.  
> - **502:** el gateway no está inyectando el **JWT interno** o el `report-service` no responde.

---

## 7) Gestión de roles y menús
- **Roles:** por defecto existe `admin`. Este rol es necesario para acceder a administración y reportes.  
- **Menús:** si la interfaz lo permite, los accesos se gestionan desde *Admin → Menú*.  
- **Buenas prácticas:** usa cuentas nominativas; no compartas contraseñas; revoca accesos al egresar personal.

---

## 8) Sesión y seguridad
- Cierra sesión desde el menú al terminar.  
- El token se guarda en **LocalStorage**; no lo compartas.  
- Cambia la contraseña periódicamente (si la UI lo permite) y usa contraseñas seguras.  
- Evita usar el sistema en equipos públicos o sin cerrar sesión.

---

## 9) Solución de problemas
| Problema | Causa probable | Solución |
|-----------|----------------|-----------|
| No puedo entrar a `/admin/reports` | Usuario sin rol `admin` | Solicita asignación de rol |
| Descargas fallan (401/502) | Token expirado o servicio caído | Inicia sesión nuevamente / valida `report-service` |
| Marcador no actualiza | Desconexión o error Nginx | Revisa `/hub/matches` y configuración de WebSockets |
| Error CORS en desarrollo | Proxy no configurado | Usa `ng serve --proxy-config proxy.conf.json` |

---

## 10) Checklist previo a la demo
- [ ] Equipos y jugadores **cargados**.  
- [ ] Partidos **programados** para la fecha de la demo.  
- [ ] Scoreboard probado en **dos navegadores** (sincronización correcta).  
- [ ] Reportes descargan correctamente (sin 401/502).  
- [ ] Dominio, SSL y CORS **configurados correctamente**.

---

## 11) FAQ rápidas
- **¿Puedo editar un partido finalizado?** No se recomienda; crea uno nuevo o reabre solo si el flujo lo permite.  
- **¿Usuarios sin rol admin pueden ver reportes?** No; los reportes son solo para **administradores**.  
- **¿Puedo usar el sistema desde el móvil?** Sí; la interfaz es totalmente **responsive**.  
- **¿Debo cambiar URLs al pasar a producción?** No, si usas rutas relativas (`/api`, `/hub/matches`) detrás del gateway.

---

### Vista rápida de funciones
- **Login** con credenciales válidas.  
- **Listado de equipos** con botón *Nuevo*.  
- **Programar partido** (formulario con fecha/hora).  
- **Scoreboard** en vivo mostrando puntos y faltas.  
- **Descarga de reportes** en `/admin/reports`.

---
