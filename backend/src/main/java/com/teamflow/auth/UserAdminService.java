package com.teamflow.auth;

import com.teamflow.audit.AuditService;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Management of any user's account by a {@link SystemRole#ADMIN}. The role
 * check itself is in {@code SecurityConfig}, on the {@code /api/admin/**} path.
 * Deleted (anonymized) accounts are treated as gone: they are neither listed
 * nor editable.
 */
@Service
public class UserAdminService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AccountService accounts;
    private final AuditService audit;

    public UserAdminService(UserRepository users, PasswordEncoder passwordEncoder,
            AccountService accounts, AuditService audit) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.accounts = accounts;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<AdminUserResponse> list() {
        return users.findAllByEnabledTrueOrderByCreatedAtAsc().stream().map(AdminUserResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public AdminUserResponse get(UUID userId) {
        return AdminUserResponse.from(requireActive(userId));
    }

    @Transactional
    public AdminUserResponse create(UUID actorId, UserAdminRequests.CreateUser request) {
        String email = normalize(request.email());
        requireFreeEmail(email);
        SystemRole role = request.systemRole() == null ? SystemRole.USER : request.systemRole();
        User user = users.save(new User(UUID.randomUUID(), email, passwordEncoder.encode(request.password()),
                request.displayName().trim(), role, Instant.now()));
        audit.record(actorId, "USER_CREATED", "USER", user.getId(), Map.of("systemRole", role.name()));
        return AdminUserResponse.from(user);
    }

    @Transactional
    public AdminUserResponse update(UUID actorId, UUID userId, UserAdminRequests.UpdateUser request) {
        User user = requireActive(userId);
        if (request.displayName() != null) {
            String displayName = request.displayName().trim();
            if (!displayName.equals(user.getDisplayName())) {
                user.rename(displayName);
                audit.record(actorId, "USER_RENAMED", "USER", userId, Map.of());
            }
        }
        if (request.email() != null) {
            String email = normalize(request.email());
            if (!email.equals(user.getEmail())) {
                requireFreeEmail(email);
                user.changeEmail(email);
                audit.record(actorId, "USER_EMAIL_CHANGED", "USER", userId, Map.of());
            }
        }
        if (request.systemRole() != null && request.systemRole() != user.getSystemRole()) {
            protectLastAdmin(user);
            user.changeSystemRole(request.systemRole());
            audit.record(actorId, "USER_ROLE_CHANGED", "USER", userId, Map.of("systemRole", request.systemRole().name()));
        }
        if (request.password() != null) {
            user.changePasswordHash(passwordEncoder.encode(request.password()));
            audit.record(actorId, "USER_PASSWORD_RESET", "USER", userId, Map.of());
        }
        return AdminUserResponse.from(user);
    }

    /**
     * Same soft delete as self-service deletion, including the workspace
     * clean-up and its last-workspace-admin veto. An admin deletes their own
     * account from the account page, where it re-confirms the password and
     * clears their cookies.
     */
    @Transactional
    public void delete(UUID actorId, UUID userId) {
        if (actorId.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Delete your own account from the account page");
        }
        accounts.anonymize(requireActive(userId), actorId);
    }

    private User requireActive(UUID userId) {
        return users.findById(userId).filter(User::isEnabled)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private void requireFreeEmail(String email) {
        users.findByEmail(email).ifPresent(existing -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already registered");
        });
    }

    // Without an admin nobody could ever manage accounts again, short of
    // editing the database.
    private void protectLastAdmin(User user) {
        if (user.getSystemRole() == SystemRole.ADMIN && users.countByEnabledTrueAndSystemRole(SystemRole.ADMIN) <= 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "At least one administrator is required");
        }
    }

    private static String normalize(String email) { return email.trim().toLowerCase(Locale.ROOT); }
}
