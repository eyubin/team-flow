package com.teamflow.task;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "task_comments")
public class Comment {
    @Id private UUID id;
    @Column(name = "task_id", nullable = false) private UUID taskId;
    @Column(name = "author_id", nullable = false) private UUID authorId;
    @Column(nullable = false, length = 4000) private String body;
    @Column(name = "created_at", nullable = false) private Instant createdAt;

    protected Comment() {}

    public Comment(UUID taskId, UUID authorId, String body) {
        this.id = UUID.randomUUID();
        this.taskId = taskId;
        this.authorId = authorId;
        this.body = body;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getTaskId() { return taskId; }
    public UUID getAuthorId() { return authorId; }
    public String getBody() { return body; }
    public Instant getCreatedAt() { return createdAt; }
}
