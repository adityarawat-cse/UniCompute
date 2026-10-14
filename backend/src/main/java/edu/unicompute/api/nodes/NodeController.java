package edu.unicompute.api.nodes;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import edu.unicompute.api.common.ResourceNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
public class NodeController {

    private final NodeService nodeService;

    public NodeController(NodeService nodeService) {
        this.nodeService = nodeService;
    }

    @PostMapping("/api/nodes")
    public ResponseEntity<ClusterNode> registerNode(
            @Valid @RequestBody NodeRegistrationRequest request,
            HttpServletRequest servletRequest) {
        String clientIp = extractClientIp(servletRequest);
        ClusterNode node = nodeService.register(request, clientIp);
        return ResponseEntity.status(HttpStatus.CREATED).body(node);
    }

    @GetMapping("/api/nodes")
    public ResponseEntity<List<ClusterNode>> getAllNodes() {
        return ResponseEntity.ok(nodeService.findAll());
    }

    @GetMapping("/api/nodes/{id}")
    public ResponseEntity<ClusterNode> getNodeById(@PathVariable String id) {
        ClusterNode node = nodeService.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Node not found with ID: " + id));
        return ResponseEntity.ok(node);
    }

    @PutMapping("/api/nodes/{id}/status")
    public ResponseEntity<ClusterNode> updateNodeStatus(
            @PathVariable String id,
            @Valid @RequestBody NodeStatusUpdateRequest request) {
        ClusterNode node = nodeService.updateStatus(id, request.status())
                .orElseThrow(() -> new ResourceNotFoundException("Node not found with ID: " + id));
        return ResponseEntity.ok(node);
    }

    @DeleteMapping("/api/nodes/{id}")
    public ResponseEntity<Void> removeNode(@PathVariable String id) {
        boolean removed = nodeService.remove(id);
        if (!removed) {
            throw new ResourceNotFoundException("Node not found or cannot be removed: " + id);
        }
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/nodes/heartbeat")
    public ResponseEntity<ClusterNode> receiveHeartbeat(
            @Valid @RequestBody HeartbeatRequest request,
            HttpServletRequest servletRequest) {
        String clientIp = extractClientIp(servletRequest);
        ClusterNode node = nodeService.recordHeartbeat(request, clientIp)
                .orElseThrow(() -> new ResourceNotFoundException("Node not registered for token: " + request.token()));
        return ResponseEntity.ok(node);
    }

    @GetMapping("/api/nodes/heartbeat")
    public ResponseEntity<ClusterNode> receiveHeartbeatGet(
            @RequestParam String token,
            @RequestParam(required = false) String nodeName,
            @RequestParam(required = false) Integer cores,
            @RequestParam(required = false) Integer memoryGb,
            @RequestParam(required = false) String os,
            HttpServletRequest servletRequest) {
        String clientIp = extractClientIp(servletRequest);
        HeartbeatRequest request = new HeartbeatRequest(token, nodeName, cores, memoryGb, os);
        ClusterNode node = nodeService.recordHeartbeat(request, clientIp)
                .orElseThrow(() -> new ResourceNotFoundException("Node not registered for token: " + token));
        return ResponseEntity.ok(node);
    }

    private String extractClientIp(HttpServletRequest request) {
        String xf = request.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            return xf.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
