package com.teamflow.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class UserAdminRequests {

    private UserAdminRequests() {}

    /** A null {@code systemRole} creates a regular {@link SystemRole#USER}. */
    public record CreateUser(
            @NotBlank @Email @Size(max = 320) String email,
            @NotBlank @Size(min = 8, max = 128) String password,
            @NotBlank @Size(max = 80) String displayName,
            SystemRole systemRole) {}

    /**
     * Partial update: a null field is left unchanged. Unlike the self-service
     * {@link AccountRequests.UpdateProfile}, no current password is asked for -
     * the admin is acting on someone else's account and doesn't know it.
     */
    public record UpdateUser(
            @Size(max = 80) @Pattern(regexp = ".*\\S.*", message = "must not be blank") String displayName,
            @Email @Size(max = 320) @Pattern(regexp = ".*\\S.*", message = "must not be blank") String email,
            SystemRole systemRole,
            @Size(min = 8, max = 128) String password) {}
}
