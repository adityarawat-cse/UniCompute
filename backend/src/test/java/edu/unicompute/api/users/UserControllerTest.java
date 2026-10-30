package edu.unicompute.api.users;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import edu.unicompute.api.jobs.JobService;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(UserController.class)
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private JobService jobService;

    @Test
    @DisplayName("DELETE /api/users/{id} deletes user and cascades workloads")
    void testDeleteUser_Success() throws Exception {
        Long userId = 2L;
        when(userService.deleteUser(userId)).thenReturn(true);

        mockMvc.perform(delete("/api/users/" + userId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("User deleted successfully"))
                .andExpect(jsonPath("$.userId").value(userId));

        verify(jobService).cleanupUserWorkloads(userId);
        verify(userService).deleteUser(userId);
    }

    @Test
    @DisplayName("DELETE /api/users/{id} returns 404 when user not found")
    void testDeleteUser_NotFound() throws Exception {
        Long nonExistentId = 999L;
        when(userService.deleteUser(nonExistentId)).thenReturn(false);

        mockMvc.perform(delete("/api/users/" + nonExistentId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("User not found"));

        verify(jobService).cleanupUserWorkloads(nonExistentId);
        verify(userService).deleteUser(nonExistentId);
    }

    @Test
    @DisplayName("GET /api/users returns list of users")
    void testGetAllUsers() throws Exception {
        UserResponse u1 = new UserResponse(1L, "aditya", "aditya@unicompute.edu", "Aditya Rawat", "ADMIN", "ACTIVE", "CSE", 10000, 0, java.time.Instant.now());
        when(userService.findAllUsers()).thenReturn(List.of(u1));

        mockMvc.perform(get("/api/users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].username").value("aditya"));
    }
}
