# ===== build =====
FROM maven:3.9.8-eclipse-temurin-17 AS build
WORKDIR /app

COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline

COPY src ./src
# compila y deja un app.jar en /app
RUN mvn -q -DskipTests clean package && \
    cp target/*.jar /app/app.jar

# ===== runtime (Java 17 JRE) =====
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/app.jar /app/app.jar

EXPOSE 8082
ENTRYPOINT ["java","-jar","/app/app.jar"]
