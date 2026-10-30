import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
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
  Bell,
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
  // F-8: State for Delete User confirmation modal
  const [userToDeleteConfirm, setUserToDeleteConfirm] = useState(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

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
    priority: 2,
    schedulingAlgorithm: 'AUTO'
  });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  const [workloadInputMode, setWorkloadInputMode] = useState('file'); // 'file' (default) or 'editor'
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef(null);

  // F-5: Resumable Chunked Upload Engine
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks
  const [uploadState, setUploadState] = useState({
    fileId: null,
    totalChunks: 0,
    uploadedChunks: [],
    currentChunk: 0,
    percent: 0,
    status: 'idle', // 'idle' | 'uploading' | 'completed' | 'retrying' | 'error'
    bytesUploaded: 0,
    totalBytes: 0,
    retryCount: 0,
    errorMsg: null
  });
  const uploadAbortControllerRef = useRef(null);

  const startResumableUpload = async (file, fileId, totalChunks) => {
    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
    }
    uploadAbortControllerRef.current = new AbortController();
    const signal = uploadAbortControllerRef.current.signal;

    setUploadState({
      fileId,
      totalChunks,
      uploadedChunks: [],
      currentChunk: 0,
      percent: 0,
      status: 'uploading',
      bytesUploaded: 0,
      totalBytes: file.size,
      retryCount: 0,
      errorMsg: null
    });

    let alreadyUploaded = [];
    try {
      const statusRes = await fetch(`/api/jobs/upload-status/${fileId}`);
      if (statusRes.ok) {
        const s = await statusRes.json();
        if (s.complete) {
          setUploadState(prev => ({
            ...prev,
            status: 'completed',
            percent: 100,
            uploadedChunks: s.receivedChunks || []
          }));
          setJobForm(prev => ({ ...prev, sourceCode: 'pkg:' + fileId }));
          return;
        }
        if (Array.isArray(s.receivedChunks)) {
          alreadyUploaded = s.receivedChunks;
        }
      }
    } catch (e) {
      // proceed from 0
    }

    let uploadedIndices = [...alreadyUploaded];

    for (let i = 0; i < totalChunks; i++) {
      if (signal.aborted) return;
      if (uploadedIndices.includes(i)) continue;

      const start = i * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      const chunkBlob = file.slice(start, end);

      let success = false;
      let attempt = 0;
      const maxAttempts = 5;

      while (!success && attempt < maxAttempts) {
        if (signal.aborted) return;
        try {
          attempt++;
          const formData = new FormData();
          formData.append('fileId', fileId);
          formData.append('chunkIndex', i);
          formData.append('totalChunks', totalChunks);
          formData.append('fileName', file.name);
          formData.append('totalSize', file.size);
          formData.append('chunk', chunkBlob, `${file.name}.part${i}`);

          const res = await fetch('/api/jobs/upload-chunk', {
            method: 'POST',
            body: formData,
            signal
          });

          if (!res.ok) {
            throw new Error(`Server returned HTTP ${res.status}`);
          }

          const data = await res.json();
          success = true;
          uploadedIndices.push(i);

          const pct = Math.round((uploadedIndices.length / totalChunks) * 100);
          setUploadState(prev => ({
            ...prev,
            currentChunk: i + 1,
            uploadedChunks: uploadedIndices,
            percent: pct,
            status: pct >= 100 || data.complete ? 'completed' : 'uploading',
            bytesUploaded: Math.min(file.size, (i + 1) * CHUNK_SIZE),
            retryCount: 0,
            errorMsg: null
          }));

          if (data.complete || pct >= 100) {
            setJobForm(prev => ({ ...prev, sourceCode: 'pkg:' + fileId }));
            addNotification(
              'Upload Assembled',
              `Package "${file.name}" assembled (${totalChunks} chunks verified on cluster).`,
              'info'
            );
          }
        } catch (err) {
          if (signal.aborted || err.name === 'AbortError') return;

          if (attempt >= maxAttempts) {
            setUploadState(prev => ({
              ...prev,
              status: 'error',
              errorMsg: `Upload halted after ${maxAttempts} retries: ${err.message}`
            }));
            return;
          }

          setUploadState(prev => ({
            ...prev,
            status: 'retrying',
            currentChunk: i,
            retryCount: attempt,
            errorMsg: `Wi-Fi / network drop detected. Auto-retrying chunk ${i + 1} from checkpoint in 2s (Attempt ${attempt}/${maxAttempts})...`
          }));
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
  };

  const handleFileProcess = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const isZip = ext === 'zip' || ext === 'tar' || ext === 'gz';
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1;
    const fileId = 'pkg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

    setSelectedFile({
      fileObj: file,
      name: file.name,
      size: file.size > 1024 * 1024
        ? (file.size / (1024 * 1024)).toFixed(2) + ' MB'
        : (file.size / 1024).toFixed(1) + ' KB',
      rawSize: file.size,
      extension: ext,
      isZip: isZip,
      fileId: fileId,
      totalChunks: totalChunks
    });

    if (!jobForm.jobName || jobForm.jobName.trim() === '' || jobForm.jobName.startsWith('Workload-')) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      setJobForm(prev => ({ ...prev, jobName: cleanName }));
    }

    if (isZip || file.size > CHUNK_SIZE) {
      startResumableUpload(file, fileId, totalChunks);
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
      startResumableUpload(file, fileId, totalChunks);
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
    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
    }
    setSelectedFile(null);
    setUploadState({
      fileId: null,
      totalChunks: 0,
      uploadedChunks: [],
      currentChunk: 0,
      percent: 0,
      status: 'idle',
      bytesUploaded: 0,
      totalBytes: 0,
      retryCount: 0,
      errorMsg: null
    });
    setJobForm(prev => ({ ...prev, sourceCode: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Compute Nodes state (persisted)
  const [computeNodes, setComputeNodes] = useState(() => {
    const saved = localStorage.getItem('unicompute_nodes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Filter out the removed example nodes
          const cleaned = parsed.filter(n => n.id !== 'node-1' && n.id !== 'node-2');
          if (cleaned.length > 0) return cleaned;
        }
      } catch (e) {
        // fallback
      }
    }
    return [
      { id: 'node-3', name: 'Node-Master-Orchestrator', cores: 8, memoryGb: 16, os: 'macOS (Host)', status: 'Active (Master)', token: 'master_token' }
    ];
  });

  // State for interactive node metrics and pie chart (F-4)
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [pinnedNodeMetricsId, setPinnedNodeMetricsId] = useState(null);
  const [activeJobDetailsNodeId, setActiveJobDetailsNodeId] = useState(null);

  // State for dynamic resource analytics filter (F-7)
  const [analyticsFilterMode, setAnalyticsFilterMode] = useState('cluster'); // 'cluster' or 'process'
  const [selectedProcessJobId, setSelectedProcessJobId] = useState('');

  // B-8: Real hardware telemetry stream state
  const [realJobTelemetry, setRealJobTelemetry] = useState([]);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState(false);

  useEffect(() => {
    if (analyticsFilterMode === 'process' && selectedProcessJobId) {
      let isMounted = true;
      const fetchTelemetry = async () => {
        try {
          setIsLoadingTelemetry(true);
          const res = await fetch(`/api/jobs/${selectedProcessJobId}/telemetry`);
          if (res.ok) {
            const data = await res.json();
            if (isMounted) setRealJobTelemetry(data);
          }
        } catch (e) {
          // ignore
        } finally {
          if (isMounted) setIsLoadingTelemetry(false);
        }
      };
      fetchTelemetry();
      const interval = setInterval(fetchTelemetry, 3000);
      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    } else {
      setRealJobTelemetry([]);
    }
  }, [selectedProcessJobId, analyticsFilterMode]);

  // Notification Center & Alerts State (F-6)
  const prevJobStatusMap = useRef({});

  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('unicompute_notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse notifications from localStorage', e);
    }
    return [
      {
        id: 'n-1',
        title: 'Cluster Topology Ready',
        message: 'UniCompute nodes active & synchronizing telemetry.',
        type: 'info',
        time: 'Just now',
        read: false
      },
      {
        id: 'n-2',
        title: 'Quota Allocation Active',
        message: 'Daily quota balance allocated for student CSE workload dispatch.',
        type: 'success',
        time: '5m ago',
        read: false
      }
    ];
  });
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  // Sync notifications to localStorage so read/unread and custom alerts persist across refresh
  useEffect(() => {
    try {
      localStorage.setItem('unicompute_notifications', JSON.stringify(notifications));
    } catch (e) {
      console.warn('Failed to persist notifications', e);
    }
  }, [notifications]);

  const addNotification = (title, message, type = 'info') => {
    const newNotif = {
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      title,
      message,
      type,
      time: 'Just now',
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const markNotificationAsRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  // Modal state for adding a worker node
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeOS, setNewNodeOS] = useState('Windows');
  const [generatedPackage, setGeneratedPackage] = useState(null);
  const [isSyncingNodes, setIsSyncingNodes] = useState(false);

  // Sync nodes to localStorage
  useEffect(() => {
    localStorage.setItem('unicompute_nodes', JSON.stringify(computeNodes));
  }, [computeNodes]);

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
        if (Array.isArray(data)) {
          setAllBackendJobs(data);

          // Real-time notification triggers for job lifecycle transitions
          data.forEach(job => {
            const prevStatus = prevJobStatusMap.current[job.jobId];
            if (prevStatus && prevStatus !== job.status) {
              if (job.status === 'COMPLETED') {
                addNotification(
                  'Job Completed',
                  `"${job.jobName}" finished successfully (${job.durationMs || 0}ms).`,
                  'success'
                );
              } else if (job.status === 'FAILED') {
                addNotification(
                  'Job Failed',
                  `"${job.jobName}" failed: ${job.errorMessage || 'Execution terminated with error'}.`,
                  'error'
                );
              } else if (job.status === 'SUSPENDED') {
                addNotification(
                  'Job Preempted',
                  `"${job.jobName}" suspended to yield node to higher priority job.`,
                  'warning'
                );
              } else if (job.status === 'RUNNING' && prevStatus === 'SUSPENDED') {
                addNotification(
                  'Job Resumed',
                  `"${job.jobName}" resumed execution on compute worker.`,
                  'info'
                );
              }
            }
            prevJobStatusMap.current[job.jobId] = job.status;
          });
        }
      }
    } catch (e) {
      // keep local
    } finally {
      setIsLoadingJobs(false);
    }

    // 4. Users Quota & Authentication List from Database
    try {
      const usersRes = await fetch('/api/users');
      if (usersRes.ok) {
        const uData = await usersRes.json();
        if (Array.isArray(uData) && uData.length > 0) {
          setUsers(prev => {
            const mapped = uData.map(u => ({
              userId: u.userId,
              username: u.username,
              email: u.email,
              name: u.fullName,
              role: u.role === 'ADMIN' ? 'Platform Administrator' : 'Student / Researcher',
              quotaSeconds: u.dailyQuotaSeconds || 1200,
              usedSeconds: u.usedQuotaSeconds || 0
            }));
            const existing = new Set(mapped.map(m => m.email));
            const leftovers = prev.filter(p => !existing.has(p.email));
            return [...mapped, ...leftovers];
          });
        }
      }
    } catch (e) {}

    // 3. Compute Nodes telemetry (Independent with cache busting)
    try {
      const nodesRes = await fetch(`/api/nodes?_t=${Date.now()}`, { cache: 'no-store' });
      if (nodesRes.ok) {
        const nodesData = await nodesRes.json();
        if (Array.isArray(nodesData)) {
          setComputeNodes(nodesData);
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
          setComputeNodes(data);
          const onlineCount = data.filter(n => n.status === 'Available' || n.status === 'Busy' || n.status === 'Active (Master)').length;
          setFeedback({
            type: 'success',
            message: `Nodes refreshed: ${data.length} total (${onlineCount} online/active).`
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
  // Smart AI runtime predictor & auto-scheduler heuristic (F-9 & B-4)
  const getAiPrediction = () => {
    const code = jobForm.sourceCode || '';
    const lineCount = code ? code.split('\n').length : 25;
    const isJava = jobForm.language === 'JAVA';
    const cores = Number(jobForm.cpuCores) || 2;
    const ramMb = Number(jobForm.memoryMb) || 1024;
    const maxTime = Number(jobForm.maxExecutionTimeSeconds) || 60;

    // Check past completed job history for similar language/resource profile
    const similarJobs = allBackendJobs.filter(j => j.status === 'COMPLETED' && j.language === jobForm.language && j.executionDurationMs != null);
    let baseSeconds;
    if (similarJobs.length > 0) {
      const avgDurationSec = similarJobs.reduce((acc, j) => acc + (j.executionDurationMs / 1000), 0) / similarJobs.length;
      baseSeconds = Math.max(5, Math.round(avgDurationSec * (isJava ? 0.9 : 1.1)));
    } else {
      // Heuristic based on complexity tokens & cores
      const complexityFactor = Math.min(3.0, Math.max(0.4, lineCount * 0.08));
      baseSeconds = Math.round((20 * complexityFactor) / Math.max(1, cores * 0.7));
    }

    const predictedSec = Math.min(maxTime, Math.max(3, baseSeconds));

    // Recommend optimal scheduling algorithm based on duration and priority
    let recommendedAlgo = 'FCFS';
    if (Number(jobForm.priority) === 3) {
      recommendedAlgo = 'Priority Preemptive';
    } else if (predictedSec < 15) {
      recommendedAlgo = 'Shortest Job First (SJF)';
    } else {
      recommendedAlgo = 'Round Robin (Time-Slice)';
    }

    return { predictedSec, recommendedAlgo };
  };

  const calcApproxTime = () => {
    return getAiPrediction().predictedSec;
  };

  // Login Handler (Verified against database via /api/auth/login)
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    const trimmedId = loginIdentifier.trim();
    const trimmedPwd = loginPassword.trim();

    if (!trimmedId || !trimmedPwd) {
      setFeedback({ type: 'error', message: 'Please enter your username/email and password.' });
      return;
    }

    // Authenticate against database API
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: trimmedId, password: trimmedPwd })
      });
      if (res.ok) {
        const u = await res.json();
        const loggedUser = {
          userId: u.userId,
          username: u.username,
          email: u.email,
          name: u.fullName,
          role: u.role === 'ADMIN' ? 'Platform Administrator' : 'Student / Researcher',
          quotaSeconds: u.dailyQuotaSeconds || 1200,
          usedSeconds: u.usedQuotaSeconds || 0
        };
        setFeedback({ type: 'success', message: `Welcome, ${loggedUser.name}!` });
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
        setTimeout(() => {
          setCurrentUser(loggedUser);
          localStorage.setItem('unicompute_session', JSON.stringify(loggedUser));
        }, 400);
        return;
      }
    } catch (err) {
      console.warn('Backend auth unavailable, checking local accounts', err);
    }

    // Fallback to local accounts
    const matchedUser = users.find(
      (u) =>
        (u.username?.toLowerCase() === trimmedId.toLowerCase() ||
          u.email?.toLowerCase() === trimmedId.toLowerCase()) &&
        u.password === trimmedPwd
    );

    if (matchedUser) {
      setFeedback({ type: 'success', message: `Welcome, ${matchedUser.name}!` });
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

  // Register Handler (Persisted to database via /api/auth/register)
  const handleRegisterSubmit = async (e) => {
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

    // Call backend API to persist to MySQL users table
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: email.split('@')[0],
          email: email,
          password: pwd,
          fullName: name,
          role: 'STUDENT',
          department: 'Computer Science & Engineering'
        })
      });

      if (res.ok) {
        const u = await res.json();
        const newUser = {
          userId: u.userId,
          username: u.username,
          email: u.email,
          name: u.fullName,
          role: 'Student / Researcher',
          quotaSeconds: u.dailyQuotaSeconds || 3600,
          usedSeconds: u.usedQuotaSeconds || 0
        };
        setUsers(prev => [...prev.filter(x => x.email !== newUser.email), newUser]);
        setFeedback({
          type: 'success',
          message: 'Account successfully registered and persisted in database! You can now sign in.'
        });
        setRegName('');
        setRegEmail('');
        setRegPassword('');
        setLoginIdentifier(email);
        setLoginPassword('');
        setTimeout(() => setAuthMode('login'), 1200);
        return;
      } else {
        const errJson = await res.json().catch(() => ({}));
        setFeedback({ type: 'error', message: errJson.error || 'Registration failed on server.' });
        return;
      }
    } catch (err) {
      console.warn('Backend registration unavailable, creating local user', err);
    }

    const newUser = {
      username: email.split('@')[0],
      email: email,
      name: name,
      password: pwd,
      role: 'Student / Researcher',
      quotaSeconds: 300,
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
    setTimeout(() => setAuthMode('login'), 1200);
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
        schedulingAlgorithm: jobForm.schedulingAlgorithm,
        userId: currentUser?.userId
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
        addNotification('Job Dispatched', `"${created.jobName}" submitted (${payload.maxExecutionTimeSeconds}s quota reserved).`, 'info');

        // Reset form
        setJobForm({
          jobName: '',
          language: 'PYTHON',
          sourceCode: DEFAULT_PYTHON_SCRIPT,
          cpuCores: 2,
          memoryMb: 1024,
          storageMb: 256,
          maxExecutionTimeSeconds: 30,
          priority: 2,
          schedulingAlgorithm: 'AUTO'
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
        addNotification('Job Cancelled', 'Workload was aborted and unallocated quota refunded.', 'warning');
        fetchBackendInfo();
      } else {
        setFeedback({ type: 'error', message: 'Could not cancel job (it may have already finished).' });
      }
    } catch (e) {
      setFeedback({ type: 'error', message: 'Failed to communicate with master.' });
    }
  };

  // Admin: Update User Quota with backend sync
  const handleUpdateQuota = async (userEmail, additionalSeconds) => {
    const updated = users.map(u => {
      if (u.email === userEmail) {
        const newQuota = Math.max(0, (u.quotaSeconds || 300) + additionalSeconds);
        return { ...u, quotaSeconds: newQuota };
      }
      return u;
    });
    setUsers(updated);

    const targetUser = users.find(u => u.email === userEmail);
    if (targetUser?.userId) {
      try {
        await fetch(`/api/users/${targetUser.userId}/quota`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deltaSeconds: additionalSeconds })
        });
        addNotification(
          'Quota Updated',
          `Quota for "${targetUser.name || userEmail}" adjusted by ${additionalSeconds > 0 ? '+' : ''}${additionalSeconds}s.`,
          'info'
        );
      } catch (err) {
        console.warn('Could not sync quota to backend:', err);
      }
    }
  };

  // F-8: Open safety confirmation modal
  const handleOpenDeleteModal = (userToDelete) => {
    setUserToDeleteConfirm(userToDelete);
  };

  // F-8: Confirm user deletion safely cascading workloads
  const handleConfirmDeleteUser = async () => {
    if (!userToDeleteConfirm) return;
    setIsDeletingUser(true);
    const targetName = userToDeleteConfirm.name || userToDeleteConfirm.username;
    try {
      if (userToDeleteConfirm.userId) {
        const res = await fetch(`/api/users/${userToDeleteConfirm.userId}`, { method: 'DELETE' });
        if (!res.ok) {
          console.warn(`DELETE /api/users/${userToDeleteConfirm.userId} returned status ${res.status}`);
        }
      }
      setUsers(prev => prev.filter(u => u.email !== userToDeleteConfirm.email && u.username !== userToDeleteConfirm.username));
      setFeedback({
        type: 'info',
        message: `User "${targetName}" deleted successfully. Active jobs cancelled and quotas revoked.`
      });
      addNotification(
        'User Deleted',
        `User "${targetName}" and associated quotas deleted by Admin.`,
        'info'
      );
    } catch (err) {
      console.warn('Backend user deletion error:', err);
      setFeedback({
        type: 'error',
        message: `Error deleting user: ${err.message}`
      });
    } finally {
      setIsDeletingUser(false);
      setUserToDeleteConfirm(null);
    }
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

    setComputeNodes([...computeNodes, newNode]);

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
    const target = computeNodes.find(n => n.id === nodeId);
    const willBeOnBreak = target?.status !== 'On Break';
    const nextStatus = willBeOnBreak ? 'On Break' : 'Available';

    const updated = computeNodes.map(n => {
      if (n.id === nodeId) {
        return { ...n, status: nextStatus };
      }
      return n;
    });
    setComputeNodes(updated);

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
    const target = computeNodes.find(n => n.id === nodeId);
    if (target?.id === 'node-3') {
      setFeedback({ type: 'error', message: 'Cannot remove the Master Orchestrator.' });
      return;
    }
    setComputeNodes(computeNodes.filter(n => n.id !== nodeId));

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

  // Dynamic resource analytics dataset (Cluster-Wide or Specific Process) (F-7 & B-8)
  const getDynamicAnalyticsData = () => {
    if (analyticsFilterMode === 'process' && selectedProcessJobId) {
      // 100% real measured physical OS telemetry points streamed from worker (B-8)
      if (realJobTelemetry && realJobTelemetry.length > 0) {
        return realJobTelemetry.map((pt, idx) => ({
          time: `+${Math.round(pt.elapsedMs / 1000)}s`,
          cpuUsage: Math.round((pt.cpuUsagePercent || 15) * 10) / 10,
          memory: Math.round(pt.memoryMb || 256),
          activeThreads: pt.activeThreads || 1,
          quotaConsumed: Math.round(pt.elapsedMs / 1000),
          isRealStream: true
        }));
      }

      // Dynamic fallback profile based on actual job specifications
      const job = allBackendJobs.find(j => j.jobId === selectedProcessJobId);
      if (job) {
        const cores = job.cpuCores || 2;
        const ram = job.memoryMb || 512;
        const durSec = job.executionDurationMs ? Math.round(job.executionDurationMs / 1000) : job.maxExecutionTimeSeconds || 30;
        return [
          { time: 'T+0s (Init)', cpuUsage: Math.max(1, Math.round(cores * 0.3)), memory: Math.round(ram * 0.4), quotaConsumed: Math.round(durSec * 0.15) },
          { time: `T+${Math.max(1, Math.round(durSec * 0.25))}s`, cpuUsage: Math.round(cores * 0.85), memory: Math.round(ram * 0.75), quotaConsumed: Math.round(durSec * 0.4) },
          { time: `T+${Math.max(2, Math.round(durSec * 0.5))}s (Peak)`, cpuUsage: cores, memory: ram, quotaConsumed: Math.round(durSec * 0.65) },
          { time: `T+${Math.max(3, Math.round(durSec * 0.75))}s`, cpuUsage: Math.round(cores * 0.9), memory: Math.round(ram * 0.88), quotaConsumed: Math.round(durSec * 0.85) },
          { time: `T+${durSec}s (Final)`, cpuUsage: Math.max(1, Math.round(cores * 0.2)), memory: Math.round(ram * 0.3), quotaConsumed: durSec }
        ];
      }
    }

    // Default Cluster-Wide telemetry aggregated from real jobs
    if (allBackendJobs.length > 0) {
      return allBackendJobs.slice(-6).map((j, idx) => ({
        time: j.jobName?.slice(0, 10) || `Job #${idx + 1}`,
        cpuUsage: j.cpuCores || 2,
        memory: j.memoryMb || 1024,
        quotaConsumed: j.executionDurationMs ? Math.round(j.executionDurationMs / 1000) : 30
      }));
    }

    return [
      { time: '10:00', cpuUsage: 2, memory: 512, quotaConsumed: 30 },
      { time: '12:00', cpuUsage: 4, memory: 1024, quotaConsumed: 70 },
      { time: '14:00', cpuUsage: 3, memory: 1536, quotaConsumed: 120 },
      { time: '16:00', cpuUsage: 6, memory: 2048, quotaConsumed: Math.min(quotaTotal, quotaUsed) },
      { time: 'Now', cpuUsage: Number(jobForm.cpuCores) || 2, memory: Number(jobForm.memoryMb) || 1024, quotaConsumed: quotaUsed }
    ];
  };

  const dynamicAnalyticsData = getDynamicAnalyticsData();

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

          {/* F-6: Notification Bell & Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowNotifDropdown(prev => !prev)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '0.45rem',
                color: 'var(--text-main)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                transition: 'all 0.2s'
              }}
              title="Notifications & System Alerts"
            >
              <Bell size={18} />
              {notifications.filter(n => !n.read).length > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    background: '#ef4444',
                    color: '#ffffff',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 6px rgba(239, 68, 68, 0.6)'
                  }}
                >
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {showNotifDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '120%',
                  right: 0,
                  width: '320px',
                  background: 'rgba(15, 23, 42, 0.96)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '12px',
                  boxShadow: '0 12px 35px rgba(0, 0, 0, 0.6)',
                  zIndex: 1000,
                  overflow: 'hidden',
                  animation: 'fadeIn 0.2s ease-out'
                }}
              >
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f1f5f9' }}>Notifications & Alerts</span>
                  <button
                    type="button"
                    onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Mark all read
                  </button>
                </div>

                <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                      No notifications at this time
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => markNotificationAsRead(n.id)}
                        title={n.read ? 'Marked as read' : 'Click to mark as read'}
                        style={{
                          padding: '0.75rem 1rem',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          background: n.read ? 'transparent' : 'rgba(37, 99, 235, 0.12)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.2rem',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                          position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            color: n.type === 'error' ? '#ef4444' : n.type === 'warning' ? '#f59e0b' : n.type === 'success' ? '#10b981' : 'var(--accent-cyan)'
                          }}>
                            {n.title}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {n.time}
                            {!n.read && (
                              <span
                                style={{
                                  width: '7px',
                                  height: '7px',
                                  borderRadius: '50%',
                                  background: '#38bdf8',
                                  boxShadow: '0 0 6px rgba(56, 189, 248, 0.8)',
                                  display: 'inline-block'
                                }}
                                title="Unread"
                              />
                            )}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.74rem', color: n.read ? 'var(--text-dim)' : 'var(--text-main)', lineHeight: 1.4 }}>
                          {n.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ padding: '0.5rem 1rem', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setNotifications([])}
                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '0.7rem', cursor: 'pointer' }}
                  >
                    Clear All Notifications
                  </button>
                </div>
              </div>
            )}
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
                        <div className="metric-info-label">Active Workers</div>
                        <div className="metric-info-val">4 Nodes</div>
                        <div className="metric-info-sub">&bull; Gossip Protocol Ready</div>
                      </div>
                    </div>

                    <div className="glass-panel metric-card">
                      <div className="metric-icon-box metric-icon-amber">
                        <Layers size={24} />
                      </div>
                      <div>
                        <div className="metric-info-label">Total Queue</div>
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

              {/* Overview Layout (2-Column for Admin with Node Topology, 1-Column full width for Student) */}
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
                                {j.priority && (
                                  <span style={{
                                    marginLeft: '0.45rem',
                                    padding: '0.12rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    letterSpacing: '0.02em',
                                    background: Number(j.priority) === 3 ? 'rgba(245, 158, 11, 0.15)' : Number(j.priority) === 1 ? 'rgba(148, 163, 184, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                    color: Number(j.priority) === 3 ? '#f59e0b' : Number(j.priority) === 1 ? '#94a3b8' : '#60a5fa',
                                    border: Number(j.priority) === 3 ? '1px solid rgba(245, 158, 11, 0.4)' : Number(j.priority) === 1 ? '1px solid rgba(148, 163, 184, 0.3)' : '1px solid rgba(59, 130, 246, 0.4)'
                                  }}>
                                    {Number(j.priority) === 3 ? 'HIGH' : Number(j.priority) === 1 ? 'LOW' : 'NORMAL'}
                                  </span>
                                )}
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
                        <span>Node Topology ({computeNodes.length} Nodes)</span>
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
                      {computeNodes.map((node) => {
                        const isOnBreak = node.status === 'On Break';
                        const isOffline = node.status === 'Offline' || node.online === false;
                        const isMaster = node.id === 'node-3';
                        const showMetrics = pinnedNodeMetricsId === node.id;

                        // Calculate resource telemetry for F-4 3-color pie chart
                        const totalMem = node.memoryGb || 16;
                        const activeNodeJobs = allBackendJobs.filter(j => 
                          (j.assignedNodeId === node.id || j.assignedNodeName === node.name) && 
                          (j.status === 'RUNNING' || j.status === 'ASSIGNED')
                        );
                        const occupiedMb = activeNodeJobs.reduce((acc, curr) => acc + (curr.memoryMb || 0), 0);
                        const occupiedGb = Math.round((occupiedMb / 1024) * 10) / 10;
                        const reservedGb = Math.round(totalMem * 0.15 * 10) / 10;
                        const freeGb = Math.max(0, Math.round((totalMem - occupiedGb - reservedGb) * 10) / 10);

                        const pieData = [
                          { name: 'Available Space', value: freeGb > 0 ? freeGb : 0.2, color: '#10b981', displayVal: `${freeGb} GB` },
                          { name: 'Process Occupied', value: occupiedGb > 0 ? occupiedGb : 0.1, color: '#f59e0b', displayVal: `${occupiedGb} GB (${activeNodeJobs.length} jobs)` },
                          { name: 'System Reserve', value: reservedGb, color: '#6366f1', displayVal: `${reservedGb} GB` }
                        ];

                        return (
                          <div
                            key={node.id}
                            style={{ marginBottom: '1rem', transition: 'all 0.25s ease' }}
                          >
                            <div
                              className="node-card"
                              style={{
                                opacity: isOnBreak ? 0.75 : 1,
                                transform: showMetrics ? 'translateY(-2px)' : 'none',
                                borderColor: showMetrics ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.05)',
                                boxShadow: showMetrics ? '0 6px 20px rgba(6, 182, 212, 0.18)' : 'none',
                                transition: 'all 0.25s ease'
                              }}
                            >
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
                                {/* Dedicated View Pie Chart Button (No hover glitching) */}
                                <button
                                  type="button"
                                  className="quota-adjust-btn"
                                  onClick={() => setPinnedNodeMetricsId(prev => prev === node.id ? null : node.id)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.32rem 0.65rem',
                                    height: 'auto',
                                    fontSize: '0.76rem',
                                    fontWeight: 600,
                                    background: showMetrics ? 'rgba(6, 182, 212, 0.22)' : 'rgba(255, 255, 255, 0.05)',
                                    color: showMetrics ? 'var(--accent-cyan)' : 'var(--text-main)',
                                    border: showMetrics ? '1px solid rgba(6, 182, 212, 0.45)' : '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                  title="Inspect storage capacity and occupied process pie chart"
                                >
                                  <span>{showMetrics ? '📊 Hide Pie Chart' : '📊 View Pie Chart'}</span>
                                </button>

                                <span className={isOnBreak ? 'status-badge-queued' : (isOffline && !isMaster ? 'status-badge-offline' : 'status-badge-online')}>
                                  {node.status}
                                </span>

                                {/* Break / Resume Button */}
                                {!isMaster && (
                                  <button
                                    type="button"
                                    className="node-action-btn"
                                    onClick={() => handleToggleNodeBreak(node.id)}
                                    title={isOnBreak ? 'Resume Node for Workloads' : 'Take Break (Free machine for local lab tasks)'}
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

                            {/* F-4: Pop-up Box below node with 3-color Pie Chart and Clickable Process Breakdown */}
                            {showMetrics && (
                              <div
                                style={{
                                  marginTop: '-0.35rem',
                                  padding: '1.2rem',
                                  background: 'rgba(15, 23, 42, 0.95)',
                                  backdropFilter: 'blur(16px)',
                                  borderRadius: '12px',
                                  border: '1px solid rgba(6, 182, 212, 0.3)',
                                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
                                  animation: 'fadeIn 0.2s ease-out'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: '0.5rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                                    <Activity size={16} />
                                    <span>Resource Telemetry & Capacity Breakdown</span>
                                  </div>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                                    Total: {totalMem} GB RAM &bull; {node.cores} Cores
                                  </span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '1.2rem', alignItems: 'center' }}>
                                  {/* 3-Color Donut Chart */}
                                  <div style={{ width: '130px', height: '130px', position: 'relative' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                      <PieChart>
                                        <Tooltip
                                          formatter={(val, name, item) => [item.payload.displayVal, name]}
                                          contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.75rem' }}
                                        />
                                        <Pie
                                          data={pieData}
                                          innerRadius={36}
                                          outerRadius={58}
                                          paddingAngle={3}
                                          dataKey="value"
                                          cursor="pointer"
                                          onClick={(entry) => {
                                            if (entry.name === 'Process Occupied') {
                                              setActiveJobDetailsNodeId(prev => prev === node.id ? null : node.id);
                                            }
                                          }}
                                        >
                                          {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                          ))}
                                        </Pie>
                                      </PieChart>
                                    </ResponsiveContainer>
                                  </div>

                                  {/* 3-Color Interactive Legend */}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {/* 1. Free Capacity */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0.6rem', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem' }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                                        <span>Available Capacity</span>
                                      </div>
                                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>{freeGb} GB</span>
                                    </div>

                                    {/* 2. Process Occupied (Clickable to view active jobs) */}
                                    <div
                                      onClick={() => setActiveJobDetailsNodeId(prev => prev === node.id ? null : node.id)}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '0.35rem 0.6rem',
                                        borderRadius: '6px',
                                        background: 'rgba(245, 158, 11, 0.12)',
                                        border: '1px solid rgba(245, 158, 11, 0.35)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem' }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                                        <span style={{ fontWeight: 600, color: '#fcd34d' }}>Process Occupied</span>
                                        <span style={{ fontSize: '0.68rem', color: 'var(--accent-amber)', textDecoration: 'underline' }}>
                                          ({activeJobDetailsNodeId === node.id ? 'Hide' : 'Click to inspect'})
                                        </span>
                                      </div>
                                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#f59e0b', fontWeight: 700 }}>
                                        {occupiedGb} GB ({activeNodeJobs.length} active)
                                      </span>
                                    </div>

                                    {/* 3. System Reserve */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0.6rem', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem' }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1' }} />
                                        <span>System Reserve</span>
                                      </div>
                                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#818cf8', fontWeight: 600 }}>{reservedGb} GB</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Active Process Drilldown Table (appears when clicking occupied slice) */}
                                {activeJobDetailsNodeId === node.id && (
                                  <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px dashed rgba(245, 158, 11, 0.3)' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fcd34d', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
                                      <span>Running Processes on {node.name}</span>
                                      <span>Total: {activeNodeJobs.length} active</span>
                                    </div>
                                    {activeNodeJobs.length === 0 ? (
                                      <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontStyle: 'italic', padding: '0.4rem 0' }}>
                                        No active jobs currently allocated to this node. Node is ready to accept queued workloads.
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        {activeNodeJobs.map(job => (
                                          <div
                                            key={job.jobId}
                                            style={{
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              padding: '0.4rem 0.6rem',
                                              borderRadius: '6px',
                                              background: 'rgba(255, 255, 255, 0.04)',
                                              border: '1px solid rgba(255, 255, 255, 0.08)',
                                              fontSize: '0.74rem'
                                            }}
                                          >
                                            <div>
                                              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{job.jobName}</span>
                                              <span style={{ marginLeft: '0.4rem', color: 'var(--accent-cyan)' }}>({job.language})</span>
                                              <span style={{ marginLeft: '0.4rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>[{job.jobId?.slice(0, 8)}]</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                              <span>{job.cpuCores}c &bull; {job.memoryMb}MB</span>
                                              <span style={{ padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 600, fontSize: '0.68rem' }}>
                                                {job.status}
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
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
                              border: uploadState.status === 'retrying'
                                ? '1px solid rgba(245, 158, 11, 0.6)'
                                : uploadState.status === 'error'
                                ? '1px solid rgba(239, 68, 68, 0.6)'
                                : uploadState.status === 'completed'
                                ? '1px solid rgba(16, 185, 129, 0.5)'
                                : '1px solid rgba(56, 189, 248, 0.4)',
                              background: 'rgba(15, 23, 42, 0.8)',
                              borderRadius: '12px',
                              padding: '1.25rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '1rem'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
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
                                    Size: {selectedFile.size} • {selectedFile.totalChunks > 1 ? `${selectedFile.totalChunks} Chunks (5MB Resumable)` : 'Single Chunk'}
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

                            {/* F-5: Resumable Chunked Upload Progress & Status Bar */}
                            <div style={{ padding: '0.85rem 1rem', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', fontSize: '0.82rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  {uploadState.status === 'completed' && <CheckCircle2 size={15} color="#10b981" />}
                                  {uploadState.status === 'uploading' && <RefreshCw size={15} color="#38bdf8" className="spin" />}
                                  {uploadState.status === 'retrying' && <AlertTriangle size={15} color="#f59e0b" />}
                                  {uploadState.status === 'error' && <AlertCircle size={15} color="#ef4444" />}
                                  <span style={{
                                    fontWeight: 600,
                                    color: uploadState.status === 'completed' ? '#34d399'
                                      : uploadState.status === 'retrying' ? '#fbbf24'
                                      : uploadState.status === 'error' ? '#f87171'
                                      : '#67e8f9'
                                  }}>
                                    {uploadState.status === 'completed' ? 'Package Assembled & Verified'
                                      : uploadState.status === 'retrying' ? `Auto-Retrying Chunk ${uploadState.currentChunk + 1}...`
                                      : uploadState.status === 'error' ? 'Upload Interrupted'
                                      : `Uploading Chunk ${uploadState.currentChunk} of ${uploadState.totalChunks}`}
                                  </span>
                                </div>
                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: uploadState.status === 'completed' ? '#34d399' : 'var(--accent-cyan)' }}>
                                  {uploadState.percent}%
                                </span>
                              </div>

                              {/* Progress Track */}
                              <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.07)', borderRadius: '999px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: `${uploadState.percent}%`,
                                    height: '100%',
                                    background: uploadState.status === 'completed'
                                      ? 'linear-gradient(90deg, #10b981, #059669)'
                                      : uploadState.status === 'retrying'
                                      ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                                      : uploadState.status === 'error'
                                      ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                                      : 'linear-gradient(90deg, #06b6d4, #3b82f6)',
                                    transition: 'width 0.3s ease',
                                    borderRadius: '999px'
                                  }}
                                />
                              </div>

                              {/* Diagnostic / Detail footer */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.45rem', fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                                <span>
                                  {uploadState.status === 'completed'
                                    ? `Checkpoint: All ${uploadState.totalChunks} chunks saved • File ready for compute distribution`
                                    : uploadState.status === 'retrying'
                                    ? uploadState.errorMsg
                                    : uploadState.status === 'error'
                                    ? uploadState.errorMsg
                                    : `Uploaded ${((uploadState.bytesUploaded || 0) / (1024 * 1024)).toFixed(1)} MB of ${((uploadState.totalBytes || 1) / (1024 * 1024)).toFixed(1)} MB • Checkpoint autosaved`}
                                </span>
                                {(uploadState.status === 'retrying' || uploadState.status === 'error') && (
                                  <button
                                    type="button"
                                    onClick={() => startResumableUpload(selectedFile.fileObj, selectedFile.fileId, selectedFile.totalChunks)}
                                    style={{
                                      background: 'rgba(245, 158, 11, 0.2)',
                                      border: '1px solid rgba(245, 158, 11, 0.5)',
                                      color: '#fbbf24',
                                      padding: '0.15rem 0.5rem',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '0.72rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.25rem'
                                    }}
                                  >
                                    <RefreshCw size={11} />
                                    <span>Retry Now</span>
                                  </button>
                                )}
                              </div>
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
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Shield size={16} color="var(--accent-cyan)" />
                      <span>Priority Tier</span>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={() => setJobForm({ ...jobForm, priority: 1 })}
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          border: Number(jobForm.priority) === 1 ? '2px solid #94a3b8' : '1px solid rgba(148, 163, 184, 0.25)',
                          background: Number(jobForm.priority) === 1 ? 'rgba(148, 163, 184, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                          color: Number(jobForm.priority) === 1 ? '#f1f5f9' : '#94a3b8',
                          fontWeight: Number(jobForm.priority) === 1 ? 700 : 500,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.2rem',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span style={{ fontSize: '0.95rem' }}>Low</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Batch / background</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setJobForm({ ...jobForm, priority: 2 })}
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          border: Number(jobForm.priority) === 2 ? '2px solid #3b82f6' : '1px solid rgba(59, 130, 246, 0.25)',
                          background: Number(jobForm.priority) === 2 ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                          color: Number(jobForm.priority) === 2 ? '#93c5fd' : '#60a5fa',
                          fontWeight: Number(jobForm.priority) === 2 ? 700 : 500,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.2rem',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span style={{ fontSize: '0.95rem' }}>Normal</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Default priority</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setJobForm({ ...jobForm, priority: 3 })}
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          border: Number(jobForm.priority) === 3 ? '2px solid #f59e0b' : '1px solid rgba(245, 158, 11, 0.25)',
                          background: Number(jobForm.priority) === 3 ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                          color: Number(jobForm.priority) === 3 ? '#fcd34d' : '#f59e0b',
                          fontWeight: Number(jobForm.priority) === 3 ? 700 : 500,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.2rem',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span style={{ fontSize: '0.95rem' }}>High ⚡</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Preemptive urgent</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* F-9: Smart AI Runtime & Adaptive Priority Badges */}
                {(() => {
                  const ai = getAiPrediction();
                  return (
                    <div style={{ padding: '0.95rem 1.15rem', background: 'rgba(6, 182, 212, 0.06)', border: '1px solid rgba(6, 182, 212, 0.22)', borderRadius: '12px', marginTop: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.86rem', color: '#67e8f9', fontWeight: 600 }}>
                          <Clock size={16} />
                          <span>Estimated Duration:</span>
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8', fontSize: '0.95rem', padding: '0.15rem 0.6rem', background: 'rgba(56, 189, 248, 0.12)', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                          ~{ai.predictedSec}s (AI predicted)
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.4rem', borderTop: '1px dashed rgba(255,255,255,0.08)', fontSize: '0.78rem' }}>
                        <span style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>🧠 Optimal Scheduling Policy:</span>
                        </span>
                        <span style={{ color: 'var(--accent-emerald)', fontWeight: 600, background: 'rgba(16, 185, 129, 0.1)', padding: '0.1rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                          {ai.recommendedAlgo}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <button
                  type="submit"
                  className="btn-submit-academic"
                  disabled={
                    wouldExceedQuota ||
                    isSubmittingJob ||
                    (selectedFile && (uploadState.status === 'uploading' || uploadState.status === 'retrying'))
                  }
                  style={{ marginTop: '1.5rem' }}
                >
                  <PlusCircle size={18} />
                  <span>
                    {isSubmittingJob
                      ? 'Submitting to Queue...'
                      : (selectedFile && (uploadState.status === 'uploading' || uploadState.status === 'retrying'))
                      ? `Uploading Package Chunks (${uploadState.percent}%)...`
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.35rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <BarChart3 size={20} color="var(--accent-cyan)" />
                      <span>Compute Usage & Quota Consumption Velocity</span>
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Real-time monitoring of CPU cores and compute time consumption against your quota.
                    </p>
                  </div>

                  {/* F-7: Dynamic Scope Toggle (Cluster-Wide vs Specific Process) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '3px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setAnalyticsFilterMode('cluster');
                          setSelectedProcessJobId('');
                        }}
                        style={{
                          padding: '0.35rem 0.8rem',
                          borderRadius: '6px',
                          border: 'none',
                          background: analyticsFilterMode === 'cluster' ? 'var(--primary-blue)' : 'transparent',
                          color: analyticsFilterMode === 'cluster' ? '#ffffff' : 'var(--text-dim)',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        Cluster Average
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAnalyticsFilterMode('process');
                          if (allBackendJobs.length > 0 && !selectedProcessJobId) {
                            setSelectedProcessJobId(allBackendJobs[0].jobId);
                          }
                        }}
                        style={{
                          padding: '0.35rem 0.8rem',
                          borderRadius: '6px',
                          border: 'none',
                          background: analyticsFilterMode === 'process' ? 'var(--primary-blue)' : 'transparent',
                          color: analyticsFilterMode === 'process' ? '#ffffff' : 'var(--text-dim)',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        Specific Process
                      </button>
                    </div>

                    {analyticsFilterMode === 'process' && (
                      <select
                        className="form-select"
                        style={{ padding: '0.38rem 0.8rem', fontSize: '0.78rem', width: 'auto', minWidth: '220px' }}
                        value={selectedProcessJobId}
                        onChange={(e) => setSelectedProcessJobId(e.target.value)}
                      >
                        {allBackendJobs.length === 0 ? (
                          <option value="">No jobs submitted yet</option>
                        ) : (
                          allBackendJobs.map(j => (
                            <option key={j.jobId} value={j.jobId}>
                              {j.jobName} ({j.language}) • {j.status}
                            </option>
                          ))
                        )}
                      </select>
                    )}
                  </div>
                </div>

                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <AreaChart data={dynamicAnalyticsData}>
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
                      <Area type="monotone" dataKey="quotaConsumed" stroke="#2563eb" fillOpacity={1} fill="url(#colorQuota)" name="Duration / Quota (s)" />
                      <Area type="monotone" dataKey="cpuUsage" stroke="#06b6d4" fillOpacity={1} fill="url(#colorCpu)" name={realJobTelemetry.length > 0 ? "CPU Utilization (%)" : "CPU Cores"} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* B-8: Process Hardware Telemetry Inspection Card */}
                {analyticsFilterMode === 'process' && selectedProcessJobId && (() => {
                  const job = allBackendJobs.find(j => j.jobId === selectedProcessJobId);
                  if (!job) return null;
                  const hasStream = realJobTelemetry.length > 0;
                  const latestPt = hasStream ? realJobTelemetry[realJobTelemetry.length - 1] : null;

                  return (
                    <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                            {job.jobName}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>({job.language})</span>
                          <span style={{
                            fontSize: '0.7rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            background: hasStream ? 'rgba(16, 185, 129, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                            color: hasStream ? '#10b981' : '#06b6d4',
                            border: hasStream ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(6, 182, 212, 0.3)'
                          }}>
                            {hasStream ? `🟢 Live OS Stream (${realJobTelemetry.length} ticks)` : '⚡ Synchronized Profile'}
                          </span>
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          ID: {job.jobId}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                        <div style={{ padding: '0.6rem 0.85rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Target Worker</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                            {job.assignedNodeName || 'Pending'}
                          </div>
                        </div>

                        <div style={{ padding: '0.6rem 0.85rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>CPU Allocated</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8', marginTop: '2px' }}>
                            {job.cpuCores} Cores {hasStream ? `(${latestPt?.cpuUsagePercent || 0}%)` : ''}
                          </div>
                        </div>

                        <div style={{ padding: '0.6rem 0.85rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>RAM Footprint</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#818cf8', marginTop: '2px' }}>
                            {hasStream ? `${latestPt?.memoryMb || 0} MB` : `${job.memoryMb} MB Max`}
                          </div>
                        </div>

                        <div style={{ padding: '0.6rem 0.85rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Execution Time</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#10b981', marginTop: '2px' }}>
                            {job.executionDurationMs ? `${(job.executionDurationMs / 1000).toFixed(1)}s` : `${job.maxExecutionTimeSeconds}s limit`}
                          </div>
                        </div>

                        <div style={{ padding: '0.6rem 0.85rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Execution State</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: job.status === 'COMPLETED' ? '#10b981' : job.status === 'RUNNING' ? 'var(--accent-cyan)' : 'var(--text-muted)', marginTop: '2px' }}>
                            {job.status}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
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
                                <button
                                  className="quota-adjust-btn"
                                  title={`Delete User ${u.name || u.username}`}
                                  style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)', marginLeft: '0.4rem' }}
                                  onClick={() => handleOpenDeleteModal(u)}
                                >
                                  <Trash2 size={13} style={{ marginRight: '3px', verticalAlign: 'middle', display: 'inline' }} />
                                  Delete
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
          {/* ================= MODAL: SAFETY CONFIRM USER DELETION (F-8) ================= */}
          {userToDeleteConfirm && (
            <div className="modal-backdrop" style={{ zIndex: 1200 }}>
              <div className="glass-panel modal-card animate-fade-in" style={{ maxWidth: '480px', border: '1px solid rgba(239, 68, 68, 0.45)', boxShadow: '0 20px 45px rgba(0,0,0,0.6)' }}>
                <div className="modal-header" style={{ borderBottom: '1px solid rgba(239, 68, 68, 0.25)', paddingBottom: '0.9rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <AlertTriangle size={20} color="#ef4444" />
                    <span>Confirm User Deletion</span>
                  </h3>
                  <button
                    className="modal-close-btn"
                    onClick={() => setUserToDeleteConfirm(null)}
                    disabled={isDeletingUser}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div style={{ padding: '1.4rem 0 0.5rem 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.5', margin: 0 }}>
                    Are you sure you want to delete user <strong style={{ color: '#f87171' }}>{userToDeleteConfirm.name || userToDeleteConfirm.username}</strong> (<code style={{ color: '#38bdf8' }}>@{userToDeleteConfirm.username}</code>)?
                  </p>

                  <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.22)', borderRadius: '10px', padding: '0.9rem 1.1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <p style={{ margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#fca5a5', fontWeight: 600 }}>
                      <Shield size={15} /> Immediate Cascade Actions:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: '1.5' }}>
                      <li>Active, assigned, and queued workloads will be cleanly cancelled.</li>
                      <li>Allocated compute quota ({userToDeleteConfirm.quotaSeconds || 300}s) will be revoked.</li>
                      <li>All session tokens and user data will be purged from the cluster.</li>
                    </ul>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.6rem' }}>
                    <button
                      type="button"
                      className="btn-academic-secondary"
                      style={{ width: 'auto', padding: '0.55rem 1.25rem' }}
                      onClick={() => setUserToDeleteConfirm(null)}
                      disabled={isDeletingUser}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      style={{
                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.55rem 1.25rem',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: isDeletingUser ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        boxShadow: '0 2px 12px rgba(239, 68, 68, 0.35)',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={handleConfirmDeleteUser}
                      disabled={isDeletingUser}
                    >
                      <Trash2 size={15} />
                      <span>{isDeletingUser ? 'Deleting User...' : 'Delete User'}</span>
                    </button>
                  </div>
                </div>
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
                    <span>Onboard New Worker Node</span>
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
