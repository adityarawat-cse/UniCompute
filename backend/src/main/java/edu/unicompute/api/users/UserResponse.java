package edu.unicompute.api.users;

import java.time.Instant;

import edu.unicompute.api.persistence.entity.UserEntity;

public record UserResponse(
        Long userId,
        String username,
        String email,
        String fullName,
        String role,
        String status,
        String department,
        Integer dailyQuotaSeconds,
        Integer usedQuotaSeconds,
        Instant createdAt
) {
    public static UserResponse fromEntity(UserEntity entity) {
        return new UserResponse(
                entity.getUserId(),
                entity.getUsername(),
                entity.getEmail(),
                entity.getFullName(),
                entity.getRole(),
                entity.getStatus(),
                entity.getDepartment(),
                entity.getDailyQuotaSeconds(),
                entity.getUsedQuotaSeconds(),
                entity.getCreatedAt()
        );
    }
}

