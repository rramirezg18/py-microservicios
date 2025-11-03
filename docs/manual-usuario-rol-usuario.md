# Manual de Usuario — **Rol Usuario**
## 🏀 Tablero de Baloncesto (Frontend Angular)

---

## Introducción
El sistema Tablero de Baloncesto es una aplicación web moderna desarrollada con Angular 20 en el frontend y un conjunto de microservicios independientes en .NET 8, Java Spring Boot, Node.js y Python FastAPI en el backend.  
Su finalidad es permitir el seguimiento en tiempo real de partidos de baloncesto, así como la consulta de estadísticas, tabla de posiciones y resultados históricos de los encuentros.

Los usuarios con Rol Usuario pueden acceder a todas las funciones de consulta pública: visualizar partidos, marcadores, clasificaciones y resultados.  
Este rol está orientado principalmente a jugadores, aficionados o personal del torneo que requieren consultar información sin realizar modificaciones administrativas.

---

## Requisitos del sistema
Para garantizar el correcto funcionamiento del sistema, asegúrate de cumplir los siguientes requisitos mínimos:

- Navegador compatible: **Google Chrome**, **Microsoft Edge**, **Mozilla Firefox** o **Safari** (versiones actualizadas).  
- Conexión a Internet estable (mínimo 5 Mbps recomendados).  
- Resolución mínima de pantalla: **1366×768 px**.  
- Cookies y almacenamiento local habilitados (el sistema guarda el token de autenticación en el navegador).  
- Permitir descargas y ventanas emergentes (en caso de futuras funciones de exportación).  
- URL oficial del sistema: [`https://proyectosdw.lat`](https://proyectosdw.lat)

> 💡 No se requiere instalación. El sistema está completamente alojado en la nube y accesible desde cualquier dispositivo con navegador.

---

## Tabla de Contenidos
1. [Ingreso](#1-ingreso)  
2. [Navegación](#2-navegación)  
3. [Ver partidos y marcador](#3-ver-partidos-y-marcador)  
4. [Tabla de posiciones](#4-tabla-de-posiciones)  
5. [Mi sesión](#5-mi-sesión)  
6. [Preguntas frecuentes](#6-preguntas-frecuentes)  
7. [Solución de problemas](#7-solución-de-problemas)

---

## 1) Ingreso
1. Abre el sitio web oficial: [`https://proyectosdw.lat`](https://proyectosdw.lat).  
2. En la pantalla principal selecciona la opción **Login**.  
3. Ingresa tus credenciales (usuario y contraseña) o usa el inicio de sesión con **Google** o **Facebook** si está habilitado.  
4. Al iniciar sesión correctamente, el sistema mostrará el menú principal con las opciones disponibles para tu rol.  
5. Si tus credenciales no son válidas, el sistema mostrará un mensaje de error indicando el motivo.

> ⚠️ Si la sesión expira o cierras el navegador, aparecerán errores **401 (No autorizado)**. Solo inicia sesión nuevamente.

---

## 2) Navegación
- **Menú principal:** incluye acceso a *Partidos (Matches)*, *Marcador (Scoreboard)* y *Tabla de Posiciones (Standings)*.  
- **Interfaz general:** la aplicación utiliza un diseño **responsive**, por lo que se adapta automáticamente a pantallas de distintos tamaños (computadora, tablet o teléfono).  
- **Elementos comunes:**  
  - Encabezado superior con el nombre del usuario y opción de **cerrar sesión**.  
  - Menú lateral o barra superior para navegar entre secciones.  
  - Tablas interactivas con buscador, paginación y ordenamiento.

> 💡 Puedes explorar las secciones sin recargar la página gracias al enrutamiento interno de Angular.

---

## 3) Ver partidos y marcador
El módulo Partidos (Matches) te permite consultar toda la programación del torneo, con los datos más relevantes de cada encuentro.

### Funcionalidades
- **Listado general:** muestra la lista de partidos con columnas de *Fecha*, *Equipos participantes*, *Estado* (planificado, en curso o finalizado) y *Marcador* (si aplica).  
- **Detalle de partido:** al seleccionar un partido, accedes a la vista `/score/:id`, donde puedes observar:  
  - Marcador actual (puntos de ambos equipos).  
  - Periodo (cuarto) en curso.  
  - Tiempo restante del reloj del partido.  
  - Indicadores de faltas, pausas o finalización.  
- **Actualización en tiempo real:** los datos del marcador se sincronizan mediante SignalR, sin necesidad de refrescar la página manualmente.  
- **Modo lectura:** como usuario estándar, no puedes registrar puntos ni modificar eventos. Tu vista es únicamente informativa.

> 🔄 En caso de pérdida de conexión, la aplicación reintentará automáticamente conectarse al servidor de eventos (*hub*) hasta restablecer la comunicación.

---

## 4) Tabla de posiciones
El módulo Standings muestra la clasificación general de los equipos, calculada automáticamente a partir de los resultados oficiales de los partidos.

### Características:
- Ordenada por victorias, derrotas y puntos acumulados.  
- Se actualiza automáticamente al finalizar cada encuentro.  
- Puede incluir indicadores adicionales según la versión (por ejemplo: porcentaje de efectividad, puntos a favor y en contra).  
- Disponible en formato tabla con posibilidad de desplazamiento horizontal en pantallas pequeñas.

> 📊 La tabla de posiciones refleja en tiempo real el desempeño de todos los equipos activos en el torneo.

---

## 5) Mi sesión
En esta sección se gestiona el control de tu sesión activa dentro del sistema.

### Opciones disponibles
- **Cerrar sesión:** utiliza el menú superior o lateral para salir del sistema de manera segura.  
- **Gestión del token:** el sistema almacena tu sesión en el LocalStorage del navegador; se elimina al cerrar sesión.  
- **Seguridad:** evita compartir tus credenciales o iniciar sesión en equipos públicos.  
- **Recordatorio:** si estás inactivo por un tiempo prolongado, la sesión puede expirar por motivos de seguridad.

> 🔒 Se recomienda usar contraseñas seguras y no compartir tus credenciales con otras personas.

---

## 6) Preguntas frecuentes

### Uso general
- **¿Puedo descargar reportes PDF?**  
  No. Los reportes están disponibles únicamente para los usuarios con rol **Administrador**.  
- **¿Puedo ver el marcador desde mi teléfono o tablet?**  
  Sí. La aplicación es **responsive** y se adapta automáticamente a tu dispositivo.  
- **¿Por qué el marcador tarda en actualizarse?**  
  Puede deberse a una conexión lenta o inestable. El sistema reintenta la conexión de forma automática.  
- **¿Qué hago si me aparece “Error 401”?**  
  Significa que tu sesión expiró; vuelve a iniciar sesión desde la pantalla principal.  
- **¿Se pueden ver partidos anteriores?**  
  Sí, desde el listado de *Matches* puedes consultar partidos finalizados y sus resultados.  

### Técnicas y conexión
- **¿Necesito instalar algo para usar la aplicación?**  
  No. Solo necesitas un navegador web moderno.  
- **¿Puedo compartir el enlace de un marcador en vivo?**  
  Sí. Cualquier usuario autenticado puede acceder al mismo enlace (`/score/:id`) para ver el marcador.  
- **¿Qué pasa si se pierde la conexión a Internet durante un partido?**  
  El marcador dejará de actualizarse temporalmente, pero se sincronizará automáticamente al reconectarse.

---

## 7) Solución de problemas
| Problema | Causa probable | Solución |
|-----------|----------------|-----------|
| No carga el sistema o muestra error **401** | Sesión expirada o token inválido | Inicia sesión nuevamente |
| El marcador no se actualiza en vivo | Problemas de red o caída del servicio WebSocket | Verifica tu conexión y recarga la página |
| No aparece la opción de reportes | Restricción del rol *Usuario* | Funcionalidad exclusiva para *Admin* |
| La sesión se cierra al apagar el navegador | Token eliminado automáticamente | Inicia sesión nuevamente |
| La app tarda en responder | Conexión lenta o servidor saturado | Espera unos segundos o prueba desde otro navegador |

---

### Vista rápida de funciones
- **Login** exitoso con credenciales válidas.  
- **Listado de partidos** y detalles de encuentros.  
- **Marcador en vivo** con actualizaciones en tiempo real (SignalR).  
- **Tabla de posiciones (Standings)** actualizada según los resultados.  
- **Cierre de sesión** seguro y almacenamiento temporal de token.

---


