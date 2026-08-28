package com.teamflow.workspace;

import com.teamflow.auth.User;
import com.teamflow.auth.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WorkspaceService {
    private final WorkspaceRepository workspaces;
    private final WorkspaceMemberRepository members;
    private final ProjectRepository projects;
    private final UserRepository users;

    public WorkspaceService(
            WorkspaceRepository workspaces,
            WorkspaceMemberRepository members,
            ProjectRepository projects,
            UserRepository users) {
        this.workspaces = workspaces;
        this.members = members;
        this.projects = projects;
        this.users = users;
    }

    @Transactional
    public WorkspaceResponses.WorkspaceResponse createWorkspace(UUID userId, WorkspaceRequests.CreateWorkspace request) {
        Instant now = Instant.now();
        Workspace workspace = workspaces.save(new Workspace(UUID.randomUUID(), request.name().trim(), userId, now));
        members.save(new WorkspaceMember(new WorkspaceMemberId(workspace.getId(), userId), Role.ADMIN, now));
        return WorkspaceResponses.WorkspaceResponse.from(workspace, Role.ADMIN);
    }

    @Transactional(readOnly = true)
    public List<WorkspaceResponses.WorkspaceResponse> listWorkspaces(UUID userId) {
        return members.findAllByIdUserId(userId).stream()
                .map(member -> workspaces.findById(member.getId().getWorkspaceId())
                        .map(workspace -> WorkspaceResponses.WorkspaceResponse.from(workspace, member.getRole()))
                        .orElse(null))
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    @Transactional(readOnly = true)
    public WorkspaceResponses.WorkspaceResponse getWorkspace(UUID userId, UUID workspaceId) {
        WorkspaceMember member = requireMember(userId, workspaceId);
        return WorkspaceResponses.WorkspaceResponse.from(requireWorkspace(workspaceId), member.getRole());
    }

    @Transactional
    public WorkspaceResponses.ProjectResponse createProject(UUID userId, UUID workspaceId, WorkspaceRequests.CreateProject request) {
        requireMember(userId, workspaceId);
        Project project = projects.save(new Project(
                UUID.randomUUID(), workspaceId, request.name().trim(), request.description(), Instant.now()));
        return WorkspaceResponses.ProjectResponse.from(project);
    }

    @Transactional(readOnly = true)
    public List<WorkspaceResponses.ProjectResponse> listProjects(UUID userId, UUID workspaceId) {
        requireMember(userId, workspaceId);
        return projects.findAllByWorkspaceIdOrderByNameAsc(workspaceId).stream()
                .map(WorkspaceResponses.ProjectResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public WorkspaceResponses.ProjectResponse getProject(UUID userId, UUID projectId) {
        Project project = requireProject(projectId);
        requireMember(userId, project.getWorkspaceId());
        return WorkspaceResponses.ProjectResponse.from(project);
    }

    @Transactional
    public WorkspaceResponses.ProjectResponse updateProject(UUID userId, UUID projectId, WorkspaceRequests.UpdateProject request) {
        Project project = requireProject(projectId);
        requireRole(userId, project.getWorkspaceId(), Role.ADMIN);
        project.update(request.name(), request.description());
        return WorkspaceResponses.ProjectResponse.from(projects.save(project));
    }

    @Transactional
    public void deleteProject(UUID userId, UUID projectId) {
        Project project = requireProject(projectId);
        requireRole(userId, project.getWorkspaceId(), Role.ADMIN);
        projects.delete(project);
    }

    @Transactional(readOnly = true)
    public List<WorkspaceResponses.MemberResponse> listMembers(UUID userId, UUID workspaceId) {
        requireMember(userId, workspaceId);
        return members.findAllByIdWorkspaceId(workspaceId).stream()
                .map(member -> users.findById(member.getId().getUserId())
                        .map(user -> new WorkspaceResponses.MemberResponse(
                                user.getId(), user.getEmail(), user.getDisplayName(), member.getRole()))
                        .orElse(null))
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    @Transactional
    public WorkspaceResponses.MemberResponse addMember(UUID userId, UUID workspaceId, MemberRequests.AddMember request) {
        requireAdmin(userId, workspaceId);
        User user = users.findByEmail(request.email().trim().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        WorkspaceMemberId memberId = new WorkspaceMemberId(workspaceId, user.getId());
        if (members.existsById(memberId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User is already a workspace member");
        }
        WorkspaceMember member = members.save(new WorkspaceMember(memberId, request.role(), Instant.now()));
        return new WorkspaceResponses.MemberResponse(user.getId(), user.getEmail(), user.getDisplayName(), member.getRole());
    }

    @Transactional
    public WorkspaceResponses.MemberResponse updateMemberRole(
            UUID userId, UUID workspaceId, UUID memberUserId, MemberRequests.UpdateRole request) {
        requireAdmin(userId, workspaceId);
        WorkspaceMember member = requireMemberRecord(workspaceId, memberUserId);
        protectLastAdmin(member, request.role());
        member.setRole(request.role());
        User user = requireUser(memberUserId);
        return new WorkspaceResponses.MemberResponse(user.getId(), user.getEmail(), user.getDisplayName(), member.getRole());
    }

    @Transactional
    public void removeMember(UUID userId, UUID workspaceId, UUID memberUserId) {
        requireAdmin(userId, workspaceId);
        WorkspaceMember member = requireMemberRecord(workspaceId, memberUserId);
        protectLastAdmin(member, null);
        members.delete(member);
    }

    private Workspace requireWorkspace(UUID workspaceId) {
        return workspaces.findById(workspaceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace not found"));
    }

    private Project requireProject(UUID projectId) {
        return projects.findById(projectId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));
    }

    private WorkspaceMember requireMember(UUID userId, UUID workspaceId) {
        requireWorkspace(workspaceId);
        return members.findByIdWorkspaceIdAndIdUserId(workspaceId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Workspace membership required"));
    }

    private void requireRole(UUID userId, UUID workspaceId, Role required) {
        if (requireMember(userId, workspaceId).getRole() != required) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator role required");
        }
    }

    private void requireAdmin(UUID userId, UUID workspaceId) {
        requireRole(userId, workspaceId, Role.ADMIN);
    }

    private WorkspaceMember requireMemberRecord(UUID workspaceId, UUID userId) {
        return members.findByIdWorkspaceIdAndIdUserId(workspaceId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace member not found"));
    }

    private User requireUser(UUID userId) {
        return users.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private void protectLastAdmin(WorkspaceMember member, Role replacement) {
        if (member.getRole() == Role.ADMIN
                && (replacement != Role.ADMIN)
                && members.countByIdWorkspaceIdAndRole(member.getId().getWorkspaceId(), Role.ADMIN) <= 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Workspace must retain an administrator");
        }
    }
}
