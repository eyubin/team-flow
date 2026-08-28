package com.teamflow.shared.web;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import org.hibernate.StaleObjectStateException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    private static final URI OPTIMISTIC_LOCK_TYPE = URI.create("urn:teamflow:problem:optimistic-lock");

    @ExceptionHandler(OptimisticLockException.class)
    ResponseEntity<ProblemDetail> optimisticLock(OptimisticLockException exception, HttpServletRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
        problem.setType(OPTIMISTIC_LOCK_TYPE);
        problem.setTitle("Task was changed");
        problem.setInstance(URI.create(request.getRequestURI()));
        if (exception.getCurrentVersion() != null) problem.setProperty("currentVersion", exception.getCurrentVersion());
        problem.setProperty("taskId", exception.getTaskId());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
    }

    @ExceptionHandler({OptimisticLockingFailureException.class, StaleObjectStateException.class})
    ResponseEntity<ProblemDetail> optimisticLockFallback(Exception exception, HttpServletRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "Task was changed; reload before saving");
        problem.setType(OPTIMISTIC_LOCK_TYPE);
        problem.setTitle("Task was changed");
        problem.setInstance(URI.create(request.getRequestURI()));
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
    }
}
