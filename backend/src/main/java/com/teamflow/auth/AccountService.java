package com.teamflow.auth;

import com.teamflow.audit.AuditService;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Self-service management of the signed-in user's own account. */
@Service
public class AccountService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final ApplicationEventPublisher events;
    private final AuditService audit;

    public AccountService(UserRepository users, PasswordEncoder passwordEncoder,
            ApplicationEventPublisher events, AuditService audit) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.events = events;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public UserProfile get(UUID userId) {
        return UserProfile.from(requireActive(userId));
    }

    @Transactional
    public UserProfile updateProfile(UUID userId, AccountRequests.UpdateProfile request) {
        User user = requireActive(userId);
        if (request.displayName() != null) {
            String displayName = request.displayName().trim();
            if (!displayName.equals(user.getDisplayName())) {
                user.rename(displayName);
                audit.record(userId, "USER_RENAMED", "USER", userId, Map.of());
            }
        }
        if (request.email() != null) {
            String email = normalize(request.email());
            if (!email.equals(user.getEmail())) {
                verifyPassword(user, request.currentPassword());
                users.findByEmail(email).ifPresent(existing -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already registered");
                });
                user.changeEmail(email);
                audit.record(userId, "USER_EMAIL_CHANGED", "USER", userId, Map.of());
            }
        }
        return UserProfile.from(user);
    }

    @Transactional
    public void changePassword(UUID userId, AccountRequests.ChangePassword request) {
        User user = requireActive(userId);
        verifyPassword(user, request.currentPassword());
        if (request.newPassword().equals(request.currentPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New password must differ from the current password");
        }
        user.changePasswordHash(passwordEncoder.encode(request.newPassword()));
        audit.record(userId, "USER_PASSWORD_CHANGED", "USER", userId, Map.of());
    }

    @Transactional
    public void delete(UUID userId, AccountRequests.DeleteAccount request) {
        User user = requireActive(userId);
        verifyPassword(user, request.password());
        events.publishEvent(new UserDeletedEvent(userId));
        // A hash of a random secret nobody holds: well-formed for the encoder,
        // but no password will ever match it.
        user.anonymize(passwordEncoder.encode(UUID.randomUUID().toString()));
        audit.record(userId, "USER_DELETED", "USER", userId, Map.of());
    }

    private User requireActive(UUID userId) {
        return users.findById(userId).filter(User::isEnabled)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthenticated"));
    }

    // 403 rather than 401: the session is valid, the re-authentication step
    // failed. A 401 would make the SPA treat it as an expired session.
    private void verifyPassword(User user, String password) {
        if (password == null || password.isBlank() || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Current password is incorrect");
        }
    }

    private static String normalize(String email) { return email.trim().toLowerCase(Locale.ROOT); }
}
