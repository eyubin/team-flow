package com.teamflow.task;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;

public final class TaskRequests {
    private TaskRequests() {}

    public record CreateTask(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 8000) String description,
            TaskStatus status,
            TaskPriority priority,
            UUID assigneeId,
            LocalDate dueDate) {}

    public record UpdateTask(
            @NotNull Integer version,
            @Size(min = 1, max = 200) String title,
            @Size(max = 8000) String description,
            TaskStatus status,
            TaskPriority priority,
            UUID assigneeId,
            LocalDate dueDate) {}
}
