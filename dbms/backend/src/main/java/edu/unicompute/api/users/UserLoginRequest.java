package edu.unicompute.api.users;

import jakarta.validation.constraints.NotBlank;

public record UserLoginRequest(
        @NotBlank String identifier,
        @NotBlank String password
) {}

