package com.teamflow.auth;

import java.time.Instant;
import java.util.UUID;

public record AdminUserResponse(UUID id, String email, String displayName, SystemRole systemRole, Instant createdAt) {
    static AdminUserResponse from(User user) {
        return new AdminUserResponse(
                user.getId(), user.getEmail(), user.getDisplayName(), user.getSystemRole(), user.getCreatedAt());
    }
}
