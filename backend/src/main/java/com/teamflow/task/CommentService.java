package com.teamflow.task;

import com.teamflow.audit.AuditService;
import com.teamflow.workspace.Project;
import com.teamflow.workspace.ProjectRepository;
import com.teamflow.workspace.Role;
import com.teamflow.workspace.WorkspaceMember;
import com.teamflow.workspace.WorkspaceMemberRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CommentService {
    private final CommentRepository comments;
    private final TaskRepository tasks;
    private final ProjectRepository projects;
    private final WorkspaceMemberRepository members;
    private final AuditService audit;

    public CommentService(CommentRepository comments, TaskRepository tasks, ProjectRepository projects,
            WorkspaceMemberRepository members, AuditService audit) {
        this.comments = comments;
        this.tasks = tasks;
        this.projects = projects;
        this.members = members;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<CommentResponses.CommentResponse> list(UUID userId, UUID taskId) {
        requireRole(userId, taskId, false);
        return comments.findAllByTaskIdOrderByCreatedAtDesc(taskId).stream()
                .map(CommentResponses.CommentResponse::from).toList();
    }

    @Transactional
    public CommentResponses.CommentResponse create(UUID userId, UUID taskId, CommentRequests.CreateComment request) {
        requireRole(userId, taskId, true);
        Comment comment = comments.save(new Comment(taskId, userId, request.body().trim()));
        audit.record(userId, "COMMENT_CREATED", "TASK", taskId, Map.of("commentId", comment.getId().toString()));
        return CommentResponses.CommentResponse.from(comment);
    }

    private void requireRole(UUID userId, UUID taskId, boolean write) {
        Task task = tasks.findById(taskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        Project project = projects.findById(task.getProjectId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));
        WorkspaceMember member = members.findByIdWorkspaceIdAndIdUserId(project.getWorkspaceId(), userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Workspace membership required"));
        if (write && member.getRole() == Role.VIEWER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Write access is not allowed for viewers");
        }
    }
}
