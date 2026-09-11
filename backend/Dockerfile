# syntax=docker/dockerfile:1

# Placeholder for the Maven cache. Overridden locally with
# `--build-context m2=$HOME/.m2` to seed the build from a warm host cache;
# empty by default, so a plain build still resolves from Maven Central.
FROM scratch AS m2

FROM eclipse-temurin:25-jdk-jammy AS build
WORKDIR /src
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN --mount=type=cache,target=/root/.m2,from=m2,source=/,sharing=locked \
    chmod +x mvnw && ./mvnw -q -B dependency:go-offline
COPY src src
RUN --mount=type=cache,target=/root/.m2,from=m2,source=/,sharing=locked \
    ./mvnw -q -B -DskipTests package && \
    mv target/backend-*.jar /tmp/app.jar

FROM eclipse-temurin:25-jre-jammy AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 teamflow \
    && useradd --system --uid 10001 --gid teamflow --home /app --shell /usr/sbin/nologin teamflow
WORKDIR /app
COPY --from=build --chown=teamflow:teamflow /tmp/app.jar /app/app.jar
USER teamflow
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=40s --retries=5 \
    CMD curl -fsS http://127.0.0.1:8080/actuator/health | grep -q '"status":"UP"'
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
