package com.teamflow.task;

import java.time.Instant;
import java.util.UUID;

public final class CommentResponses {
    private CommentResponses() {}

    public record CommentResponse(UUID id, UUID taskId, UUID authorId, String body, Instant createdAt) {
        static CommentResponse from(Comment comment) {
            return new CommentResponse(comment.getId(), comment.getTaskId(), comment.getAuthorId(), comment.getBody(), comment.getCreatedAt());
        }
    }
}
