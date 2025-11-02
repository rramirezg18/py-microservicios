# Manual de Usuario — **Rol Usuario**
## 🏀 Tablero de Baloncesto (Frontend Angular)

---

## Tabla de contenidos
1. [Ingreso](#1-ingreso)  
2. [Navegación](#2-navegación)  
3. [Ver partidos y marcador](#3-ver-partidos-y-marcador)  
4. [Tabla de posiciones](#4-tabla-de-posiciones)  
5. [Mi sesión](#5-mi-sesión)  
6. [Preguntas frecuentes](#6-preguntas-frecuentes)  
7. [Solución de problemas](#7-solución-de-problemas)

---

## 1) Ingreso
1. Abre `https://proyectosdw.lat`.  
2. Ve a *Login** e ingresa tus credenciales.  
3. Si el inicio de sesión es correcto, verás el menú principal.

> Si tu sesión expira, verás errores 401. Solo vuelve a iniciar sesión.

---

## 2) Navegación
- **Menú**: acceso a *Partidos* (Matches), *Scoreboard* y *Standings* (los nombres pueden variar).  
- **Restricción**: las opciones Admin (por ejemplo, *Reports*) no están disponibles para este rol.

---

## 3) Ver partidos y marcador
- **Partidos**: desde *Matches/Partidos* puedes ver el listado* y detalles (fecha, equipos, estado).  
- **Marcador en vivo**: al abrir un partido (`/score/:id`), la pantalla muestra **marcador**, **periodo** y **tiempo restante** en tiempo real mediante SignalR (no necesitas refrescar).  
- **Permisos**: con el rol *Usuario* no puedes editar el marcador ni registrar puntos/faltas; es solo lectura

> Si notas retraso en la actualización, puede deberse a tu conexión. La app reintenta la conexión al *hub* automáticamente.

---

## 4) Tabla de posiciones
- En *Standings* verás la tabla de posiciones por victorias/derrotas.  
- Se actualiza automáticamente según los resultados finales de los partidos.

---

## 5) Mi sesión
- **Cerrar sesión**: usa el menú superior para salir del sistema.  
- **Seguridad**: no compartas tus credenciales; cierra sesión en equipos públicos o compartidos.

---

## 6) Preguntas frecuentes
- **¿Puedo descargar reportes PDF?** No; esa función es solo para Administradores.  
- **¿Puedo ver el marcador desde el teléfono?** Sí; la interfaz es responsive.  
- **¿Por qué a veces el marcador tarda en actualizar?** Puede ser tu conexión; la app intentará reconectarse al *hub* de tiempo real.

---

## 7) Solución de problemas
- **No carga / error 401** → tu sesión expiró; vuelve a iniciar sesión.  
- **El marcador no cambia** → verifica tu conexión; si persiste, avisa al Administrador (podrían estar caídos los **WebSockets**).  
- **No veo la opción de reportes** → es normal; solo los **Admins** tienen acceso a reportería.

---
)
- **Login** exitoso.  
- **Listado de partidos**.  
- **Scoreboard** mostrando marcador y periodo.  
- **Standings** con posiciones actualizadas.

---
