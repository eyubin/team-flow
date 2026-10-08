package com.teamflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import org.springframework.test.web.servlet.ResultActions;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class UserAdminTests {

    private static final String PASSWORD = "password123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private record Account(UUID id, String email, Cookie accessToken) {}

    @Test
    void adminEndpointsRequireTheSystemAdminRole() throws Exception {
        Account user = register("Regular User");

        mockMvc.perform(get("/api/admin/users")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/admin/users").cookie(user.accessToken())).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/admin/users").with(csrf()).cookie(user.accessToken())
                        .contentType("application/json").content(createBody(UUID.randomUUID() + "@example.com", "USER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/admin/users/" + user.id()).with(csrf()).cookie(user.accessToken()))
                .andExpect(status().isForbidden());
    }

    @Test
    void newAccountsAreRegularUsers() throws Exception {
        Account user = register("Plain Registrant");

        mockMvc.perform(get("/api/auth/me").cookie(user.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.systemRole").value("USER"));
    }

    @Test
    void adminCreatesReadsUpdatesAndDeletesAUser() throws Exception {
        Account admin = registerAdmin("Crud Admin");
        String email = UUID.randomUUID() + "@example.com";

        String created = mockMvc.perform(post("/api/admin/users").with(csrf()).cookie(admin.accessToken())
                        .contentType("application/json").content(createBody(email.toUpperCase(), null)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.displayName").value("Created User"))
                .andExpect(jsonPath("$.systemRole").value("USER"))
                .andReturn().getResponse().getContentAsString();
        UUID id = idOf(created);
        login(email, PASSWORD).andExpect(status().isOk());

        mockMvc.perform(get("/api/admin/users").cookie(admin.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == '" + id + "')].email").value(email));
        mockMvc.perform(get("/api/admin/users/" + id).cookie(admin.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Created User"));

        String newEmail = UUID.randomUUID() + "@example.com";
        mockMvc.perform(patch("/api/admin/users/" + id).with(csrf()).cookie(admin.accessToken())
                        .contentType("application/json")
                        .content("{\"displayName\":\" Renamed \",\"email\":\"" + newEmail + "\",\"systemRole\":\"ADMIN\","
                                + "\"password\":\"reset-password-1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Renamed"))
                .andExpect(jsonPath("$.email").value(newEmail))
                .andExpect(jsonPath("$.systemRole").value("ADMIN"));
        login(newEmail, PASSWORD).andExpect(status().isUnauthorized());
        login(newEmail, "reset-password-1").andExpect(status().isOk());

        mockMvc.perform(delete("/api/admin/users/" + id).with(csrf()).cookie(admin.accessToken()))
                .andExpect(status().isNoContent());

        assertThat(jdbcTemplate.queryForObject("SELECT display_name FROM users WHERE id = ?", String.class, id))
                .isEqualTo("Deleted user");
        login(newEmail, "reset-password-1").andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/admin/users/" + id).cookie(admin.accessToken())).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/admin/users").cookie(admin.accessToken()))
                .andExpect(jsonPath("$[?(@.id == '" + id + "')]").isEmpty());
    }

    @Test
    void roleChangesApplyToExistingSessions() throws Exception {
        Account admin = registerAdmin("Promoting Admin");
        Account user = register("Promoted User");

        mockMvc.perform(get("/api/admin/users").cookie(user.accessToken())).andExpect(status().isForbidden());

        mockMvc.perform(patch("/api/admin/users/" + user.id()).with(csrf()).cookie(admin.accessToken())
                        .contentType("application/json").content("{\"systemRole\":\"ADMIN\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/admin/users").cookie(user.accessToken())).andExpect(status().isOk());

        mockMvc.perform(patch("/api/admin/users/" + user.id()).with(csrf()).cookie(admin.accessToken())
                        .contentType("application/json").content("{\"systemRole\":\"USER\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/admin/users").cookie(user.accessToken())).andExpect(status().isForbidden());
    }

    @Test
    void rejectsDuplicateEmailsAndInvalidInput() throws Exception {
        Account admin = registerAdmin("Validating Admin");
        Account existing = register("Existing User");

        mockMvc.perform(post("/api/admin/users").with(csrf()).cookie(admin.accessToken())
                        .contentType("application/json").content(createBody(existing.email(), "USER")))
                .andExpect(status().isConflict());
        mockMvc.perform(post("/api/admin/users").with(csrf()).cookie(admin.accessToken())
                        .contentType("application/json")
                        .content("{\"email\":\"x@example.com\",\"password\":\"short\",\"displayName\":\"X\"}"))
                .andExpect(status().isBadRequest());

        Account other = register("Other User");
        mockMvc.perform(patch("/api/admin/users/" + other.id()).with(csrf()).cookie(admin.accessToken())
                        .contentType("application/json").content("{\"email\":\"" + existing.email() + "\"}"))
                .andExpect(status().isConflict());
        mockMvc.perform(patch("/api/admin/users/" + other.id()).with(csrf()).cookie(admin.accessToken())
                        .contentType("application/json").content("{\"displayName\":\"   \"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(patch("/api/admin/users/" + UUID.randomUUID()).with(csrf()).cookie(admin.accessToken())
                        .contentType("application/json").content("{\"displayName\":\"Nobody\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void adminCannotDeleteThemselvesThroughTheAdminApi() throws Exception {
        Account admin = registerAdmin("Self Deleting Admin");

        mockMvc.perform(delete("/api/admin/users/" + admin.id()).with(csrf()).cookie(admin.accessToken()))
                .andExpect(status().isConflict());
        mockMvc.perform(get("/api/users/me").cookie(admin.accessToken())).andExpect(status().isOk());
    }

    @Test
    void deletingTheLastAdminOfASharedWorkspaceIsVetoed() throws Exception {
        Account admin = registerAdmin("Vetoed Admin");
        Account owner = register("Workspace Owner");
        Account member = register("Workspace Member");
        String workspace = mockMvc.perform(post("/api/workspaces").with(csrf()).cookie(owner.accessToken())
                        .contentType("application/json").content("{\"name\":\"Owned Space\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        mockMvc.perform(post("/api/workspaces/" + idOf(workspace) + "/members").with(csrf()).cookie(owner.accessToken())
                        .contentType("application/json").content("{\"email\":\"" + member.email() + "\",\"role\":\"MEMBER\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(delete("/api/admin/users/" + owner.id()).with(csrf()).cookie(admin.accessToken()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("Owned Space")));
        mockMvc.perform(get("/api/users/me").cookie(owner.accessToken())).andExpect(status().isOk());
    }

    private Account registerAdmin(String displayName) throws Exception {
        Account account = register(displayName);
        jdbcTemplate.update("UPDATE users SET system_role = 'ADMIN' WHERE id = ?", account.id());
        return account;
    }

    private Account register(String displayName) throws Exception {
        String email = UUID.randomUUID() + "@example.com";
        var response = mockMvc.perform(post("/api/auth/register").with(csrf())
                        .contentType("application/json")
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\",\"displayName\":\"" + displayName + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse();
        Cookie accessToken = response.getCookie("access_token");
        assertThat(accessToken).isNotNull();
        return new Account(idOf(response.getContentAsString()), email, accessToken);
    }

    private ResultActions login(String email, String password) throws Exception {
        return mockMvc.perform(post("/api/auth/login").with(csrf())
                .contentType("application/json")
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"));
    }

    private static String createBody(String email, String systemRole) {
        return "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\",\"displayName\":\"Created User\""
                + (systemRole == null ? "" : ",\"systemRole\":\"" + systemRole + "\"") + "}";
    }

    private static UUID idOf(String json) {
        return UUID.fromString(json.replaceAll(".*\"id\":\"([^\"]+)\".*", "$1"));
    }
}
