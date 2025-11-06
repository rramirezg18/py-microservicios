<div align="center">
<h1><strong>PROYECTO Final - DESARROLLO WEB</h1>
<h1><strong>Arquitectura Microservicios</h1>
</div>

<div align="center">
<h1><strong>Administración de Marcador de Baloncesto</h1>
</div>


# **Proyecto desarrollado por:**

---

#### Roberto Antonio Ramirez Gomez 7690-22-12700

#### Jean Klaus Castañeda Santos 7690-22-892

#### Jonathan Joel Chan Cuellar 7690-22-1805

# **Descripción de la aplicación web**
Esta aplicación esta desarrollada con una arquitectura microservidios . 

## **Arquitectura General** 
| Microservicio / Componente | Lenguaje / Framework                    | Base de datos        | Tipo BD                    | Observaciones                                                                 |
|---|---|---|---|---|
| **Auth-Service**           | C# (.NET 8, ASP.NET Core Web API)       | SQL Server 2022      | Relacional                 | Autenticación/Autorización, emisión de JWT, gestión de roles/menús.          |
| **Matches-Service**        | C# (.NET 8, ASP.NET Core + SignalR)     | SQL Server 2022      | Relacional                 | Partidos, marcador, faltas y cronómetro en tiempo real (SignalR).            |
| **Tournament-Service**     | C# (.NET 8, ASP.NET Core)               | SQL Server 2022      | Relacional                 | Torneos, calendario y organización de jornadas.                               |
| **Teams-Service**          | Java (Spring Boot)                      | PostgreSQL 16        | Relacional                 | Catálogo de equipos.                                                          |
| **Players-Service**        | Node.js (Express)                       | MySQL 8              | Relacional                 | Gestión de jugadores.                                                         |
| **Report-Service**         | Python 3.12 (FastAPI)                   | MongoDB 6+           | No relacional (documentos) | Endpoints de reportes agregados para paneles.                                 |
| **ETL-Service**            | Python (httpx, pymongo)                 | MongoDB (destino)    | No relacional (documentos) | Extrae de SQL Server/PostgreSQL/MySQL, transforma y consolida en MongoDB.    |
| **Frontend (SPA)**         | Angular 18                              | —                    | —                          | Servida por Nginx; consumo de APIs; manejo de CORS.                           |
| **Gateway/Proxy**          | Nginx                                   | —                    | —                          | Reverse proxy hacia microservicios y servidor estático del Frontend.         |
