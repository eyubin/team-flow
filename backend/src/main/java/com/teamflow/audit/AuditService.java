package com.teamflow.audit;

import com.teamflow.task.Task;
import com.teamflow.task.TaskRepository;
import com.teamflow.workspace.Project;
import com.teamflow.workspace.ProjectRepository;
import com.teamflow.workspace.WorkspaceMemberRepository;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuditService {
    private final AuditEventRepository events;
    private final TaskRepository tasks;
    private final ProjectRepository projects;
    private final WorkspaceMemberRepository members;

    public AuditService(AuditEventRepository events, TaskRepository tasks, ProjectRepository projects,
            WorkspaceMemberRepository members) {
        this.events = events;
        this.tasks = tasks;
        this.projects = projects;
        this.members = members;
    }

    @Transactional
    public void record(UUID actorId, String action, String entityType, UUID entityId, Map<String, Object> payload) {
        events.save(new AuditEvent(actorId, action, entityType, entityId, payload));
    }

    @Transactional(readOnly = true)
    public AuditResponses.AuditEventPage list(UUID userId, String entityType, UUID entityId, int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "page must be non-negative and size must be between 1 and 100");
        }
        UUID workspaceId = switch (entityType) {
            case "TASK" -> projectWorkspace(tasks.findById(entityId).orElseThrow(() -> notFound("Task")));
            case "PROJECT" -> projects.findById(entityId).map(Project::getWorkspaceId).orElseThrow(() -> notFound("Project"));
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported entity type");
        };
        if (members.findByIdWorkspaceIdAndIdUserId(workspaceId, userId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Workspace membership required");
        }
        return AuditResponses.AuditEventPage.from(events.findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc(
                entityType, entityId, PageRequest.of(page, size)));
    }

    private UUID projectWorkspace(Task task) {
        return projects.findById(task.getProjectId()).map(Project::getWorkspaceId).orElseThrow(() -> notFound("Project"));
    }

    private static ResponseStatusException notFound(String type) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, type + " not found");
    }
}
