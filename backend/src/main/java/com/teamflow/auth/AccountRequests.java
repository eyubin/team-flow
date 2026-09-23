package com.teamflow.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AccountRequests {

    private AccountRequests() {}

    /**
     * Partial update: a null field is left unchanged. Changing the email is a
     * credential change, so it also requires {@code currentPassword}.
     */
    public record UpdateProfile(
            @Size(max = 80) @Pattern(regexp = ".*\\S.*", message = "must not be blank") String displayName,
            @Email @Size(max = 320) @Pattern(regexp = ".*\\S.*", message = "must not be blank") String email,
            @Size(max = 128) String currentPassword) {}

    public record ChangePassword(
            @NotBlank @Size(max = 128) String currentPassword,
            @NotBlank @Size(min = 8, max = 128) String newPassword) {}

    public record DeleteAccount(@NotBlank @Size(max = 128) String password) {}
}
