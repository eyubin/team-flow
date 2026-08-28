package com.teamflow.audit;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;

public final class AuditResponses {
    private AuditResponses() {}

    public record AuditEventResponse(UUID id, UUID actorId, String action, String entityType,
            UUID entityId, Map<String, Object> payload, Instant createdAt) {
        static AuditEventResponse from(AuditEvent event) {
            return new AuditEventResponse(event.getId(), event.getActorId(), event.getAction(), event.getEntityType(),
                    event.getEntityId(), event.getPayload(), event.getCreatedAt());
        }
    }

    public record AuditEventPage(List<AuditEventResponse> content, int page, int size, long totalElements) {
        static AuditEventPage from(Page<AuditEvent> events) {
            return new AuditEventPage(events.getContent().stream().map(AuditEventResponse::from).toList(),
                    events.getNumber(), events.getSize(), events.getTotalElements());
        }
    }
}
