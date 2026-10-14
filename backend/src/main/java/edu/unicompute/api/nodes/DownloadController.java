package edu.unicompute.api.nodes;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.nio.charset.StandardCharsets;
import java.util.Enumeration;
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
        String bat = buildWindowsBatScript(defaultServer);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"start.bat\"")
                .body(bat);
    }

    @GetMapping(value = "/downloads/worker.ps1", produces = "text/plain")
    public ResponseEntity<String> getWorkerPs1Script(
            @RequestParam(required = false) String token,
            @RequestParam(required = false) String name,
            HttpServletRequest request) {

        String defaultServer = resolveServerUrl(request);
        String ps1 = buildPowerShellWorkerScript(
                token != null ? token : "",
                name != null ? name : "Worker-Node",
                defaultServer
        );

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"worker.ps1\"")
                .body(ps1);
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

        // When accessed as localhost or 127.0.0.1, auto-detect the host's actual LAN IP
        // so that the generated worker package can connect over the local network from other computers!
        if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
            String lanIp = getLocalLanIp();
            if (lanIp != null && !lanIp.isBlank()) {
                String port = "8080";
                if (host.contains(":")) {
                    port = host.substring(host.indexOf(":") + 1);
                }
                return scheme + "://" + lanIp + ":" + port;
            }
        }

        return scheme + "://" + host;
    }

    private String getLocalLanIp() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface iface = interfaces.nextElement();
                if (iface.isLoopback() || !iface.isUp() || iface.isVirtual()) continue;
                Enumeration<InetAddress> addresses = iface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress addr = addresses.nextElement();
                    if (addr instanceof Inet4Address && !addr.isLoopbackAddress()) {
                        String ip = addr.getHostAddress();
                        if (!ip.startsWith("127.")) {
                            return ip;
                        }
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return null;
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

            // 2. start.bat (Windows Launcher - cleanly invokes worker.ps1 and pauses)
            String startBat = buildWindowsBatScript(serverUrl);
            addFileToZip(zos, "start.bat", startBat.getBytes(StandardCharsets.UTF_8));

            // 3. worker.ps1 (Pure, robust PowerShell script with auto-prompts)
            String workerPs1 = buildPowerShellWorkerScript(token, name, serverUrl);
            addFileToZip(zos, "worker.ps1", workerPs1.getBytes(StandardCharsets.UTF_8));

            // 4. start.sh (Mac / Linux Launcher)
            String startSh = buildBashWorkerScript(token, name, serverUrl);
            addFileToZip(zos, "start.sh", startSh.getBytes(StandardCharsets.UTF_8));

            // 5. README.txt
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
        sb.append("   - (Or open PowerShell in this folder and run: .\\worker.ps1)\n\n");
        sb.append("2. macOS / Linux:\n");
        sb.append("   - Open Terminal in this folder and run:\n");
        sb.append("     chmod +x start.sh\n");
        sb.append("     ./start.sh\n\n");
        sb.append("3. Network Note:\n");
        sb.append("   Ensure both this machine and the master laptop are on the same Wi-Fi\n");
        sb.append("   or mobile hotspot. If the IP changes, the script will prompt you for\n");
        sb.append("   the new Master IP.\n\n");
        sb.append("To disconnect this worker, simply press Ctrl+C in the terminal.\n");
        sb.append("========================================================================\n");
        return sb.toString();
    }

    private String buildWindowsBatScript(String serverUrl) {
        StringBuilder sb = new StringBuilder();
        sb.append("@echo off\r\n");
        sb.append("setlocal\r\n");
        sb.append("cd /d \"%~dp0\"\r\n");
        sb.append("title UniCompute Distributed Worker Node\r\n");
        sb.append("echo ========================================================================\r\n");
        sb.append("echo     UniCompute Academic Cluster Worker Node Agent (Windows)\r\n");
        sb.append("echo ========================================================================\r\n");
        sb.append("echo.\r\n");
        sb.append("if not exist \"%~dp0worker.ps1\" (\r\n");
        sb.append("    echo [!] Downloading worker.ps1 from ").append(serverUrl).append("...\r\n");
        sb.append("    powershell -NoProfile -ExecutionPolicy Bypass -Command \"Invoke-WebRequest -Uri '").append(serverUrl).append("/downloads/worker.ps1' -OutFile '%~dp0worker.ps1'\" 2>nul\r\n");
        sb.append(")\r\n");
        sb.append("if exist \"%~dp0worker.ps1\" (\r\n");
        sb.append("    powershell -NoProfile -ExecutionPolicy Bypass -File \"%~dp0worker.ps1\" %*\r\n");
        sb.append(") else (\r\n");
        sb.append("    echo [-] Error: worker.ps1 could not be located or downloaded.\r\n");
        sb.append(")\r\n");
        sb.append("if %ERRORLEVEL% NEQ 0 (\r\n");
        sb.append("    echo.\r\n");
        sb.append("    echo [!] Worker stopped or encountered an error.\r\n");
        sb.append(")\r\n");
        sb.append("echo.\r\n");
        sb.append("echo Press any key to close this window...\r\n");
        sb.append("pause >nul\r\n");
        return sb.toString();
    }

    private String buildPowerShellWorkerScript(String token, String name, String serverUrl) {
        StringBuilder sb = new StringBuilder();
        sb.append("param(\n");
        sb.append("    [string]$Token = \"").append(token).append("\",\n");
        sb.append("    [string]$Node = \"").append(name).append("\",\n");
        sb.append("    [string]$Server = \"").append(serverUrl).append("\"\n");
        sb.append(")\n\n");
        sb.append("$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition\n");
        sb.append("if (-not $PSScriptRoot) { $PSScriptRoot = \".\" }\n\n");
        sb.append("# 1. Read config.json if available\n");
        sb.append("$configFile = Join-Path $PSScriptRoot \"config.json\"\n");
        sb.append("if (Test-Path $configFile) {\n");
        sb.append("    try {\n");
        sb.append("        $cfg = Get-Content $configFile -Raw | ConvertFrom-Json\n");
        sb.append("        if (-not $Token -and $cfg.token) { $Token = $cfg.token }\n");
        sb.append("        if (-not $Node -and $cfg.nodeName) { $Node = $cfg.nodeName }\n");
        sb.append("        if (-not $Server -and $cfg.serverUrl) { $Server = $cfg.serverUrl }\n");
        sb.append("    } catch {}\n");
        sb.append("}\n\n");
        sb.append("# 2. Validate Token\n");
        sb.append("while ([string]::IsNullOrWhiteSpace($Token)) {\n");
        sb.append("    Write-Host \"[-] Node token is required.\" -ForegroundColor Yellow\n");
        sb.append("    $Token = Read-Host \"Please enter your Node Token (e.g. uc_tok_abc123)\"\n");
        sb.append("    $Token = $Token.Trim()\n");
        sb.append("}\n\n");
        sb.append("# 3. Validate Server URL\n");
        sb.append("if ([string]::IsNullOrWhiteSpace($Server)) {\n");
        sb.append("    $Server = \"http://localhost:8080\"\n");
        sb.append("}\n\n");
        sb.append("if ($Server -match \"localhost\" -or $Server -match \"127\\.0\\.0\\.1\") {\n");
        sb.append("    $canReachLocal = $false\n");
        sb.append("    try {\n");
        sb.append("        $check = Invoke-RestMethod -Uri \"$Server/api/health\" -TimeoutSec 2 -ErrorAction Stop\n");
        sb.append("        if ($check) { $canReachLocal = $true }\n");
        sb.append("    } catch { $canReachLocal = $false }\n\n");
        sb.append("    if (-not $canReachLocal) {\n");
        sb.append("        Write-Host \"\"\n");
        sb.append("        Write-Host \"[!] Note: Server points to '$Server', but no UniCompute master is running on this laptop.\" -ForegroundColor Yellow\n");
        sb.append("        Write-Host \"[!] Enter the IP address of the Master Orchestrator laptop.\" -ForegroundColor Yellow\n");
        sb.append("        $customIp = Read-Host \"Master IP (e.g. 192.168.1.15:8080, or press Enter to keep '$Server')\"\n");
        sb.append("        if (-not [string]::IsNullOrWhiteSpace($customIp)) {\n");
        sb.append("            $customIp = $customIp.Trim()\n");
        sb.append("            if (-not ($customIp -match \"^https?://\")) { $customIp = \"http://\" + $customIp }\n");
        sb.append("            if (-not ($customIp -match \":\\d+$\")) { $customIp = $customIp + \":8080\" }\n");
        sb.append("            $Server = $customIp\n");
        sb.append("            try {\n");
        sb.append("                $newCfg = @{ serverUrl = $Server; token = $Token; nodeName = $Node } | ConvertTo-Json\n");
        sb.append("                Set-Content -Path $configFile -Value $newCfg\n");
        sb.append("            } catch {}\n");
        sb.append("        }\n");
        sb.append("    }\n");
        sb.append("}\n\n");
        sb.append("if (-not $Node) {\n");
        sb.append("    $Node = \"Node-\" + $env:COMPUTERNAME\n");
        sb.append("}\n\n");
        sb.append("# 4. Detect hardware specs\n");
        sb.append("$cores = 4\n");
        sb.append("try {\n");
        sb.append("    $proc = Get-CimInstance Win32_Processor\n");
        sb.append("    if ($proc) { $cores = ($proc | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum }\n");
        sb.append("} catch { $cores = $env:NUMBER_OF_PROCESSORS }\n\n");
        sb.append("$memGb = 8\n");
        sb.append("try {\n");
        sb.append("    $cs = Get-CimInstance Win32_ComputerSystem\n");
        sb.append("    if ($cs -and $cs.TotalPhysicalMemory) {\n");
        sb.append("        $memGb = [math]::Round($cs.TotalPhysicalMemory / 1GB)\n");
        sb.append("    }\n");
        sb.append("} catch {}\n\n");
        sb.append("$os = \"Windows\"\n");
        sb.append("try {\n");
        sb.append("    $osInfo = Get-CimInstance Win32_OperatingSystem\n");
        sb.append("    if ($osInfo -and $osInfo.Caption) { $os = $osInfo.Caption.Trim() }\n");
        sb.append("} catch {}\n\n");
        sb.append("Write-Host \"\"\n");
        sb.append("Write-Host \"========================================================================\" -ForegroundColor Cyan\n");
        sb.append("Write-Host \"    UniCompute Academic Cluster - Worker Node Agent\" -ForegroundColor Cyan\n");
        sb.append("Write-Host \"========================================================================\" -ForegroundColor Cyan\n");
        sb.append("Write-Host \"[+] Master Server:    $Server\" -ForegroundColor White\n");
        sb.append("Write-Host \"[+] Node Name:        $Node\" -ForegroundColor Green\n");
        sb.append("Write-Host \"[+] Token:            $Token\" -ForegroundColor DarkGray\n");
        sb.append("Write-Host \"[+] Detected Specs:   $cores Cores, $memGb GB RAM ($os)\" -ForegroundColor Yellow\n");
        sb.append("Write-Host \"[+] Heartbeat:        Transmitting every 10s (Press Ctrl+C to stop)\" -ForegroundColor Gray\n");
        sb.append("Write-Host \"\"\n\n");
        sb.append("$consecutiveFailures = 0\n\n");
        sb.append("while ($true) {\n");
        sb.append("    $time = (Get-Date).ToString(\"HH:mm:ss\")\n");
        sb.append("    $body = @{\n");
        sb.append("        token = $Token\n");
        sb.append("        nodeName = $Node\n");
        sb.append("        cores = [int]$cores\n");
        sb.append("        memoryGb = [int]$memGb\n");
        sb.append("        os = $os\n");
        sb.append("    } | ConvertTo-Json\n\n");
        sb.append("    try {\n");
        sb.append("        $resp = Invoke-RestMethod -Uri \"$Server/api/nodes/heartbeat\" -Method POST -ContentType \"application/json\" -Body $body -TimeoutSec 6 -ErrorAction Stop\n");
        sb.append("        $consecutiveFailures = 0\n");
        sb.append("        Write-Host \"[$time] [UniCompute] Heartbeat ACK -> Node is \" -NoNewline -ForegroundColor Green\n");
        sb.append("        Write-Host \"$($resp.status)\" -NoNewline -ForegroundColor White\n");
        sb.append("        Write-Host \" (Live on Master Dashboard)\" -ForegroundColor Green\n");
        sb.append("    } catch {\n");
        sb.append("        $consecutiveFailures++\n");
        sb.append("        Write-Host \"[$time] [UniCompute] Heartbeat failed (Attempt $consecutiveFailures): $($_.Exception.Message)\" -ForegroundColor DarkYellow\n");
        sb.append("        if ($consecutiveFailures -eq 3) {\n");
        sb.append("            Write-Host \"\"\n");
        sb.append("            Write-Host \"[!] Cannot reach Master server at $Server\" -ForegroundColor Red\n");
        sb.append("            Write-Host \"[!] Please verify both laptops are on the same Wi-Fi / hotspot network.\" -ForegroundColor Yellow\n");
        sb.append("            $newIp = Read-Host \"Enter new Master IP (or press Enter to keep retrying '$Server')\"\n");
        sb.append("            if (-not [string]::IsNullOrWhiteSpace($newIp)) {\n");
        sb.append("                $newIp = $newIp.Trim()\n");
        sb.append("                if (-not ($newIp -match \"^https?://\")) { $newIp = \"http://\" + $newIp }\n");
        sb.append("                if (-not ($newIp -match \":\\d+$\")) { $newIp = $newIp + \":8080\" }\n");
        sb.append("                $Server = $newIp\n");
        sb.append("                try {\n");
        sb.append("                    $newCfg = @{ serverUrl = $Server; token = $Token; nodeName = $Node } | ConvertTo-Json\n");
        sb.append("                    Set-Content -Path $configFile -Value $newCfg\n");
        sb.append("                } catch {}\n");
        sb.append("            }\n");
        sb.append("            $consecutiveFailures = 0\n");
        sb.append("        }\n");
        sb.append("    }\n");
        sb.append("    Start-Sleep -Seconds 10\n");
        sb.append("}\n");
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
        sb.append("SCRIPT_DIR=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")\" && pwd)\"\n\n");
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
        sb.append("CONFIG_FILE=\"$SCRIPT_DIR/config.json\"\n");
        sb.append("if [ -z \"$NODE_TOKEN\" ] && [ -f \"$CONFIG_FILE\" ]; then\n");
        sb.append("  NODE_TOKEN=$(grep -o '\"token\": *\"[^\"]*\"' \"$CONFIG_FILE\" | cut -d'\"' -f4 || true)\n");
        sb.append("  if [ -z \"$NODE_NAME\" ]; then\n");
        sb.append("    NODE_NAME=$(grep -o '\"nodeName\": *\"[^\"]*\"' \"$CONFIG_FILE\" | cut -d'\"' -f4 || true)\n");
        sb.append("  fi\n");
        sb.append("  SERVER_FROM_CFG=$(grep -o '\"serverUrl\": *\"[^\"]*\"' \"$CONFIG_FILE\" | cut -d'\"' -f4 || true)\n");
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
