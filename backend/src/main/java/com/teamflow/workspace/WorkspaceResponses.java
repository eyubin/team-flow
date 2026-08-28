package com.teamflow.workspace;

import java.util.UUID;

public final class WorkspaceResponses {
    private WorkspaceResponses() {}

    public record WorkspaceResponse(UUID id, String name, Role myRole) {
        static WorkspaceResponse from(Workspace workspace, Role role) {
            return new WorkspaceResponse(workspace.getId(), workspace.getName(), role);
        }
    }

    public record ProjectResponse(UUID id, UUID workspaceId, String name, String description) {
        static ProjectResponse from(Project project) {
            return new ProjectResponse(project.getId(), project.getWorkspaceId(), project.getName(), project.getDescription());
        }
    }

    public record MemberResponse(UUID userId, String email, String displayName, Role role) {}
}
