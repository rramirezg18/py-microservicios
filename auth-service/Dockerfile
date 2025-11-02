
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

WORKDIR /src


COPY ["AuthService.csproj", "./"]


RUN dotnet restore


COPY . .
RUN dotnet publish -c Release -o /app


FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final

WORKDIR /app
COPY --from=build /app .

ENTRYPOINT ["dotnet", "AuthService.dll"]
