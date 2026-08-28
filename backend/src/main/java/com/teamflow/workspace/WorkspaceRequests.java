package com.teamflow.workspace;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class WorkspaceRequests {
    private WorkspaceRequests() {}

    public record CreateWorkspace(@NotBlank @Size(max = 120) String name) {}
    public record CreateProject(@NotBlank @Size(max = 120) String name, @Size(max = 4000) String description) {}
    public record UpdateProject(@Size(min = 1, max = 120) String name, @Size(max = 4000) String description) {}
}
