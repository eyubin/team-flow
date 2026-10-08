package com.teamflow.auth;

/**
 * Platform-wide role, separate from the workspace-scoped
 * {@code com.teamflow.workspace.Role}. An {@code ADMIN} can manage every
 * user account through {@code /api/admin/users}.
 */
public enum SystemRole {
    ADMIN,
    USER
}
