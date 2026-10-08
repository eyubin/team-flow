package com.teamflow.auth;

import java.util.UUID;

public record UserProfile(UUID id, String email, String displayName, SystemRole systemRole) {
    static UserProfile from(User user) {
        return new UserProfile(user.getId(), user.getEmail(), user.getDisplayName(), user.getSystemRole());
    }
}
