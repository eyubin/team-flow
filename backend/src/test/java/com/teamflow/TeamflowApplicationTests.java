package com.teamflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.UUID;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class TeamflowApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void contextLoads() {}

    @Test
    void healthIsPublic() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void flywayAppliedInitSchema() {
        Integer migrations =
                jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM flyway_schema_history WHERE success = true", Integer.class);
        assertThat(migrations).isGreaterThanOrEqualTo(1);

        Integer tables =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*) FROM information_schema.tables
                        WHERE table_schema = 'public'
                          AND table_name IN (
                            'users', 'workspaces', 'workspace_members', 'projects',
                            'tasks', 'task_comments', 'audit_events'
                          )
                        """,
                        Integer.class);
        assertThat(tables).isEqualTo(7);
    }

      @Test
      void unauthenticatedWorkspaceAccessIsRejected() throws Exception {
        mockMvc.perform(get("/api/workspaces")).andExpect(status().isUnauthorized());
      }

      @Test
      void registrationCreatesAuthenticatedUser() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .with(csrf())
                .contentType("application/json")
                .content("""
                    {"email":"workspace-test@example.com","password":"password123","displayName":"Workspace Tester"}
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.email").value("workspace-test@example.com"))
            .andExpect(cookie().exists("access_token"))
            .andExpect(cookie().exists("refresh_token"));
      }

                @Test
                void refreshRenewsAccessCookieAndRejectsInvalidToken() throws Exception {
              String email = UUID.randomUUID() + "@example.com";
              MvcResult registration = mockMvc.perform(post("/api/auth/register").with(csrf())
                  .contentType("application/json")
                  .content("{\"email\":\"" + email + "\",\"password\":\"password123\",\"displayName\":\"Refresh Tester\"}"))
                .andExpect(status().isCreated())
                .andReturn();
              Cookie refreshCookie = registration.getResponse().getCookie("refresh_token");
              assertThat(refreshCookie).isNotNull();

              mockMvc.perform(post("/api/auth/refresh").with(csrf()).cookie(refreshCookie))
                .andExpect(status().isNoContent())
                .andExpect(cookie().exists("access_token"));

              mockMvc.perform(post("/api/auth/refresh").with(csrf())
                  .cookie(new Cookie("refresh_token", "not-a-jwt")))
                .andExpect(status().isUnauthorized());
                }

                @Test
                void authenticatedUserCanCreateAndFilterTasks() throws Exception {
              UUID userId = UUID.randomUUID();
              jdbcTemplate.update("""
                INSERT INTO users (id, email, password_hash, display_name, enabled, created_at, updated_at)
                VALUES (?, ?, ?, ?, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, userId, userId + "@example.com", "test-hash", "Task Tester");
              var auth = UsernamePasswordAuthenticationToken.authenticated(userId.toString(), null, List.of());

              String workspace = mockMvc.perform(post("/api/workspaces")
                  .with(authentication(auth)).with(csrf())
                  .contentType("application/json").content("{\"name\":\"Task Workspace\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
              UUID workspaceId = UUID.fromString(workspace.replaceAll(".*\\\"id\\\":\\\"([^\\\"]+).*$", "$1"));

              String project = mockMvc.perform(post("/api/workspaces/" + workspaceId + "/projects")
                  .with(authentication(auth)).with(csrf())
                  .contentType("application/json").content("{\"name\":\"Task Project\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
              UUID projectId = UUID.fromString(project.replaceAll(".*\\\"id\\\":\\\"([^\\\"]+).*$", "$1"));

              String task = mockMvc.perform(post("/api/projects/" + projectId + "/tasks")
                  .with(authentication(auth)).with(csrf())
                  .contentType("application/json")
                  .content("{\"title\":\"Ship task API\",\"status\":\"IN_PROGRESS\",\"priority\":\"HIGH\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.version").value(0))
                .andReturn().getResponse().getContentAsString();

              mockMvc.perform(get("/api/projects/" + projectId + "/tasks?status=IN_PROGRESS&size=10")
                  .with(authentication(auth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].title").value("Ship task API"));

                UUID taskId = UUID.fromString(task.replaceAll(".*\\\"id\\\":\\\"([^\\\"]+).*$", "$1"));
                mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(
                      "/api/tasks/" + taskId)
                    .with(authentication(auth)).with(csrf())
                    .contentType("application/json")
                    .content("{\"version\":99,\"title\":\"Stale update\"}"))
                  .andExpect(status().isConflict())
                  .andExpect(jsonPath("$.type").value("urn:teamflow:problem:optimistic-lock"))
                  .andExpect(jsonPath("$.currentVersion").value(0));
                }

                  @Test
                  void adminCanManageMembersButCannotRemoveLastAdmin() throws Exception {
                UUID adminId = UUID.randomUUID();
                UUID memberId = UUID.randomUUID();
                jdbcTemplate.update("""
                  INSERT INTO users (id, email, password_hash, display_name, enabled, created_at, updated_at)
                  VALUES (?, ?, ?, ?, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
                   (?, ?, ?, ?, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                  """, adminId, adminId + "@example.com", "test-hash", "Admin",
                  memberId, memberId + "@example.com", "test-hash", "Member");
                var auth = UsernamePasswordAuthenticationToken.authenticated(adminId.toString(), null, List.of());
                String workspace = mockMvc.perform(post("/api/workspaces")
                    .with(authentication(auth)).with(csrf())
                    .contentType("application/json").content("{\"name\":\"Members Workspace\"}"))
                  .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
                UUID workspaceId = UUID.fromString(workspace.replaceAll(".*\\\"id\\\":\\\"([^\\\"]+).*$", "$1"));

                mockMvc.perform(post("/api/workspaces/" + workspaceId + "/members")
                    .with(authentication(auth)).with(csrf())
                    .contentType("application/json")
                    .content("{\"email\":\"" + memberId + "@example.com\",\"role\":\"MEMBER\"}"))
                  .andExpect(status().isCreated())
                  .andExpect(jsonPath("$.role").value("MEMBER"));

                mockMvc.perform(get("/api/workspaces/" + workspaceId + "/members").with(authentication(auth)))
                  .andExpect(status().isOk())
                  .andExpect(jsonPath("$", org.hamcrest.Matchers.hasSize(2)));

                mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(
                      "/api/workspaces/" + workspaceId + "/members/" + adminId)
                    .with(authentication(auth)).with(csrf())
                    .contentType("application/json").content("{\"role\":\"MEMBER\"}"))
                  .andExpect(status().isConflict());
                  }

                    @Test
                    void taskCommentsAndAuditHistoryAreAvailableToMembers() throws Exception {
                  UUID userId = UUID.randomUUID();
                  jdbcTemplate.update("""
                    INSERT INTO users (id, email, password_hash, display_name, enabled, created_at, updated_at)
                    VALUES (?, ?, ?, ?, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """, userId, userId + "@example.com", "test-hash", "Comment Tester");
                  var auth = UsernamePasswordAuthenticationToken.authenticated(userId.toString(), null, List.of());
                  String workspace = mockMvc.perform(post("/api/workspaces").with(authentication(auth)).with(csrf())
                      .contentType("application/json").content("{\"name\":\"Comment Workspace\"}"))
                    .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
                  UUID workspaceId = UUID.fromString(workspace.replaceAll(".*\\\"id\\\":\\\"([^\\\"]+).*$", "$1"));
                  String project = mockMvc.perform(post("/api/workspaces/" + workspaceId + "/projects")
                      .with(authentication(auth)).with(csrf()).contentType("application/json")
                      .content("{\"name\":\"Comment Project\"}"))
                    .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
                  UUID projectId = UUID.fromString(project.replaceAll(".*\\\"id\\\":\\\"([^\\\"]+).*$", "$1"));
                  String task = mockMvc.perform(post("/api/projects/" + projectId + "/tasks")
                      .with(authentication(auth)).with(csrf()).contentType("application/json")
                      .content("{\"title\":\"Review comments\"}"))
                    .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
                  UUID taskId = UUID.fromString(task.replaceAll(".*\\\"id\\\":\\\"([^\\\"]+).*$", "$1"));

                  mockMvc.perform(post("/api/tasks/" + taskId + "/comments").with(authentication(auth)).with(csrf())
                      .contentType("application/json").content("{\"body\":\"Looks good\"}"))
                    .andExpect(status().isCreated()).andExpect(jsonPath("$.body").value("Looks good"));
                  mockMvc.perform(get("/api/tasks/" + taskId + "/comments").with(authentication(auth)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$", org.hamcrest.Matchers.hasSize(1)));
                  mockMvc.perform(get("/api/audit-events?entityType=TASK&entityId=" + taskId).with(authentication(auth)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
                    }
}
