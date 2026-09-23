package com.teamflow.task;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaskRepository extends JpaRepository<Task, UUID>, JpaSpecificationExecutor<Task> {

    /** Bumps the version too, so a client holding the old one gets a 409 instead of re-assigning blindly. */
    @Modifying(flushAutomatically = true)
    @Query("update Task t set t.assigneeId = null, t.version = t.version + 1, t.updatedAt = :now where t.assigneeId = :assigneeId")
    int unassignAll(@Param("assigneeId") UUID assigneeId, @Param("now") Instant now);
}
