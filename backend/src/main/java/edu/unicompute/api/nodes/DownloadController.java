package edu.unicompute.api.nodes;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

@RestController
public class DownloadController {

    @GetMapping(value = "/downloads/install-worker.sh", produces = "text/x-shellscript")
    public ResponseEntity<String> getInstallWorkerScript(
            @RequestParam(required = false) String token,
            @RequestParam(required = false) String name,
            HttpServletRequest request) {

        String defaultServer = resolveServerUrl(request);
        String script = buildBashWorkerScript(
                token != null ? token : "",
                name != null ? name : "Worker-Node",
                defaultServer
        );

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"install-worker.sh\"")
                .body(script);
    }

    @GetMapping(value = "/downloads/start.bat", produces = "application/x-bat")
    public ResponseEntity<String> getStartBatScript(
            @RequestParam(required = false) String token,
            @RequestParam(required = false) String name,
            HttpServletRequest request) {

        String defaultServer = resolveServerUrl(request);
        String bat = buildWindowsBatScript(
                token != null ? token : "",
                name != null ? name : "Worker-Node",
                defaultServer
        );

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"start.bat\"")
                .body(bat);
    }

    @GetMapping(value = "/downloads/unicompute-worker.zip", produces = "application/zip")
    public ResponseEntity<byte[]> getWorkerZip(
            @RequestParam(required = false, defaultValue = "") String token,
            @RequestParam(required = false, defaultValue = "Worker-Node") String name,
            HttpServletRequest request) throws IOException {

        String serverUrl = resolveServerUrl(request);
        byte[] zipBytes = buildWorkerZip(token, name, serverUrl);

        String filename = "unicompute-worker" + (name.isBlank() ? "" : "-" + name.toLowerCase().replaceAll("[^a-z0-9]", "-")) + ".zip";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(zipBytes);
    }

    private String resolveServerUrl(HttpServletRequest request) {
        String scheme = request.getScheme();
        String host = request.getHeader("Host");
        if (host == null || host.isBlank()) {
            host = request.getServerName() + ":" + request.getServerPort();
        }
        return scheme + "://" + host;
    }

    private byte[] buildWorkerZip(String token, String name, String serverUrl) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos, StandardCharsets.UTF_8)) {

            // 1. config.json
            String configJson = "{\n"
                    + "  \"serverUrl\": \"" + serverUrl + "\",\n"
                    + "  \"token\": \"" + token + "\",\n"
                    + "  \"nodeName\": \"" + name + "\"\n"
                    + "}\n";
            addFileToZip(zos, "config.json", configJson.getBytes(StandardCharsets.UTF_8));

            // 2. start.bat (Windows Launcher)
            String startBat = buildWindowsBatScript(token, name, serverUrl);
            addFileToZip(zos, "start.bat", startBat.getBytes(StandardCharsets.UTF_8));

            // 3. start.sh (Mac / Linux Launcher)
            String startSh = buildBashWorkerScript(token, name, serverUrl);
            addFileToZip(zos, "start.sh", startSh.getBytes(StandardCharsets.UTF_8));

            // 4. README.txt
            String readme = buildReadme(token, name, serverUrl);
            addFileToZip(zos, "README.txt", readme.getBytes(StandardCharsets.UTF_8));
        }
        return baos.toByteArray();
    }

    private void addFileToZip(ZipOutputStream zos, String entryName, byte[] data) throws IOException {
        ZipEntry entry = new ZipEntry(entryName);
        zos.putNextEntry(entry);
        zos.write(data);
        zos.closeEntry();
    }

    private String buildReadme(String token, String name, String serverUrl) {
        StringBuilder sb = new StringBuilder();
        sb.append("========================================================================\n");
        sb.append("    UniCompute Academic HPC Cluster - Distributed Worker Node\n");
        sb.append("========================================================================\n\n");
        sb.append("Welcome to UniCompute! This package allows this machine to contribute\n");
        sb.append("compute cores and RAM to the UniCompute cluster.\n\n");
        sb.append("CONFIGURATION:\n");
        sb.append("- Node Name:  ").append(name).append("\n");
        sb.append("- Node Token: ").append(token).append("\n");
        sb.append("- Master URL: ").append(serverUrl).append("\n\n");
        sb.append("HOW TO RUN:\n\n");
        sb.append("1. Windows:\n");
        sb.append("   - Double-click 'start.bat'\n");
        sb.append("   - Or open PowerShell in this folder and run: .\\start.bat\n\n");
        sb.append("2. macOS / Linux:\n");
        sb.append("   - Open Terminal in this folder and run:\n");
        sb.append("     chmod +x start.sh\n");
        sb.append("     ./start.sh\n\n");
        sb.append("3. Verification:\n");
        sb.append("   Once running, you will see a heartbeat transmitted every 10 seconds.\n");
        sb.append("   The Admin Dashboard at ").append(serverUrl).append(" will automatically\n");
        sb.append("   display this laptop with an active green status indicator!\n\n");
        sb.append("To disconnect this worker, simply press Ctrl+C in the terminal.\n");
        sb.append("========================================================================\n");
        return sb.toString();
    }

    private String buildWindowsBatScript(String token, String name, String serverUrl) {
        StringBuilder sb = new StringBuilder();
        sb.append("@echo off\r\n");
        sb.append("title UniCompute Distributed Worker Node\r\n");
        sb.append("echo ========================================================================\r\n");
        sb.append("echo     UniCompute Academic Cluster Worker Node Agent (Windows)\r\n");
        sb.append("echo ========================================================================\r\n");
        sb.append("echo.\r\n");
        sb.append("powershell -NoProfile -ExecutionPolicy Bypass -Command \"& {\" ^\r\n");
        sb.append("\"  $server = '").append(serverUrl).append("';\" ^\r\n");
        sb.append("\"  $token = '").append(token).append("';\" ^\r\n");
        sb.append("\"  $name = '").append(name).append("';\" ^\r\n");
        sb.append("\"  for ($i=0; $i -lt $args.Count; $i++) {\" ^\r\n");
        sb.append("\"    if ($args[$i] -eq '-Token' -and $i+1 -lt $args.Count) { $token = $args[$i+1] }\" ^\r\n");
        sb.append("\"    if ($args[$i] -eq '-Node' -and $i+1 -lt $args.Count) { $name = $args[$i+1] }\" ^\r\n");
        sb.append("\"    if ($args[$i] -eq '-Server' -and $i+1 -lt $args.Count) { $server = $args[$i+1] }\" ^\r\n");
        sb.append("\"  }\" ^\r\n");
        sb.append("\"  if ([string]::IsNullOrWhiteSpace($token) -and (Test-Path 'config.json')) {\" ^\r\n");
        sb.append("\"    $cfg = Get-Content 'config.json' | ConvertFrom-Json;\" ^\r\n");
        sb.append("\"    if ($cfg.token) { $token = $cfg.token };\" ^\r\n");
        sb.append("\"    if ($cfg.nodeName) { $name = $cfg.nodeName };\" ^\r\n");
        sb.append("\"    if ($cfg.serverUrl) { $server = $cfg.serverUrl };\" ^\r\n");
        sb.append("\"  }\" ^\r\n");
        sb.append("\"  if ([string]::IsNullOrWhiteSpace($token)) {\" ^\r\n");
        sb.append("\"    Write-Host '[-] Error: Node token is missing.' -ForegroundColor Red;\" ^\r\n");
        sb.append("\"    exit 1;\" ^\r\n");
        sb.append("\"  }\" ^\r\n");
        sb.append("\"  $cores = (Get-CimInstance Win32_Processor).NumberOfLogicalProcessors;\" ^\r\n");
        sb.append("\"  $totalRamBytes = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory;\" ^\r\n");
        sb.append("\"  $memGb = [math]::Round($totalRamBytes / 1GB);\" ^\r\n");
        sb.append("\"  $os = 'Windows 11 / 10';\" ^\r\n");
        sb.append("\"  Write-Host '[+] Master Orchestrator: ' -NoNewline; Write-Host $server -ForegroundColor Cyan;\" ^\r\n");
        sb.append("\"  Write-Host '[+] Registered Node:     ' -NoNewline; Write-Host $name -ForegroundColor Green;\" ^\r\n");
        sb.append("\"  Write-Host '[+] Hardware Specs:      ' -NoNewline; Write-Host ($cores.ToString() + ' Cores, ' + $memGb.ToString() + ' GB RAM') -ForegroundColor Yellow;\" ^\r\n");
        sb.append("\"  Write-Host '[+] Heartbeat Active:    Transmitting telemetry every 10s (Ctrl+C to quit)...' -ForegroundColor Gray;\" ^\r\n");
        sb.append("\"  echo '';\" ^\r\n");
        sb.append("\"  while ($true) {\" ^\r\n");
        sb.append("\"    $body = @{ token = $token; nodeName = $name; cores = $cores; memoryGb = $memGb; os = $os } | ConvertTo-Json;\" ^\r\n");
        sb.append("\"    try {\" ^\r\n");
        sb.append("\"      $resp = Invoke-RestMethod -Uri ($server + '/api/nodes/heartbeat') -Method POST -ContentType 'application/json' -Body $body -TimeoutSec 5;\" ^\r\n");
        sb.append("\"      $time = (Get-Date).ToString('HH:mm:ss');\" ^\r\n");
        sb.append("\"      Write-Host ('[' + $time + '] [UniCompute] Heartbeat ACK - Node is ' + $resp.status + ' (Live on Dashboard)') -ForegroundColor Green;\" ^\r\n");
        sb.append("\"    } catch {\" ^\r\n");
        sb.append("\"      $time = (Get-Date).ToString('HH:mm:ss');\" ^\r\n");
        sb.append("\"      Write-Host ('[' + $time + '] [UniCompute] Heartbeat failed (retrying in 10s): ' + $_.Exception.Message) -ForegroundColor DarkYellow;\" ^\r\n");
        sb.append("\"    }\" ^\r\n");
        sb.append("\"    Start-Sleep -Seconds 10;\" ^\r\n");
        sb.append("\"  }\" ^\r\n");
        sb.append("\"} %*\r\n");
        sb.append("pause\r\n");
        return sb.toString();
    }

    private String buildBashWorkerScript(String token, String name, String serverUrl) {
        StringBuilder sb = new StringBuilder();
        sb.append("#!/usr/bin/env bash\n");
        sb.append("# UniCompute Academic Cluster Worker Node Agent (Linux / macOS)\n\n");
        sb.append("set -e\n\n");
        sb.append("SERVER_URL='").append(serverUrl).append("'\n");
        sb.append("NODE_TOKEN='").append(token).append("'\n");
        sb.append("NODE_NAME='").append(name).append("'\n\n");
        sb.append("while [[ $# -gt 0 ]]; do\n");
        sb.append("  case $1 in\n");
        sb.append("    --token)\n");
        sb.append("      NODE_TOKEN=\"$2\"\n");
        sb.append("      shift 2\n");
        sb.append("      ;;\n");
        sb.append("    --name)\n");
        sb.append("      NODE_NAME=\"$2\"\n");
        sb.append("      shift 2\n");
        sb.append("      ;;\n");
        sb.append("    --server)\n");
        sb.append("      SERVER_URL=\"$2\"\n");
        sb.append("      shift 2\n");
        sb.append("      ;;\n");
        sb.append("    *)\n");
        sb.append("      shift\n");
        sb.append("      ;;\n");
        sb.append("  esac\n");
        sb.append("done\n\n");
        sb.append("if [ -z \"$NODE_TOKEN\" ] && [ -f \"config.json\" ]; then\n");
        sb.append("  NODE_TOKEN=$(grep -o '\"token\": *\"[^\"]*\"' config.json | cut -d'\"' -f4 || true)\n");
        sb.append("  if [ -z \"$NODE_NAME\" ]; then\n");
        sb.append("    NODE_NAME=$(grep -o '\"nodeName\": *\"[^\"]*\"' config.json | cut -d'\"' -f4 || true)\n");
        sb.append("  fi\n");
        sb.append("  SERVER_FROM_CFG=$(grep -o '\"serverUrl\": *\"[^\"]*\"' config.json | cut -d'\"' -f4 || true)\n");
        sb.append("  if [ -n \"$SERVER_FROM_CFG\" ]; then\n");
        sb.append("    SERVER_URL=\"$SERVER_FROM_CFG\"\n");
        sb.append("  fi\n");
        sb.append("fi\n\n");
        sb.append("if [ -z \"$NODE_TOKEN\" ]; then\n");
        sb.append("  echo -e \"\\033[0;31m[-] Error: Node token is required. Use --token <TOKEN>\\033[0m\"\n");
        sb.append("  exit 1\n");
        sb.append("fi\n\n");
        sb.append("if [ -z \"$NODE_NAME\" ]; then\n");
        sb.append("  NODE_NAME=\"Worker-$(hostname -s 2>/dev/null || echo 'Node')\"\n");
        sb.append("fi\n\n");
        sb.append("CORES=4\n");
        sb.append("if command -v nproc >/dev/null 2>&1; then\n");
        sb.append("  CORES=$(nproc)\n");
        sb.append("elif command -v sysctl >/dev/null 2>&1; then\n");
        sb.append("  CORES=$(sysctl -n hw.ncpu 2>/dev/null || echo 4)\n");
        sb.append("fi\n\n");
        sb.append("MEM_GB=8\n");
        sb.append("if [ -f /proc/meminfo ]; then\n");
        sb.append("  MEM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')\n");
        sb.append("  MEM_GB=$(( MEM_KB / 1024 / 1024 ))\n");
        sb.append("elif command -v sysctl >/dev/null 2>&1; then\n");
        sb.append("  MEM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || echo 8589934592)\n");
        sb.append("  MEM_GB=$(( MEM_BYTES / 1024 / 1024 / 1024 ))\n");
        sb.append("fi\n\n");
        sb.append("OS_NAME=\"$(uname -s) $(uname -m)\"\n\n");
        sb.append("echo \"========================================================================\"\n");
        sb.append("echo \"    UniCompute Academic HPC Cluster - Worker Node Agent\"\n");
        sb.append("echo \"========================================================================\"\n");
        sb.append("echo -e \"\\033[0;36m[+] Master Orchestrator: $SERVER_URL\\033[0m\"\n");
        sb.append("echo -e \"\\033[0;32m[+] Registered Node:     $NODE_NAME\\033[0m\"\n");
        sb.append("echo -e \"\\033[0;33m[+] Specs Detected:      $CORES Cores, ${MEM_GB} GB RAM ($OS_NAME)\\033[0m\"\n");
        sb.append("echo -e \"\\033[0;90m[+] Heartbeat Active:    Transmitting telemetry every 10s (Ctrl+C to stop)...\\033[0m\"\n");
        sb.append("echo \"\"\n\n");
        sb.append("while true; do\n");
        sb.append("  TIMESTAMP=$(date +\"%H:%M:%S\")\n");
        sb.append("  PAYLOAD=\"{\\\"token\\\":\\\"$NODE_TOKEN\\\",\\\"nodeName\\\":\\\"$NODE_NAME\\\",\\\"cores\\\":$CORES,\\\"memoryGb\\\":$MEM_GB,\\\"os\\\":\\\"$OS_NAME\\\"}\"\n");
        sb.append("  RESPONSE=$(curl -s -w \"\\nHTTP_STATUS:%{http_code}\" -X POST \"$SERVER_URL/api/nodes/heartbeat\" \\\n");
        sb.append("    -H \"Content-Type: application/json\" \\\n");
        sb.append("    -d \"$PAYLOAD\" || true)\n");
        sb.append("  STATUS_CODE=$(echo \"$RESPONSE\" | grep \"HTTP_STATUS\" | cut -d':' -f2)\n");
        sb.append("  if [ \"$STATUS_CODE\" = \"200\" ]; then\n");
        sb.append("    echo -e \"\\033[0;32m[$TIMESTAMP] [UniCompute] Heartbeat ACK -> Node is Online & Ready (Visible on Dashboard)\\033[0m\"\n");
        sb.append("  else\n");
        sb.append("    echo -e \"\\033[0;33m[$TIMESTAMP] [UniCompute] Heartbeat retry (HTTP $STATUS_CODE)... Server: $SERVER_URL\\033[0m\"\n");
        sb.append("  fi\n");
        sb.append("  sleep 10\n");
        sb.append("done\n");
        return sb.toString();
    }
}
