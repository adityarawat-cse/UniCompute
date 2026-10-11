import React, { useState, useEffect } from 'react';
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
  Power
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

export default function App() {
  const [authMode, setAuthMode] = useState('login');

  // Registered users storage
  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem('unicompute_users');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure quota fields exist
        return parsed.map(u => ({
          ...u,
          quotaSeconds: u.quotaSeconds ?? (u.username === 'aditya' ? 10000 : 300),
          usedSeconds: u.usedSeconds ?? 0
        }));
      } catch (e) {
        return [ADMIN_USER];
      }
    }
    return [ADMIN_USER];
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

  // Active navigation tab for student / admin
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'submit' | 'history' | 'users'

  // Feedback notifications
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Live Backend Stats
  const [backendStatus, setBackendStatus] = useState('Checking...');
  const [allBackendJobs, setAllBackendJobs] = useState([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);

  // Job Submission Form state
  const [jobForm, setJobForm] = useState({
    jobName: '',
    language: 'PYTHON',
    cpuCores: 2,
    memoryMb: 1024,
    storageMb: 256,
    maxExecutionTimeSeconds: 60,
    priority: 3,
    schedulingAlgorithm: 'FCFS'
  });
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

  // Fetch backend data
  useEffect(() => {
    if (currentUser) {
      fetchBackendInfo();
    }
  }, [currentUser]);

  const fetchBackendInfo = async () => {
    setIsLoadingJobs(true);
    try {
      const healthRes = await fetch('/api/health');
      if (healthRes.ok) {
        setBackendStatus('Online (Connected)');
      } else {
        setBackendStatus('Offline');
      }

      const jobsRes = await fetch('/api/jobs');
      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setAllBackendJobs(data);
      }
    } catch (err) {
      setBackendStatus('Running Local (Proxy / Standalone)');
    } finally {
      setIsLoadingJobs(false);
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

    setIsSubmittingJob(true);
    setFeedback({ type: '', message: '' });

    try {
      const payload = {
        jobName: isAdmin ? jobForm.jobName : `[${currentUser.username}] ${jobForm.jobName}`,
        language: jobForm.language,
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
          cpuCores: 2,
          memoryMb: 1024,
          storageMb: 256,
          maxExecutionTimeSeconds: 60,
          priority: 3,
          schedulingAlgorithm: 'FCFS'
        });

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
        message: 'Could not connect to backend at /api/jobs.'
      });
    } finally {
      setIsSubmittingJob(false);
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
      status: 'Available',
      token: token
    };

    setClusterNodes([...clusterNodes, newNode]);

    // Generate easy one-line auto-installer command based on OS
    let installCommand = '';
    if (newNodeOS === 'Windows') {
      installCommand = `powershell -Command "Invoke-WebRequest -Uri 'http://${window.location.hostname}:8080/downloads/unicompute-worker.zip' -OutFile 'worker.zip'; Expand-Archive 'worker.zip' -DestinationPath 'unicompute-worker'; .\\unicompute-worker\\start.bat -Token '${token}' -Node '${newNode.name}'"`;
    } else {
      installCommand = `curl -fsSL http://${window.location.hostname}:8080/downloads/install-worker.sh | bash -s -- --token "${token}" --name "${newNode.name}"`;
    }

    setGeneratedPackage({
      node: newNode,
      command: installCommand,
      token: token
    });

    setFeedback({
      type: 'success',
      message: `Node "${newNode.name}" created! Share the installation package/command with the computer.`
    });
  };

  // Admin: Toggle break / pause on node (so it can be used for personal lab work without receiving jobs)
  const handleToggleNodeBreak = (nodeId) => {
    const updated = clusterNodes.map(n => {
      if (n.id === nodeId) {
        const newStatus = n.status === 'On Break' ? 'Available' : 'On Break';
        return { ...n, status: newStatus };
      }
      return n;
    });
    setClusterNodes(updated);
    const target = clusterNodes.find(n => n.id === nodeId);
    const willBeOnBreak = target?.status !== 'On Break';
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

        <div className="nav-academic-tag">
          <span className="nav-live-dot" />
          <span>B.Tech CSE Capstone &bull; Decentralized Engine</span>
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

              <button id="btn-logout" className="btn-logout" onClick={handleLogout}>
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
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
                        <div className="metric-info-val" style={{ color: quotaRemaining < 60 ? 'var(--accent-rose)' : '#fff' }}>
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
                          <div key={j.jobId} className="node-card">
                            <div>
                              <div className="node-name">
                                <span>{j.jobName}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>({j.language})</span>
                              </div>
                              <div className="node-specs">
                                ID: {j.jobId?.slice(0, 8)}... &bull; CPU: {j.cpuCores}c &bull; RAM: {j.memoryMb}MB &bull; MaxTime: {j.maxExecutionTimeSeconds}s &bull; Priority: {j.priority}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                              <span className="status-badge-queued">{j.status}</span>
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
                      <button
                        className="admin-fill-btn"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem' }}
                        onClick={() => {
                          setGeneratedPackage(null);
                          setNewNodeName('');
                          setShowAddNodeModal(true);
                        }}
                      >
                        <PlusCircle size={14} />
                        <span>Add Worker Node</span>
                      </button>
                    </div>
                    <div className="panel-body">
                      {clusterNodes.map((node) => {
                        const isOnBreak = node.status === 'On Break';
                        const isMaster = node.id === 'node-3';

                        return (
                          <div key={node.id} className="node-card" style={{ opacity: isOnBreak ? 0.75 : 1 }}>
                            <div>
                              <div className="node-name">
                                <span
                                  className="nav-live-dot"
                                  style={{
                                    backgroundColor: isOnBreak ? 'var(--accent-amber)' : 'var(--accent-emerald)',
                                    boxShadow: isOnBreak ? '0 0 8px var(--accent-amber)' : '0 0 8px var(--accent-emerald)'
                                  }}
                                />
                                <span>{node.name}</span>
                                {isOnBreak && (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--accent-amber)', marginLeft: '0.3rem' }}>(Free for Local Use)</span>
                                )}
                              </div>
                              <div className="node-specs">
                                {node.cores} Cores &bull; {node.memoryGb} GB RAM &bull; {node.os}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span className={isOnBreak ? 'status-badge-queued' : 'status-badge-online'}>
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
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
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
                    <label className="form-label">
                      <span>Compute Workload & Script Upload</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>Accepts .py, .java, .zip, .tar, folders, binaries</span>
                    </label>

                    {/* File Dropzone */}
                    <div className="upload-dropzone">
                      <input
                        type="file"
                        id="job-file-input"
                        multiple
                        className="file-input-hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setUploadedFiles((prev) => [...prev, ...files]);
                        }}
                      />
                      <label htmlFor="job-file-input" className="dropzone-label">
                        <Upload size={30} color="var(--accent-cyan)" />
                        <div style={{ marginTop: '0.5rem', fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>
                          Click to browse or drag & drop files / folders / archives
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                          Upload single scripts, project packages, datasets, or full <code>.zip</code> bundles
                        </div>
                      </label>
                    </div>

                    {/* Uploaded Files List */}
                    {uploadedFiles.length > 0 && (
                      <div className="uploaded-files-container">
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>
                          Attached Workload Files ({uploadedFiles.length}):
                        </div>
                        <div className="uploaded-files-list">
                          {uploadedFiles.map((file, idx) => (
                            <div key={idx} className="uploaded-file-item">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {file.name.endsWith('.zip') || file.name.endsWith('.tar.gz') ? (
                                  <FolderArchive size={16} color="var(--accent-amber)" />
                                ) : (
                                  <FileCode size={16} color="var(--accent-cyan)" />
                                )}
                                <span className="file-item-name">{file.name}</span>
                                <span className="file-item-size">({(file.size / 1024).toFixed(1)} KB)</span>
                              </div>
                              <button
                                type="button"
                                className="file-remove-btn"
                                onClick={() => setUploadedFiles(uploadedFiles.filter((_, i) => i !== idx))}
                                title="Remove file"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
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
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>
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
                  <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.35rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                        contentStyle={{ backgroundColor: '#0f1624', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
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
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.35rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                            <div style={{ fontWeight: 600, color: '#fff' }}>{u.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{u.role}</div>
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{u.email}</td>
                          <td style={{ fontWeight: 600, color: '#fff' }}>{total}s</td>
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
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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

                    <div style={{ padding: '0.8rem 1rem', background: 'rgba(6, 182, 212, 0.08)', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.2)', fontSize: '0.8rem', color: '#67e8f9', marginTop: '1rem', lineHeight: 1.4 }}>
                      💡 <strong>Windows Auto-Install Mechanism:</strong> On Windows, the script uses Windows' built-in <code>winget</code> and portable embedded Python to install missing dependencies silently without prompting the user.
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
                      <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>
                        Option 2: Standalone Portable ZIP
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', background: 'rgba(10, 14, 23, 0.6)', border: '1px solid var(--border-subtle)', borderRadius: '10px' }}>
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fff' }}>unicompute-worker-{generatedPackage.node.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.zip</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Pre-configured with Node Token: <code>{generatedPackage.token}</code></div>
                        </div>
                        <button
                          type="button"
                          className="admin-fill-btn"
                          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                          onClick={() => {
                            setFeedback({ type: 'info', message: 'Downloading pre-bundled portable worker archive...' });
                          }}
                        >
                          <Download size={14} />
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
