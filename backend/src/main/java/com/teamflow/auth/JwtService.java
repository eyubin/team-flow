package com.teamflow.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;
import com.teamflow.shared.config.TeamflowProperties;

@Service
public class JwtService {

    private static final String LOCAL_ACCESS_SECRET = "local-dev-access-secret-change-me-32chars";
    private static final String LOCAL_REFRESH_SECRET = "local-dev-refresh-secret-change-me-32ch";
    private final SecretKey accessKey;
    private final SecretKey refreshKey;
    private final Duration accessTtl;
    private final Duration refreshTtl;

    public JwtService(TeamflowProperties properties) {
        this.accessKey = key(properties.jwt().accessSecret(), LOCAL_ACCESS_SECRET);
        this.refreshKey = key(properties.jwt().refreshSecret(), LOCAL_REFRESH_SECRET);
        this.accessTtl = properties.jwt().accessTtl();
        this.refreshTtl = properties.jwt().refreshTtl();
    }

    public String accessToken(User user) {
        return create(user, accessKey, accessTtl, "access");
    }

    public String refreshToken(User user) {
        return create(user, refreshKey, refreshTtl, "refresh");
    }

    public UUID parseAccessSubject(String token) {
        return subject(token, accessKey, "access");
    }

    public UUID parseRefreshSubject(String token) {
        return subject(token, refreshKey, "refresh");
    }

    private String create(User user, SecretKey key, Duration ttl, String type) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(user.getId().toString())
                .claim("email", user.getEmail())
                .claim("typ", type)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key)
                .compact();
    }

    private UUID subject(String token, SecretKey key, String expectedType) {
        Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        if (!expectedType.equals(claims.get("typ", String.class))) {
            throw new IllegalArgumentException("Invalid token type");
        }
        return UUID.fromString(claims.getSubject());
    }

    private static SecretKey key(String configured, String fallback) {
        String value = configured == null || configured.length() < 32 ? fallback : configured;
        return Keys.hmacShaKeyFor(value.getBytes(StandardCharsets.UTF_8));
    }
}
