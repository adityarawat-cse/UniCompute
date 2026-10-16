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
        sb.append("setlocal enabledelayedexpansion\r\n");
        sb.append("cd /d \"%~dp0\"\r\n");
        sb.append("title UniCompute Distributed Worker Node\r\n");
        sb.append("\r\n");
        sb.append(":START_WORKER\r\n");
        sb.append("cls\r\n");
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
        sb.append("echo.\r\n");
        sb.append("echo ========================================================================\r\n");
        sb.append("echo [*] UniCompute Worker loop stopped.\r\n");
        sb.append("echo ========================================================================\r\n");
        sb.append("set \"RESTART=Y\"\r\n");
        sb.append("set /p RESTART=\"[?] Do you want to reconnect and restart the worker? (Y/N) [default: Y]: \"\r\n");
        sb.append("if /i \"!RESTART!\"==\"Y\" goto START_WORKER\r\n");
        sb.append("if \"!RESTART!\"==\"\" goto START_WORKER\r\n");
        sb.append("echo [*] Exiting UniCompute Worker Agent.\r\n");
        sb.append("exit /b 0\r\n");
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
        sb.append("# 5. Detect and verify Python 3 environment\n");
        sb.append("$pyCmd = $null\n");
        sb.append("$pyArgsPrefix = \"\"\n");
        sb.append("if (Get-Command 'python' -ErrorAction SilentlyContinue) {\n");
        sb.append("    try {\n");
        sb.append("        $v = (& python -c \"import sys; print(sys.version_info[0])\" 2>$null)\n");
        sb.append("        if ($v -eq '3') { $pyCmd = 'python'; $pyArgsPrefix = '-u' }\n");
        sb.append("    } catch {}\n");
        sb.append("}\n");
        sb.append("if (-not $pyCmd -and (Get-Command 'py' -ErrorAction SilentlyContinue)) {\n");
        sb.append("    try {\n");
        sb.append("        $v = (& py -3 -c \"import sys; print(sys.version_info[0])\" 2>$null)\n");
        sb.append("        if ($v -eq '3') { $pyCmd = 'py'; $pyArgsPrefix = '-3 -u' }\n");
        sb.append("    } catch {}\n");
        sb.append("}\n");
        sb.append("$pyAvailable = [bool]$pyCmd\n");
        sb.append("$pyVersion = if ($pyAvailable) { (& $pyCmd --version 2>&1).ToString().Trim() } else { 'Not Installed' }\n\n");
        sb.append("# 6. Detect and verify Java environment\n");
        sb.append("$javaAvailable = [bool](Get-Command 'java' -ErrorAction SilentlyContinue)\n");
        sb.append("$javaVersion = if ($javaAvailable) {\n");
        sb.append("    try {\n");
        sb.append("        $jOut = (& java -version 2>&1) | Out-String\n");
        sb.append("        if ($jOut -match 'version \"([^\"]+)\"') { 'Java ' + $matches[1] } else { 'Java Installed' }\n");
        sb.append("    } catch { 'Java Installed' }\n");
        sb.append("} else { 'Not Installed' }\n\n");
        sb.append("Write-Host \"\"\n");
        sb.append("Write-Host \"========================================================================\" -ForegroundColor Cyan\n");
        sb.append("Write-Host \"    UniCompute Academic Cluster - Worker Node Agent\" -ForegroundColor Cyan\n");
        sb.append("Write-Host \"========================================================================\" -ForegroundColor Cyan\n");
        sb.append("Write-Host \"[+] Master Server:    $Server\" -ForegroundColor White\n");
        sb.append("Write-Host \"[+] Node Name:        $Node\" -ForegroundColor Green\n");
        sb.append("Write-Host \"[+] Token:            $Token\" -ForegroundColor DarkGray\n");
        sb.append("Write-Host \"[+] Detected Specs:   $cores Cores, $memGb GB RAM ($os)\" -ForegroundColor Yellow\n");
        sb.append("Write-Host \"[+] Python Runtime:   $pyVersion\" -ForegroundColor $(if ($pyAvailable) { 'Green' } else { 'DarkYellow' })\n");
        sb.append("Write-Host \"[+] Java Runtime:     $javaVersion\" -ForegroundColor $(if ($javaAvailable) { 'Green' } else { 'DarkYellow' })\n");
        sb.append("Write-Host \"[+] Polling & Heartbeat Active (Press Ctrl+C to stop)\" -ForegroundColor Gray\n");
        sb.append("Write-Host \"\"\n\n");
        sb.append("$consecutiveFailures = 0\n\n");
        sb.append("try {\n");
        sb.append("    while ($true) {\n");
        sb.append("        $time = (Get-Date).ToString(\"HH:mm:ss\")\n");
        sb.append("        $body = @{\n");
        sb.append("            token = $Token\n");
        sb.append("            nodeName = $Node\n");
        sb.append("            cores = [int]$cores\n");
        sb.append("            memoryGb = [int]$memGb\n");
        sb.append("            os = $os\n");
        sb.append("            pythonAvailable = $pyAvailable\n");
        sb.append("            pythonVersion = $pyVersion\n");
        sb.append("            javaAvailable = $javaAvailable\n");
        sb.append("            javaVersion = $javaVersion\n");
        sb.append("        } | ConvertTo-Json\n\n");
        sb.append("        try {\n");
        sb.append("            $resp = Invoke-RestMethod -Uri \"$Server/api/nodes/heartbeat\" -Method POST -ContentType \"application/json\" -Body $body -TimeoutSec 6 -ErrorAction Stop\n");
        sb.append("            if ($resp.status -eq \"Terminated\") {\n");
        sb.append("                Write-Host \"\"\n");
        sb.append("                Write-Host \"[!] Node was permanently removed from cluster by Master Administrator.\" -ForegroundColor Red\n");
        sb.append("                Write-Host \"[!] Terminating worker agent loop...\" -ForegroundColor Yellow\n");
        sb.append("                break\n");
        sb.append("            }\n");
        sb.append("            $consecutiveFailures = 0\n");
        sb.append("            Write-Host \"[$time] [Heartbeat] Heartbeat transmitted -> Master OK (Status: $($resp.status))\" -ForegroundColor Green\n");
        sb.append("        } catch {\n");
        sb.append("            $consecutiveFailures++\n");
        sb.append("            Write-Host \"[$time] [UniCompute] Heartbeat retry ($consecutiveFailures)...\" -ForegroundColor DarkYellow\n");
        sb.append("        }\n\n");
        sb.append("        # Poll for pending jobs if idle\n");
        sb.append("        try {\n");
        sb.append("            $pollBody = @{ availableCores = [int]$cores; availableMemoryMb = [int]($memGb * 1024) } | ConvertTo-Json\n");
        sb.append("            $headers = @{ 'X-Node-Token' = $Token }\n");
        sb.append("            $job = Invoke-RestMethod -Uri \"$Server/api/worker/poll\" -Method POST -Headers $headers -ContentType \"application/json\" -Body $pollBody -TimeoutSec 5 -ErrorAction SilentlyContinue\n");
        sb.append("            if ($job -and $job.jobId) {\n");
        sb.append("                Write-Host \"[$time] [UniCompute] Job Assigned! ID: $($job.jobId) ($($job.jobName))\" -ForegroundColor Cyan\n");
        sb.append("                $null = Invoke-RestMethod -Uri \"$Server/api/worker/start-ack\" -Method POST -Headers $headers -ContentType \"application/json\" -Body (@{ jobId = $job.jobId } | ConvertTo-Json) -TimeoutSec 5 -ErrorAction SilentlyContinue\n\n");
        sb.append("                $runDir = Join-Path $env:TEMP \"unicompute\\run_$($job.jobId)\"\n");
        sb.append("                $null = New-Item -ItemType Directory -Force -Path $runDir\n\n");
        sb.append("                $psi = New-Object System.Diagnostics.ProcessStartInfo\n");
        sb.append("                $psi.RedirectStandardOutput = $true\n");
        sb.append("                $psi.RedirectStandardError = $true\n");
        sb.append("                $psi.UseShellExecute = $false\n");
        sb.append("                $psi.CreateNoWindow = $true\n");
        sb.append("                $psi.WorkingDirectory = $runDir\n\n");
        sb.append("                if ($job.sourceCode -match '^data:[^;]+;base64,(.+)$' -or $job.sourceCode.StartsWith('UEsDB')) {\n");
        sb.append("                    $b64 = if ($job.sourceCode.StartsWith('UEsDB')) { $job.sourceCode } else { $matches[1] }\n");
        sb.append("                    try {\n");
        sb.append("                        $zipBytes = [System.Convert]::FromBase64String($b64)\n");
        sb.append("                        $zipPath = Join-Path $runDir \"workload.zip\"\n");
        sb.append("                        [System.IO.File]::WriteAllBytes($zipPath, $zipBytes)\n");
        sb.append("                        Write-Host \"[$time] [UniCompute] Unpacking workload archive (ZIP)...\" -ForegroundColor Yellow\n");
        sb.append("                        Expand-Archive -Path $zipPath -DestinationPath $runDir -Force\n");
        sb.append("                        if (Test-Path (Join-Path $runDir \"Main.java\")) {\n");
        sb.append("                            $null = & javac -encoding UTF-8 (Join-Path $runDir \"Main.java\") 2>&1\n");
        sb.append("                            $psi.FileName = \"java\"\n");
        sb.append("                            $psi.Arguments = \"-cp `\"$runDir`\" Main\"\n");
        sb.append("                        } elseif (Test-Path (Join-Path $runDir \"main.py\")) {\n");
        sb.append("                            $psi.FileName = $pyCmd\n");
        sb.append("                            $psi.Arguments = \"$pyArgsPrefix `\"$(Join-Path $runDir 'main.py')`\"\"\n");
        sb.append("                        } elseif (Test-Path (Join-Path $runDir \"run.py\")) {\n");
        sb.append("                            $psi.FileName = $pyCmd\n");
        sb.append("                            $psi.Arguments = \"$pyArgsPrefix `\"$(Join-Path $runDir 'run.py')`\"\"\n");
        sb.append("                        } else {\n");
        sb.append("                            $firstPy = Get-ChildItem -Path $runDir -Filter \"*.py\" -Recurse | Select-Object -First 1\n");
        sb.append("                            if ($firstPy) {\n");
        sb.append("                                $psi.FileName = $pyCmd\n");
        sb.append("                                $psi.Arguments = \"$pyArgsPrefix `\"$($firstPy.FullName)`\"\"\n");
        sb.append("                            }\n");
        sb.append("                        }\n");
        sb.append("                    } catch {\n");
        sb.append("                        Write-Host \"[-] Failed to unpack ZIP archive: $_\" -ForegroundColor Red\n");
        sb.append("                    }\n");
        sb.append("                } elseif ($job.language -eq 'JAVA') {\n");
        sb.append("                    $scriptFile = Join-Path $runDir \"Main.java\"\n");
        sb.append("                    [System.IO.File]::WriteAllText($scriptFile, $job.sourceCode, [System.Text.Encoding]::UTF8)\n");
        sb.append("                    Write-Host \"[$time] [UniCompute] Compiling and Executing Java workload (Max: $($job.maxExecutionTimeSeconds)s)...\" -ForegroundColor Yellow\n");
        sb.append("                    $null = & javac -encoding UTF-8 $scriptFile 2>&1\n");
        sb.append("                    $psi.FileName = \"java\"\n");
        sb.append("                    $psi.Arguments = \"-cp `\"$runDir`\" Main\"\n");
        sb.append("                } else {\n");
        sb.append("                    $scriptFile = Join-Path $runDir \"script.py\"\n");
        sb.append("                    [System.IO.File]::WriteAllText($scriptFile, $job.sourceCode, [System.Text.Encoding]::UTF8)\n");
        sb.append("                    Write-Host \"[$time] [UniCompute] Executing Python workload (Max time: $($job.maxExecutionTimeSeconds)s)...\" -ForegroundColor Yellow\n");
        sb.append("                    $psi.FileName = $pyCmd\n");
        sb.append("                    $psi.Arguments = \"$pyArgsPrefix `\"$scriptFile`\"\"\n");
        sb.append("                }\n\n");
        sb.append("                $proc = [System.Diagnostics.Process]::Start($psi)\n");
        sb.append("                $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()\n");
        sb.append("                $stdoutBuilder = New-Object System.Text.StringBuilder\n");
        sb.append("                $stderrBuilder = New-Object System.Text.StringBuilder\n");
        sb.append("                $maxBytes = 32768\n");
        sb.append("                $truncated = $false\n");
        sb.append("                $lastHeartbeatSec = 0\n");
        sb.append("                $wasCancelled = $false\n");
        sb.append("                $timedOut = $false\n\n");
        sb.append("                while (-not $proc.HasExited) {\n");
        sb.append("                    Start-Sleep -Milliseconds 500\n");
        sb.append("                    # Continuously drain stdout without blocking pipe buffer\n");
        sb.append("                    while (-not $proc.StandardOutput.EndOfStream) {\n");
        sb.append("                        $line = $proc.StandardOutput.ReadLine()\n");
        sb.append("                        if ($stdoutBuilder.Length -lt $maxBytes) {\n");
        sb.append("                            [void]$stdoutBuilder.AppendLine($line)\n");
        sb.append("                        } elseif (-not $truncated) {\n");
        sb.append("                            [void]$stdoutBuilder.AppendLine(\"[UniCompute: Output capped at 32 KB limit]\")\n");
        sb.append("                            $truncated = $true\n");
        sb.append("                        }\n");
        sb.append("                        # Continue draining stream into discard\n");
        sb.append("                    }\n");
        sb.append("                    while (-not $proc.StandardError.EndOfStream) {\n");
        sb.append("                        $errLine = $proc.StandardError.ReadLine()\n");
        sb.append("                        if ($stderrBuilder.Length -lt 16384) {\n");
        sb.append("                            [void]$stderrBuilder.AppendLine($errLine)\n");
        sb.append("                        }\n");
        sb.append("                    }\n\n");
        sb.append("                    # Send heartbeat every 10s while running\n");
        sb.append("                    $elapsedSec = [math]::Floor($stopwatch.Elapsed.TotalSeconds)\n");
        sb.append("                    if ($elapsedSec -ge ($lastHeartbeatSec + 10)) {\n");
        sb.append("                        $lastHeartbeatSec = $elapsedSec\n");
        sb.append("                        try {\n");
        sb.append("                            $hbBody = @{ activeJobId = $job.jobId; pythonAvailable = $pyAvailable; pythonVersion = $pyVersion; javaAvailable = $javaAvailable; javaVersion = $javaVersion } | ConvertTo-Json\n");
        sb.append("                            $hbResp = Invoke-RestMethod -Uri \"$Server/api/worker/heartbeat\" -Method POST -Headers $headers -ContentType \"application/json\" -Body $hbBody -TimeoutSec 4 -ErrorAction SilentlyContinue\n");
        sb.append("                            if ($hbResp.command -eq 'CANCEL_JOB') {\n");
        sb.append("                                Write-Host \"[!] Master sent CANCEL_JOB signal! Terminating process...\" -ForegroundColor Red\n");
        sb.append("                                $wasCancelled = $true\n");
        sb.append("                                break\n");
        sb.append("                            }\n");
        sb.append("                        } catch {}\n");
        sb.append("                    }\n\n");
        sb.append("                    # Watchdog timeout check\n");
        sb.append("                    if ($elapsedSec -ge [int]$job.maxExecutionTimeSeconds) {\n");
        sb.append("                        Write-Host \"[!] Watchdog limit ($($job.maxExecutionTimeSeconds)s) exceeded! Killing process...\" -ForegroundColor Red\n");
        sb.append("                        $timedOut = $true\n");
        sb.append("                        break\n");
        sb.append("                    }\n");
        sb.append("                }\n\n");
        sb.append("                if ($wasCancelled -or $timedOut) {\n");
        sb.append("                    try { Start-Process -FilePath \"taskkill.exe\" -ArgumentList \"/PID $($proc.Id) /T /F\" -NoNewWindow -Wait 2>$null } catch {}\n");
        sb.append("                } else {\n");
        sb.append("                    $proc.WaitForExit()\n");
        sb.append("                    # Drain any remaining lines\n");
        sb.append("                    $remOut = $proc.StandardOutput.ReadToEnd()\n");
        sb.append("                    if ($remOut -and $stdoutBuilder.Length -lt $maxBytes) { [void]$stdoutBuilder.Append($remOut) }\n");
        sb.append("                    $remErr = $proc.StandardError.ReadToEnd()\n");
        sb.append("                    if ($remErr -and $stderrBuilder.Length -lt 16384) { [void]$stderrBuilder.Append($remErr) }\n");
        sb.append("                }\n");
        sb.append("                $stopwatch.Stop()\n\n");
        sb.append("                $finalStatus = if ($wasCancelled) { 'CANCELLED' } elseif ($timedOut) { 'FAILED' } elseif ($proc.ExitCode -eq 0) { 'COMPLETED' } else { 'FAILED' }\n");
        sb.append("                $errMsg = if ($timedOut) { 'Execution exceeded max allowed execution time limit.' } else { $stderrBuilder.ToString().Trim() }\n");
        sb.append("                $resultPayload = @{\n");
        sb.append("                    jobId = $job.jobId\n");
        sb.append("                    status = $finalStatus\n");
        sb.append("                    exitCode = if ($timedOut) { -1 } else { $proc.ExitCode }\n");
        sb.append("                    executionDurationMs = $stopwatch.ElapsedMilliseconds\n");
        sb.append("                    stdout = $stdoutBuilder.ToString()\n");
        sb.append("                    stderr = $errMsg\n");
        sb.append("                } | ConvertTo-Json\n\n");
        sb.append("                $null = Invoke-RestMethod -Uri \"$Server/api/worker/result\" -Method POST -Headers $headers -ContentType \"application/json\" -Body $resultPayload -TimeoutSec 6 -ErrorAction SilentlyContinue\n");
        sb.append("                Write-Host \"[$((Get-Date).ToString('HH:mm:ss'))] [UniCompute] Result Transmitted -> Status: $finalStatus in $($stopwatch.ElapsedMilliseconds)ms\" -ForegroundColor $(if ($finalStatus -eq 'COMPLETED') { 'Green' } else { 'Red' })\n");
        sb.append("                try { Remove-Item -Recurse -Force -Path $runDir 2>$null } catch {}\n");
        sb.append("            }\n");
        sb.append("        } catch {}\n\n");
        sb.append("        Start-Sleep -Seconds 4\n");
        sb.append("    }\n");
        sb.append("} finally {\n");
        sb.append("    Write-Host \"\"\n");
        sb.append("    Write-Host \"[*] Disconnecting from UniCompute Cluster...\" -ForegroundColor Yellow\n");
        sb.append("    if ($Token -and $Server) {\n");
        sb.append("        try {\n");
        sb.append("            $disconnectBody = @{ token = $Token } | ConvertTo-Json\n");
        sb.append("            $null = Invoke-RestMethod -Uri \"$Server/api/nodes/disconnect\" -Method POST -ContentType \"application/json\" -Body $disconnectBody -TimeoutSec 3 -ErrorAction SilentlyContinue\n");
        sb.append("            Write-Host \"[+] Disconnect signal sent to Master. Node marked Offline on Dashboard.\" -ForegroundColor Green\n");
        sb.append("        } catch {\n");
        sb.append("            try {\n");
        sb.append("                $null = Invoke-RestMethod -Uri \"$Server/api/nodes/disconnect?token=$Token\" -Method GET -TimeoutSec 3 -ErrorAction SilentlyContinue\n");
        sb.append("                Write-Host \"[+] Disconnect signal sent to Master. Node marked Offline on Dashboard.\" -ForegroundColor Green\n");
        sb.append("            } catch {}\n");
        sb.append("        }\n");
        sb.append("    }\n");
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
        sb.append("cleanup() {\n");
        sb.append("  echo \"\"\n");
        sb.append("  echo -e \"\\033[0;33m[*] Disconnecting worker node from UniCompute Master ($SERVER_URL)...\\033[0m\"\n");
        sb.append("  if [ -n \"$NODE_TOKEN\" ]; then\n");
        sb.append("    curl -s -m 3 -X POST \"$SERVER_URL/api/nodes/disconnect\" \\\n");
        sb.append("      -H \"Content-Type: application/json\" \\\n");
        sb.append("      -d \"{\\\"token\\\":\\\"$NODE_TOKEN\\\"}\" >/dev/null 2>&1 || \\\n");
        sb.append("    curl -s -m 3 -X GET \"$SERVER_URL/api/nodes/disconnect?token=$NODE_TOKEN\" >/dev/null 2>&1 || true\n");
        sb.append("    echo -e \"\\033[0;32m[+] Disconnect signal delivered. Node marked Offline on Master Dashboard.\\033[0m\"\n");
        sb.append("  fi\n");
        sb.append("}\n");
        sb.append("trap cleanup SIGINT SIGTERM EXIT\n\n");
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
        sb.append("  if echo \"$RESPONSE\" | grep -q '\"status\":\"Terminated\"'; then\n");
        sb.append("    echo -e \"\\033[0;31m\\n[!] Node was permanently removed from cluster by Master Administrator.\\033[0m\"\n");
        sb.append("    echo -e \"\\033[0;33m[!] Terminating worker agent...\\033[0m\"\n");
        sb.append("    exit 0\n");
        sb.append("  fi\n");
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
