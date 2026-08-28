package com.teamflow.workspace;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.UUID;

@Embeddable
public class WorkspaceMemberId implements Serializable {
    private UUID workspaceId;
    private UUID userId;

    protected WorkspaceMemberId() {}

    public WorkspaceMemberId(UUID workspaceId, UUID userId) {
        this.workspaceId = workspaceId;
        this.userId = userId;
    }

    public UUID getWorkspaceId() { return workspaceId; }
    public UUID getUserId() { return userId; }

    @Override public boolean equals(Object object) {
        if (this == object) return true;
        if (!(object instanceof WorkspaceMemberId other)) return false;
        return workspaceId.equals(other.workspaceId) && userId.equals(other.userId);
    }

    @Override public int hashCode() { return 31 * workspaceId.hashCode() + userId.hashCode(); }
}
