package edu.unicompute.api.nodes;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(NodeController.class)
class NodeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private NodeService nodeService;

    @Test
    @DisplayName("GET /api/nodes returns all registered cluster nodes")
    void testGetAllNodes() throws Exception {
        ClusterNode node = new ClusterNode(
                "node-1", "Lab-01", 8, 16, "Linux", "Available", "tok-1", Instant.now(), "127.0.0.1", Instant.now(), true
        );
        when(nodeService.findAll()).thenReturn(List.of(node));

        mockMvc.perform(get("/api/nodes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value("node-1"))
                .andExpect(jsonPath("$[0].name").value("Lab-01"));
    }

    @Test
    @DisplayName("POST /api/nodes registers a new node and returns 201")
    void testRegisterNode() throws Exception {
        ClusterNode created = new ClusterNode(
                "node-99", "Friend-Laptop", 8, 16, "Windows", "Offline", "uc_tok_abc", null, "127.0.0.1", Instant.now(), false
        );
        when(nodeService.register(any(NodeRegistrationRequest.class), any())).thenReturn(created);

        String json = """
                {
                    "name": "Friend-Laptop",
                    "cores": 8,
                    "memoryGb": 16,
                    "os": "Windows",
                    "token": "uc_tok_abc"
                }
                """;

        mockMvc.perform(post("/api/nodes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("node-99"))
                .andExpect(jsonPath("$.name").value("Friend-Laptop"))
                .andExpect(jsonPath("$.token").value("uc_tok_abc"));
    }

    @Test
    @DisplayName("POST /api/nodes/heartbeat updates node status and returns 200")
    void testHeartbeat() throws Exception {
        ClusterNode active = new ClusterNode(
                "node-99", "Friend-Laptop", 8, 16, "Windows", "Available", "uc_tok_abc", Instant.now(), "192.168.1.10", Instant.now(), true
        );
        when(nodeService.recordHeartbeat(any(HeartbeatRequest.class), any())).thenReturn(Optional.of(active));

        String json = """
                {
                    "token": "uc_tok_abc",
                    "nodeName": "Friend-Laptop",
                    "cores": 8,
                    "memoryGb": 16,
                    "os": "Windows 11"
                }
                """;

        mockMvc.perform(post("/api/nodes/heartbeat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("uc_tok_abc"))
                .andExpect(jsonPath("$.status").value("Available"))
                .andExpect(jsonPath("$.online").value(true));
    }

    @Test
    @DisplayName("PUT /api/nodes/{id}/status updates status")
    void testUpdateStatus() throws Exception {
        ClusterNode onBreak = new ClusterNode(
                "node-1", "Lab-01", 8, 16, "Linux", "On Break", "tok-1", Instant.now(), "127.0.0.1", Instant.now(), true
        );
        when(nodeService.updateStatus(eq("node-1"), eq("On Break"))).thenReturn(Optional.of(onBreak));

        String json = """
                {
                    "status": "On Break"
                }
                """;

        mockMvc.perform(put("/api/nodes/node-1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("On Break"));
    }

    @Test
    @DisplayName("DELETE /api/nodes/{id} removes node")
    void testRemoveNode() throws Exception {
        when(nodeService.remove("node-1")).thenReturn(true);

        mockMvc.perform(delete("/api/nodes/node-1"))
                .andExpect(status().isNoContent());
    }
}
