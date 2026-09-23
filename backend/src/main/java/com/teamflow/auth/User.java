package com.teamflow.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {

    @Id
    private UUID id;

    @Column(nullable = false, unique = true, length = 320)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "display_name", nullable = false, length = 80)
    private String displayName;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected User() {}

    public User(UUID id, String email, String passwordHash, String displayName, Instant now) {
        this.id = id;
        this.email = email;
        this.passwordHash = passwordHash;
        this.displayName = displayName;
        this.enabled = true;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getDisplayName() { return displayName; }
    public boolean isEnabled() { return enabled; }
    public Instant getCreatedAt() { return createdAt; }

    public void rename(String displayName) {
        this.displayName = displayName;
        this.updatedAt = Instant.now();
    }

    public void changeEmail(String email) {
        this.email = email;
        this.updatedAt = Instant.now();
    }

    public void changePasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
        this.updatedAt = Instant.now();
    }

    /**
     * Soft delete. The row stays because audit events, comments and workspaces
     * reference it, but everything that identifies the person is replaced and
     * the account can no longer authenticate (the JWT filter and refresh both
     * require {@code enabled}).
     */
    public void anonymize(String unusablePasswordHash) {
        this.email = "deleted-" + id + "@deleted.invalid";
        this.displayName = "Deleted user";
        this.passwordHash = unusablePasswordHash;
        this.enabled = false;
        this.updatedAt = Instant.now();
    }
}
