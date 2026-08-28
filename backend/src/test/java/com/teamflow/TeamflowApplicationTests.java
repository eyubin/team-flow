package com.teamflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
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
}
