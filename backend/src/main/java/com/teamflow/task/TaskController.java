package com.teamflow.task;

import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class TaskController {
    private final TaskService service;

    public TaskController(TaskService service) { this.service = service; }

    @GetMapping("/projects/{projectId}/tasks")
    public TaskResponses.TaskPage list(
            Authentication authentication,
            @PathVariable UUID projectId,
            @RequestParam(required = false) TaskStatus status,
            @RequestParam(required = false) UUID assigneeId,
            @RequestParam(required = false) TaskPriority priority,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort) {
        return service.list(userId(authentication), projectId, status, assigneeId, priority, page, size, sort);
    }

    @PostMapping("/projects/{projectId}/tasks")
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponses.TaskResponse create(
            Authentication authentication, @PathVariable UUID projectId,
            @Valid @RequestBody TaskRequests.CreateTask request) {
        return service.create(userId(authentication), projectId, request);
    }

    @GetMapping("/tasks/{taskId}")
    public TaskResponses.TaskResponse get(Authentication authentication, @PathVariable UUID taskId) {
        return service.get(userId(authentication), taskId);
    }

    @PatchMapping("/tasks/{taskId}")
    public TaskResponses.TaskResponse update(
            Authentication authentication, @PathVariable UUID taskId,
            @Valid @RequestBody TaskRequests.UpdateTask request) {
        return service.update(userId(authentication), taskId, request);
    }

    @DeleteMapping("/tasks/{taskId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Authentication authentication, @PathVariable UUID taskId) {
        service.delete(userId(authentication), taskId);
    }

    private static UUID userId(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }
}
