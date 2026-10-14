package edu.unicompute.api.nodes;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

@Service
public class NodeService {

    private final Map<String, ClusterNode> nodes = new ConcurrentHashMap<>();

    public NodeService() {
        // Seed default cluster nodes matching demo setup
        Instant now = Instant.now();
        nodes.put("node-1", new ClusterNode(
                "node-1",
                "Node-CSE-Lab-01",
                16,
                64,
                "Linux / Ubuntu",
                "Available",
                "uc_tok_8492",
                now,
                "10.0.4.12",
                now.minusSeconds(3600),
                true
        ));

        nodes.put("node-2", new ClusterNode(
                "node-2",
                "Node-CSE-Lab-02",
                8,
                32,
                "Windows 11",
                "Available",
                "uc_tok_3910",
                now,
                "10.0.4.15",
                now.minusSeconds(3600),
                true
        ));

        nodes.put("node-3", new ClusterNode(
                "node-3",
                "Node-Master-Orchestrator",
                8,
                16,
                "macOS (Host)",
                "Active (Master)",
                "master_token",
                now,
                "127.0.0.1",
                now.minusSeconds(86400),
                true
        ));
    }

    public ClusterNode register(NodeRegistrationRequest request, String clientIp) {
        String nodeId = (request.id() != null && !request.id().isBlank())
                ? request.id()
                : "node-" + System.currentTimeMillis();

        String token = (request.token() != null && !request.token().isBlank())
                ? request.token()
                : "uc_tok_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);

        int cores = request.cores() > 0 ? request.cores() : 8;
        int memoryGb = request.memoryGb() > 0 ? request.memoryGb() : 16;
        String os = (request.os() != null && !request.os().isBlank()) ? request.os() : "Linux";

        ClusterNode node = new ClusterNode(
                nodeId,
                request.name(),
                cores,
                memoryGb,
                os,
                "Offline",
                token,
                null, // No heartbeat yet
                clientIp,
                Instant.now(),
                false
        );

        nodes.put(nodeId, node);
        return node;
    }

    public Optional<ClusterNode> recordHeartbeat(HeartbeatRequest request, String clientIp) {
        String token = request.token().trim();

        // Find existing node with this token
        Optional<ClusterNode> existingNode = nodes.values().stream()
                .filter(n -> token.equalsIgnoreCase(n.token()))
                .findFirst();

        ClusterNode node;
        Instant now = Instant.now();

        if (existingNode.isPresent()) {
            node = existingNode.get().withHeartbeat(
                    now,
                    clientIp,
                    request.os(),
                    request.cores(),
                    request.memoryGb()
            );
        } else {
            // Auto-enroll node if not pre-created
            String nodeId = "node-" + System.currentTimeMillis();
            String name = (request.nodeName() != null && !request.nodeName().isBlank())
                    ? request.nodeName()
                    : "Node-Auto-" + token.substring(Math.max(0, token.length() - 4));
            int cores = (request.cores() != null && request.cores() > 0) ? request.cores() : 4;
            int mem = (request.memoryGb() != null && request.memoryGb() > 0) ? request.memoryGb() : 8;
            String os = (request.os() != null && !request.os().isBlank()) ? request.os() : "Unknown OS";

            node = new ClusterNode(
                    nodeId,
                    name,
                    cores,
                    mem,
                    os,
                    "Available",
                    token,
                    now,
                    clientIp,
                    now,
                    true
            );
        }

        nodes.put(node.id(), node);
        return Optional.of(node);
    }

    public List<ClusterNode> findAll() {
        Instant now = Instant.now();

        return nodes.values().stream()
                .map(node -> computeLiveNodeState(node, now))
                .sorted(Comparator.comparing(ClusterNode::registeredAt))
                .toList();
    }

    public Optional<ClusterNode> findById(String id) {
        ClusterNode node = nodes.get(id);
        if (node == null) {
            return Optional.empty();
        }
        return Optional.of(computeLiveNodeState(node, Instant.now()));
    }

    public Optional<ClusterNode> updateStatus(String id, String newStatus) {
        ClusterNode node = nodes.get(id);
        if (node == null) {
            return Optional.empty();
        }
        boolean isOnline = node.online();
        ClusterNode updated = node.withStatus(newStatus, isOnline);
        nodes.put(id, updated);
        return Optional.of(computeLiveNodeState(updated, Instant.now()));
    }

    public boolean remove(String id) {
        if ("node-3".equals(id)) {
            return false; // Master cannot be removed
        }
        return nodes.remove(id) != null;
    }

    private ClusterNode computeLiveNodeState(ClusterNode node, Instant now) {
        if ("node-3".equals(node.id())) {
            return node.withStatus("Active (Master)", true);
        }

        // Demo seed nodes (node-1, node-2) keep Available status unless modified
        if (("node-1".equals(node.id()) || "node-2".equals(node.id())) && node.lastHeartbeat() == null) {
            return node;
        }

        if (node.lastHeartbeat() == null) {
            return node.withStatus("Offline", false);
        }

        long secondsSinceHeartbeat = Duration.between(node.lastHeartbeat(), now).getSeconds();
        boolean isRecent = secondsSinceHeartbeat <= 30;

        if (isRecent) {
            String currentStatus = "On Break".equalsIgnoreCase(node.status()) ? "On Break" : "Available";
            return node.withStatus(currentStatus, true);
        } else {
            String offlineStatus = "On Break".equalsIgnoreCase(node.status()) ? "On Break" : "Offline";
            return node.withStatus(offlineStatus, false);
        }
    }
}
