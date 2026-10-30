package edu.unicompute.api.nodes;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import edu.unicompute.api.persistence.entity.ServerEntity;
import edu.unicompute.api.persistence.repository.ServerRepository;

@Service
public class NodeService {

    private static final Logger log = LoggerFactory.getLogger(NodeService.class);

    private final Map<String, ClusterNode> nodes = new ConcurrentHashMap<>();
    private final java.util.Set<String> evictedTokens = ConcurrentHashMap.newKeySet();
    private final ServerRepository serverRepository;

    @Autowired
    public NodeService(@Autowired(required = false) ServerRepository serverRepository) {
        this.serverRepository = serverRepository;
        initDefaultNodes();
        initFromDatabase();
    }

    public NodeService() {
        this(null);
    }

    private void initDefaultNodes() {
        // Master Orchestrator host node
        Instant now = Instant.now();
        nodes.put("node-3", new ClusterNode(
                "node-3",
                "Node-Master-Orchestrator",
                8,
                55,
                "macOS (Host)",
                "Active (Master)",
                "master_token",
                now,
                "127.0.0.1",
                now.minusSeconds(86400),
                true
        ));
    }

    private void initFromDatabase() {
        if (serverRepository != null) {
            try {
                List<ServerEntity> persisted = serverRepository.findAll();
                for (ServerEntity entity : persisted) {
                    try {
                        ClusterNode node = entity.toDomain();
                        nodes.put(node.id(), node);
                    } catch (Exception e) {
                        log.warn("Could not load persisted server {}: {}", entity.getServerId(), e.getMessage());
                    }
                }
                log.info("Initialized {} server nodes from database.", persisted.size());
            } catch (Exception e) {
                log.warn("Server database initialization skipped: {}", e.getMessage());
            }
        }
    }

    private void persistServer(ClusterNode node) {
        if (serverRepository != null && node != null) {
            try {
                serverRepository.save(ServerEntity.fromDomain(node));
            } catch (Exception e) {
                log.error("Failed to persist server {} to database: {}", node.id(), e.getMessage());
            }
        }
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
        persistServer(node);
        return node;
    }

