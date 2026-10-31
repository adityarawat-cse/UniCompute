package edu.unicompute.api.users;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UserRegistrationRequest(
        @NotBlank @Size(max = 64) String username,
        @NotBlank @Email @Size(max = 128) String email,
        @NotBlank @Size(min = 4, max = 128) String password,
        @NotBlank @Size(max = 128) String fullName,
        String role,
        String department
) {}
