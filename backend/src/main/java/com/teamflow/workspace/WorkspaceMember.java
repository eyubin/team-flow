package com.teamflow.workspace;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "workspace_members")
public class WorkspaceMember {
    @EmbeddedId
    private WorkspaceMemberId id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected WorkspaceMember() {}

    public WorkspaceMember(WorkspaceMemberId id, Role role, Instant createdAt) {
        this.id = id;
        this.role = role;
        this.createdAt = createdAt;
    }

    public WorkspaceMemberId getId() { return id; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
}
