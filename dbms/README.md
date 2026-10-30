# UniCompute
> **Intelligent Academic HPC Cluster, Scheduling & Distributed Resource Management System**

UniCompute is a lightweight, zero-dependency Distributed High-Performance Computing (HPC) and fair-share job scheduling platform developed for university computer science labs and research institutions. It turns ordinary student and lab laptops (Windows, macOS, Linux) into a unified, heterogeneous compute cluster that can collaboratively execute compute-intensive workloads.

---

## Table of Contents
1. [Key Features & Capabilities](#key-features--capabilities)
2. [Architecture & System Design](#architecture--system-design)
3. [Component Breakdown](#component-breakdown)
   - [Master Orchestrator (Backend)](#1-master-orchestrator-backend)
   - [Interactive Control Dashboard (Frontend)](#2-interactive-control-dashboard-frontend)
   - [Zero-Install Distributed Worker Agent](#3-zero-install-distributed-worker-agent)
4. [What Has Been Implemented (Complete Log)](#what-has-been-implemented-complete-log)
5. [End-to-End Workflow](#end-to-end-workflow)
6. [Pre-Packaged Benchmark Jobs (Demo Programs)](#pre-packaged-benchmark-jobs-demo-programs)
7. [Getting Started & Installation](#getting-started--installation)
8. [Network & Multi-Laptop Setup Guide](#network--multi-laptop-setup-guide)
9. [REST API Reference](#rest-api-reference)

---

## Key Features & Capabilities

- **Heterogeneous Cluster Orchestration**: Seamlessly aggregates compute power from diverse operating systems (Windows 11/10, macOS Sonoma/Sequoia, Linux Ubuntu/Debian).
- **Zero-Install Worker Onboarding**: One-click ZIP download (`unicompute-worker.zip`) pre-configured with the exact master IP, node name, and node token. No external dependencies, Python installations, or Docker setups required on worker nodes.
- **Hardware Telemetry Auto-Discovery**: Worker agents automatically inspect hardware specs via CIM/WMI (Windows) and `sysctl`/`nproc` (POSIX): exact physical/logical CPU core count, total RAM (GB), and OS release caption.
- **Bi-Directional Real-Time Heartbeat & Disconnect Signals**:
  - Heartbeat telemetry reported every 10 seconds.
  - **Graceful Instant Disconnect**: Catching `Ctrl+C` or `Terminate batch job (Y/N)?` on Windows executes a `try/finally` block that sends `POST /api/nodes/disconnect`, marking the node `Offline` instantly on the dashboard without waiting for timeout.
  - **Remote Node Termination**: When an admin deletes a worker node from the dashboard, the next heartbeat triggers an auto-kill signal (`"status":"Terminated"`), terminating the worker terminal cleanly.
  - **Ungraceful Fallback**: Missing heartbeats automatically mark the node `Offline` after 20 seconds.
- **Fair-Share University Quota Management**: Tracks core-hours per student (`cores * durationHours`). Prevents cluster resource monopolization by calculating quota deductions prior to job scheduling.
- **Multi-Algorithm Job Scheduler**:
  - **Fair-Share Scheduling**: Balances cluster access across students based on past usage history.
  - **Shortest Job First (SJF)**: Prioritizes low-runtime jobs to minimize average wait time.
  - **Priority Queue**: High-priority research workflows preempt low-priority jobs.
  - **First-Come, First-Served (FCFS)**: Traditional queue ordering.
- **Dual Persona Interactive Dashboard**:
  - **Admin View**: Cluster topology monitor, real-time node hardware inspector, node addition/deletion modal, student quota editor, cluster utilization stats, and active queue monitoring.
  - **Student View**: Benchmark job submission studio, code editor with syntax templates, personal job execution history, quota consumption calculator, cancellation triggers, and job log downloads.
- **Real-Time Synchronized State**:
  - Auto-polling telemetry (4-second interval) with cache-busting headers (`_t=timestamp`, `Cache-Control: no-cache, no-store`).
  - Interactive **Sync Nodes** button with spinning refresh animation and instant status toast.

---

## Architecture & System Design

```
                     ┌─────────────────────────────────────────────────────────┐
                     │              UniCompute Master Host (Laptop)            │
                     │                                                         │
                     │  ┌─────────────────────────┐   ┌─────────────────────┐  │
                     │  │   React 19 + Vite UI    │   │  Spring Boot Engine │  │
                     │  │   (Port 5173 - Admin &  │◄─►│   (Port 8080 - REST │  │
                     │  │         Student View)   │   │  API & Telemetry)   │  │
                     │  └─────────────────────────┘   └──────────┬──────────┘  │
                     └───────────────────────────────────────────┼─────────────┘
                                                                 │
                                             LAN / Wi-Fi Hotspot │ HTTP REST (JSON)
                                 ┌───────────────────────────────┴───────────────────────────────┐
                                 │                                                               │
                                 ▼                                                               ▼
             ┌───────────────────────────────────────┐                       ┌───────────────────────────────────────┐
             │       Worker Node A (Windows 11)      │                       │       Worker Node B (macOS/Linux)     │
             │                                       │                       │                                       │
             │   - start.bat -> worker.ps1           │                       │   - start.sh                          │
             │   - Auto-detects Cores, RAM, Windows  │                       │   - Auto-detects Cores, RAM, OS sysctl│
             │   - 10s Heartbeat Telemetry           │                       │   - 10s Heartbeat Telemetry           │
             │   - try/finally Ctrl+C Disconnect     │                       │   - trap cleanup SIGINT/EXIT          │
             └───────────────────────────────────────┘                       └───────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Master Orchestrator (Backend)
- **Framework**: Spring Boot 4.x / Java 17+
- **REST Endpoints**:
  - `/api/health`: Orchestrator liveness verification.
  - `/api/nodes`: Cluster topology listing with strict HTTP no-cache headers.
  - `/api/nodes/{id}`: Node lookup and admin node deletion.
  - `/api/nodes/{id}/status`: Manual status toggle (Available, On Break, Busy).
  - `/api/nodes/heartbeat`: Bi-directional telemetry transmission and remote termination signal delivery.
  - `/api/nodes/disconnect`: Immediate node de-registration endpoint (POST & GET).
  - `/api/jobs`: Job submission and job queue state engine.
  - `/api/jobs/{id}/cancel`: Dynamic job termination and node release.
  - `/downloads/unicompute-worker.zip`: In-memory ZIP package synthesizer.
  - `/downloads/worker.ps1`: Dynamic PowerShell worker script generator.
- **Port Collision Safeguard**: Integrated `kill-port 8080 5173` pre-dev lifecycle hook ensuring smooth server restarts without manual PID killing.

### 2. Interactive Control Dashboard (Frontend)
- **Framework**: React 19, Vite, Lucide Icons, Vanilla CSS
- **Design System**:
  - Glassmorphic translucent cards, neon cyan/emerald status pills, and dark/light mode toggle.
  - Active animations (`@keyframes spin` on Sync Nodes, pulsing status badges).
  - Toast notification engine for instant user feedback.
- **Multi-Persona Access**:
  - **Admin**: `aditya` / `Admin` persona with full cluster topology oversight and student quota controls.
  - **Student**: `student` persona with core-hour calculation, job submission templates, and personal job history.

### 3. Zero-Install Distributed Worker Agent
- **Windows (`start.bat` & `worker.ps1`)**:
  - Executes directly via native Windows PowerShell (`powershell -ExecutionPolicy Bypass`).
  - Reads `config.json` automatically, with fallback interactive prompts for Master IP and Token if needed.
  - Hardware probing:
    ```powershell
    $cores = (Get-CimInstance Win32_Processor | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum
    $memGb = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
    $os    = (Get-CimInstance Win32_OperatingSystem).Caption
    ```
  - Graceful exit trapping:
    ```powershell
    try {
        while ($true) { ... 10s Heartbeat ... }
    } finally {
        Invoke-RestMethod -Uri "$Server/api/nodes/disconnect" -Method POST -Body $disconnectBody
    }
    ```
- **macOS / Linux (`start.sh`)**:
  - Pure POSIX shell script with `curl`, `nproc`/`sysctl`, and `trap cleanup SIGINT SIGTERM EXIT`.

---

## What Has Been Implemented (Complete Log)

### A. Core Platform & Design
- [x] Initialized modern Spring Boot backend and Vite React frontend with proxy routing.
- [x] Built complete Vanilla CSS design system supporting dark glassmorphism and crisp academic light theme.
- [x] Implemented responsive cluster overview showing Total Cores, Total RAM, Active Nodes, and Active Jobs.
- [x] Configured Fair-Share student quota calculation engine (e.g., 50.0 core-hours quota per student).

### B. Distributed Worker Provisioning
- [x] Created `DownloadController` dynamically synthesizing in-memory zip archives (`unicompute-worker.zip`).
- [x] Added `start.bat` launcher that prevents Command Prompt from closing abruptly on Windows by adding pause checkpoints and error traps.
- [x] Fixed Windows Command Prompt execution policy hurdles with `-NoProfile -ExecutionPolicy Bypass`.
- [x] Packaged `config.json` embedding token and server URL for zero-input execution.
- [x] Included plain-text `README.txt` inside the zip with exact run commands.

### C. Live Telemetry & Bi-Directional Synchronization
- [x] Built `/api/nodes/heartbeat` processing telemetry (OS, Cores, Memory GB, IP, Node Name).
- [x] Implemented automatic IP resolution binding the server to active LAN/Wi-Fi adapter IP instead of hardcoded `localhost`.
- [x] Added network fallback logic in `worker.ps1`: if the master laptop switches Wi-Fi networks, the worker prompts for the new IP and saves it back to `config.json`.
- [x] Implemented remote node deletion: deleting a node from the admin dashboard transmits `"status":"Terminated"` in the next heartbeat ACK, causing the worker agent to terminate itself cleanly.
- [x] Lowered the ungraceful offline threshold to 20 seconds.

### D. Instant Disconnect Signal & "Sync Nodes" Button Fix
- [x] Added `POST /api/nodes/disconnect` and `GET /api/nodes/disconnect` in `NodeController`.
- [x] Added `disconnect(token)` in `NodeService` that immediately nullifies `lastHeartbeat`, sets `online = false`, and marks the node `Offline`.
- [x] Wrapped the PowerShell worker loop in `try { ... } finally { ... }` so pressing `Ctrl+C` (or answering `Y/N` in CMD) immediately fires the disconnect signal.
- [x] Added `trap cleanup SIGINT SIGTERM EXIT` in `start.sh` for Linux/macOS worker disconnection.
- [x] Resolved the browser caching issue where node states stayed "Available" until page reload by adding `?_t=${Date.now()}` and `{ cache: 'no-store' }`.
- [x] Added `.spin` CSS animation and interactive `handleSyncNodes` function on the **Sync Nodes** button.

### E. Realistic Benchmark Programs for Live Presentation
- [x] Embedded 4 production-grade benchmark simulation templates in the Student submission studio:
  1. **N-Body Gravitational Physics Simulation** (`nbody_simulation.py`)
  2. **High-Performance Matrix Multiplication** (`matrix_multiply.cpp`)
  3. **Monte Carlo Pi Estimation & Uncertainty Analysis** (`monte_carlo_pi.py`)
  4. **Deep Neural Network Layer Benchmark** (`dnn_benchmark.py`)

---

## End-to-End Workflow

```
1. Admin opens Dashboard -> Clicks "Add Worker Node" -> Enters Name (e.g. "gungun")
                                  │
                                  ▼
2. Dashboard creates Node Token (e.g. uc_tok_lahsam9) -> Downloads "unicompute-worker-gungun.zip"
                                  │
                                  ▼
3. Worker extracts ZIP on Windows laptop -> Double clicks "start.bat"
                                  │
                                  ▼
4. PowerShell script detects hardware (8 Cores, 8 GB RAM, Windows 11) -> Sends Heartbeat
                                  │
                                  ▼
5. Admin Dashboard instantly reflects: "gungun | 8 Cores | 8 GB RAM | Available (Green)"
                                  │
                                  ▼
6. Student submits "N-Body Gravitational Physics Simulation" (4 Cores, 2 Hours)
                                  │
                                  ▼
7. Scheduler assigns job -> Node turns "Busy (Cyan)" -> Cores allocated
                                  │
                                  ▼
8. Worker presses Ctrl+C in terminal -> Sends POST /api/nodes/disconnect
                                  │
                                  ▼
9. Dashboard immediately flips Node to "Offline (Gray)" without reloading the page!
```

---

## Pre-Packaged Benchmark Jobs (Demo Programs)

When demonstrating UniCompute, select any of the pre-built templates in the **Submit Compute Job** tab:

| Template Name | Language | Description | Ideal Cores / RAM |
| :--- | :--- | :--- | :--- |
| **N-Body Physics** | Python 3 | Gravitational interaction simulation computing pairwise forces between celestial bodies. | 4 Cores / 8 GB |
| **Matrix Multiply** | C++ (OpenMP) | Cache-optimized O(N³) blocked matrix multiplication measuring FLOPS. | 8 Cores / 16 GB |
| **Monte Carlo Pi** | Python 3 | High-iteration stochastic sampling calculating numerical convergence of Pi. | 2 Cores / 4 GB |
| **Deep Neural Net** | Python 3 | Forward & backward propagation benchmark across dense layers with synthetic tensors. | 4 Cores / 8 GB |

---

## Getting Started & Installation

### Prerequisites
- **Master Laptop**: Java 17+, Maven 3.8+, Node.js 18+
- **Worker Laptops**: Standard Windows 10/11 (with PowerShell) or macOS/Linux. No software installation needed.

### Running the Master Orchestrator

1. **Clone the repository**:
   ```bash
   git clone https://github.com/adityarawat-cse/UniCompute.git
   cd UniCompute
   ```

2. **Install frontend dependencies**:
   ```bash
   npm install
   ```

3. **Launch UniCompute (Both Backend & Frontend)**:
   ```bash
   npm run dev
   ```
   - **Frontend UI**: `http://localhost:5173`
   - **Backend REST API**: `http://localhost:8080`

4. **Login Credentials**:
   - **Admin Portal**: Username `aditya`, Password `admin123`
   - **Student Portal**: Username `student`, Password `student123`

---

## Network & Multi-Laptop Setup Guide

To connect worker laptops to the master laptop during a presentation or demo:

1. **Connect both laptops to the same Wi-Fi or Mobile Hotspot**.
2. **Find Master Laptop IP**:
   - macOS: `ipconfig getifaddr en0` (e.g. `10.35.205.108` or `192.168.1.15`)
   - Windows Master: `ipconfig` -> IPv4 Address
3. **Generate Worker Package**:
   - In Admin Dashboard, click **Add Worker Node**, provide a name, and download the ZIP.
   - The generated `config.json` automatically includes the master laptop's Wi-Fi IP.
4. **Transfer & Run on Worker**:
   - Send the ZIP via USB, WhatsApp Web, Google Drive, or AirDrop.
   - Extract the ZIP and double-click `start.bat`.
   - The worker window will show:
     ```
     [+] Master Server:    http://10.35.205.108:8080
     [+] Node Name:        gungun
     [+] Detected Specs:   8 Cores, 8 GB RAM (Microsoft Windows 11 Home)
     [+] Heartbeat ACK -> Node is Available (Live on Master Dashboard)
     ```
5. **Disconnect**:
   - Press `Ctrl+C` in the worker terminal.
   - The script transmits the disconnect signal and the master dashboard immediately marks the node **Offline**.

---

## REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Orchestrator health check. |
| `GET` | `/api/nodes` | List all registered cluster nodes with real-time status. |
| `POST` | `/api/nodes` | Register a new cluster node manually. |
| `DELETE` | `/api/nodes/{id}` | Permanently remove a worker node and send termination signal. |
| `PUT` | `/api/nodes/{id}/status` | Toggle node status (`Available`, `On Break`, `Busy`). |
| `POST` | `/api/nodes/heartbeat` | Ingest worker node telemetry and return live status. |
| `POST` | `/api/nodes/disconnect` | Gracefully mark a worker node offline using its token. |
| `GET` | `/api/jobs` | Retrieve all scheduled and running jobs. |
| `POST` | `/api/jobs` | Submit a new compute job (validates core-hour quota). |
| `POST` | `/api/jobs/{id}/cancel` | Cancel an active or queued job. |
| `GET` | `/downloads/unicompute-worker.zip` | Generate pre-configured worker launcher package. |
| `GET` | `/downloads/worker.ps1` | Fetch live PowerShell worker script. |

---

## Academic Citation & Project Context

Developed as an Academic Capstone Project for **Intelligent University Computing & Distributed Cluster Scheduling**. Designed to democratize high-performance computing resources within academic institutions by enabling zero-barrier peer-to-peer compute sharing.
