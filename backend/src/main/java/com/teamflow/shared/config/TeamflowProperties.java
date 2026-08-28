package com.teamflow.shared.config;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "teamflow")
public record TeamflowProperties(Cors cors, Jwt jwt) {

    public record Cors(String origins) {
        public List<String> originList() {
            if (origins == null || origins.isBlank()) {
                return List.of();
            }
            return Arrays.stream(origins.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
        }
    }

    public record Jwt(
            String accessSecret, String refreshSecret, Duration accessTtl, Duration refreshTtl) {}
}
