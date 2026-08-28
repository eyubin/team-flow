package com.teamflow.workspace;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class WorkspaceController {
    private final WorkspaceService service;

    public WorkspaceController(WorkspaceService service) { this.service = service; }

    @GetMapping("/workspaces")
    public List<WorkspaceResponses.WorkspaceResponse> listWorkspaces(Authentication authentication) {
        return service.listWorkspaces(userId(authentication));
    }

    @PostMapping("/workspaces")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkspaceResponses.WorkspaceResponse createWorkspace(
            Authentication authentication, @Valid @RequestBody WorkspaceRequests.CreateWorkspace request) {
        return service.createWorkspace(userId(authentication), request);
    }

    @GetMapping("/workspaces/{workspaceId}")
    public WorkspaceResponses.WorkspaceResponse getWorkspace(
            Authentication authentication, @PathVariable UUID workspaceId) {
        return service.getWorkspace(userId(authentication), workspaceId);
    }

    @GetMapping("/workspaces/{workspaceId}/members")
    public List<WorkspaceResponses.MemberResponse> listMembers(
            Authentication authentication, @PathVariable UUID workspaceId) {
        return service.listMembers(userId(authentication), workspaceId);
    }

    @PostMapping("/workspaces/{workspaceId}/members")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkspaceResponses.MemberResponse addMember(
            Authentication authentication,
            @PathVariable UUID workspaceId,
            @Valid @RequestBody MemberRequests.AddMember request) {
        return service.addMember(userId(authentication), workspaceId, request);
    }

    @PatchMapping("/workspaces/{workspaceId}/members/{memberUserId}")
    public WorkspaceResponses.MemberResponse updateMemberRole(
            Authentication authentication,
            @PathVariable UUID workspaceId,
            @PathVariable UUID memberUserId,
            @Valid @RequestBody MemberRequests.UpdateRole request) {
        return service.updateMemberRole(userId(authentication), workspaceId, memberUserId, request);
    }

    @DeleteMapping("/workspaces/{workspaceId}/members/{memberUserId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(
            Authentication authentication, @PathVariable UUID workspaceId, @PathVariable UUID memberUserId) {
        service.removeMember(userId(authentication), workspaceId, memberUserId);
    }

    @GetMapping("/workspaces/{workspaceId}/projects")
    public List<WorkspaceResponses.ProjectResponse> listProjects(
            Authentication authentication, @PathVariable UUID workspaceId) {
        return service.listProjects(userId(authentication), workspaceId);
    }

    @PostMapping("/workspaces/{workspaceId}/projects")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkspaceResponses.ProjectResponse createProject(
            Authentication authentication,
            @PathVariable UUID workspaceId,
            @Valid @RequestBody WorkspaceRequests.CreateProject request) {
        return service.createProject(userId(authentication), workspaceId, request);
    }

    @GetMapping("/projects/{projectId}")
    public WorkspaceResponses.ProjectResponse getProject(
            Authentication authentication, @PathVariable UUID projectId) {
        return service.getProject(userId(authentication), projectId);
    }

    @PatchMapping("/projects/{projectId}")
    public WorkspaceResponses.ProjectResponse updateProject(
            Authentication authentication,
            @PathVariable UUID projectId,
            @Valid @RequestBody WorkspaceRequests.UpdateProject request) {
        return service.updateProject(userId(authentication), projectId, request);
    }

    @DeleteMapping("/projects/{projectId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteProject(Authentication authentication, @PathVariable UUID projectId) {
        service.deleteProject(userId(authentication), projectId);
    }

    private static UUID userId(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }
}
