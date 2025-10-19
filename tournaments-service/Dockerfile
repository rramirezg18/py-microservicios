# Etapa 1: Compilación
# Usamos la imagen del SDK de .NET para compilar nuestro proyecto
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build-env
WORKDIR /app

# Copiar los archivos del proyecto (.csproj) y restaurar las dependencias
COPY *.csproj ./
RUN dotnet restore

# Copiar el resto del código fuente y construir la aplicación
COPY . ./
RUN dotnet publish -c Release -o out

# Etapa 2: Ejecución
# Usamos una imagen más ligera que solo contiene el runtime de ASP.NET Core
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app

# Copiar la aplicación compilada desde la etapa de compilación
COPY --from=build-env /app/out .

# Exponer el puerto en el que la aplicación va a correr
EXPOSE 8080

# Comando para iniciar la aplicación
ENTRYPOINT ["dotnet", "tournaments-service.dll"]