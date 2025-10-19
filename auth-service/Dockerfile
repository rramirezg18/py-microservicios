# =========================
# 1) Build & Publish
# =========================
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copia todo el proyecto
COPY . .

# ⚠️ Si tu .csproj tiene otro nombre, cámbialo aquí:
RUN dotnet restore "./AuthService.csproj"
RUN dotnet publish "./AuthService.csproj" -c Release -o /app/out /p:UseAppHost=false

# =========================
# 2) Runtime
# =========================
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

COPY --from=build /app/out ./
ENTRYPOINT ["dotnet", "AuthService.dll"]
