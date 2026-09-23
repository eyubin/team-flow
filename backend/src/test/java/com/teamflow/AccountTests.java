package com.teamflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class AccountTests {

    private static final String PASSWORD = "password123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private record Account(String email, Cookie accessToken, Cookie refreshToken) {}

    @Test
    void unauthenticatedAccountAccessIsRejected() throws Exception {
        mockMvc.perform(get("/api/users/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void readsAndRenamesOwnProfile() throws Exception {
        Account account = register("Before Rename");

        mockMvc.perform(get("/api/users/me").cookie(account.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(account.email()))
                .andExpect(jsonPath("$.displayName").value("Before Rename"));

        mockMvc.perform(patch("/api/users/me").with(csrf()).cookie(account.accessToken())
                        .contentType("application/json").content("{\"displayName\":\"  After Rename  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("After Rename"))
                .andExpect(jsonPath("$.email").value(account.email()));
    }

    @Test
    void rejectsBlankDisplayName() throws Exception {
        Account account = register("Blank Name");

        mockMvc.perform(patch("/api/users/me").with(csrf()).cookie(account.accessToken())
                        .contentType("application/json").content("{\"displayName\":\"   \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void changingEmailRequiresCurrentPasswordAndAFreeAddress() throws Exception {
        Account account = register("Email Changer");
        Account other = register("Taken Email");
        String newEmail = UUID.randomUUID() + "@example.com";

        mockMvc.perform(patch("/api/users/me").with(csrf()).cookie(account.accessToken())
                        .contentType("application/json").content("{\"email\":\"" + newEmail + "\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(patch("/api/users/me").with(csrf()).cookie(account.accessToken())
                        .contentType("application/json")
                        .content("{\"email\":\"" + other.email() + "\",\"currentPassword\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isConflict());

        mockMvc.perform(patch("/api/users/me").with(csrf()).cookie(account.accessToken())
                        .contentType("application/json")
                        .content("{\"email\":\"" + newEmail.toUpperCase() + "\",\"currentPassword\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(newEmail));

        login(newEmail, PASSWORD).andExpect(status().isOk());
    }

    @Test
    void changesPasswordAfterVerifyingTheCurrentOne() throws Exception {
        Account account = register("Password Changer");

        mockMvc.perform(put("/api/users/me/password").with(csrf()).cookie(account.accessToken())
                        .contentType("application/json")
                        .content("{\"currentPassword\":\"wrong-password\",\"newPassword\":\"new-password-456\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/users/me/password").with(csrf()).cookie(account.accessToken())
                        .contentType("application/json")
                        .content("{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"short\"}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(put("/api/users/me/password").with(csrf()).cookie(account.accessToken())
                        .contentType("application/json")
                        .content("{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"new-password-456\"}"))
                .andExpect(status().isNoContent());

        login(account.email(), PASSWORD).andExpect(status().isUnauthorized());
        login(account.email(), "new-password-456").andExpect(status().isOk());
    }

    @Test
    void deletingAccountAnonymizesUserAndCleansUpOwnedData() throws Exception {
        Account leaving = register("Leaving User");
        Account staying = register("Staying User");

        UUID soloWorkspace = createWorkspace(leaving, "Solo");
        UUID sharedWorkspace = createWorkspace(staying, "Shared");
        addMember(staying, sharedWorkspace, leaving.email(), "MEMBER");
        UUID sharedProject = createProject(staying, sharedWorkspace);
        UUID leavingId = userId(leaving);
        UUID taskId = createTask(staying, sharedProject, leavingId);

        mockMvc.perform(delete("/api/users/me").with(csrf()).cookie(leaving.accessToken())
                        .contentType("application/json").content("{\"password\":\"wrong-password\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/users/me").with(csrf()).cookie(leaving.accessToken())
                        .contentType("application/json").content("{\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isNoContent())
                .andExpect(cookie().maxAge("access_token", 0))
                .andExpect(cookie().maxAge("refresh_token", 0));

        assertThat(count("SELECT COUNT(*) FROM workspaces WHERE id = ?", soloWorkspace)).isZero();
        assertThat(count("SELECT COUNT(*) FROM workspace_members WHERE user_id = ?", leavingId)).isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT assignee_id FROM tasks WHERE id = ?", UUID.class, taskId)).isNull();
        assertThat(jdbcTemplate.queryForObject("SELECT version FROM tasks WHERE id = ?", Integer.class, taskId)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT display_name FROM users WHERE id = ?", String.class, leavingId))
                .isEqualTo("Deleted user");
        assertThat(jdbcTemplate.queryForObject("SELECT email FROM users WHERE id = ?", String.class, leavingId))
                .doesNotContain(leaving.email());

        // Every session is signed out, not just the one that asked: tokens issued
        // before the deletion - including ones held by other devices - no longer
        // authenticate or refresh. The credentials no longer log in, and the
        // email address is free to register again.
        mockMvc.perform(get("/api/users/me").cookie(leaving.accessToken())).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/workspaces").cookie(leaving.accessToken())).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/auth/refresh").with(csrf()).cookie(leaving.refreshToken()))
                .andExpect(status().isUnauthorized())
                .andExpect(cookie().doesNotExist("access_token"));
        login(leaving.email(), PASSWORD).andExpect(status().isUnauthorized());
        register(leaving.email(), "Returning User");
    }

    @Test
    void lastAdminOfASharedWorkspaceCannotDeleteTheirAccount() throws Exception {
        Account admin = register("Only Admin");
        Account member = register("Plain Member");
        UUID workspaceId = createWorkspace(admin, "Needs An Admin");
        addMember(admin, workspaceId, member.email(), "MEMBER");

        mockMvc.perform(delete("/api/users/me").with(csrf()).cookie(admin.accessToken())
                        .contentType("application/json").content("{\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("Needs An Admin")));

        // The veto rolled the whole deletion back.
        mockMvc.perform(get("/api/users/me").cookie(admin.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Only Admin"));
        assertThat(count("SELECT COUNT(*) FROM workspace_members WHERE workspace_id = ?", workspaceId)).isEqualTo(2);
    }

    private Account register(String displayName) throws Exception {
        return register(UUID.randomUUID() + "@example.com", displayName);
    }

    private Account register(String email, String displayName) throws Exception {
        var response = mockMvc.perform(post("/api/auth/register").with(csrf())
                        .contentType("application/json")
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\",\"displayName\":\"" + displayName + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse();
        Cookie accessToken = response.getCookie("access_token");
        Cookie refreshToken = response.getCookie("refresh_token");
        assertThat(accessToken).isNotNull();
        assertThat(refreshToken).isNotNull();
        return new Account(email, accessToken, refreshToken);
    }

    private org.springframework.test.web.servlet.ResultActions login(String email, String password) throws Exception {
        return mockMvc.perform(post("/api/auth/login").with(csrf())
                .contentType("application/json")
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"));
    }

    private UUID userId(Account account) {
        return jdbcTemplate.queryForObject("SELECT id FROM users WHERE email = ?", UUID.class, account.email());
    }

    private UUID createWorkspace(Account account, String name) throws Exception {
        return idOf(mockMvc.perform(post("/api/workspaces").with(csrf()).cookie(account.accessToken())
                        .contentType("application/json").content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    }

    private void addMember(Account admin, UUID workspaceId, String email, String role) throws Exception {
        mockMvc.perform(post("/api/workspaces/" + workspaceId + "/members").with(csrf()).cookie(admin.accessToken())
                        .contentType("application/json").content("{\"email\":\"" + email + "\",\"role\":\"" + role + "\"}"))
                .andExpect(status().isCreated());
    }

    private UUID createProject(Account account, UUID workspaceId) throws Exception {
        return idOf(mockMvc.perform(post("/api/workspaces/" + workspaceId + "/projects").with(csrf()).cookie(account.accessToken())
                        .contentType("application/json").content("{\"name\":\"Project\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    }

    private UUID createTask(Account account, UUID projectId, UUID assigneeId) throws Exception {
        return idOf(mockMvc.perform(post("/api/projects/" + projectId + "/tasks").with(csrf()).cookie(account.accessToken())
                        .contentType("application/json")
                        .content("{\"title\":\"Assigned task\",\"assigneeId\":\"" + assigneeId + "\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    }

    private int count(String sql, UUID id) {
        return jdbcTemplate.queryForObject(sql, Integer.class, id);
    }

    private static UUID idOf(String json) {
        return UUID.fromString(json.replaceAll(".*\"id\":\"([^\"]+)\".*", "$1"));
    }
}
