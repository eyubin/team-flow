package com.teamflow.demo;

import com.teamflow.auth.User;
import com.teamflow.auth.UserRepository;
import com.teamflow.task.Task;
import com.teamflow.task.TaskPriority;
import com.teamflow.task.TaskRepository;
import com.teamflow.task.TaskStatus;
import com.teamflow.workspace.Project;
import com.teamflow.workspace.ProjectRepository;
import com.teamflow.workspace.Role;
import com.teamflow.workspace.Workspace;
import com.teamflow.workspace.WorkspaceMember;
import com.teamflow.workspace.WorkspaceMemberId;
import com.teamflow.workspace.WorkspaceMemberRepository;
import com.teamflow.workspace.WorkspaceRepository;
import java.time.Instant;
import java.util.UUID;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Configuration
public class DemoDataSeeder {
    private static final String DEMO_PASSWORD = "TeamFlow-demo-123";
    private static final UUID ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID MEMBER_ID = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID VIEWER_ID = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID WORKSPACE_ID = UUID.fromString("00000000-0000-0000-0000-000000000010");
    private static final UUID PROJECT_ID = UUID.fromString("00000000-0000-0000-0000-000000000020");

    @Bean
    CommandLineRunner seedDemoData(
            UserRepository users, WorkspaceRepository workspaces, WorkspaceMemberRepository members,
            ProjectRepository projects, TaskRepository tasks, PasswordEncoder passwordEncoder,
            PlatformTransactionManager transactionManager) {
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);
        return args -> transaction.executeWithoutResult(status ->
                seed(users, workspaces, members, projects, tasks, passwordEncoder));
    }

    void seed(UserRepository users, WorkspaceRepository workspaces, WorkspaceMemberRepository members,
            ProjectRepository projects, TaskRepository tasks, PasswordEncoder passwordEncoder) {
        if (users.findById(ADMIN_ID).isPresent()) return;
        Instant now = Instant.now();
        String passwordHash = passwordEncoder.encode(DEMO_PASSWORD);
        users.save(new User(ADMIN_ID, "demo-admin@teamflow.local", passwordHash, "Demo Admin", now));
        users.save(new User(MEMBER_ID, "demo-member@teamflow.local", passwordHash, "Demo Member", now));
        users.save(new User(VIEWER_ID, "demo-viewer@teamflow.local", passwordHash, "Demo Viewer", now));
        workspaces.save(new Workspace(WORKSPACE_ID, "Demo Workspace", ADMIN_ID, now));
        members.save(new WorkspaceMember(new WorkspaceMemberId(WORKSPACE_ID, ADMIN_ID), Role.ADMIN, now));
        members.save(new WorkspaceMember(new WorkspaceMemberId(WORKSPACE_ID, MEMBER_ID), Role.MEMBER, now));
        members.save(new WorkspaceMember(new WorkspaceMemberId(WORKSPACE_ID, VIEWER_ID), Role.VIEWER, now));
        projects.save(new Project(PROJECT_ID, WORKSPACE_ID, "Demo Project", "A seeded project for the TeamFlow walkthrough.", now));
        tasks.save(new Task(UUID.fromString("00000000-0000-0000-0000-000000000021"), PROJECT_ID,
                "Review the task board", "Try editing this task as the demo member.", TaskStatus.IN_PROGRESS,
                TaskPriority.HIGH, MEMBER_ID, null, now));
        tasks.save(new Task(UUID.fromString("00000000-0000-0000-0000-000000000022"), PROJECT_ID,
                "View-only example", "The viewer account can read but cannot change this board.", TaskStatus.TODO,
                TaskPriority.MEDIUM, null, null, now));
    }
}
