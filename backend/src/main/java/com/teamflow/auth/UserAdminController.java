package com.teamflow.auth;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Every user's account, for {@link SystemRole#ADMIN}s only (enforced in {@code SecurityConfig}). */
@RestController
@RequestMapping("/api/admin/users")
public class UserAdminController {

    private final UserAdminService service;

    public UserAdminController(UserAdminService service) { this.service = service; }

    @GetMapping
    public List<AdminUserResponse> list() {
        return service.list();
    }

    @GetMapping("/{userId}")
    public AdminUserResponse get(@PathVariable UUID userId) {
        return service.get(userId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AdminUserResponse create(Authentication authentication, @Valid @RequestBody UserAdminRequests.CreateUser request) {
        return service.create(userId(authentication), request);
    }

    @PatchMapping("/{userId}")
    public AdminUserResponse update(
            Authentication authentication, @PathVariable UUID userId, @Valid @RequestBody UserAdminRequests.UpdateUser request) {
        return service.update(userId(authentication), userId, request);
    }

    @DeleteMapping("/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Authentication authentication, @PathVariable UUID userId) {
        service.delete(userId(authentication), userId);
    }

    private static UUID userId(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }
}
