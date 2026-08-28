package com.teamflow.auth;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public User register(AuthRequests.Register request) {
        String email = normalize(request.email());
        if (users.findByEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already registered");
        }
        return users.save(new User(
                UUID.randomUUID(), email, passwordEncoder.encode(request.password()), request.displayName().trim(), Instant.now()));
    }

    @Transactional(readOnly = true)
    public User login(AuthRequests.Login request) {
        return users.findByEmail(normalize(request.email()))
                .filter(User::isEnabled)
                .filter(user -> passwordEncoder.matches(request.password(), user.getPasswordHash()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));
    }

    @Transactional(readOnly = true)
    public User requireUser(UUID id) {
        return users.findById(id).filter(User::isEnabled)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthenticated"));
    }

    public String accessToken(User user) { return jwtService.accessToken(user); }
    public String refreshToken(User user) { return jwtService.refreshToken(user); }

    private static String normalize(String email) { return email.trim().toLowerCase(Locale.ROOT); }
}
