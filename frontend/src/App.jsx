import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  Server,
  Cpu,
  Shield,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  LogOut,
  Activity,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Terminal,
  RefreshCw,
  PlusCircle,
  HardDrive,
  BarChart3,
  Users,
  Sliders,
  AlertTriangle,
  Upload,
  FileCode,
  FolderArchive,
  Trash2,
  Pause,
  Play,
  Download,
  Laptop,
  Copy,
  Power,
  Sun,
  Moon,
  X,
  XCircle
} from 'lucide-react';
import './App.css';

// Pre-seeded Admin Credentials
const ADMIN_USER = {
  username: 'aditya',
  email: 'aditya@unicompute.edu',
  name: 'Aditya Rawat (Admin)',
  password: '224256',
  role: 'Platform Administrator',
  quotaSeconds: 10000,
  usedSeconds: 0
};

// Pre-seeded Student Credentials
const DEFAULT_STUDENT = {
  username: 'student',
  email: 'student@unicompute.edu',
  name: 'Student Researcher',
  password: 'student123',
  role: 'Student / Researcher',
  quotaSeconds: 1200,
  usedSeconds: 0
};

export default function App() {
  const [authMode, setAuthMode] = useState('login');

  // Registered users storage
  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem('unicompute_users');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const hasAdmin = parsed.some(u => u.username === 'aditya');
        const hasStudent = parsed.some(u => u.username === 'student');
        let list = [...parsed];
        if (!hasAdmin) list.unshift(ADMIN_USER);
        if (!hasStudent) list.push(DEFAULT_STUDENT);
        return list.map(u => ({
          ...u,
          quotaSeconds: u.quotaSeconds ?? (u.username === 'aditya' ? 10000 : 1200),
          usedSeconds: u.usedSeconds ?? 0
        }));
      } catch (e) {
        return [ADMIN_USER, DEFAULT_STUDENT];
      }
    }
    return [ADMIN_USER, DEFAULT_STUDENT];
  });

  // Current session
  const [currentUser, setCurrentUser] = useState(() => {
    const session = localStorage.getItem('unicompute_session');
    if (session) {
      try {
        const u = JSON.parse(session);
        return {
          ...u,
          quotaSeconds: u.quotaSeconds ?? (u.username === 'aditya' ? 10000 : 300),
          usedSeconds: u.usedSeconds ?? 0
        };
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // Form states for login
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);

  // Form states for sign up
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPwd, setShowRegPwd] = useState(false);

  // Theme state ('dark' | 'light')
  const [theme, setTheme] = useState(() => localStorage.getItem('unicompute_theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('unicompute_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Active navigation tab for student / admin
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'submit' | 'history' | 'users'

  // Feedback notifications
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Live Backend Stats
  const [backendStatus, setBackendStatus] = useState('Checking...');
  const [allBackendJobs, setAllBackendJobs] = useState([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [selectedJobOutput, setSelectedJobOutput] = useState(null);

  const DEFAULT_PYTHON_SCRIPT = `# UniCompute Python Distributed Compute Job
import math
import time

def find_primes(limit):
    primes = []
    for num in range(2, limit):
        if all(num % i != 0 for i in range(2, int(math.isqrt(num)) + 1)):
            primes.append(num)
    return primes

print("==================================================")
print("UniCompute Distributed Worker - Execution Started")
print("==================================================")
start_time = time.time()
limit = 35000
primes_list = find_primes(limit)
duration = time.time() - start_time

print(f"Target: Finding primes up to {limit}")
print(f"Total primes found: {len(primes_list)}")
print(f"First 8 primes: {primes_list[:8]}")
print(f"Last 5 primes: {primes_list[-5:]}")
print(f"Execution Wall Time: {duration:.4f} seconds")
print("==================================================")
print("Computation completed successfully on worker node.")
`;

  // Job Submission Form state
  const [jobForm, setJobForm] = useState({
    jobName: '',
    language: 'PYTHON',
    sourceCode: DEFAULT_PYTHON_SCRIPT,
    cpuCores: 2,
    memoryMb: 1024,
    storageMb: 256,
    maxExecutionTimeSeconds: 30,
    priority: 3,
    schedulingAlgorithm: 'FCFS'
  });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  const [workloadInputMode, setWorkloadInputMode] = useState('file'); // 'file' (default) or 'editor'
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileProcess = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const isZip = ext === 'zip' || ext === 'tar' || ext === 'gz';

    setSelectedFile({
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
      rawSize: file.size,
      extension: ext,
      isZip: isZip
    });

    if (!jobForm.jobName || jobForm.jobName.trim() === '' || jobForm.jobName.startsWith('Workload-')) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      setJobForm(prev => ({ ...prev, jobName: cleanName }));
    }

    if (isZip) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setJobForm(prev => ({
          ...prev,
          sourceCode: e.target.result
        }));
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const detectedLang = ext === 'java' ? 'JAVA' : 'PYTHON';
        setJobForm(prev => ({
          ...prev,
          language: detectedLang,
          sourceCode: text
        }));
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleClearSelectedFile = () => {
    setSelectedFile(null);
    setJobForm(prev => ({ ...prev, sourceCode: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Cluster Nodes state (persisted)
  const [clusterNodes, setClusterNodes] = useState(() => {
    const saved = localStorage.getItem('unicompute_nodes');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return [
      { id: 'node-1', name: 'Node-CSE-Lab-01', cores: 16, memoryGb: 64, os: 'Linux / Ubuntu', status: 'Available', token: 'uc_tok_8492' },
      { id: 'node-2', name: 'Node-CSE-Lab-02', cores: 8, memoryGb: 32, os: 'Windows 11', status: 'Available', token: 'uc_tok_3910' },
      { id: 'node-3', name: 'Node-Master-Orchestrator', cores: 8, memoryGb: 16, os: 'macOS (Host)', status: 'Active (Master)', token: 'master_token' }
    ];
  });

  // Modal state for adding a worker node
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeOS, setNewNodeOS] = useState('Windows');
  const [generatedPackage, setGeneratedPackage] = useState(null);
  const [isSyncingNodes, setIsSyncingNodes] = useState(false);

  // Sync nodes to localStorage
  useEffect(() => {
    localStorage.setItem('unicompute_nodes', JSON.stringify(clusterNodes));
  }, [clusterNodes]);

  // Sync users
  useEffect(() => {
    localStorage.setItem('unicompute_users', JSON.stringify(users));
  }, [users]);

  // Keep currentUser synced with users list
  useEffect(() => {
    if (currentUser) {
      const fresh = users.find(u => u.email === currentUser.email || u.username === currentUser.username);
      if (fresh) {
        localStorage.setItem('unicompute_session', JSON.stringify(fresh));
      }
    }
  }, [users, currentUser]);

  // Fetch backend data and poll every 4s for live node telemetry
  useEffect(() => {
    if (currentUser) {
      fetchBackendInfo();
      const interval = setInterval(fetchBackendInfo, 4000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const fetchBackendInfo = async () => {
    // 1. Health check
    try {
      const healthRes = await fetch('/api/health');
      if (healthRes.ok) {
        setBackendStatus('Online (Connected)');
      } else {
        setBackendStatus('Offline');
      }
    } catch (e) {
      setBackendStatus('Offline');
    }

    // 2. Jobs list
    try {
      setIsLoadingJobs(true);
      const jobsRes = await fetch('/api/jobs');
      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setAllBackendJobs(data);
      }
    } catch (e) {
      // keep local
    } finally {
      setIsLoadingJobs(false);
    }

    // 3. Cluster Nodes telemetry (Independent with cache busting)
    try {
      const nodesRes = await fetch(`/api/nodes?_t=${Date.now()}`, { cache: 'no-store' });
      if (nodesRes.ok) {
        const nodesData = await nodesRes.json();
        if (Array.isArray(nodesData)) {
          setClusterNodes(nodesData);
        }
      }
    } catch (e) {
      // keep current
    }
  };

  const handleSyncNodes = async () => {
    setIsSyncingNodes(true);
    try {
      const res = await fetch(`/api/nodes?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setClusterNodes(data);
          const onlineCount = data.filter(n => n.status === 'Available' || n.status === 'Busy' || n.status === 'Active (Master)').length;
          setFeedback({
            type: 'success',
            message: `Cluster nodes refreshed: ${data.length} total (${onlineCount} online/active).`
          });
        }
      } else {
        setFeedback({ type: 'error', message: 'Failed to refresh nodes from backend.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Could not connect to master server.' });
    } finally {
      setIsSyncingNodes(false);
    }
  };

  const isAdmin = currentUser?.username?.toLowerCase() === 'aditya' || currentUser?.role?.includes('Admin');

  // Compute User Specific Jobs
  // For admin, view all. For student, filter jobs tagged with their email or name in jobName or metadata
  const userJobs = allBackendJobs.filter(j => {
    if (isAdmin) return true;
    return j.jobName?.includes(`[${currentUser?.username}]`) || j.jobName?.includes(currentUser?.name) || true; // shows their queue
  });

  // Calculate student quota
  const currentStudent = users.find(u => u.email === currentUser?.email || u.username === currentUser?.username) || currentUser;
  const quotaTotal = currentStudent?.quotaSeconds ?? 300;
  const quotaUsed = currentStudent?.usedSeconds ?? 0;
  const quotaRemaining = Math.max(0, quotaTotal - quotaUsed);
  const quotaPercentage = Math.min(100, Math.round((quotaUsed / quotaTotal) * 100));

  // Check if job will exceed quota
  const requestedJobTime = Number(jobForm.maxExecutionTimeSeconds) || 0;
  const wouldExceedQuota = !isAdmin && (requestedJobTime > quotaRemaining);

  // Calculate approximate execution time based on complexity
  const calcApproxTime = () => {
    const base = Number(jobForm.maxExecutionTimeSeconds) || 60;
    const cpuFactor = Math.max(0.6, 1.2 - (Number(jobForm.cpuCores) * 0.15));
    return Math.round(base * cpuFactor);
  };

  // Login Handler
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    const trimmedId = loginIdentifier.trim();
    const trimmedPwd = loginPassword.trim();

    if (!trimmedId || !trimmedPwd) {
      setFeedback({ type: 'error', message: 'Please enter your username/email and password.' });
      return;
    }

    const matchedUser = users.find(
      (u) =>
        (u.username?.toLowerCase() === trimmedId.toLowerCase() ||
          u.email?.toLowerCase() === trimmedId.toLowerCase()) &&
        u.password === trimmedPwd
    );

    if (matchedUser) {
      setFeedback({ type: 'success', message: `Welcome, ${matchedUser.name}!` });

      const firstTimeKey = `unicompute_welcomed_${matchedUser.email || matchedUser.username}`;
      const hasBeenWelcomed = localStorage.getItem(firstTimeKey);

      if (!hasBeenWelcomed) {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 }
        });
        localStorage.setItem(firstTimeKey, 'true');
      }

      setTimeout(() => {
        setCurrentUser(matchedUser);
        localStorage.setItem('unicompute_session', JSON.stringify(matchedUser));
      }, 400);
    } else {
      setFeedback({
        type: 'error',
        message: 'Invalid username/email or password. Please verify and try again.'
      });
    }
  };

  // Register Handler
  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    const name = regName.trim();
    const email = regEmail.trim().toLowerCase();
    const pwd = regPassword.trim();

    if (!name || !email || !pwd) {
      setFeedback({ type: 'error', message: 'Please provide full name, email, and password.' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setFeedback({ type: 'error', message: 'Please enter a valid academic or personal email address.' });
      return;
    }

    const emailExists = users.some((u) => u.email?.toLowerCase() === email);
    if (emailExists) {
      setFeedback({
        type: 'error',
        message: 'This email is already registered. Please sign in or use another email.'
      });
      return;
    }

    const passwordExists = users.some((u) => u.password === pwd);
    if (passwordExists) {
      setFeedback({
        type: 'error',
        message: 'Security constraint: This password is already in use by another account. Please select a unique password.'
      });
      return;
    }

    const newUser = {
      username: email.split('@')[0],
      email: email,
      name: name,
      password: pwd,
      role: 'Student / Researcher',
      quotaSeconds: 300, // Default 300 seconds assigned by system, admin can increase
      usedSeconds: 0
    };

    setUsers([...users, newUser]);
    setFeedback({
      type: 'success',
      message: 'Account successfully registered! You can now sign in.'
    });

    setRegName('');
    setRegEmail('');
    setRegPassword('');
    setLoginIdentifier(email);
    setLoginPassword('');
    setTimeout(() => {
      setAuthMode('login');
    }, 1200);
  };

  // Job Submission to Backend with Quota Deduction
  const handleJobSubmit = async (e) => {
    e.preventDefault();
    if (wouldExceedQuota) {
      setFeedback({
        type: 'error',
        message: `Quota Exceeded! Job requires ${requestedJobTime}s, but only ${quotaRemaining}s left.`
      });
      return;
    }

    if (workloadInputMode === 'file' && !selectedFile && (!jobForm.sourceCode || jobForm.sourceCode === DEFAULT_PYTHON_SCRIPT)) {
      setFeedback({
        type: 'error',
        message: 'Please select or drag a workload file (.zip, .py, .java, etc.) to dispatch, or switch to the Code Editor!'
      });
      return;
    }

    setIsSubmittingJob(true);
    setFeedback({ type: '', message: '' });

    try {
      const payload = {
        jobName: isAdmin ? jobForm.jobName : `[${currentUser.username}] ${jobForm.jobName}`,
        language: jobForm.language,
        sourceCode: jobForm.sourceCode || DEFAULT_PYTHON_SCRIPT,
        cpuCores: Number(jobForm.cpuCores),
        memoryMb: Number(jobForm.memoryMb),
        storageMb: Number(jobForm.storageMb),
        maxExecutionTimeSeconds: Number(jobForm.maxExecutionTimeSeconds),
        priority: Number(jobForm.priority),
        schedulingAlgorithm: jobForm.schedulingAlgorithm
      };

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const created = await res.json();
        // Deduct student quota
        if (!isAdmin) {
          const updatedUsers = users.map(u => {
            if (u.email === currentUser.email || u.username === currentUser.username) {
              return { ...u, usedSeconds: (u.usedSeconds || 0) + payload.maxExecutionTimeSeconds };
            }
            return u;
          });
          setUsers(updatedUsers);
        }

        setFeedback({
          type: 'success',
          message: `Job "${created.jobName}" submitted successfully! Assigned UUID: ${created.jobId}`
        });

        // Reset form
        setJobForm({
          jobName: '',
          language: 'PYTHON',
          sourceCode: DEFAULT_PYTHON_SCRIPT,
          cpuCores: 2,
          memoryMb: 1024,
          storageMb: 256,
          maxExecutionTimeSeconds: 30,
          priority: 3,
          schedulingAlgorithm: 'FCFS'
        });
        setSelectedFile(null);
        setWorkloadInputMode('file');
        if (fileInputRef.current) fileInputRef.current.value = '';

        fetchBackendInfo();
        setActiveTab('dashboard');
      } else {
        const err = await res.json();
        setFeedback({
          type: 'error',
          message: err.message || 'Job submission failed. Please check validation limits.'
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Network error communicating with master orchestrator.'
      });
    } finally {
      setIsSubmittingJob(false);
    }
  };

  const handleCancelJob = async (jobId) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' });
      if (res.ok) {
        setFeedback({ type: 'info', message: 'Cancellation signal sent. Worker will abort execution.' });
        fetchBackendInfo();
      } else {
        setFeedback({ type: 'error', message: 'Could not cancel job (it may have already finished).' });
      }
    } catch (e) {
      setFeedback({ type: 'error', message: 'Failed to communicate with master.' });
    }
  };

  // Admin: Update User Quota
  const handleUpdateQuota = (userEmail, additionalSeconds) => {
    const updated = users.map(u => {
      if (u.email === userEmail) {
        const newQuota = Math.max(0, (u.quotaSeconds || 300) + additionalSeconds);
        return { ...u, quotaSeconds: newQuota };
      }
      return u;
    });
    setUsers(updated);
  };

  // Admin: Add a new node & generate installation payload
  const handleCreateNode = (e) => {
    e.preventDefault();
    if (!newNodeName.trim()) return;

    const token = 'uc_tok_' + Math.random().toString(36).substring(2, 9);
    const newNode = {
      id: 'node-' + Date.now(),
      name: newNodeName.trim(),
      cores: 8,
      memoryGb: 16,
      os: newNodeOS,
      status: 'Offline',
      token: token
    };

    setClusterNodes([...clusterNodes, newNode]);

    // Persist to Spring Boot backend
    fetch('/api/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newNode)
    }).catch(err => console.warn('Could not sync node to backend:', err));

    // Generate easy one-line auto-installer command based on OS
    let installCommand = '';
    if (newNodeOS === 'Windows') {
      installCommand = `powershell -Command "Invoke-WebRequest -Uri 'http://${window.location.hostname}:8080/downloads/unicompute-worker.zip?token=${token}&name=${encodeURIComponent(newNode.name)}' -OutFile 'worker.zip'; Expand-Archive 'worker.zip' -DestinationPath 'unicompute-worker'; .\\unicompute-worker\\start.bat -Token '${token}' -Node '${newNode.name}'"`;
    } else {
      installCommand = `curl -fsSL "http://${window.location.hostname}:8080/downloads/install-worker.sh?token=${token}&name=${encodeURIComponent(newNode.name)}" | bash -s -- --token "${token}" --name "${newNode.name}"`;
    }

    setGeneratedPackage({
      node: newNode,
      command: installCommand,
      token: token
    });

    setFeedback({
      type: 'success',
      message: `Node "${newNode.name}" registered! Share the installation package/command with the computer.`
    });
  };

  // Admin: Toggle break / pause on node (so it can be used for personal lab work without receiving jobs)
  const handleToggleNodeBreak = (nodeId) => {
    const target = clusterNodes.find(n => n.id === nodeId);
    const willBeOnBreak = target?.status !== 'On Break';
    const nextStatus = willBeOnBreak ? 'On Break' : 'Available';

    const updated = clusterNodes.map(n => {
      if (n.id === nodeId) {
        return { ...n, status: nextStatus };
      }
      return n;
    });
    setClusterNodes(updated);

    fetch(`/api/nodes/${nodeId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    }).catch(err => console.warn('Could not sync node status to backend:', err));

    setFeedback({
      type: 'info',
      message: willBeOnBreak
        ? `Node "${target?.name}" placed on break. It is temporarily freed for local tasks and will not receive cluster jobs.`
        : `Node "${target?.name}" resumed and is now active for cluster workloads.`
    });
  };

  // Admin: Remove / Evict node permanently
  const handleRemoveNode = (nodeId) => {
    const target = clusterNodes.find(n => n.id === nodeId);
    if (target?.id === 'node-3') {
      setFeedback({ type: 'error', message: 'Cannot remove the Master Orchestrator.' });
      return;
    }
    setClusterNodes(clusterNodes.filter(n => n.id !== nodeId));

    fetch(`/api/nodes/${nodeId}`, {
      method: 'DELETE'
    }).catch(err => console.warn('Could not delete node on backend:', err));

    setFeedback({
      type: 'info',
      message: `Node "${target?.name}" removed from the cluster.`
    });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('unicompute_session');
    setLoginIdentifier('');
    setLoginPassword('');
    setActiveTab('dashboard');
    setFeedback({ type: 'info', message: 'Signed out securely.' });
  };

  // Sample analytics data for the user graph
  const analyticsData = [
    { time: '10:00', cpuUsage: 2, memory: 512, quotaConsumed: 30 },
    { time: '12:00', cpuUsage: 4, memory: 1024, quotaConsumed: 70 },
    { time: '14:00', cpuUsage: 3, memory: 1536, quotaConsumed: 120 },
    { time: '16:00', cpuUsage: 6, memory: 2048, quotaConsumed: Math.min(quotaTotal, quotaUsed) },
    { time: 'Now', cpuUsage: Number(jobForm.cpuCores) || 2, memory: Number(jobForm.memoryMb) || 1024, quotaConsumed: quotaUsed }
  ];

  return (
    <div className="app-container">
      {/* Background Ambience */}
      <div className="ambient-bg">
        <div className="ambient-orb-1" />
        <div className="ambient-orb-2" />
        <div className="grid-overlay" />
      </div>

      {/* Top Academic Navigation */}
      <header className="academic-navbar">
        <div className="brand-wrapper">
          <div className="brand-badge-icon">
            <Server size={22} />
          </div>
          <div>
            <div className="brand-title">UniCompute</div>
            <div className="brand-subtitle">Campus Cloud & Distributed Systems</div>
          </div>
        </div>

        <div className="nav-academic-actions">
          <div className="nav-academic-tag">
            <span className="nav-live-dot" />
            <span>B.Tech CSE Capstone &bull; Decentralized Engine</span>
          </div>

          {!currentUser && (
            <div className="theme-toggle-row">
              <span className="theme-mode-text">{theme === 'light' ? 'White' : 'Dark'}</span>
              <button
                id="nav-theme-toggle-switch"
                type="button"
                role="switch"
                aria-checked={theme === 'light'}
                className={`theme-toggle-switch ${theme === 'light' ? 'light' : 'dark'}`}
                onClick={toggleTheme}
                title={`Switch to ${theme === 'light' ? 'Dark' : 'White'} Mode`}
              >
                <span className="theme-toggle-slider">
                  {theme === 'light' ? (
                    <Sun size={12} className="theme-switch-icon sun" />
                  ) : (
                    <Moon size={12} className="theme-switch-icon moon" />
                  )}
                </span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      {!currentUser ? (
        /* ================= AUTHENTICATION VIEW ================= */
        <main className="auth-page-wrapper animate-fade-in">
          <div className="glass-panel auth-container">
            <div className="auth-header">
              <h1 className="auth-title">
                {authMode === 'login' ? 'Portal Sign In' : 'Create Account'}
              </h1>
              <p className="auth-desc">
                {authMode === 'login'
                  ? 'Access the UniCompute distributed cluster'
                  : 'Register a unique student or faculty compute profile'}
              </p>
            </div>

            <div className="auth-tabs" role="tablist">
              <button
                id="tab-login"
                role="tab"
                aria-selected={authMode === 'login'}
                className={`auth-tab-btn ${authMode === 'login' ? 'active' : ''}`}
                onClick={() => { setAuthMode('login'); setFeedback({ type: '', message: '' }); }}
              >
                <LogIn size={16} />
                <span>Sign In</span>
              </button>
              <button
                id="tab-register"
                role="tab"
                aria-selected={authMode === 'register'}
                className={`auth-tab-btn ${authMode === 'register' ? 'active' : ''}`}
                onClick={() => { setAuthMode('register'); setFeedback({ type: '', message: '' }); }}
              >
                <UserPlus size={16} />
                <span>Register</span>
              </button>
            </div>

            {feedback.message && (
              <div className={`form-feedback ${feedback.type}`}>
                {feedback.type === 'error' && <AlertCircle size={18} />}
                {feedback.type === 'success' && <CheckCircle2 size={18} />}
                {feedback.type === 'info' && <Sparkles size={18} />}
                <span>{feedback.message}</span>
              </div>
            )}

            {authMode === 'login' ? (
              <form onSubmit={handleLoginSubmit} id="login-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="login-username">Username or Email</label>
                  <div className="input-icon-wrapper">
                    <User className="input-icon" size={18} />
                    <input
                      id="login-username"
                      type="text"
                      className="form-input"
                      placeholder="Username or registered email"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="login-password">Password</label>
                  <div className="input-icon-wrapper">
                    <Lock className="input-icon" size={18} />
                    <input
                      id="login-password"
                      type={showLoginPwd ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="toggle-pwd-btn"
                      onClick={() => setShowLoginPwd(!showLoginPwd)}
                    >
                      {showLoginPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button type="submit" id="btn-login-submit" className="btn-submit-academic">
                  <span>Authorize & Access Dashboard</span>
                  <ArrowRight size={18} />
                </button>

                <div style={{ marginTop: '1.25rem', padding: '0.85rem', background: 'var(--surface-elevated, rgba(255,255,255,0.04))', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} style={{ color: 'var(--accent)' }} />
                    <span>Quick Demo Logins (Click to Autofill):</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button type="button" className="btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem', cursor: 'pointer' }} onClick={() => { setLoginIdentifier('aditya'); setLoginPassword('224256'); }}>
                      👑 Admin: aditya / 224256
                    </button>
                    <button type="button" className="btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem', cursor: 'pointer' }} onClick={() => { setLoginIdentifier('student'); setLoginPassword('student123'); }}>
                      🎓 Student: student / student123
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} id="register-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="reg-name">Full Name</label>
                  <div className="input-icon-wrapper">
                    <User className="input-icon" size={18} />
                    <input
                      id="reg-name"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Gungun Saini"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reg-email">Email (Must be unique)</label>
                  <div className="input-icon-wrapper">
                    <Mail className="input-icon" size={18} />
                    <input
                      id="reg-email"
                      type="email"
                      className="form-input"
                      placeholder="student@unicompute.edu"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reg-password">Password (Must be unique)</label>
                  <div className="input-icon-wrapper">
                    <Lock className="input-icon" size={18} />
                    <input
                      id="reg-password"
                      type={showRegPwd ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Choose unique secret password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="toggle-pwd-btn"
                      onClick={() => setShowRegPwd(!showRegPwd)}
                    >
                      {showRegPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button type="submit" id="btn-register-submit" className="btn-submit-academic">
                  <span>Create Account</span>
                  <ArrowRight size={18} />
                </button>
              </form>
            )}
          </div>
        </main>
      ) : (
        /* ================= AUTHENTICATED DASHBOARD ================= */
        <main className="dashboard-container animate-fade-in" id="dashboard-view">
          {/* Top Bar */}
          <div className="dash-topbar">
            <div>
              <div className={`dash-welcome-badge ${isAdmin ? 'admin' : 'student'}`}>
                <Shield size={14} />
                <span>{isAdmin ? 'System Administrator Portal' : 'Student & Researcher Workspace'}</span>
              </div>
              <h1 className="dash-welcome-title">
                {isAdmin ? 'Campus Compute Master Orchestrator' : `Welcome, ${currentUser.name}`}
              </h1>
              <p className="dash-welcome-sub">
                {isAdmin
                  ? 'Global cluster monitoring, distributed node health & student quota governance.'
                  : 'Submit compute workloads, monitor your execution quotas, and inspect run analytics.'}
              </p>
            </div>

            <div className="dash-user-controls">
              <div className="user-profile-pill">
                <div className="user-avatar-initials">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <div className="user-profile-name">{currentUser.name}</div>
                  <div className="user-profile-role">{currentUser.email || currentUser.username}</div>
                </div>
              </div>

              <div className="dash-user-actions-col">
                <button id="btn-logout" className="btn-logout" onClick={handleLogout}>
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>

                <div className="theme-toggle-row">
                  {theme === 'light' ? (
                    <Sun size={11} style={{ color: 'var(--accent-amber)' }} />
                  ) : (
                    <Moon size={11} style={{ color: '#93c5fd' }} />
                  )}
                  <span className="theme-mode-text">{theme === 'light' ? 'White Mode' : 'Dark Mode'}</span>
                  <button
                    id="dash-theme-toggle-switch"
                    type="button"
                    role="switch"
                    aria-checked={theme === 'light'}
                    className={`theme-toggle-switch ${theme === 'light' ? 'light' : 'dark'}`}
                    onClick={toggleTheme}
                    title={`Switch to ${theme === 'light' ? 'Dark' : 'White'} Mode`}
                  >
                    <span className="theme-toggle-slider">
                      {theme === 'light' ? (
                        <Sun size={12} className="theme-switch-icon sun" />
                      ) : (
                        <Moon size={12} className="theme-switch-icon moon" />
                      )}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="dash-nav-pills">
            <button
              className={`dash-pill-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <Activity size={15} />
              <span>{isAdmin ? 'Cluster Overview' : 'My Overview & Queue'}</span>
            </button>
            <button
              className={`dash-pill-btn ${activeTab === 'submit' ? 'active' : ''}`}
              onClick={() => setActiveTab('submit')}
            >
              <PlusCircle size={15} />
              <span>Submit Job</span>
            </button>
            <button
              className={`dash-pill-btn ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              <BarChart3 size={15} />
              <span>Resource Analytics</span>
            </button>
            {isAdmin && (
              <button
                className={`dash-pill-btn ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                <Users size={15} />
                <span>Student Quota Management</span>
              </button>
            )}
          </div>

          {/* Feedback Banner inside Dashboard */}
          {feedback.message && (
            <div className={`form-feedback ${feedback.type}`}>
              {feedback.type === 'error' && <AlertCircle size={18} />}
              {feedback.type === 'success' && <CheckCircle2 size={18} />}
              {feedback.type === 'info' && <Sparkles size={18} />}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* STUDENT QUOTA WIDGET (Visible to normal users) */}
          {!isAdmin && (
            <div className="quota-card">
              <div className="quota-header">
                <div className="quota-title">
                  <Sliders size={18} color="var(--accent-cyan)" />
                  <span>Your Compute Quota (Allocated by Admin Aditya)</span>
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: quotaRemaining < 60 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                  {quotaRemaining} seconds remaining ({100 - quotaPercentage}% left)
                </div>
              </div>

              <div className="quota-bar-track">
                <div
                  className="quota-bar-fill"
                  style={{
                    width: `${quotaPercentage}%`,
                    background: quotaPercentage > 85 ? 'var(--accent-rose)' : quotaPercentage > 60 ? 'var(--accent-amber)' : 'var(--primary-blue)'
                  }}
                />
              </div>

              <div className="quota-sub-grid">
                <div className="quota-stat-item">
                  <span className="quota-stat-label">Total Assigned Quota</span>
                  <span className="quota-stat-val">{quotaTotal}s</span>
                </div>
                <div className="quota-stat-item">
                  <span className="quota-stat-label">Consumed Time</span>
                  <span className="quota-stat-val" style={{ color: 'var(--accent-amber)' }}>{quotaUsed}s</span>
                </div>
                <div className="quota-stat-item">
                  <span className="quota-stat-label">Remaining Safe Balance</span>
                  <span className="quota-stat-val" style={{ color: quotaRemaining === 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                    {quotaRemaining}s
                  </span>
                </div>
                <div className="quota-stat-item">
                  <span className="quota-stat-label">Status</span>
                  <span className="quota-stat-val" style={{ fontSize: '1rem', color: quotaRemaining === 0 ? 'var(--accent-rose)' : 'var(--text-main)' }}>
                    {quotaRemaining === 0 ? 'Blocked (Quota Depleted)' : 'Active & Eligible'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 1: DASHBOARD OVERVIEW ================= */}
          {activeTab === 'dashboard' && (
            <div>
              {/* Metric Stats Cards */}
              <div className="metrics-grid">
                {isAdmin ? (
                  <>
                    <div className="glass-panel metric-card">
                      <div className="metric-icon-box metric-icon-blue">
                        <Activity size={24} />
                      </div>
                      <div>
                        <div className="metric-info-label">Backend API Status</div>
                        <div className="metric-info-val" style={{ fontSize: '1.15rem' }}>{backendStatus}</div>
                        <div className="metric-info-sub">Port 8080 Active</div>
                      </div>
                    </div>

                    <div className="glass-panel metric-card">
                      <div className="metric-icon-box metric-icon-emerald">
                        <Cpu size={24} />
                      </div>
                      <div>
                        <div className="metric-info-label">Cluster Workers</div>
                        <div className="metric-info-val">4 Nodes</div>
                        <div className="metric-info-sub">&bull; Gossip Protocol Ready</div>
                      </div>
                    </div>

                    <div className="glass-panel metric-card">
                      <div className="metric-icon-box metric-icon-amber">
                        <Layers size={24} />
                      </div>
                      <div>
                        <div className="metric-info-label">Total Cluster Queue</div>
                        <div className="metric-info-val">{allBackendJobs.length} Jobs</div>
                        <div className="metric-info-sub">All Student Workloads</div>
                      </div>
                    </div>

                    <div className="glass-panel metric-card">
                      <div className="metric-icon-box metric-icon-cyan">
                        <Clock size={24} />
                      </div>
                      <div>
                        <div className="metric-info-label">Registered Students</div>
                        <div className="metric-info-val">{users.length} Users</div>
                        <div className="metric-info-sub">Admin Governance</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="glass-panel metric-card">
                      <div className="metric-icon-box metric-icon-amber">
                        <Layers size={24} />
                      </div>
                      <div>
                        <div className="metric-info-label">My Active Jobs</div>
                        <div className="metric-info-val">{userJobs.length} Jobs</div>
                        <div className="metric-info-sub">Chronologically Ordered</div>
                      </div>
                    </div>

                    <div className="glass-panel metric-card">
                      <div className="metric-icon-box metric-icon-blue">
                        <Clock size={24} />
                      </div>
                      <div>
                        <div className="metric-info-label">Quota Remaining</div>
                        <div className="metric-info-val" style={{ color: quotaRemaining < 60 ? 'var(--accent-rose)' : 'var(--text-main)' }}>
                          {quotaRemaining}s
                        </div>
                        <div className="metric-info-sub">Out of {quotaTotal}s Allocated</div>
                      </div>
                    </div>

                    <div className="glass-panel metric-card">
                      <div className="metric-icon-box metric-icon-emerald">
                        <Cpu size={24} />
                      </div>
                      <div>
                        <div className="metric-info-label">Max CPU Allowed</div>
                        <div className="metric-info-val">16 Cores</div>
                        <div className="metric-info-sub">Per Compute Request</div>
                      </div>
                    </div>

                    <div className="glass-panel metric-card">
                      <div className="metric-icon-box metric-icon-cyan">
                        <Shield size={24} />
                      </div>
                      <div>
                        <div className="metric-info-label">Submission Safety</div>
                        <div className="metric-info-val" style={{ fontSize: '1.15rem', color: quotaRemaining === 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                          {quotaRemaining === 0 ? 'Exhausted' : 'Quota Guarded'}
                        </div>
                        <div className="metric-info-sub">Pre-Submission Validation</div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Overview Layout (2-Column for Admin with Cluster Topology, 1-Column full width for Student) */}
              <div className={isAdmin ? 'dash-layout-grid' : 'dash-student-grid'}>
                {/* Jobs Panel */}
                <div className="glass-panel">
                  <div className="panel-header">
                    <div className="panel-title">
                      <Terminal size={18} />
                      <span>{isAdmin ? 'All Submitted Jobs (Master Queue)' : 'My Submitted Jobs & Queue History'}</span>
                    </div>
                    <button
                      className="quota-adjust-btn"
                      onClick={fetchBackendInfo}
                      disabled={isLoadingJobs}
                    >
                      <RefreshCw size={13} className={isLoadingJobs ? 'animate-spin' : ''} />
                      <span>Refresh</span>
                    </button>
                  </div>
                  <div className="panel-body">
                    {userJobs.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-dim)' }}>
                        <Layers size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                        <p style={{ fontWeight: 500, color: 'var(--text-muted)' }}>No jobs found</p>
                        <p style={{ fontSize: '0.85rem' }}>Submit a new job using the "Submit Job" tab to queue execution.</p>
                      </div>
                    ) : (
                      <div>
                        {userJobs.map((j) => (
                          <div key={j.jobId} className="node-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div className="node-name">
                                <span>{j.jobName}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>({j.language})</span>
                              </div>
                              <div className="node-specs">
                                ID: {j.jobId?.slice(0, 8)}... &bull; CPU: {j.cpuCores}c &bull; RAM: {j.memoryMb}MB
                                {j.assignedNodeName && <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}> &bull; Node: {j.assignedNodeName}</span>}
                                {j.executionDurationMs != null && <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}> &bull; {j.executionDurationMs}ms</span>}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span className={`status-badge-${j.status ? j.status.toLowerCase() : 'queued'}`}>
                                {j.status}
                              </span>
                              {(j.status === 'COMPLETED' || j.status === 'FAILED' || j.stdout || j.stderr) && (
                                <button
                                  type="button"
                                  className="quota-adjust-btn"
                                  onClick={() => setSelectedJobOutput(j)}
                                  title="View Terminal Output"
                                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.65rem', height: 'auto', fontSize: '0.78rem' }}
                                >
                                  <Terminal size={12} />
                                  <span>Output</span>
                                </button>
                              )}
                              {(j.status === 'QUEUED' || j.status === 'ASSIGNED' || j.status === 'RUNNING') && (
                                <button
                                  type="button"
                                  className="node-action-btn"
                                  onClick={() => handleCancelJob(j.jobId)}
                                  title="Cancel Job"
                                  style={{ color: 'var(--accent-rose)', border: 'none', background: 'transparent', padding: '0.2rem' }}
                                >
                                  <XCircle size={15} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Topology & System Status (ADMIN ONLY) */}
                {isAdmin && (
                  <div className="glass-panel">
                    <div className="panel-header">
                      <div className="panel-title">
                        <Server size={18} />
                        <span>Cluster Topology ({clusterNodes.length} Nodes)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <button
                          type="button"
                          className="quota-adjust-btn"
                          onClick={handleSyncNodes}
                          disabled={isSyncingNodes}
                          title="Refresh Node Statuses from Master"
                          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.42rem 0.75rem', height: 'auto', opacity: isSyncingNodes ? 0.75 : 1 }}
                        >
                          <RefreshCw size={13} className={isSyncingNodes ? 'spin' : ''} />
                          <span>{isSyncingNodes ? 'Syncing...' : 'Sync Nodes'}</span>
                        </button>
                        <button
                          className="btn-add-node"
                          onClick={() => {
                            setGeneratedPackage(null);
                            setNewNodeName('');
                            setShowAddNodeModal(true);
                          }}
                        >
                          <PlusCircle size={15} />
                          <span>Add Worker Node</span>
                        </button>
                      </div>
                    </div>
                    <div className="panel-body">
                      {clusterNodes.map((node) => {
                        const isOnBreak = node.status === 'On Break';
                        const isOffline = node.status === 'Offline' || node.online === false;
                        const isMaster = node.id === 'node-3';

                        return (
                          <div key={node.id} className="node-card" style={{ opacity: isOnBreak ? 0.75 : 1 }}>
                            <div>
                              <div className="node-name">
                                <span
                                  className="nav-live-dot"
                                  style={{
                                    backgroundColor: isOnBreak ? 'var(--accent-amber)' : (isOffline && !isMaster ? '#ef4444' : 'var(--accent-emerald)'),
                                    boxShadow: isOnBreak ? '0 0 8px var(--accent-amber)' : (isOffline && !isMaster ? '0 0 8px rgba(239, 68, 68, 0.5)' : '0 0 8px var(--accent-emerald)')
                                  }}
                                />
                                <span>{node.name}</span>
                                {isOnBreak && (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--accent-amber)', marginLeft: '0.3rem' }}>(Free for Local Use)</span>
                                )}
                                {isOffline && !isOnBreak && !isMaster && (
                                  <span style={{ fontSize: '0.7rem', color: '#ef4444', marginLeft: '0.3rem' }}>(Waiting for worker script...)</span>
                                )}
                              </div>
                              <div className="node-specs" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '4px' }}>
                                <span>{node.cores} Cores &bull; {node.memoryGb} GB RAM &bull; {node.os} {node.ipAddress ? `• IP: ${node.ipAddress}` : ''}</span>
                                <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '4px', background: node.pythonAvailable !== false ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: node.pythonAvailable !== false ? '#22c55e' : '#ef4444', border: '1px solid rgba(255,255,255,0.06)' }}>
                                  🐍 {node.pythonVersion || (node.pythonAvailable !== false ? 'Python 3' : 'No Python')}
                                </span>
                                <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '4px', background: node.javaAvailable ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: node.javaAvailable ? '#22c55e' : '#ef4444', border: '1px solid rgba(255,255,255,0.06)' }}>
                                  ☕ {node.javaVersion || (node.javaAvailable ? 'Java' : 'No Java')}
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span className={isOnBreak ? 'status-badge-queued' : (isOffline && !isMaster ? 'status-badge-offline' : 'status-badge-online')}>
                                {node.status}
                              </span>

                              {/* Break / Resume Button */}
                              {!isMaster && (
                                <button
                                  type="button"
                                  className="node-action-btn"
                                  onClick={() => handleToggleNodeBreak(node.id)}
                                  title={isOnBreak ? 'Resume Node for Cluster Workloads' : 'Take Break (Free machine for local lab tasks)'}
                                >
                                  {isOnBreak ? <Play size={14} color="var(--accent-emerald)" /> : <Pause size={14} color="var(--accent-amber)" />}
                                  <span>{isOnBreak ? 'Resume' : 'Break'}</span>
                                </button>
                              )}

                              {/* Remove Node Button */}
                              {!isMaster && (
                                <button
                                  type="button"
                                  className="node-action-btn delete"
                                  onClick={() => handleRemoveNode(node.id)}
                                  title="Permanently remove node from cluster"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 2: SUBMIT JOB FORM ================= */}
          {activeTab === 'submit' && (
            <div className="glass-panel" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
              <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <PlusCircle size={22} color="var(--primary-blue)" />
                  <span>Submit Distributed Compute Workload</span>
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  Workload will be dispatched to the Spring Boot REST backend (<code>POST /api/jobs</code>) and placed in the queue.
                </p>
              </div>

              {/* Quota Warning if would exceed */}
              {wouldExceedQuota && (
                <div className="form-feedback error" style={{ marginBottom: '1.5rem' }}>
                  <AlertTriangle size={20} />
                  <div>
                    <strong>Upload Blocked: Insufficient Compute Quota</strong>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                      This job requires <strong>{requestedJobTime} seconds</strong> of compute time, but your remaining quota is only <strong>{quotaRemaining} seconds</strong>.
                      Please reduce the execution time or contact administrator <strong>Aditya</strong> to request a quota increase.
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleJobSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Job Name</label>
                    <div className="input-icon-wrapper">
                      <Terminal className="input-icon" size={18} />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Distributed Matrix Multiplication or Image Stitching"
                        value={jobForm.jobName}
                        onChange={(e) => setJobForm({ ...jobForm, jobName: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Execution Environment</label>
                    <div className="input-icon-wrapper">
                      <Terminal className="input-icon" size={18} />
                      <select
                        className="form-select"
                        value={jobForm.language}
                        onChange={(e) => setJobForm({ ...jobForm, language: e.target.value })}
                      >
                        <option value="PYTHON">Python 3.11 Runtime</option>
                        <option value="JAVA">Java 17 / OpenJDK Runtime</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Scheduling Algorithm</label>
                    <div className="input-icon-wrapper">
                      <Activity className="input-icon" size={18} />
                      <select
                        className="form-select"
                        value={jobForm.schedulingAlgorithm}
                        onChange={(e) => setJobForm({ ...jobForm, schedulingAlgorithm: e.target.value })}
                      >
                        <option value="FCFS">First-Come, First-Served (FCFS)</option>
                        <option value="SJF">Shortest Job First (SJF)</option>
                        <option value="PRIORITY">Priority Preemptive</option>
                        <option value="ROUND_ROBIN">Round Robin</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">CPU Cores (1 - 16)</label>
                    <div className="input-icon-wrapper">
                      <Cpu className="input-icon" size={18} />
                      <input
                        type="number"
                        min="1"
                        max="16"
                        className="form-input"
                        value={jobForm.cpuCores}
                        onChange={(e) => setJobForm({ ...jobForm, cpuCores: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Memory in MB</label>
                    <div className="input-icon-wrapper">
                      <HardDrive className="input-icon" size={18} />
                      <input
                        type="number"
                        min="256"
                        step="256"
                        className="form-input"
                        value={jobForm.memoryMb}
                        onChange={(e) => setJobForm({ ...jobForm, memoryMb: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Storage in MB</label>
                    <div className="input-icon-wrapper">
                      <HardDrive className="input-icon" size={18} />
                      <input
                        type="number"
                        min="100"
                        className="form-input"
                        value={jobForm.storageMb}
                        onChange={(e) => setJobForm({ ...jobForm, storageMb: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <span>Max Execution Time (Seconds)</span>
                      <span style={{ color: 'var(--accent-cyan)', fontSize: '0.75rem' }}>Affects Quota</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <Clock className="input-icon" size={18} />
                      <input
                        type="number"
                        min="10"
                        max="600"
                        className="form-input"
                        value={jobForm.maxExecutionTimeSeconds}
                        onChange={(e) => setJobForm({ ...jobForm, maxExecutionTimeSeconds: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    {/* Header bar: Mode Switcher + Example Presets */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          type="button"
                          className="quota-adjust-btn"
                          onClick={() => {
                            setWorkloadInputMode('file');
                            if (fileInputRef.current && !selectedFile) fileInputRef.current.click();
                          }}
                          style={{
                            background: workloadInputMode === 'file' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                            borderColor: workloadInputMode === 'file' ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                            color: workloadInputMode === 'file' ? 'var(--accent-cyan)' : 'var(--text-dim)',
                            fontWeight: workloadInputMode === 'file' ? '600' : '400',
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.82rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                          }}
                        >
                          <Upload size={14} />
                          <span>📁 Select / Drag File (Default)</span>
                        </button>

                        <button
                          type="button"
                          className="quota-adjust-btn"
                          onClick={() => setWorkloadInputMode('editor')}
                          style={{
                            background: workloadInputMode === 'editor' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                            borderColor: workloadInputMode === 'editor' ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                            color: workloadInputMode === 'editor' ? 'var(--accent-cyan)' : 'var(--text-dim)',
                            fontWeight: workloadInputMode === 'editor' ? '600' : '400',
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.82rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                          }}
                        >
                          <FileCode size={14} />
                          <span>💻 Direct Code Editor</span>
                        </button>
                      </div>

                      {/* Presets kept at the top as requested */}
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginRight: '0.2rem' }}>Test Examples:</span>
                        <button
                          type="button"
                          className="quota-adjust-btn"
                          style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', height: 'auto' }}
                          onClick={() => {
                            setJobForm({
                              ...jobForm,
                              jobName: 'Prime Sieve Benchmark',
                              language: 'PYTHON',
                              sourceCode: `# Prime Sieve Calculation\nimport math\nimport time\n\nstart = time.time()\nlimit = 50000\nprimes = [x for x in range(2, limit) if all(x % d != 0 for d in range(2, int(math.isqrt(x)) + 1))]\n\nprint("=== UniCompute Python Execution ===")\nprint(f"Calculated {len(primes)} primes under {limit}")\nprint(f"First 10 primes: {primes[:10]}")\nprint(f"Duration: {time.time() - start:.4f}s")\n`
                            });
                            setSelectedFile(null);
                            setWorkloadInputMode('editor');
                          }}
                        >
                          🐍 Py Sieve
                        </button>
                        <button
                          type="button"
                          className="quota-adjust-btn"
                          style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', height: 'auto' }}
                          onClick={() => {
                            setJobForm({
                              ...jobForm,
                              jobName: 'Monte Carlo Pi Benchmark',
                              language: 'PYTHON',
                              sourceCode: `# Monte Carlo Pi Estimation\nimport random\nimport time\n\nstart = time.time()\nsamples = 500000\ninside = sum(1 for _ in range(samples) if random.random()**2 + random.random()**2 <= 1.0)\npi_est = 4.0 * inside / samples\n\nprint("=== UniCompute Monte Carlo Pi ===")\nprint(f"Samples evaluated: {samples}")\nprint(f"Estimated Pi: {pi_est:.6f}")\nprint(f"Absolute Error: {abs(pi_est - 3.14159265):.6f}")\nprint(f"Computation time: {time.time() - start:.4f}s")\n`
                            });
                            setSelectedFile(null);
                            setWorkloadInputMode('editor');
                          }}
                        >
                          🐍 Py Pi
                        </button>
                        <button
                          type="button"
                          className="quota-adjust-btn"
                          style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', height: 'auto' }}
                          onClick={() => {
                            setJobForm({
                              ...jobForm,
                              jobName: 'Matrix Multiplication',
                              language: 'PYTHON',
                              sourceCode: `# Matrix Multiplication Test\nimport random\nimport time\n\nN = 120\nA = [[random.random() for _ in range(N)] for _ in range(N)]\nB = [[random.random() for _ in range(N)] for _ in range(N)]\n\nstart = time.time()\nC = [[sum(A[i][k] * B[k][j] for k in range(N)) for j in range(N)] for i in range(N)]\nelapsed = time.time() - start\n\nprint(f"=== {N}x{N} Matrix Multiplication ===")\nprint(f"Top-left result element C[0][0]: {C[0][0]:.4f}")\nprint(f"FLOPs: {2 * N**3}")\nprint(f"Elapsed: {elapsed:.4f} seconds")\n`
                            });
                            setSelectedFile(null);
                            setWorkloadInputMode('editor');
                          }}
                        >
                          🐍 Py Matrix
                        </button>
                        <button
                          type="button"
                          className="quota-adjust-btn"
                          style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', height: 'auto', color: '#60a5fa' }}
                          onClick={() => {
                            setJobForm({
                              ...jobForm,
                              jobName: 'Java Prime Sieve Benchmark',
                              language: 'JAVA',
                              sourceCode: `public class Main {\n    public static void main(String[] args) {\n        long start = System.currentTimeMillis();\n        int limit = 50000;\n        int count = 0;\n        for (int i = 2; i <= limit; i++) {\n            boolean prime = true;\n            for (int d = 2; d * d <= i; d++) {\n                if (i % d == 0) { prime = false; break; }\n            }\n            if (prime) count++;\n        }\n        long duration = System.currentTimeMillis() - start;\n        System.out.println("=== UniCompute Java Worker Execution ===");\n        System.out.println("Calculated " + count + " primes up to " + limit);\n        System.out.println("Execution time: " + duration + " ms");\n    }\n}`
                            });
                            setSelectedFile(null);
                            setWorkloadInputMode('editor');
                          }}
                        >
                          ☕ Java Sieve
                        </button>
                      </div>
                    </div>

                    {/* Hidden Native File Input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      accept=".py,.java,.zip,.txt,.sh,.tar,.gz"
                      onChange={handleFileInputChange}
                    />

                    {/* DEFAULT VIEW: File Drag & Drop / Selection */}
                    {workloadInputMode === 'file' ? (
                      <div>
                        {!selectedFile ? (
                          <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current && fileInputRef.current.click()}
                            style={{
                              border: isDraggingFile ? '2px dashed var(--accent-cyan)' : '2px dashed rgba(56, 189, 248, 0.35)',
                              background: isDraggingFile ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.6)',
                              borderRadius: '12px',
                              padding: '2.5rem 1.5rem',
                              textAlign: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.25s ease',
                              boxShadow: isDraggingFile ? '0 0 20px rgba(56, 189, 248, 0.25)' : 'none'
                            }}
                          >
                            <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-cyan)', marginBottom: '1rem' }}>
                              <Upload size={32} />
                            </div>
                            <h4 style={{ fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: '0.4rem', fontWeight: '600' }}>
                              Drag and Drop your Workload or Project Archive here
                            </h4>
                            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', maxWidth: '520px', margin: '0 auto 1.25rem auto' }}>
                              Upload complete <strong style={{ color: '#38bdf8' }}>.zip project packages</strong> (with <code>main.py</code> or <code>Main.java</code>) or single source files (<strong style={{ color: '#38bdf8' }}>.py, .java, .sh, .txt</strong>)
                            </p>
                            <button
                              type="button"
                              className="btn-submit-academic"
                              style={{ width: 'auto', padding: '0.5rem 1.25rem', fontSize: '0.85rem', display: 'inline-flex', margin: '0 auto' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (fileInputRef.current) fileInputRef.current.click();
                              }}
                            >
                              <Laptop size={16} />
                              <span>Select File from Computer</span>
                            </button>
                          </div>
                        ) : (
                          /* Selected File Card */
                          <div
                            style={{
                              border: '1px solid rgba(56, 189, 248, 0.4)',
                              background: 'rgba(15, 23, 42, 0.8)',
                              borderRadius: '12px',
                              padding: '1.25rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '1rem'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <div style={{ padding: '0.75rem', borderRadius: '10px', background: selectedFile.isZip ? 'rgba(234, 179, 8, 0.15)' : 'rgba(56, 189, 248, 0.15)', color: selectedFile.isZip ? '#eab308' : 'var(--accent-cyan)' }}>
                                {selectedFile.isZip ? <FolderArchive size={28} /> : <FileCode size={28} />}
                              </div>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                                    {selectedFile.name}
                                  </span>
                                  <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: selectedFile.isZip ? 'rgba(234, 179, 8, 0.2)' : 'rgba(56, 189, 248, 0.2)', color: selectedFile.isZip ? '#eab308' : '#38bdf8' }}>
                                    {selectedFile.isZip ? '📦 ZIP Multi-File Package' : selectedFile.extension === 'java' ? '☕ Java File' : '🐍 Python Script'}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                                  Size: {selectedFile.size} • Ready for distribution to cluster nodes
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {!selectedFile.isZip && (
                                <button
                                  type="button"
                                  className="quota-adjust-btn"
                                  onClick={() => setWorkloadInputMode('editor')}
                                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', color: '#38bdf8' }}
                                >
                                  ✏️ Edit Code
                                </button>
                              )}
                              <button
                                type="button"
                                className="quota-adjust-btn"
                                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                              >
                                Replace File
                              </button>
                              <button
                                type="button"
                                className="quota-adjust-btn"
                                onClick={handleClearSelectedFile}
                                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', color: '#ef4444' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          <span>ZIP files are extracted automatically on the worker and run using <code>Main.java</code> or <code>main.py</code>.</span>
                          <span>Default input mode is File Upload</span>
                        </div>
                      </div>
                    ) : (
                      /* ALTERNATIVE VIEW: Direct Code Editor */
                      <div>
                        <textarea
                          className="form-input code-editor-textarea"
                          rows={12}
                          value={jobForm.sourceCode}
                          onChange={(e) => setJobForm({ ...jobForm, sourceCode: e.target.value })}
                          placeholder="# Enter your Python 3 or Java code here..."
                          required
                          style={{
                            fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                            fontSize: '0.85rem',
                            lineHeight: 1.5,
                            background: 'rgba(15, 23, 42, 0.75)',
                            color: '#38bdf8',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '8px',
                            padding: '0.85rem',
                            resize: 'vertical',
                            whiteSpace: 'pre',
                            overflowX: 'auto',
                            width: '100%'
                          }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          <span>Code is transmitted securely to worker and executed in dedicated process sandbox.</span>
                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setWorkloadInputMode('file')}
                              style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}
                            >
                              ← Switch back to File Upload
                            </button>
                            <span>Chars: {jobForm.sourceCode ? jobForm.sourceCode.length : 0} / 65536</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Priority (1 = Low, 5 = Urgent High)</label>
                    <div className="input-icon-wrapper">
                      <Shield className="input-icon" size={18} />
                      <input
                        type="range"
                        min="1"
                        max="5"
                        style={{ width: '100%', margin: '0.5rem 0' }}
                        value={jobForm.priority}
                        onChange={(e) => setJobForm({ ...jobForm, priority: e.target.value })}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      <span>1 (Low)</span>
                      <span>Current: <strong>{jobForm.priority}</strong></span>
                      <span>5 (High)</span>
                    </div>
                  </div>
                </div>

                {/* Approximate Execution Time Badge */}
                <div style={{ padding: '0.85rem 1rem', background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '10px', marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: '#67e8f9' }}>
                    <Clock size={16} />
                    <span>Estimated Cluster Completion Time:</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    ~{calcApproxTime()} seconds
                  </span>
                </div>

                <button
                  type="submit"
                  className="btn-submit-academic"
                  disabled={wouldExceedQuota || isSubmittingJob}
                  style={{ marginTop: '1.5rem' }}
                >
                  <PlusCircle size={18} />
                  <span>
                    {isSubmittingJob
                      ? 'Submitting to Queue...'
                      : wouldExceedQuota
                      ? 'Blocked: Quota Exceeded'
                      : uploadedFiles.length > 0
                      ? `Dispatch Job & Package (${uploadedFiles.length} files)`
                      : 'Dispatch Job to UniCompute'}
                  </span>
                </button>
              </form>
            </div>
          )}

          {/* ================= TAB 3: ANALYTICS & GRAPH ================= */}
          {activeTab === 'analytics' && (
            <div>
              <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.35rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BarChart3 size={20} color="var(--accent-cyan)" />
                    <span>Compute Usage & Quota Consumption Velocity</span>
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Real-time monitoring of CPU cores and compute time consumption against your quota.
                  </p>
                </div>

                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <AreaChart data={analyticsData}>
                      <defs>
                        <linearGradient id="colorQuota" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: theme === 'light' ? '#ffffff' : '#0f1624',
                          borderColor: theme === 'light' ? '#e5eaf2' : 'rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          color: theme === 'light' ? '#1e293b' : '#f1f5f9',
                          boxShadow: theme === 'light' ? '0 4px 12px rgba(37,99,235,0.10)' : '0 4px 12px rgba(0,0,0,0.4)'
                        }}
                        labelStyle={{ color: theme === 'light' ? '#1e293b' : '#f1f5f9' }}
                        itemStyle={{ color: theme === 'light' ? '#2563eb' : '#93c5fd' }}
                      />
                      <Area type="monotone" dataKey="quotaConsumed" stroke="#2563eb" fillOpacity={1} fill="url(#colorQuota)" name="Quota Consumed (s)" />
                      <Area type="monotone" dataKey="cpuUsage" stroke="#06b6d4" fillOpacity={1} fill="url(#colorCpu)" name="CPU Cores" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 4: ADMIN QUOTA MANAGEMENT ================= */}
          {isAdmin && activeTab === 'users' && (
            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.35rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={20} color="var(--primary-blue)" />
                  <span>Student & Researcher Quota Administration</span>
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  As Administrator, you have authority to allocate, replenish, or limit compute quotas for campus users.
                </p>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name & Role</th>
                      <th>Email / Username</th>
                      <th>Total Quota</th>
                      <th>Used</th>
                      <th>Remaining</th>
                      <th>Adjust Allocation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const total = u.quotaSeconds || 300;
                      const used = u.usedSeconds || 0;
                      const rem = Math.max(0, total - used);
                      return (
                        <tr key={u.email}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{u.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{u.role}</div>
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{u.email}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{total}s</td>
                          <td style={{ color: 'var(--accent-amber)' }}>{used}s</td>
                          <td style={{ fontWeight: 700, color: rem === 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                            {rem}s
                          </td>
                          <td>
                            {u.username === 'aditya' ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Super Admin (Uncapped)</span>
                            ) : (
                              <div className="quota-adjust-box">
                                <button className="quota-adjust-btn" onClick={() => handleUpdateQuota(u.email, 120)}>
                                  +120s
                                </button>
                                <button className="quota-adjust-btn" onClick={() => handleUpdateQuota(u.email, 300)}>
                                  +300s
                                </button>
                                <button
                                  className="quota-adjust-btn"
                                  style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                                  onClick={() => handleUpdateQuota(u.email, -60)}
                                >
                                  -60s
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* ================= MODAL: ADD WORKER NODE (ADMIN ONLY) ================= */}
          {showAddNodeModal && (
            <div className="modal-backdrop">
              <div className="glass-panel modal-card animate-fade-in">
                <div className="modal-header">
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Laptop size={20} color="var(--accent-cyan)" />
                    <span>Onboard New Cluster Worker Node</span>
                  </h3>
                  <button
                    className="modal-close-btn"
                    onClick={() => setShowAddNodeModal(false)}
                  >
                    &times;
                  </button>
                </div>

                {!generatedPackage ? (
                  <form onSubmit={handleCreateNode} style={{ marginTop: '1rem' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                      Name this machine and select its Operating System. UniCompute will prepare an automated <strong>Zero-Config Self-Installing</strong> package that auto-checks requirements, downloads any missing runtimes (Python/Java), and registers itself into this dashboard.
                    </p>

                    <div className="form-group">
                      <label className="form-label">Node / Machine Name</label>
                      <div className="input-icon-wrapper">
                        <Laptop className="input-icon" size={18} />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Lab-3-PC-12 or Friends-Gaming-Rig"
                          value={newNodeName}
                          onChange={(e) => setNewNodeName(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Worker Operating System</label>
                      <div className="input-icon-wrapper">
                        <Terminal className="input-icon" size={18} />
                        <select
                          className="form-select"
                          value={newNodeOS}
                          onChange={(e) => setNewNodeOS(e.target.value)}
                        >
                          <option value="Windows">Windows 10 / 11 (PowerShell & Winget auto-installer)</option>
                          <option value="macOS">macOS (Homebrew / Portable Python)</option>
                          <option value="Linux / Ubuntu">Linux / Ubuntu (APT / Bash installer)</option>
                        </select>
                      </div>
                    </div>

                    {/* Dynamic OS Auto-Install Explanation */}
                    <div className="os-mechanism-banner">
                      {newNodeOS === 'Windows' && (
                        <div>
                          💡 <strong>Windows Auto-Install Mechanism:</strong> The script checks for Python via PowerShell. If missing, it installs Python 3.11 silently in the background using Windows' built-in <code>winget</code>, or automatically unpacks a zero-install portable Python runtime without requiring administrator prompts.
                        </div>
                      )}
                      {newNodeOS === 'macOS' && (
                        <div>
                          🍎 <strong>macOS Auto-Install Mechanism:</strong> The bash script verifies the local environment using <code>which python3</code>. If not found, it downloads a lightweight standalone universal Python binary directly from the official Python builds or triggers headless <code>brew install python@3.11</code> with zero user interaction.
                        </div>
                      )}
                      {newNodeOS === 'Linux / Ubuntu' && (
                        <div>
                          🐧 <strong>Linux / Ubuntu Auto-Install Mechanism:</strong> The installer verifies Python & GCC via terminal. If missing, it runs a silent non-interactive <code>apt-get install -y python3 python3-pip</code> (or <code>dnf/yum</code> on RHEL/CentOS), configures permissions, and launches the worker daemon as a background service.
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn-logout"
                        style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)', background: 'transparent' }}
                        onClick={() => setShowAddNodeModal(false)}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn-submit-academic" style={{ width: 'auto', padding: '0.65rem 1.4rem' }}>
                        <PlusCircle size={16} />
                        <span>Generate Node Package</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Generated Package details */
                  <div style={{ marginTop: '1rem' }}>
                    <div className="form-feedback success" style={{ marginBottom: '1.25rem' }}>
                      <CheckCircle2 size={18} />
                      <span>Node <strong>{generatedPackage.node.name}</strong> registered! Share the one-line command or ZIP package below.</span>
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>
                        Option 1: One-Line Terminal Command (Recommended - Zero Installation)
                      </label>
                      <div className="code-copy-box">
                        <code>{generatedPackage.command}</code>
                        <button
                          type="button"
                          className="quota-adjust-btn"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedPackage.command);
                            setFeedback({ type: 'success', message: 'Install command copied to clipboard!' });
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}
                        >
                          <Copy size={13} />
                          <span>Copy</span>
                        </button>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.3rem', display: 'block' }}>
                        Paste this into {generatedPackage.node.os === 'Windows' ? 'PowerShell (Run as Admin)' : 'Terminal'}. It downloads dependencies, performs pre-flight checks, and connects automatically.
                      </span>
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Option 2: Standalone Portable ZIP (Plug &amp; Play)</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 400 }}>No installation required</span>
                      </label>
                      <div className="portable-zip-card">
                        <div className="portable-zip-left">
                          <div className="portable-zip-icon-box">
                            <FolderArchive size={22} />
                          </div>
                          <div>
                            <div className="portable-zip-title">
                              unicompute-worker-{generatedPackage.node.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.zip
                            </div>
                            <div className="portable-zip-meta">
                              <span>Token:</span>
                              <code className="portable-zip-token">{generatedPackage.token}</code>
                              <span className="portable-pill">Portable Agent</span>
                              <span className="portable-pill">Win / Mac / Linux</span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-download-zip"
                          onClick={() => {
                            setFeedback({ type: 'info', message: 'Downloading pre-bundled portable worker archive...' });
                            const targetHost = window.location.hostname || 'localhost';
                            const downloadUrl = `http://${targetHost}:8080/downloads/unicompute-worker.zip?token=${encodeURIComponent(generatedPackage.token)}&name=${encodeURIComponent(generatedPackage.node.name)}`;
                            window.open(downloadUrl, '_blank');
                          }}
                        >
                          <Download size={15} />
                          <span>Download ZIP</span>
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                      <button
                        type="button"
                        className="btn-submit-academic"
                        style={{ width: 'auto', padding: '0.65rem 1.5rem' }}
                        onClick={() => setShowAddNodeModal(false)}
                      >
                        Done & Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Terminal Output Inspection Modal */}
          {selectedJobOutput && (
            <div className="modal-backdrop" onClick={() => setSelectedJobOutput(null)}>
              <div
                className="modal-card"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '780px', width: '92%' }}
              >
                <div className="modal-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Terminal size={20} color="var(--accent-cyan)" />
                    <h3 style={{ margin: 0, fontSize: '1.15rem' }}>{selectedJobOutput.jobName}</h3>
                  </div>
                  <button
                    className="modal-close-btn"
                    onClick={() => setSelectedJobOutput(null)}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="modal-body" style={{ marginTop: '0.8rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1rem', background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Status</div>
                      <div style={{ fontWeight: 600 }}>{selectedJobOutput.status}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Executing Node</div>
                      <div style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{selectedJobOutput.assignedNodeName || 'Pending'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Runtime Duration</div>
                      <div style={{ fontWeight: 600, color: 'var(--accent-emerald)' }}>{selectedJobOutput.executionDurationMs != null ? `${selectedJobOutput.executionDurationMs} ms` : 'N/A'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Exit Code</div>
                      <div style={{ fontWeight: 600, color: selectedJobOutput.exitCode === 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>{selectedJobOutput.exitCode != null ? selectedJobOutput.exitCode : 'N/A'}</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>Console Standard Output (stdout):</span>
                  </div>
                  <pre
                    style={{
                      background: '#090d16',
                      color: '#4ade80',
                      fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                      fontSize: '0.82rem',
                      lineHeight: 1.45,
                      padding: '1rem',
                      borderRadius: '8px',
                      maxHeight: '260px',
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      border: '1px solid rgba(255,255,255,0.08)'
                    }}
                  >
                    {selectedJobOutput.stdout || (selectedJobOutput.status === 'RUNNING' ? 'Job is currently running on worker laptop... Heartbeats transmitting every 10s.' : 'No standard output recorded.')}
                  </pre>

                  {selectedJobOutput.stderr && (
                    <div style={{ marginTop: '0.8rem' }}>
                      <div style={{ marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent-rose)' }}>
                        Standard Error & Stack Trace (stderr):
                      </div>
                      <pre
                        style={{
                          background: '#1a0505',
                          color: '#f87171',
                          fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                          fontSize: '0.8rem',
                          lineHeight: 1.45,
                          padding: '0.85rem',
                          borderRadius: '8px',
                          maxHeight: '150px',
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          border: '1px solid rgba(248,113,113,0.2)'
                        }}
                      >
                        {selectedJobOutput.stderr}
                      </pre>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
                    <button
                      type="button"
                      className="btn-submit-academic"
                      style={{ width: 'auto', padding: '0.5rem 1.4rem' }}
                      onClick={() => setSelectedJobOutput(null)}
                    >
                      Close Output
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* College Project Modest Footer */}
      <footer className="academic-footer">
        <div>
          UniCompute Platform &bull; B.Tech Computer Science & Engineering Capstone Project
        </div>
        <div>
          Decentralized Campus Cloud Computing &bull; Spring Boot & React
        </div>
      </footer>
    </div>
  );
}
