package com.teamflow.task;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tasks/{taskId}/comments")
public class CommentController {
    private final CommentService service;

    public CommentController(CommentService service) { this.service = service; }

    @GetMapping
    public List<CommentResponses.CommentResponse> list(Authentication authentication, @PathVariable UUID taskId) {
        return service.list(userId(authentication), taskId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CommentResponses.CommentResponse create(
            Authentication authentication, @PathVariable UUID taskId,
            @Valid @RequestBody CommentRequests.CreateComment request) {
        return service.create(userId(authentication), taskId, request);
    }

    private static UUID userId(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }
}
