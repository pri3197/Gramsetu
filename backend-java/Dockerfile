# Stage 1: Build the GraalVM Native Image
FROM ghcr.io/graalvm/native-image-community:17 AS builder

# Install Maven
RUN microdnf install -y maven && microdnf clean all

WORKDIR /app

# Cache Maven dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B -q

# Copy source and compile native image
COPY src ./src
RUN mvn -Pnative -DskipTests package

# Stage 2: Minimal runtime image (~80 MB)
FROM debian:bookworm-slim

# Install CA certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the native binary and static files from builder
COPY --from=builder /app/target/gramsetu-backend ./gramsetu-backend
COPY --from=builder /app/src/main/resources/static ./static

RUN chmod +x gramsetu-backend

EXPOSE 8081
ENTRYPOINT ["/app/gramsetu-backend"]
