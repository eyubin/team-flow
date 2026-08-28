package com.teamflow.shared.web;

import java.util.UUID;

public class OptimisticLockException extends RuntimeException {
    private final UUID taskId;
    private final Integer currentVersion;

    public OptimisticLockException(UUID taskId, Integer currentVersion) {
        super("Task version is stale");
        this.taskId = taskId;
        this.currentVersion = currentVersion;
    }

    public UUID getTaskId() { return taskId; }
    public Integer getCurrentVersion() { return currentVersion; }
}
