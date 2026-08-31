package com.teamflow.shared.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    private static final String ACCESS_TOKEN_COOKIE = "accessTokenCookie";

    @Bean
    OpenAPI teamflowOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("TeamFlow API")
                        .version("v1")
                        .description(
                                "REST API for TeamFlow, a compact project and task management system. "
                                        + "Authenticate via /api/auth/login, which sets an HttpOnly access-token "
                                        + "cookie; mutating requests also require the X-XSRF-TOKEN header from "
                                        + "the XSRF-TOKEN cookie issued by /api/auth/csrf."))
                .addSecurityItem(new SecurityRequirement().addList(ACCESS_TOKEN_COOKIE))
                .schemaRequirement(
                        ACCESS_TOKEN_COOKIE,
                        new SecurityScheme()
                                .type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.COOKIE)
                                .name("access_token"));
    }
}
