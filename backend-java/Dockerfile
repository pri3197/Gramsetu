# Stage 1: Build Java Spring Boot app using Maven
FROM maven:3.8.4-openjdk-17-slim AS build
WORKDIR /app
COPY pom.xml .
# Download dependencies first (cached layer)
RUN mvn dependency:go-offline -B
COPY src ./src
# Build package and skip unit tests to speed up deploy
RUN mvn package -DskipTests

# Stage 2: Create a lightweight runtime container
FROM openjdk:17-slim
WORKDIR /app
COPY --from=build /app/target/backend-java-1.0.0.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
