package com.teamflow.task;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;

public final class TaskResponses {
    private TaskResponses() {}

    public record TaskResponse(UUID id, UUID projectId, String title, String description,
            TaskStatus status, TaskPriority priority, UUID assigneeId, LocalDate dueDate,
            Integer version, Instant createdAt, Instant updatedAt) {
        static TaskResponse from(Task task) {
            return new TaskResponse(task.getId(), task.getProjectId(), task.getTitle(), task.getDescription(),
                    task.getStatus(), task.getPriority(), task.getAssigneeId(), task.getDueDate(), task.getVersion(),
                    task.getCreatedAt(), task.getUpdatedAt());
        }
    }

    public record TaskPage(List<TaskResponse> content, int page, int size, long totalElements) {
        static TaskPage from(Page<Task> tasks) {
            return new TaskPage(tasks.getContent().stream().map(TaskResponse::from).toList(),
                    tasks.getNumber(), tasks.getSize(), tasks.getTotalElements());
        }
    }
}
