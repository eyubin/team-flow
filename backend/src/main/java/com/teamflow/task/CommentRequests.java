package com.teamflow.task;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class CommentRequests {
    private CommentRequests() {}
    public record CreateComment(@NotBlank @Size(max = 4000) String body) {}
}
