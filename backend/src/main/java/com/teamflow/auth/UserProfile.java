package com.teamflow.auth;

import java.util.UUID;

public record UserProfile(UUID id, String email, String displayName) {
    static UserProfile from(User user) {
        return new UserProfile(user.getId(), user.getEmail(), user.getDisplayName());
    }
}
