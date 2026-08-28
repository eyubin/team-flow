package com.teamflow.workspace;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;

public final class MemberRequests {
    private MemberRequests() {}

    public record AddMember(@Email @jakarta.validation.constraints.NotBlank String email, @NotNull Role role) {}
    public record UpdateRole(@NotNull Role role) {}
}
