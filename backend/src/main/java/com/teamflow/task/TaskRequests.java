package com.teamflow.task;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import com.fasterxml.jackson.annotation.JsonSetter;
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

        public static class UpdateTask {
                @NotNull private Integer version;
                @Size(min = 1, max = 200) private String title;
                @Size(max = 8000) private String description;
                private TaskStatus status;
                private TaskPriority priority;
                private UUID assigneeId;
                private LocalDate dueDate;
                private boolean titleSet;
                private boolean descriptionSet;
                private boolean statusSet;
                private boolean prioritySet;
                private boolean assigneeIdSet;
                private boolean dueDateSet;

                public Integer version() { return version; }
                public String title() { return title; }
                public String description() { return description; }
                public TaskStatus status() { return status; }
                public TaskPriority priority() { return priority; }
                public UUID assigneeId() { return assigneeId; }
                public LocalDate dueDate() { return dueDate; }
                public boolean titleSet() { return titleSet; }
                public boolean descriptionSet() { return descriptionSet; }
                public boolean statusSet() { return statusSet; }
                public boolean prioritySet() { return prioritySet; }
                public boolean assigneeIdSet() { return assigneeIdSet; }
                public boolean dueDateSet() { return dueDateSet; }

                @JsonSetter("version") public void setVersion(Integer value) { version = value; }
                @JsonSetter("title") public void setTitle(String value) { titleSet = true; title = value; }
                @JsonSetter("description") public void setDescription(String value) { descriptionSet = true; description = value; }
                @JsonSetter("status") public void setStatus(TaskStatus value) { statusSet = true; status = value; }
                @JsonSetter("priority") public void setPriority(TaskPriority value) { prioritySet = true; priority = value; }
                @JsonSetter("assigneeId") public void setAssigneeId(UUID value) { assigneeIdSet = true; assigneeId = value; }
                @JsonSetter("dueDate") public void setDueDate(LocalDate value) { dueDateSet = true; dueDate = value; }
        }
}
