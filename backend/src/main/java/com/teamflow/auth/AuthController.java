package com.teamflow.auth;

import jakarta.validation.Valid;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Duration ACCESS_TTL = Duration.ofMinutes(15);
    private static final Duration REFRESH_TTL = Duration.ofDays(7);
    private final AuthService authService;

    public AuthController(AuthService authService) { this.authService = authService; }

    @PostMapping("/register")
    public ResponseEntity<UserProfile> register(@Valid @RequestBody AuthRequests.Register request) {
        return authenticated(authService.register(request), HttpStatus.CREATED);
    }

    @PostMapping("/login")
    public ResponseEntity<UserProfile> login(@Valid @RequestBody AuthRequests.Login request) {
        return authenticated(authService.login(request), HttpStatus.OK);
    }

    @GetMapping("/me")
    public UserProfile me(Authentication authentication) {
        return UserProfile.from(authService.requireUser(UUID.fromString(authentication.getName())));
    }

    @GetMapping("/csrf")
    public ResponseEntity<Void> csrf(CsrfToken token) {
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/refresh")
    public ResponseEntity<Void> refresh(HttpServletRequest request) {
        String token = cookieValue(request, "refresh_token");
        if (token == null || token.isBlank()) {
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid refresh token");
        }
        User user = authService.refresh(token);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, cookie("access_token", authService.accessToken(user), ACCESS_TTL, "/api"))
                .build();
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, expiredCookie("access_token", "/api"))
                .header(HttpHeaders.SET_COOKIE, expiredCookie("refresh_token", "/api/auth/refresh"))
                .build();
    }

    private ResponseEntity<UserProfile> authenticated(User user, HttpStatus status) {
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, cookie("access_token", authService.accessToken(user), ACCESS_TTL, "/api"))
                .header(HttpHeaders.SET_COOKIE, cookie("refresh_token", authService.refreshToken(user), REFRESH_TTL, "/api/auth/refresh"))
                .body(UserProfile.from(user));
    }

    private static String cookie(String name, String value, Duration maxAge, String path) {
        return ResponseCookie.from(name, value).httpOnly(true).secure(false).sameSite("Lax").path(path).maxAge(maxAge).build().toString();
    }

    private static String expiredCookie(String name, String path) {
        return ResponseCookie.from(name, "").httpOnly(true).secure(false).sameSite("Lax").path(path).maxAge(Duration.ZERO).build().toString();
    }

    private static String cookieValue(HttpServletRequest request, String name) {
        if (request.getCookies() == null) return null;
        for (Cookie cookie : request.getCookies()) {
            if (name.equals(cookie.getName())) return cookie.getValue();
        }
        return null;
    }
}
