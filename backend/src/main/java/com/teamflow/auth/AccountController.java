package com.teamflow.auth;

import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The signed-in user's own account. Creation is {@code POST /api/auth/register};
 * there is deliberately no endpoint to act on another user's account, since
 * roles are workspace-scoped and no one administers accounts globally.
 */
@RestController
@RequestMapping("/api/users/me")
public class AccountController {

    private final AccountService service;

    public AccountController(AccountService service) { this.service = service; }

    @GetMapping
    public UserProfile get(Authentication authentication) {
        return service.get(userId(authentication));
    }

    @PatchMapping
    public UserProfile update(Authentication authentication, @Valid @RequestBody AccountRequests.UpdateProfile request) {
        return service.updateProfile(userId(authentication), request);
    }

    @PutMapping("/password")
    public ResponseEntity<Void> changePassword(
            Authentication authentication, @Valid @RequestBody AccountRequests.ChangePassword request) {
        service.changePassword(userId(authentication), request);
        return ResponseEntity.noContent().build();
    }

    /** Takes a body because deletion re-confirms the password. */
    @DeleteMapping
    public ResponseEntity<Void> delete(Authentication authentication, @Valid @RequestBody AccountRequests.DeleteAccount request) {
        service.delete(userId(authentication), request);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, AuthController.expiredCookie("access_token", "/api"))
                .header(HttpHeaders.SET_COOKIE, AuthController.expiredCookie("refresh_token", "/api/auth/refresh"))
                .build();
    }

    private static UUID userId(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }
}
