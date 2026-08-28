package com.teamflow.shared.config;

import com.teamflow.auth.JwtAuthenticationFilter;
import java.util.List;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.session.NullAuthenticatedSessionStrategy;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(TeamflowProperties.class)
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    private static final String[] PUBLIC_GET = {
        "/actuator/health", "/actuator/health/**", "/actuator/health/liveness", "/actuator/health/readiness"
    };

    private static final String[] OPENAPI_PATHS = {
        "/v3/api-docs", "/v3/api-docs/**", "/swagger-ui.html", "/swagger-ui/**"
    };

    private static final String[] PUBLIC_AUTH = {
        "/api/auth/register", "/api/auth/login", "/api/auth/refresh", "/api/auth/csrf"
    };

    @Bean
    @Order(1)
    SecurityFilterChain openApiFilterChain(HttpSecurity http) throws Exception {
        http.securityMatcher(OPENAPI_PATHS)
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(
                        headers ->
                                headers.contentSecurityPolicy(
                                        csp ->
                                                csp.policyDirectives(
                                                        "default-src 'self'; style-src 'self' 'unsafe-inline'; "
                                                                + "script-src 'self'; img-src 'self' data:; "
                                                                + "connect-src 'self'; frame-ancestors 'none'")));
        return http.build();
    }

    @Bean
    @Order(2)
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        CookieCsrfTokenRepository csrfRepo = CookieCsrfTokenRepository.withHttpOnlyFalse();
        csrfRepo.setCookieName("XSRF-TOKEN");
        csrfRepo.setHeaderName("X-XSRF-TOKEN");

        CsrfTokenRequestAttributeHandler requestHandler = new CsrfTokenRequestAttributeHandler();
        requestHandler.setCsrfRequestAttributeName("_csrf");

        http.csrf(csrf -> csrf.csrfTokenRepository(csrfRepo)
                        .csrfTokenRequestHandler(requestHandler)
                        // CsrfConfigurer otherwise auto-wires its own CsrfAuthenticationStrategy, which
                        // rotates/deletes the XSRF-TOKEN cookie on every authenticated request. That's
                        // meant to fire once per login, but under stateless JWT auth every request
                        // re-authenticates from the access-token cookie, so it fired constantly and
                        // silently broke every mutation that followed a plain GET.
                        .sessionAuthenticationStrategy(new NullAuthenticatedSessionStrategy()))
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(
                        auth ->
                                auth.requestMatchers(HttpMethod.GET, PUBLIC_GET)
                                        .permitAll()
                                        .requestMatchers(PUBLIC_AUTH)
                                        .permitAll()
                                        .anyRequest()
                                        .authenticated())
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(exceptions -> exceptions.authenticationEntryPoint(new HttpStatusEntryPoint(org.springframework.http.HttpStatus.UNAUTHORIZED)))
                .headers(
                        headers ->
                                headers.contentSecurityPolicy(
                                        csp -> csp.policyDirectives("default-src 'none'; frame-ancestors 'none'")));

        return http.build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(TeamflowProperties properties) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(properties.cors().originList());
        config.setAllowedMethods(List.of("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Content-Type", "X-XSRF-TOKEN"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