    public Optional<ClusterNode> recordHeartbeat(HeartbeatRequest request, String clientIp) {
        String token = request.token().trim();

        // If node has been evicted/removed by admin, inform worker to terminate
        if (evictedTokens.contains(token.toLowerCase())) {
            return Optional.of(new ClusterNode(
                    "evicted",
                    request.nodeName() != null ? request.nodeName() : "Evicted-Node",
                    request.cores() != null ? request.cores() : 1,
                    request.memoryGb() != null ? request.memoryGb() : 1,
                    request.os() != null ? request.os() : "Unknown",
                    "Terminated",
                    token,
                    Instant.now(),
                    clientIp,
                    Instant.now(),
                    false
            ));
        }

        // Find existing node with this token
        Optional<ClusterNode> existingNode = nodes.values().stream()
                .filter(n -> token.equalsIgnoreCase(n.token()))
                .findFirst();

        ClusterNode node;
        Instant now = Instant.now();

        if (existingNode.isPresent()) {
            boolean pyAvail = request.pythonAvailable() != null ? request.pythonAvailable() : true;
            String pyVer = request.pythonVersion() != null ? request.pythonVersion() : "Python 3";
            boolean javaAvail = request.javaAvailable() != null ? request.javaAvailable() : true;
            String javaVer = request.javaVersion() != null ? request.javaVersion() : "Java 17";

            node = existingNode.get().withHeartbeat(
                    now,
                    clientIp,
                    request.os(),
                    request.cores(),
                    request.memoryGb(),
                    null,
                    pyAvail,
                    pyVer,
                    javaAvail,
                    javaVer
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
        persistServer(node);
        return Optional.of(node);
    }

    public void registerNode(ClusterNode node) {
        if (node != null) {
            nodes.put(node.id(), node);
            persistServer(node);
        }
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
        persistServer(updated);
        return Optional.of(computeLiveNodeState(updated, Instant.now()));
    }

    public Optional<ClusterNode> disconnect(String token) {
        String cleanToken = token.trim();
        Optional<ClusterNode> existingNode = nodes.values().stream()
                .filter(n -> cleanToken.equalsIgnoreCase(n.token()))
                .findFirst();

        if (existingNode.isPresent()) {
            ClusterNode node = existingNode.get();
            ClusterNode offlineNode = new ClusterNode(
                    node.id(),
                    node.name(),
                    node.cores(),
                    node.memoryGb(),
                    node.os(),
                    "Offline",
                    node.token(),
                    null,
                    node.ipAddress(),
                    node.registeredAt(),
                    false
            );
            nodes.put(node.id(), offlineNode);
            persistServer(offlineNode);
            return Optional.of(offlineNode);
        }
        return Optional.empty();
    }

    public Optional<ClusterNode> findByToken(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        String clean = token.trim();
        return nodes.values().stream()
                .filter(n -> clean.equalsIgnoreCase(n.token()))
                .map(n -> computeLiveNodeState(n, Instant.now()))
                .findFirst();
    }

    public void setNodeBusy(String id, UUID jobId) {
        ClusterNode node = nodes.get(id);
        if (node != null) {
            ClusterNode busyNode = node.withActiveJob(jobId);
            nodes.put(id, busyNode);
            persistServer(busyNode);
        }
    }

    public void setNodeAvailable(String id) {
        ClusterNode node = nodes.get(id);
        if (node != null) {
            ClusterNode availNode = node.withJobCleared();
            nodes.put(id, availNode);
            persistServer(availNode);
        }
    }

    public void recordWorkerHeartbeat(String token, UUID activeJobId, Boolean pythonAvailable, String pythonVersion) {
        recordWorkerHeartbeat(token, activeJobId, pythonAvailable, pythonVersion, true, "Java 17");
    }

    public void recordWorkerHeartbeat(String token, UUID activeJobId, Boolean pythonAvailable, String pythonVersion, Boolean javaAvailable, String javaVersion) {
        if (token == null || token.isBlank()) {
            return;
        }
        String clean = token.trim();
        nodes.values().stream()
                .filter(n -> clean.equalsIgnoreCase(n.token()))
                .findFirst()
                .ifPresent(existing -> {
                    ClusterNode updated = existing.withHeartbeat(
                            Instant.now(),
                            existing.ipAddress(),
                            existing.os(),
                            existing.cores(),
                            existing.memoryGb(),
                            activeJobId,
                            pythonAvailable,
                            pythonVersion,
                            javaAvailable,
                            javaVersion
                    );
                    nodes.put(existing.id(), updated);
                    persistServer(updated);
                });
    }

    public boolean remove(String id) {
        if ("node-3".equals(id)) {
            return false; // Master cannot be removed
        }
        ClusterNode removed = nodes.remove(id);
        if (removed != null) {
            if (removed.token() != null && !removed.token().isBlank()) {
                evictedTokens.add(removed.token().toLowerCase().trim());
            }
            if (serverRepository != null) {
                try {
                    serverRepository.deleteById(id);
                } catch (Exception e) {
                    log.error("Failed to delete server {} from database: {}", id, e.getMessage());
                }
            }
            return true;
        }
        return false;
    }

    private ClusterNode computeLiveNodeState(ClusterNode node, Instant now) {
        if ("node-3".equals(node.id())) {
            return node.withStatus("Active (Master)", true);
        }

        // Demo seed nodes (node-1, node-2) keep Available status unless modified
        if (("node-1".equals(node.id()) || "node-2".equals(node.id())) && node.lastHeartbeat() == null) {
            return node;
        }

        if (node.lastHeartbeat() == null || !node.online()) {
            return node.withStatus("Offline", false);
        }

        long secondsSinceHeartbeat = Duration.between(node.lastHeartbeat(), now).getSeconds();
        boolean isRecent = secondsSinceHeartbeat <= 20;

        if (isRecent) {
            String currentStatus;
            if ("On Break".equalsIgnoreCase(node.status())) {
                currentStatus = "On Break";
            } else if ("Busy".equalsIgnoreCase(node.status()) || node.activeJobId() != null) {
                currentStatus = "Busy";
            } else {
                currentStatus = "Available";
            }
            return node.withStatus(currentStatus, true);
        } else {
            String offlineStatus = "On Break".equalsIgnoreCase(node.status()) ? "On Break" : "Offline";
            return node.withStatus(offlineStatus, false);
        }
    }
}
