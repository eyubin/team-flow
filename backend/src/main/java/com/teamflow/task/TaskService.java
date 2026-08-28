package com.teamflow.task;

import com.teamflow.audit.AuditService;
import com.teamflow.workspace.Project;
import com.teamflow.workspace.ProjectRepository;
import com.teamflow.workspace.Role;
import com.teamflow.workspace.WorkspaceMember;
import com.teamflow.workspace.WorkspaceMemberRepository;
import com.teamflow.shared.web.OptimisticLockException;
import java.time.LocalDate;
import java.util.UUID;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TaskService {
    private final TaskRepository tasks;
    private final ProjectRepository projects;
    private final WorkspaceMemberRepository members;
    private final AuditService audit;

    public TaskService(TaskRepository tasks, ProjectRepository projects, WorkspaceMemberRepository members, AuditService audit) {
        this.tasks = tasks;
        this.projects = projects;
        this.members = members;
        this.audit = audit;
    }

    @Transactional
    public TaskResponses.TaskResponse create(UUID userId, UUID projectId, TaskRequests.CreateTask request) {
        Project project = requireProject(projectId);
        requireWriteRole(userId, project);
        validateAssignee(userId, project, request.assigneeId());
        Task task = new Task(UUID.randomUUID(), projectId, request.title().trim(), request.description(),
                request.status() == null ? TaskStatus.TODO : request.status(),
                request.priority() == null ? TaskPriority.MEDIUM : request.priority(),
                request.assigneeId(), request.dueDate(), java.time.Instant.now());
        Task saved = tasks.save(task);
        audit.record(userId, "TASK_CREATED", "TASK", saved.getId(), Map.of("projectId", projectId.toString()));
        return TaskResponses.TaskResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public TaskResponses.TaskPage list(UUID userId, UUID projectId, TaskStatus status, UUID assigneeId,
            TaskPriority priority, int page, int size, String sort) {
        Project project = requireProject(projectId);
        requireReadRole(userId, project);
        if (page < 0 || size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "page must be non-negative and size must be between 1 and 100");
        }
        Pageable pageable = PageRequest.of(page, size, parseSort(sort));
        Specification<Task> specification = (root, query, builder) -> builder.equal(root.get("projectId"), projectId);
        if (status != null) specification = specification.and((root, query, builder) -> builder.equal(root.get("status"), status));
        if (assigneeId != null) specification = specification.and((root, query, builder) -> builder.equal(root.get("assigneeId"), assigneeId));
        if (priority != null) specification = specification.and((root, query, builder) -> builder.equal(root.get("priority"), priority));
        return TaskResponses.TaskPage.from(tasks.findAll(specification, pageable));
    }

    @Transactional(readOnly = true)
    public TaskResponses.TaskResponse get(UUID userId, UUID taskId) {
        Task task = requireTask(taskId);
        requireReadRole(userId, requireProject(task.getProjectId()));
        return TaskResponses.TaskResponse.from(task);
    }

    @Transactional
    public TaskResponses.TaskResponse update(UUID userId, UUID taskId, TaskRequests.UpdateTask request) {
        Task task = requireTask(taskId);
        Project project = requireProject(task.getProjectId());
        requireWriteRole(userId, project);
        if (!task.getVersion().equals(request.version())) {
            throw new OptimisticLockException(taskId, task.getVersion());
        }
        UUID assigneeId = request.assigneeIdSet() ? request.assigneeId() : task.getAssigneeId();
        validateAssignee(userId, project, assigneeId);
        task.update(
            request.titleSet() ? request.title() : task.getTitle(),
            request.descriptionSet() ? request.description() : task.getDescription(),
            request.statusSet() ? request.status() : task.getStatus(),
            request.prioritySet() ? request.priority() : task.getPriority(),
            assigneeId,
            request.dueDateSet() ? request.dueDate() : task.getDueDate());
        Task saved = tasks.saveAndFlush(task);
        audit.record(userId, "TASK_UPDATED", "TASK", saved.getId(), Map.of("version", saved.getVersion()));
        return TaskResponses.TaskResponse.from(saved);
    }

    @Transactional
    public void delete(UUID userId, UUID taskId) {
        Task task = requireTask(taskId);
        requireWriteRole(userId, requireProject(task.getProjectId()));
        tasks.delete(task);
        audit.record(userId, "TASK_DELETED", "TASK", taskId, Map.of("projectId", task.getProjectId().toString()));
    }

    private Project requireProject(UUID id) {
        return projects.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));
    }

    private Task requireTask(UUID id) {
        return tasks.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
    }

    private void requireReadRole(UUID userId, Project project) {
        requireMember(userId, project).getRole();
    }

    private void requireWriteRole(UUID userId, Project project) {
        Role role = requireMember(userId, project).getRole();
        if (role == Role.VIEWER) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Write access is not allowed for viewers");
    }

    private WorkspaceMember requireMember(UUID userId, Project project) {
        return members.findByIdWorkspaceIdAndIdUserId(project.getWorkspaceId(), userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Workspace membership required"));
    }

    private void validateAssignee(UUID userId, Project project, UUID assigneeId) {
        if (assigneeId != null && members.findByIdWorkspaceIdAndIdUserId(project.getWorkspaceId(), assigneeId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assignee must be a workspace member");
        }
    }

    private static Sort parseSort(String value) {
        String sort = value == null || value.isBlank() ? "createdAt,desc" : value;
        String[] parts = sort.split(",", -1);
        String property = switch (parts[0]) {
            case "createdAt", "dueDate", "priority", "title" -> parts[0];
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported sort field");
        };
        Sort.Direction direction = parts.length > 1 && "asc".equalsIgnoreCase(parts[1]) ? Sort.Direction.ASC : Sort.Direction.DESC;
        return Sort.by(new Sort.Order(direction, property));
    }
}
