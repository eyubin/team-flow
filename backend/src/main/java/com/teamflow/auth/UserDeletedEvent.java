package com.teamflow.auth;

import java.util.UUID;

/**
 * Published inside the account-deletion transaction, before the user row is
 * anonymized. Other modules clean up what they own (memberships, assignments)
 * with a plain {@code @EventListener}, so a listener that throws - e.g. the
 * user is the last admin of a shared workspace - vetoes the whole deletion.
 */
public record UserDeletedEvent(UUID userId) {}
