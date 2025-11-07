<div align="center">

# **PROYECTO Final – DESARROLLO WEB**  
# **Arquitectura de Microservicios**  
# **Administración de Marcador de Baloncesto**

[![Angular](https://img.shields.io/badge/Frontend-Angular%2020-red)](#)
[![.NET 8](https://img.shields.io/badge/Backend-.NET%208-blue)](#)
[![Spring Boot](https://img.shields.io/badge/Backend-Spring%20Boot-green)](#)
[![Node.js](https://img.shields.io/badge/Backend-Node.js-brightgreen)](#)
[![FastAPI](https://img.shields.io/badge/Reports-FastAPI-009688)](#)
[![Nginx](https://img.shields.io/badge/Gateway-Nginx-orange)](#)

</div>

---

## Acceso a la aplicación

**https://proyectosdw.lat**  
_Inicia sesión con tu cuenta de **GitHub** para probar todas las funcionalidades._

---

## Proyecto desarrollado por

- **Roberto Antonio Ramírez Gómez** — *7690-22-12700*  
- **Jean Klaus Castañeda Santos** — *7690-22-892*  
- **Jonathan Joel Chan Cuéllar** — *7690-22-1805*

---

## Descripción general

Aplicación web de **marcador de baloncesto** con **arquitectura de microservicios**, actualizaciones **en tiempo real** (SignalR), autenticación con **JWT**, y un **frontend Angular** servido por **Nginx**.  
Incluye un **ETL** que consolida datos desde los servicios transaccionales hacia **MongoDB** para reportes.

---

## rquitectura 

| Microservicio / Componente | Lenguaje / Framework                    | Base de datos        | Tipo BD                    | Observaciones |
|---|---|---|---|---|
| **Auth-Service**           | C# (.NET 8, ASP.NET Core Web API)       | SQL Server 2022      | Relacional                 | Autenticación/Autorización, emisión de JWT, gestión de roles/menús. |
| **Matches-Service**        | C# (.NET 8, ASP.NET Core + SignalR)     | SQL Server 2022      | Relacional                 | Partidos, marcador, faltas y **cronómetro en tiempo real**. |
| **Tournament-Service**     | C# (.NET 8, ASP.NET Core)               | SQL Server 2022      | Relacional                 | Torneos, calendario y organización de jornadas. |
| **Teams-Service**          | Java (Spring Boot)                      | PostgreSQL 16        | Relacional                 | Catálogo de equipos. |
| **Players-Service**        | Node.js (Express)                       | MySQL 8              | Relacional                 | Gestión de jugadores. |
| **Report-Service**         | Python 3.12 (FastAPI)                   | MongoDB 6+           | Utiliza mongodb            | Gestion de reportes y estadisticas |
| **ETL-Service**            | Python (httpx, SQL clients, pymongo)    | MongoDB (destino)    | No relacional              | Extrae de SQL Server/PostgreSQL/MySQL y **consolida** en MongoDB. |
| **Frontend**               | Angular                                 | —                    | —                          | Build estático; servido por **Nginx**; consumo de APIs + CORS. |
| **Gateway/Proxy**          | Nginx                                   | —                    | —                          | Reverse proxy a microservicios y servidor estático del frontend. |

> Rutas típicas en el gateway: `/api/auth`, `/api/matches`, `/api/teams`, `/api/players`, `/api/reports.

---

## Funcionalidades 

- Registro y administración de **torneos, equipos y jugadores**.  
- **Marcador en tiempo real**: puntuación, faltas, periodos y cronómetro (SignalR).  
- **Reportes** consolidados (ETL → MongoDB → FastAPI).  
- **Autenticación JWT** y **roles** (Admin / Control).  
- Despliegue en **VPS** con **Nginx** como gateway.

---

## Seguridad implementada

- **JWT** con issuer/audience fijos y expiración validada.  
- **BCrypt** para hash de contraseñas en el servicio de identidad.  
- Propagación de **roles/claims** para autorización por microservicio.  
- **CORS** configurado para el dominio del frontend.  
- Endpoints sensibles protegidos por **middleware/atributos** según rol.


---

## Despliegue con docker

```bash
# Clonar
git clone https://github.com/rramirezg18/py-microservicios.git
cd py-microservicios

# Levantar servicios
docker compose up -d --build
```


## **Enlaces para ver la documentación de la aplicación:**

[**Documentación Frontend**](https://github.com/rramirezg18/py-microservicios/blob/main/docs/documentacion%20del%20FRONTED.md "Frontend")

[**Documentación Backend**](https://github.com/rramirezg18/py-microservicios/blob/main/docs/documentacion%20del%20BACKEND.md "Backend")

[**Documentación Base de Datos**](https://github.com/rramirezg18/py-microservicios/blob/main/docs/DocumentacionBD.md "Base de Datos")

[**Guia despliegue VPS**](https://github.com/rramirezg18/py-microservicios/blob/main/docs/guia-despliegue-frontend-vps.md "VPS")

[**Manual tecnico - Backend**](https://github.com/rramirezg18/py-microservicios/blob/main/docs/manual-tecnico-backends.md "backend")

[**Manual tecnico - Frontend**](https://github.com/rramirezg18/py-microservicios/blob/main/docs/manual-tecnico-frontend.md "frontend")

**El siguiente manual te mostrara los pasos para utilizar las funcionalidades de la aplicación, por ejemplo crear torneos, registrar jugadores y equipos, etc.**
[**Manual de usuario - Admin**](https://github.com/rramirezg18/py-microservicios/blob/main/docs/manual-usuario-admin.md "admin")

[**Manual de usuario - rol control**](https://github.com/rramirezg18/py-microservicios/blob/main/docs/manual-usuario-rol-usuario.md "control")

