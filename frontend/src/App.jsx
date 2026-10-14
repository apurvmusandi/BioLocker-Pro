import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  Lock,
  Unlock,
  Users,
  UserPlus,
  FileClock,
  BarChart3,
  Settings,
  LogOut,
  Radio,
  Key,
  Plus,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Server,
  Activity,
  Layers,
  ArrowRight,
  UserCheck,
  Edit2,
  Check,
  X
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { motion, AnimatePresence } from 'framer-motion';

// Register Chart.js elements
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const BACKEND_URL = 'http://localhost:3000';

// Custom Glowing BioLocker Logo (Using the png logo in the public folder)
const BioLockerLogo = ({ className = "h-8 w-auto" }) => (
  <div className="relative flex items-center justify-center">
    <img src="/bitlocker pro logo.png" className={className} alt="BioLocker Pro Logo" />
  </div>
);

export default function App() {
  // App navigation state: 'landing' | 'vault-animation' | 'dashboard'
  const [view, setView] = useState('landing');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSpecsModal, setShowSpecsModal] = useState(false);
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Vault animation state
  const [vaultUnlocked, setVaultUnlocked] = useState(false);

  // Authenticated user state
  const [currentUser, setCurrentUser] = useState(null);

  // Sidebar Tab state
  const [activeTab, setActiveTab] = useState('dashboard');

  // Real-time system states
  const [hardwareStatus, setHardwareStatus] = useState({ online: false, ip: null });
  const [lockers, setLockers] = useState([]);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [analytics, setAnalytics] = useState({
    dailyAccess: [],
    peakHours: [],
    overallStats: []
  });

  // Fingerprint Enrollment form state
  const [enrollUserId, setEnrollUserId] = useState('');
  const [enrollFingerId, setEnrollFingerId] = useState('');
  const [enrollLabel, setEnrollLabel] = useState('');
  const [enrollStatus, setEnrollStatus] = useState(null); // { success, message, step }
  const [isEnrolling, setIsEnrolling] = useState(false);

  // Fingerprint editing (inline rename/delete) states
  const [renamingFpId, setRenamingFpId] = useState(null);
  const [renamingLabel, setRenamingLabel] = useState('');
  const [isDeletingFp, setIsDeletingFp] = useState(null);

  // User creation form state
  const [newUser, setNewUser] = useState({ name: '', role: 'Staff', pin: '', locker_id: 1 });

  // Inventory form state
  const [newItem, setNewItem] = useState({ item_name: '', quantity: 1, status: 'In Stock' });

  // Socket client reference
  const socketRef = useRef(null);

  // Clock state
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Connect to Socket.IO and fetch initial data
  useEffect(() => {
    socketRef.current = io(BACKEND_URL);

    socketRef.current.on('connect', () => {
      console.log('Connected to backend Socket.IO server');
    });

    socketRef.current.on('hardware_status', (status) => {
      setHardwareStatus(status);
    });

    socketRef.current.on('locker_status', (data) => {
      setLockers((prev) =>
        prev.map((l) => (l.id === data.id ? { ...l, status: data.status } : l))
      );
    });

    socketRef.current.on('access_log', (newLog) => {
      setLogs((prev) => [newLog, ...prev]);
      fetchAnalytics();
    });

    socketRef.current.on('enroll_status', (status) => {
      setEnrollStatus(status);
      if (status.success !== undefined) {
        setIsEnrolling(false);
        setEnrollFingerId('');
        setEnrollLabel('');
        fetchUsers(); // Refresh users list
      }
    });

    socketRef.current.on('users_list_update', (updatedUsers) => {
      setUsers(updatedUsers);
    });

    socketRef.current.on('inventory_update', (items) => {
      setInventory(items);
    });

    // Initial API fetches
    fetchUsers();
    fetchLogs();
    fetchInventory();
    fetchAnalytics();
    fetchLockers();

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/users`);
      if (res.ok) setUsers(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/logs`);
      if (res.ok) setLogs(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/inventory`);
      if (res.ok) setInventory(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/analytics`);
      if (res.ok) setAnalytics(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchLockers = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/lockers`);
      if (res.ok) setLockers(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: loginPin })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentUser(data.user);
        setShowLoginModal(false);
        
        // Start Vault Unlock animation
        setView('vault-animation');
        setVaultUnlocked(false);

        // 1. Dial spins and bolts prepare (2.5s delay)
        setTimeout(() => {
          setVaultUnlocked(true);
          
          // 2. Open split doors, transition to dashboard after 2.5s door opening
          setTimeout(() => {
            setView('dashboard');
            setLoginPin('');
            setVaultUnlocked(false);
          }, 2500);
        }, 2500);

      } else {
        setLoginError(data.error || 'Authentication Failed');
      }
    } catch (err) {
      setLoginError('Could not connect to authentication server');
    } finally {
      setLoading(false);
    }
  };

  const triggerRemoteUnlock = async (lockerId) => {
    const targetId = lockerId || 1;
    if (!hardwareStatus.online) {
      alert('Solenoid Controller unit is offline. Cannot send remote command.');
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/lockers/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockerId: targetId })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Unlock command failed');
      }
    } catch (e) {
      alert('Error triggering remote unlock');
    }
  };

  const startEnrollment = async (e) => {
    e.preventDefault();
    if (!enrollUserId || !enrollFingerId || !enrollLabel) {
      alert('Please fill out all enrollment fields');
      return;
    }
    if (!hardwareStatus.online) {
      alert('ESP32 device must be online to initiate fingerprint enrollment');
      return;
    }

    const occupiedSlots = users.flatMap(u => u.fingerprints || []).map(f => f.id);
    if (occupiedSlots.includes(parseInt(enrollFingerId))) {
      alert(`Hardware biometric slot #${enrollFingerId} is currently occupied! Rename or delete the existing fingerprint template, or select an empty slot.`);
      return;
    }

    setIsEnrolling(true);
    setEnrollStatus({ message: 'Initiating connection to hardware...', step: 0 });

    try {
      const res = await fetch(`${BACKEND_URL}/api/lockers/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: parseInt(enrollUserId),
          fingerId: parseInt(enrollFingerId),
          label: enrollLabel
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setIsEnrolling(false);
        setEnrollStatus({ success: false, message: data.error || 'Failed to start enrollment' });
      }
    } catch (err) {
      setIsEnrolling(false);
      setEnrollStatus({ success: false, message: 'Could not contact backend server.' });
    }
  };

  // Renaming Fingerprint Label
  const handleRenameFp = async (fpId) => {
    if (!renamingLabel.trim()) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/fingerprints/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: fpId, label: renamingLabel })
      });
      if (res.ok) {
        setRenamingFpId(null);
        setRenamingLabel('');
        fetchUsers();
      } else {
        alert('Rename request failed on server');
      }
    } catch (e) {
      alert('Server communication error');
    }
  };

  // Deleting Fingerprint from Hardware and DB
  const handleDeleteFp = async (fpId) => {
    const confirmationText = hardwareStatus.online
      ? 'Are you sure you want to delete this fingerprint template? It will be deleted from the R307 sensor storage and SQLite database.'
      : 'WARNING: Biometric hardware is OFFLINE. Deleting will remove it from the web database, but you must clear slot ID from the sensor manually later. Proceed?';
    
    if (!confirm(confirmationText)) return;
    
    setIsDeletingFp(fpId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/fingerprints/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: fpId })
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to delete fingerprint template');
      }
    } catch (e) {
      alert('Server connection error during deletion');
    } finally {
      setIsDeletingFp(null);
    }
  };

  const createNewUser = async (e) => {
    e.preventDefault();
    if (!newUser.name || !newUser.pin) {
      alert('Please enter Name and security PIN');
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUser.name,
          role: newUser.role,
          pin: newUser.pin,
          lockerId: parseInt(newUser.locker_id) || 1
        })
      });
      if (res.ok) {
        alert('User profile created successfully!');
        setNewUser({ name: '', role: 'Staff', pin: '', locker_id: 1 });
        fetchUsers();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to create user');
      }
    } catch (err) {
      alert('Server communication error');
    }
  };

  const addInventoryItem = async (e) => {
    e.preventDefault();
    if (!newItem.item_name || newItem.quantity < 0) {
      alert('Invalid item specifications');
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
      if (res.ok) {
        setNewItem({ item_name: '', quantity: 1, status: 'In Stock' });
        fetchInventory();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to add item');
      }
    } catch (err) {
      alert('Server error');
    }
  };
//currentUser?.name || 
  const updateItemQty = async (item, change) => {
    const newQty = item.quantity + change;
    if (newQty < 0) return;
    const newStatus = newQty === 0 ? 'Out of Stock' : (newQty < 3 ? 'Low Stock' : 'In Stock');
    try {
      const res = await fetch(`${BACKEND_URL}/api/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          item_name: item.item_name,
          quantity: newQty,
          status: newStatus
        })
      });
      if (res.ok) {
        fetchInventory();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Get active occupied slots mapping
  const occupiedSlots = users.flatMap(u => u.fingerprints || []).map(f => f.id);

  // Process data for charts
  const getWeeklyChartData = () => {
    const mockDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const mockGrants = [12, 19, 15, 8, 22, 14, 18];
    const mockDenies = [2, 4, 1, 0, 3, 2, 1];

    if (!analytics.dailyAccess || analytics.dailyAccess.length === 0) {
      return {
        labels: mockDays,
        datasets: [
          {
            label: 'Grants',
            data: mockGrants,
            borderColor: '#00f5a0',
            backgroundColor: 'rgba(0, 245, 160, 0.1)',
            fill: true,
            tension: 0.4
          },
          {
            label: 'Denied',
            data: mockDenies,
            borderColor: '#f43f5e',
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            fill: true,
            tension: 0.4
          }
        ]
      };
    }

    const labels = analytics.dailyAccess.map(d => {
      const date = new Date(d.day);
      return date.toLocaleDateString(undefined, { weekday: 'short' });
    });
    const grants = analytics.dailyAccess.map(d => d.granted);
    const denies = analytics.dailyAccess.map(d => d.denied);

    return {
      labels,
      datasets: [
        {
          label: 'Access Granted',
          data: grants,
          borderColor: '#00f5a0',
          backgroundColor: 'rgba(0, 245, 160, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Access Denied',
          data: denies,
          borderColor: '#f43f5e',
          backgroundColor: 'rgba(244, 63, 94, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    };
  };

  const getDoughnutChartData = () => {
    let grants = 0;
    let denies = 0;

    if (analytics.overallStats && analytics.overallStats.length > 0) {
      analytics.overallStats.forEach(s => {
        if (s.action === 'Granted') grants = s.count;
        if (s.action === 'Denied') denies = s.count;
      });
    } else {
      grants = 108;
      denies = 13;
    }

    return {
      labels: ['Granted', 'Denied'],
      datasets: [
        {
          data: [grants, denies],
          backgroundColor: ['#00f5a0', '#f43f5e'],
          borderColor: ['rgba(0, 255, 160, 0.2)', 'rgba(244, 63, 94, 0.2)'],
          hoverOffset: 4
        }
      ]
    };
  };

  const getBarChartData = () => {
    const mockHours = ['09:00', '10:00', '12:00', '14:00', '17:00'];
    const mockCounts = [24, 38, 15, 30, 42];

    if (!analytics.peakHours || analytics.peakHours.length === 0) {
      return {
        labels: mockHours,
        datasets: [
          {
            label: 'Access Logs',
            data: mockCounts,
            backgroundColor: '#00f2fe',
            borderWidth: 0,
            borderRadius: 6
          }
        ]
      };
    }

    const labels = analytics.peakHours.map(p => `${p.hour}:00`);
    const counts = analytics.peakHours.map(p => p.count);

    return {
      labels,
      datasets: [
        {
          label: 'Logs Recorded',
          data: counts,
          backgroundColor: '#00f2fe',
          borderWidth: 0,
          borderRadius: 6
        }
      ]
    };
  };

  return (
    <div className="relative min-h-screen text-slate-100 flex flex-col font-sans overflow-hidden bg-[#030303]">
      
      {/* BACKGROUND VIDEO (Looping hero.mp4 with custom bright visibility and soft vignette overlay) */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className={`w-full h-full object-cover transition-all duration-1000 ${
            view === 'landing' ? 'opacity-70 scale-100 filter blur-[1px]' : 'opacity-[0.08] scale-105 filter blur-[6px]'
          }`}
        >
          <source src="/hero.mp4" type="video/mp4" />
        </video>
        {/* Soft Vignette Overlay - reduced bottom/overall dark layers for clear video visibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#030305]/40 via-transparent to-[#030305]/60 opacity-80 pointer-events-none"></div>
      </div>

      {/* VIEW 1: LANDING PAGE */}
      {view === 'landing' && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-start px-4 max-w-6xl mx-auto w-full pt-24 pb-16 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center w-full min-h-[82vh] flex flex-col justify-center items-center pb-12"
          >
            {/* Status Orb Indicator */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-cyber-accent/30 bg-cyber-accent/5 backdrop-blur-md mb-8">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyber-accent"></span>
              </span>
              <span className="text-[10px] uppercase tracking-widest font-bold text-cyber-accent font-sans">
                OFFLINE BIOMETRIC SHIELD ACTUATOR
              </span>
            </div>

            {/* Glowing System Title */}
            <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight text-white mb-6">
              BioLocker <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyber-accent to-cyber-emerald neon-text-glow">Pro</span>
            </h1>
            
            <p className="text-base md:text-lg text-slate-350 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
              Local Intelligent Access Management Console for ESP32. Fully offline biometric equipment authorization, database audit logs, inventory control, and real-time physical relays.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowLoginModal(true)}
                className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-cyber-accent to-cyber-emerald text-cyber-dark font-extrabold rounded-lg shadow-lg shadow-cyber-accent/25 hover:shadow-cyber-emerald/40 transition-all duration-300 flex items-center justify-center gap-2 group"
              >
                Enter System
                <ArrowRight className="h-4.5 w-4.5 transform group-hover:translate-x-1 transition-transform" />
              </motion.button>
              
              <button
                onClick={() => setShowSpecsModal(true)}
                className="w-full sm:w-auto px-8 py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white font-semibold rounded-lg backdrop-blur-md transition-all duration-300"
              >
                Technical Spec
              </button>
            </div>
          </motion.div>

          {/* LANDING PAGE ADDITIONAL CONTENT: FEATURES, USAGE, TEAM & GUIDE */}
          <div className="w-full mt-24 space-y-20 border-t border-white/5 pt-16 text-left">
            
            {/* Features Section */}
            <div>
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Radio className="h-5 w-5 text-cyber-accent animate-pulse" />
                Key Features
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-xl border border-white/5 hover:border-cyber-accent/30 transition-all">
                  <h4 className="font-bold text-white text-base">Biometric Credentials</h4>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Secure optical R307 scanner template matching. Fully handles offline biometric reads, authorizations, and board triggers under 1.2s.
                  </p>
                </div>
                <div className="glass-card p-6 rounded-xl border border-white/5 hover:border-cyber-emerald/30 transition-all">
                  <h4 className="font-bold text-white text-base">Multi-Locker Mapping</h4>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Each user is associated with their own locker space (Lockers 1-5). Dashboard tracks individual lockers while triggering a single solenoid relay lock.
                  </p>
                </div>
                <div className="glass-card p-6 rounded-xl border border-white/5 hover:border-cyber-accent/30 transition-all">
                  <h4 className="font-bold text-white text-base">Real-time Stream</h4>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Socket.IO socket connection pushes instant scan statuses, logs, inventory updates, and live telemetry heartbeats.
                  </p>
                </div>
              </div>
            </div>

            {/* Operating Guide & Project Team details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-4">
              
              {/* Instructions */}
              <div>
                <h3 className="text-2xl font-bold text-white mb-6">Operating Instructions</h3>
                <ol className="space-y-4 text-xs text-slate-400 font-medium">
                  <li className="flex gap-3">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-cyber-accent/10 border border-cyber-accent/30 flex items-center justify-center font-bold text-cyber-accent">1</span>
                    <span className="leading-relaxed">Connect ESP32 Lock to laptop hotspot network SSID <code className="text-white bg-white/5 px-1.5 py-0.5 rounded font-mono text-[10px]">Apurv</code> with security WPA2 key <code className="text-white bg-white/5 px-1.5 py-0.5 rounded font-mono text-[10px]">12345678</code>.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-cyber-accent/10 border border-cyber-accent/30 flex items-center justify-center font-bold text-cyber-accent">2</span>
                    <span className="leading-relaxed">Launch the backend server. The ESP32 will automatically connect, pinging heartbeats to register as Online.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-cyber-accent/10 border border-cyber-accent/30 flex items-center justify-center font-bold text-cyber-accent">3</span>
                    <span className="leading-relaxed">Access the dashboard to assign users a specific Locker number and manage biometric IDs (1-127) using the visual hardware grid.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-cyber-accent/10 border border-cyber-accent/30 flex items-center justify-center font-bold text-cyber-accent">4</span>
                    <span className="leading-relaxed">Trigger remote unlocks for users or scan fingers. The console logs operations instantly to keep records synchronized.</span>
                  </li>
                </ol>
              </div>

              {/* Mentorship & Project Guide Info */}
              <div className="glass-panel p-6 md:p-8 rounded-2xl border border-white/5 space-y-6">
                <div>
                  <span className="text-[10px] text-cyber-emerald uppercase tracking-widest font-extrabold font-mono block">Academic Project Guide</span>
                  <h4 className="text-lg font-bold text-white mt-1">Mrs. M. T. Naik</h4>
                  <p className="text-xs text-slate-400 font-medium mt-1">Department of Computer Science & Engineering, SITCOE.</p>
                </div>
                
                <div className="border-t border-white/5 pt-5 space-y-3">
                  <span className="text-[10px] text-cyber-accent uppercase tracking-widest font-extrabold font-mono block">Project Team Members (CSE Batch 2027)</span>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs font-semibold text-slate-350">
                    <div>1. Piyush Munje</div>
                    <div>2. Swapnil Koli</div>
                    <div>3. Zaheer Mujawar</div>
                    <div>4. Aman Nadaf</div>
                  </div>
                </div>
              </div>

            </div>

            {/* LANDING FOOTER */}
            <div className="border-t border-white/5 pt-10 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 gap-4">
              <p>© 2026 BioLocker Pro. All rights reserved.</p>
              <p>Prototype engineered by SITians CSE Batch 2027.</p>
            </div>

          </div>

          {/* ADMIN LOGIN MODAL */}
          <AnimatePresence>
            {showLoginModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full max-w-md glass-panel p-8 rounded-2xl relative shadow-2xl"
                >
                  <div className="text-center mb-6">
                    <div className="mx-auto w-12 h-12 bg-cyber-accent/10 border border-cyber-accent/30 rounded-xl flex items-center justify-center mb-3">
                      <Key className="h-6 w-6 text-cyber-accent" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">Administrator Access</h3>
                    <p className="text-sm text-slate-400 mt-1">Input security authorization PIN</p>
                  </div>

                  <form onSubmit={handleLoginSubmit} className="space-y-5">
                    <div>
                      <input
                        type="password"
                        placeholder="••••"
                        maxLength={6}
                        value={loginPin}
                        onChange={(e) => setLoginPin(e.target.value)}
                        className="w-full text-center text-3xl tracking-[0.8em] font-semibold text-white bg-white/5 border border-white/10 rounded-xl py-3 focus:outline-none focus:border-cyber-accent focus:ring-1 focus:ring-cyber-accent transition-all"
                        required
                        autoFocus
                      />
                    </div>

                    {loginError && (
                      <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>{loginError}</span>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowLoginModal(false);
                          setLoginPin('');
                          setLoginError('');
                        }}
                        className="flex-1 py-3 border border-white/10 rounded-lg text-slate-350 hover:bg-white/5 transition-colors font-semibold text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 py-3 bg-gradient-to-r from-cyber-accent to-cyber-emerald text-cyber-dark font-extrabold rounded-lg shadow-md hover:shadow-cyber-accent/20 transition-all text-sm flex items-center justify-center"
                      >
                        {loading ? 'Verifying...' : 'Sign In'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* TECHNICAL SPECIFICATIONS MODAL */}
          <AnimatePresence>
            {showSpecsModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/85 backdrop-blur-md overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full max-w-2xl glass-panel p-8 rounded-2xl relative shadow-2xl space-y-6 my-8"
                >
                  <div className="flex justify-between items-center border-b border-white/10 pb-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <BioLockerLogo className="h-6 w-6 text-cyber-accent" />
                      Technical Specifications
                    </h3>
                    <button
                      onClick={() => setShowSpecsModal(false)}
                      className="text-slate-400 hover:text-white p-1 hover:bg-white/5 rounded transition-colors text-xs font-semibold"
                    >
                      Close [X]
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs text-slate-300">
                    <div className="space-y-4">
                      <h4 className="text-xs font-extrabold text-cyber-accent border-b border-cyber-accent/20 pb-1 uppercase tracking-wider">Hardware Components</h4>
                      <ul className="space-y-2.5 list-disc list-inside">
                        <li><strong className="text-white">ESP32 DevKit V1:</strong> Main controller. Coordinates Wi-Fi client, local server on Port 80, hardware serial, and relays.</li>
                        <li><strong className="text-white">R307 Optical Sensor:</strong> Biometric core. Handles scanning, template verification and matches templates offline.</li>
                        <li><strong className="text-white">I2C LCD 16x2 Display:</strong> Prints real-time statuses (Wi-Fi pings, user access, scanner enrollments).</li>
                        <li><strong className="text-white">Relays & Solenoid Lock:</strong> Solenoid physical lock gate powered by relay pins.</li>
                        <li><strong className="text-white">Buzzer & LEDs:</strong> Feedback for authorized (green LED) and denied (red LED) users.</li>
                      </ul>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-extrabold text-cyber-accent border-b border-cyber-accent/20 pb-1 uppercase tracking-wider">Pin connections Map</h4>
                      <div className="bg-black/50 p-4 rounded-xl border border-white/5 space-y-2.5 font-mono text-[10.5px]">
                        <div className="flex justify-between border-b border-white/3 pb-1"><span>ESP32 Pin 16 (RX2)</span><span>➔ R307 TX Pin</span></div>
                        <div className="flex justify-between border-b border-white/3 pb-1"><span>ESP32 Pin 17 (TX2)</span><span>➔ R307 RX Pin</span></div>
                        <div className="flex justify-between border-b border-white/3 pb-1"><span>ESP32 Pin 4 (Relay)</span><span>➔ Solenoid Relay</span></div>
                        <div className="flex justify-between border-b border-white/3 pb-1"><span>ESP32 Pin 13 (Buzzer)</span><span>➔ Piezo Buzzer</span></div>
                        <div className="flex justify-between border-b border-white/3 pb-1"><span>ESP32 Pin 18 (Green)</span><span>➔ Authorized LED</span></div>
                        <div className="flex justify-between border-b border-white/3 pb-1"><span>ESP32 Pin 19 (Red)</span><span>➔ Denied LED</span></div>
                        <div className="flex justify-between"><span>ESP32 I2C (SDA 21/SCL 22)</span><span>➔ 16x2 LCD SDA/SCL</span></div>
                      </div>
                      <h4 className="text-xs font-extrabold text-cyber-accent border-b border-cyber-accent/20 pb-1 uppercase tracking-wider mt-4">Software Architecture</h4>
                      <ul className="space-y-1 text-[11px]">
                        <li>• <strong className="text-white">React 18 & Vite:</strong> Framer Motion page flows.</li>
                        <li>• <strong className="text-white">Node / Express Server:</strong> SQLite better-sqlite3 engine.</li>
                        <li>• <strong className="text-white">Client / Sockets:</strong> Socket.IO real-time data events.</li>
                      </ul>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* VIEW 2: CINEMATIC BANK VAULT UNLOCKING ANIMATION (RE-DESIGNED) */}
      {view === 'vault-animation' && (
        <div className="fixed inset-0 z-50 bg-[#040407] flex items-center justify-center overflow-hidden">
          
          {/* VAULT DOOR LEFT STEEL HALF */}
          <motion.div
            initial={{ x: "0%" }}
            animate={{ x: vaultUnlocked ? "-100%" : "0%" }}
            transition={{ duration: 2.0, ease: [0.77, 0, 0.175, 1] }}
            className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-slate-950 to-slate-900 border-r border-white/10 z-40 flex items-center justify-end"
          >
            <div className="w-full h-full opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] absolute inset-0" />
            {/* Rivets */}
            <div className="absolute right-4 top-4 w-3.5 h-3.5 rounded-full bg-black/60 border border-white/10 shadow-inner" />
            <div className="absolute right-4 bottom-4 w-3.5 h-3.5 rounded-full bg-black/60 border border-white/10 shadow-inner" />
            <div className="w-8 h-full border-r border-white/5 mr-8 opacity-25" />
          </motion.div>

          {/* VAULT DOOR RIGHT STEEL HALF */}
          <motion.div
            initial={{ x: "0%" }}
            animate={{ x: vaultUnlocked ? "100%" : "0%" }}
            transition={{ duration: 2.0, ease: [0.77, 0, 0.175, 1] }}
            className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-slate-950 to-slate-900 border-l border-white/10 z-40 flex items-center justify-start"
          >
            <div className="w-full h-full opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] absolute inset-0" />
            {/* Rivets */}
            <div className="absolute left-4 top-4 w-3.5 h-3.5 rounded-full bg-black/60 border border-white/10 shadow-inner" />
            <div className="absolute left-4 bottom-4 w-3.5 h-3.5 rounded-full bg-black/60 border border-white/10 shadow-inner" />
            <div className="w-8 h-full border-l border-white/5 ml-8 opacity-25" />
          </motion.div>

          {/* VAULT CENTER CONTROL UNIT (Fades and scales out when unlocked) */}
          <motion.div
            initial={{ opacity: 1, scale: 1 }}
            animate={{ opacity: vaultUnlocked ? 0 : 1, scale: vaultUnlocked ? 0.75 : 1 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="relative z-50 flex flex-col items-center justify-center px-4"
          >
            {/* Heavy Vault Ring */}
            <div className="w-[360px] h-[360px] md:w-[440px] md:h-[440px] border-[5px] border-slate-700/50 rounded-full flex items-center justify-center bg-slate-950/80 backdrop-blur-md shadow-2xl relative">
              
              {/* Outer Dashed Rotating Gear */}
              <motion.div
                animate={{ rotate: vaultUnlocked ? 360 : 0 }}
                transition={{ duration: 2.5, ease: "easeInOut" }}
                className="absolute inset-1.5 border-[6px] border-dashed border-slate-650/40 rounded-full"
              />

              {/* Red/Green Status Indicator Light */}
              <div className="absolute top-6 flex gap-1.5 bg-black/60 px-3.5 py-1 rounded-full border border-white/10 shadow-inner">
                <span className={`w-2.5 h-2.5 rounded-full shadow-lg transition-all duration-300 ${vaultUnlocked ? 'bg-cyber-emerald shadow-[0_0_12px_#00f5a0]' : 'bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse'}`}></span>
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/20"></span>
              </div>

              {/* Side Locking Bolts */}
              <motion.div
                animate={{ x: vaultUnlocked ? -40 : 0 }}
                transition={{ duration: 1.0, ease: "easeOut" }}
                className="absolute left-[-24px] w-16 h-10 bg-gradient-to-r from-slate-800 to-slate-900 border border-white/10 rounded-r shadow-lg flex items-center justify-end pr-1"
              >
                <div className="w-2 h-6 bg-slate-500 rounded" />
              </motion.div>

              <motion.div
                animate={{ x: vaultUnlocked ? 40 : 0 }}
                transition={{ duration: 1.0, ease: "easeOut" }}
                className="absolute right-[-24px] w-16 h-10 bg-gradient-to-l from-slate-800 to-slate-900 border border-white/10 rounded-l shadow-lg flex items-center justify-start pl-1"
              >
                <div className="w-2 h-6 bg-slate-500 rounded" />
              </motion.div>

              {/* Main Rotating Dial */}
              <motion.div
                animate={{ rotate: vaultUnlocked ? -180 : 0 }}
                transition={{ duration: 2.5, ease: "easeInOut" }}
                className="w-56 h-56 md:w-64 md:h-64 rounded-full bg-gradient-to-tr from-slate-850 to-slate-750 border-[5px] border-slate-650 shadow-2xl flex items-center justify-center relative"
              >
                {/* Dial Wheel Spokes */}
                <div className="w-3.5 h-full bg-slate-800/80 absolute transform rotate-0" />
                <div className="w-3.5 h-full bg-slate-800/80 absolute transform rotate-45" />
                <div className="w-3.5 h-full bg-slate-800/80 absolute transform rotate-90" />
                <div className="w-3.5 h-full bg-slate-800/80 absolute transform rotate-135" />

                {/* Dial Hub */}
                <div className="w-24 h-24 rounded-full bg-slate-950 border-4 border-slate-600 flex items-center justify-center z-10 shadow-lg relative">
                  <div className="absolute inset-1 border border-white/5 rounded-full" />
                  {!vaultUnlocked ? (
                    <Lock className="h-6 w-6 text-red-500 animate-pulse" />
                  ) : (
                    <Unlock className="h-6 w-6 text-cyber-emerald neon-text-glow-emerald" />
                  )}
                </div>
              </motion.div>
            </div>

            {/* Description Text */}
            <div className="text-center mt-8 space-y-1">
              <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-slate-500">Pneumatic Locking Shield</p>
              <h4 className="text-sm font-bold text-white font-mono min-h-5">
                {vaultUnlocked ? 'VAULT UNLOCKED - REDIRECTING...' : 'VERIFYING SYSTEM CONTROLLER KEY...'}
              </h4>
            </div>
          </motion.div>

        </div>
      )}

      {/* VIEW 3: MAIN ADMIN DASHBOARD */}
      {view === 'dashboard' && (
        <div className="relative z-10 flex-1 flex flex-col md:flex-row h-screen overflow-hidden">
          
          {/* SIDEBAR NAVIGATION */}
          <aside className="w-full md:w-64 bg-slate-950/70 border-b md:border-b-0 md:border-r border-white/5 backdrop-blur-lg flex flex-col h-auto md:h-full z-20">
            <div className="p-6 flex items-center gap-3 border-b border-white/5">
              <BioLockerLogo className="h-9 w-auto" />
              <div>
                <h2 className="text-lg font-extrabold text-white leading-none">BioLocker Pro</h2>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">SITCOE Console</span>
              </div>
            </div>

            <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: Layers },
                { id: 'lockers', label: 'Locker Control', icon: Lock },
                { id: 'users', label: 'User Management', icon: Users },
                { id: 'logs', label: 'Access Logs', icon: FileClock },
                { id: 'analytics', label: 'System Analytics', icon: BarChart3 },
                { id: 'settings', label: 'Configuration', icon: Settings },
              ].map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                      active
                        ? 'bg-gradient-to-r from-cyber-accent/15 to-cyber-emerald/5 border-l-4 border-cyber-accent text-white shadow-inner shadow-cyber-accent/5'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className={`h-4.5 w-4.5 ${active ? 'text-cyber-accent' : ''}`} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-white/5">
              <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-8 h-8 rounded-full bg-cyber-accent/10 border border-cyber-accent/30 flex items-center justify-center font-bold text-cyber-accent">
                  {currentUser?.name?.charAt(0) || 'A'}
                </div>
                <div className="overflow-hidden">
                  <h4 className="text-xs font-bold text-white truncate">{'Piush Munje'}</h4>
                  <span className="text-[10px] text-cyber-emerald font-semibold uppercase tracking-wider block">{currentUser?.role || 'Super Admin'}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setCurrentUser(null);
                  setView('landing');
                }}
                className="w-full flex items-center justify-center gap-2 py-2 border border-red-500/20 text-red-400 hover:bg-red-500/5 hover:border-red-500/30 rounded-lg text-sm font-medium transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </aside>

          {/* MAIN WORKSPACE CONTENT */}
          <main className="flex-1 flex flex-col h-full overflow-hidden bg-gradient-to-b from-slate-950 to-slate-900/50">
            
            {/* WORKSPACE HEADER */}
            <header className="px-8 py-5 border-b border-white/5 bg-slate-950/20 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 z-10 shrink-0">
              <div>
                <h1 className="text-xl font-bold text-white capitalize leading-tight">
                  {activeTab.replace('-', ' ')}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Local system timestamp: {currentTime.toLocaleTimeString()} — {currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>

              {/* Status Modules */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/3 border border-white/5">
                  <Radio className={`h-4.5 w-4.5 ${hardwareStatus.online ? 'text-cyber-emerald animate-pulse' : 'text-red-500'}`} />
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-medium">Biometric Board</span>
                    <span className={`text-xs font-bold ${hardwareStatus.online ? 'text-cyber-emerald' : 'text-red-500'}`}>
                      {hardwareStatus.online ? `ONLINE (${hardwareStatus.ip})` : 'OFFLINE'}
                    </span>
                  </div>
                </div>
              </div>
            </header>

            {/* TAB CONTENT HOUSING */}
            <div className="flex-1 overflow-y-auto p-8">

              {/* TAB 1: OVERVIEW DASHBOARD */}
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-cyber-accent/5 rounded-bl-full pointer-events-none group-hover:bg-cyber-accent/10 transition-colors" />
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">User Registry</span>
                      <h3 className="text-3xl font-extrabold text-white mt-2 font-mono">{users.length}</h3>
                      <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5 text-cyber-emerald" />
                        Credentials database safe
                      </p>
                    </div>

                    <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-cyber-emerald/5 rounded-bl-full pointer-events-none" />
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Total Lockers</span>
                      <h3 className="text-3xl font-extrabold mt-2 font-mono text-cyber-emerald">
                        {lockers.length || 5}
                      </h3>
                      <p className="text-xs text-slate-400 mt-2">
                        Mapped to individual spaces
                      </p>
                    </div>

                    <div className="glass-card p-6 rounded-2xl relative overflow-hidden">
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Grants (Today)</span>
                      <h3 className="text-3xl font-extrabold text-white mt-2 font-mono">
                        {logs.filter(l => l.action === 'Granted' && new Date(l.timestamp).toDateString() === new Date().toDateString()).length}
                      </h3>
                      <p className="text-xs text-cyber-emerald mt-2 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Authorized entry points
                      </p>
                    </div>

                    <div className="glass-card p-6 rounded-2xl relative overflow-hidden">
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Denials (Today)</span>
                      <h3 className="text-3xl font-extrabold text-white mt-2 font-mono">
                        {logs.filter(l => l.action === 'Denied' && new Date(l.timestamp).toDateString() === new Date().toDateString()).length}
                      </h3>
                      <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Intrusion events logged
                      </p>
                    </div>
                  </div>

                  {/* Lockers Overview Grid */}
                  <div className="space-y-4">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Server className="h-4.5 w-4.5 text-cyber-accent" />
                      Individual Locker Compartments Status
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                      {lockers.map((locker) => (
                        <div key={locker.id} className="glass-card p-4 rounded-xl flex flex-col justify-between space-y-4 border border-white/5">
                          <div>
                            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-mono">Locker #{locker.id}</span>
                            <h4 className="text-xs font-bold text-white truncate mt-0.5">{locker.name.split(' - ')[0]}</h4>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-bold uppercase ${locker.status === 'Unlocked' ? 'text-cyber-emerald neon-text-glow-emerald' : 'text-red-500'}`}>
                              {locker.status}
                            </span>
                            {locker.status === 'Unlocked' ? (
                              <Unlock className="h-4 w-4 text-cyber-emerald" />
                            ) : (
                              <Lock className="h-4 w-4 text-red-500" />
                            )}
                          </div>

                          <button
                            onClick={() => triggerRemoteUnlock(locker.id)}
                            disabled={!hardwareStatus.online}
                            className={`w-full py-1.5 rounded text-[10px] font-bold transition-colors ${
                              hardwareStatus.online
                                ? 'bg-cyber-accent/10 border border-cyber-accent/20 text-cyber-accent hover:bg-cyber-accent/20'
                                : 'bg-slate-900 border border-white/3 text-slate-650 cursor-not-allowed'
                            }`}
                          >
                            Trigger Unlock
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dashboard Panels Split */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Live Access Feed */}
                    <div className="lg:col-span-2 glass-panel p-6 rounded-2xl flex flex-col h-[400px]">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <Activity className="h-4.5 w-4.5 text-cyber-accent animate-pulse" />
                          Live Authentication Stream
                        </h3>
                        <span className="text-[10px] px-2 py-1 rounded bg-cyber-accent/10 border border-cyber-accent/20 text-cyber-accent uppercase tracking-widest font-mono">Socket.IO</span>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar">
                        {logs.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-slate-600">
                            <FileClock className="h-8 w-8 mb-2" />
                            <p className="text-sm">No activity recorded yet</p>
                          </div>
                        ) : (
                          logs.map((log) => (
                            <div key={log.id} className="p-3.5 rounded-xl bg-white/3 border border-white/5 flex items-center justify-between hover:bg-white/5 transition-colors">
                              <div className="flex items-center gap-3 font-medium">
                                <div className={`w-2.5 h-2.5 rounded-full ${log.action === 'Granted' ? 'bg-cyber-emerald shadow-[0_0_8px_#00f5a0]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`}></div>
                                <div>
                                  <h4 className="text-sm font-bold text-white">
                                    {log.action === 'Granted' ? (log.userName || 'Authorized Entry') : 'Access Denied / Unknown ID'}
                                  </h4>
                                  <span className="text-[10px] text-slate-500">
                                    {log.userRole || 'External Entity'} • {new Date(log.timestamp).toLocaleTimeString()}
                                  </span>
                                </div>
                              </div>
                              <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                                log.action === 'Granted' ? 'bg-cyber-emerald/10 text-cyber-emerald border border-cyber-emerald/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}>
                                {log.action}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Equipment Checklist */}
                    <div className="glass-panel p-6 rounded-2xl flex flex-col h-[400px]">
                      <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                        <Layers className="h-4.5 w-4.5 text-cyber-emerald" />
                        Equipment Checklist
                      </h3>
                      
                      <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 scrollbar">
                        {inventory.length === 0 ? (
                          <p className="text-sm text-slate-500 text-center py-8">No inventory items added</p>
                        ) : (
                          inventory.map((item) => (
                            <div key={item.id} className="p-3 bg-white/2 border border-white/5 rounded-xl flex items-center justify-between">
                              <div>
                                <h4 className="text-xs font-bold text-white">{item.item_name}</h4>
                                <span className="text-[10px] text-slate-500">Qty: {item.quantity}</span>
                              </div>
                              <span className={`text-[9px] uppercase font-extrabold px-2 py-0.5 rounded ${
                                item.status === 'In Stock' ? 'bg-cyber-emerald/10 text-cyber-emerald' : item.status === 'Low Stock' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-400'
                              }`}>
                                {item.status}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                      
                      <button
                        onClick={() => setActiveTab('lockers')}
                        className="w-full mt-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-semibold text-white transition-colors"
                      >
                        Manage Inventory
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {/* TAB 2: LOCKERS AND FINGERPRINT ENROLLMENT */}
              {activeTab === 'lockers' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  
                  {/* Left Column: Locker Relay Status & Remote Control */}
                  <div className="space-y-8">
                    <div className="glass-panel p-6 md:p-8 rounded-2xl space-y-6">
                      <div>
                        <h3 className="text-base font-bold text-white">Virtual Compartment Matrix</h3>
                        <p className="text-xs text-slate-500">All virtual locker compartments map physical signals to the single lock actuator.</p>
                      </div>

                      {/* Lockers Matrix Display */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {lockers.map((locker) => (
                          <div key={locker.id} className="p-4 rounded-xl bg-white/3 border border-white/5 flex flex-col justify-between space-y-3 hover:border-white/10 transition-all">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-xs font-bold text-white">{locker.name.split(' - ')[0]}</h4>
                                <span className="text-[9px] text-slate-500 truncate block mt-0.5">{locker.name.split(' - ')[1] || 'Assigned Cabin'}</span>
                              </div>
                              {locker.status === 'Unlocked' ? (
                                <Unlock className="h-4.5 w-4.5 text-cyber-emerald animate-pulse" />
                              ) : (
                                <Lock className="h-4.5 w-4.5 text-red-500" />
                              )}
                            </div>
                            
                            <div className="flex justify-between items-center pt-2">
                              <span className={`text-[10px] font-bold uppercase ${locker.status === 'Unlocked' ? 'text-cyber-emerald' : 'text-red-500'}`}>
                                {locker.status}
                              </span>
                              <button
                                onClick={() => triggerRemoteUnlock(locker.id)}
                                disabled={!hardwareStatus.online}
                                className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${
                                  hardwareStatus.online
                                    ? 'bg-cyber-accent/15 border border-cyber-accent/30 text-cyber-accent hover:bg-cyber-accent/30'
                                    : 'bg-slate-800 text-slate-500 border border-white/3 cursor-not-allowed'
                                }`}
                              >
                                Unlock
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Inventory list */}
                    <div className="glass-panel p-6 rounded-2xl space-y-4">
                      <h3 className="text-base font-bold text-white">Inventory Controls</h3>
                      
                      <form onSubmit={addInventoryItem} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-semibold uppercase">Item Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Soldering Iron"
                            value={newItem.item_name}
                            onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyber-accent"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-semibold uppercase">Quantity</label>
                          <input
                            type="number"
                            min={0}
                            value={newItem.quantity}
                            onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyber-accent"
                          />
                        </div>
                        <button
                          type="submit"
                          className="bg-cyber-accent/15 border border-cyber-accent/30 text-cyber-accent hover:bg-cyber-accent/20 rounded-lg py-1.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 h-[34px]"
                        >
                          <Plus className="h-4 w-4" />
                          Add Item
                        </button>
                      </form>

                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs font-medium">
                          <thead>
                            <tr className="border-b border-white/5 text-slate-500 font-semibold">
                              <th className="py-2.5">Item Name</th>
                              <th className="py-2.5">Qty</th>
                              <th className="py-2.5">Status</th>
                              <th className="py-2.5 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/3">
                            {inventory.map((item) => (
                              <tr key={item.id} className="hover:bg-white/2">
                                <td className="py-3 text-white font-bold">{item.item_name}</td>
                                <td className="py-3">{item.quantity}</td>
                                <td className="py-3">
                                  <span className={`text-[10px] px-2 py-0.5 rounded ${
                                    item.status === 'In Stock' ? 'bg-cyber-emerald/10 text-cyber-emerald' : item.status === 'Low Stock' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-400'
                                  }`}>
                                    {item.status}
                                  </span>
                                </td>
                                <td className="py-3 text-right">
                                  <div className="inline-flex gap-1.5">
                                    <button
                                      onClick={() => updateItemQty(item, -1)}
                                      className="w-6 h-6 border border-white/10 rounded flex items-center justify-center hover:bg-white/5 text-slate-400 hover:text-white"
                                    >
                                      -
                                    </button>
                                    <button
                                      onClick={() => updateItemQty(item, 1)}
                                      className="w-6 h-6 border border-white/10 rounded flex items-center justify-center hover:bg-white/5 text-slate-400 hover:text-white"
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Web-Controlled Biometric Enrollment Panel */}
                  <div className="glass-panel p-6 md:p-8 rounded-2xl flex flex-col h-full justify-between space-y-6">
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          <Radio className="h-5 w-5 text-cyber-accent animate-pulse" />
                          Enroll Biometric Credentials
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Initiate biometric template writing sequences on ESP32 R307 modules.</p>
                      </div>

                      {/* Interactive Visual Slot Map (1-127 Grid) */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-semibold uppercase">Sensor Memory slots (1 - 127)</span>
                          <span className="text-[10px] text-slate-500 font-mono">Green = Available • Red = Occupied</span>
                        </div>
                        <div className="grid grid-cols-10 gap-1.5 max-h-36 overflow-y-auto p-3 border border-white/5 rounded-xl bg-black/45 scrollbar">
                          {Array.from({ length: 127 }, (_, i) => {
                            const slotId = i + 1;
                            const isOccupied = occupiedSlots.includes(slotId);
                            const isSelected = enrollFingerId === slotId.toString();
                            return (
                              <button
                                type="button"
                                key={slotId}
                                onClick={() => !isOccupied && setEnrollFingerId(slotId.toString())}
                                disabled={isOccupied}
                                className={`h-7 text-[10px] font-extrabold rounded-md flex items-center justify-center transition-all ${
                                  isOccupied
                                    ? 'bg-red-500/10 border border-red-500/30 text-red-400/60 cursor-not-allowed'
                                    : isSelected
                                    ? 'bg-cyber-accent border border-cyber-accent text-cyber-dark shadow-glow-cyan/20'
                                    : 'bg-cyber-emerald/10 border border-cyber-emerald/20 text-cyber-emerald hover:bg-cyber-emerald/20'
                                }`}
                                title={isOccupied ? `Slot ${slotId} occupied` : `Slot ${slotId} free`}
                              >
                                {slotId}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <form onSubmit={startEnrollment} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Assign User Profile</label>
                          <select
                            value={enrollUserId}
                            onChange={(e) => setEnrollUserId(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyber-accent font-medium"
                            required
                          >
                            <option value="" className="bg-slate-900 text-slate-500">Select User Account</option>
                            {users.map(u => (
                              <option key={u.id} value={u.id} className="bg-slate-900 text-white font-medium">
                                {u.name} ({u.role})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Selected Slot ID</label>
                            <input
                              type="number"
                              min={1}
                              max={127}
                              value={enrollFingerId}
                              onChange={(e) => setEnrollFingerId(e.target.value)}
                              placeholder="Click grid slot"
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyber-accent font-semibold font-mono"
                              required
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Descriptor Tag</label>
                            <input
                              type="text"
                              value={enrollLabel}
                              onChange={(e) => setEnrollLabel(e.target.value)}
                              placeholder="e.g. Left Index"
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyber-accent font-medium"
                              required
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isEnrolling || !hardwareStatus.online}
                          className={`w-full py-3 rounded-lg font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 ${
                            isEnrolling || !hardwareStatus.online
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                              : 'bg-cyber-accent/20 border border-cyber-accent/40 text-cyber-accent hover:bg-cyber-accent/30 shadow-cyber-accent/5'
                          }`}
                        >
                          {isEnrolling ? (
                            <>
                              <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                              Enrollment Sequence Engaged
                            </>
                          ) : (
                            <>
                              <UserPlus className="h-4.5 w-4.5" />
                              Start Fingerprint Enrollment
                            </>
                          )}
                        </button>
                      </form>

                      {/* Enrollment status visualizer */}
                      {enrollStatus && (
                        <div className={`p-4 rounded-xl border ${
                          enrollStatus.success === true
                            ? 'bg-cyber-emerald/10 border-cyber-emerald/20 text-cyber-emerald'
                            : enrollStatus.success === false
                            ? 'bg-red-500/10 border-red-500/20 text-red-400'
                            : 'bg-cyber-accent/10 border-cyber-accent/20 text-cyber-accent animate-pulse'
                        }`}>
                          <div className="flex items-start gap-3">
                            {enrollStatus.success === true ? (
                              <CheckCircle2 className="h-5 w-5 shrink-0" />
                            ) : enrollStatus.success === false ? (
                              <AlertTriangle className="h-5 w-5 shrink-0" />
                            ) : (
                              <RefreshCw className="h-5 w-5 shrink-0 animate-spin" />
                            )}
                            <div>
                              <h4 className="text-sm font-bold uppercase tracking-wider">
                                {enrollStatus.success === true ? 'Enrollment Complete' : enrollStatus.success === false ? 'Enrollment Failed' : 'Active Scanner Routine'}
                              </h4>
                              <p className="text-xs mt-1 text-slate-300 font-medium leading-relaxed">
                                {enrollStatus.message}
                              </p>
                              {enrollStatus.step !== undefined && (
                                <div className="mt-2 text-[10px] uppercase font-bold text-slate-400">
                                  State progress: {enrollStatus.step === 1 ? '1/2 (SCANNING)' : enrollStatus.step === 2 ? '2/2 (STORING)' : 'READY'}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Network Hotspot Details card */}
                    <div className="p-4 rounded-xl bg-white/2 border border-white/5 text-xs text-slate-400 space-y-1.5">
                      <div className="flex justify-between">
                        <span>WiFi AP SSID:</span>
                        <span className="font-bold text-white font-mono">Apurv</span>
                      </div>
                      <div className="flex justify-between">
                        <span>WPA2 Key:</span>
                        <span className="font-bold text-white font-mono">12345678</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Backend Controller URL:</span>
                        <span className="font-bold text-cyber-accent font-mono">http://192.168.137.1:3000</span>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 3: USER MANAGEMENT */}
              {activeTab === 'users' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  
                  {/* Left Column: Create User Form */}
                  <div className="glass-panel p-6 md:p-8 rounded-2xl h-fit space-y-6">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-cyber-accent" />
                        Create New User
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Add user profiles and map custom locker spaces.</p>
                    </div>

                    <form onSubmit={createNewUser} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-semibold uppercase">Full Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Piush Munje"
                          value={newUser.name}
                          onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyber-accent font-medium"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-semibold uppercase">System Role</label>
                        <select
                          value={newUser.role}
                          onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyber-accent font-medium"
                        >
                          <option value="Super Admin" className="bg-slate-900">Super Admin</option>
                          <option value="Admin" className="bg-slate-900">Admin</option>
                          <option value="Staff" className="bg-slate-900">Staff</option>
                          <option value="Student" className="bg-slate-900">Student</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-semibold uppercase">Locker Workspace Allocation</label>
                        <select
                          value={newUser.locker_id}
                          onChange={(e) => setNewUser({ ...newUser, locker_id: parseInt(e.target.value) })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyber-accent font-medium"
                        >
                          <option value={1} className="bg-slate-900">LOCKER-001 (Main Locker)</option>
                          <option value={2} className="bg-slate-900">LOCKER-002 (Lab Drawer)</option>
                          <option value={3} className="bg-slate-900">LOCKER-003 (Sensors Cab)</option>
                          <option value={4} className="bg-slate-900">LOCKER-004 (Tools Chest)</option>
                          <option value={5} className="bg-slate-900">LOCKER-005 (Micro Rack)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-semibold uppercase">Security PIN (Numeric)</label>
                        <input
                          type="password"
                          maxLength={6}
                          placeholder="e.g. 9876"
                          value={newUser.pin}
                          onChange={(e) => setNewUser({ ...newUser, pin: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyber-accent font-mono"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-gradient-to-r from-cyber-accent to-cyber-emerald text-cyber-dark font-bold rounded-lg shadow-md hover:shadow-cyber-accent/20 transition-all text-xs"
                      >
                        Create User Record
                      </button>
                    </form>
                  </div>

                  {/* Right 2 Columns: User Registry List */}
                  <div className="lg:col-span-2 glass-panel p-6 md:p-8 rounded-2xl space-y-6">
                    <div>
                      <h3 className="text-base font-bold text-white">System User Directory</h3>
                      <p className="text-xs text-slate-500 mt-1">Audit logs map directly back to matching user locker spaces.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto max-h-[500px] pr-2 scrollbar">
                      {users.map(user => (
                        <div key={user.id} className="p-4 rounded-xl bg-white/3 border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all space-y-4 flex flex-col justify-between">
                          
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="text-sm font-bold text-white leading-tight">{user.name}</h4>
                                <span className="text-[10px] text-slate-500 font-mono">DB Account #{user.id}</span>
                              </div>
                              <span className={`text-[9px] uppercase font-extrabold px-2 py-0.5 rounded ${
                                user.role === 'Super Admin'
                                  ? 'bg-cyber-accent/15 text-cyber-accent border border-cyber-accent/20'
                                  : user.role === 'Admin'
                                  ? 'bg-cyber-emerald/15 text-cyber-emerald border border-cyber-emerald/20'
                                  : 'bg-white/5 text-slate-400'
                              }`}>
                                {user.role}
                              </span>
                            </div>

                            {/* Assigned Locker Space */}
                            <div className="flex items-center gap-1.5 text-xs text-slate-350">
                              <Server className="h-4 w-4 text-cyber-accent" />
                              <span>Assigned Space: <strong className="text-white">LOCKER-00{user.locker_id || 1}</strong></span>
                            </div>
                          </div>

                          {/* Registered Fingerprints inline view & modifications */}
                          <div className="space-y-2 border-t border-white/5 pt-3">
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] uppercase text-slate-500 font-bold block">Biometric Fingerprints</span>
                              <button
                                onClick={() => {
                                  setEnrollUserId(user.id.toString());
                                  setActiveTab('lockers');
                                }}
                                className="text-[9px] font-extrabold text-cyber-accent border-b border-cyber-accent/20 hover:border-cyber-accent transition-colors uppercase tracking-wider"
                              >
                                + Add Finger
                              </button>
                            </div>
                            
                            <div className="space-y-1.5">
                              {user.fingerprints && user.fingerprints.length > 0 ? (
                                user.fingerprints.map(fp => (
                                  <div key={fp.id} className="flex items-center justify-between p-2 rounded bg-white/3 border border-white/5 text-[11px] font-medium font-sans">
                                    
                                    {renamingFpId === fp.id ? (
                                      <div className="flex items-center gap-1.5 w-full">
                                        <input
                                          type="text"
                                          value={renamingLabel}
                                          onChange={(e) => setRenamingLabel(e.target.value)}
                                          className="bg-black/40 border border-white/10 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-cyber-accent w-full"
                                          autoFocus
                                        />
                                        <button
                                          onClick={() => handleRenameFp(fp.id)}
                                          className="p-1 hover:bg-cyber-emerald/10 text-cyber-emerald rounded"
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            setRenamingFpId(null);
                                            setRenamingLabel('');
                                          }}
                                          className="p-1 hover:bg-red-500/10 text-red-400 rounded"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="flex items-center gap-1.5 text-white font-medium truncate">
                                          <ShieldCheck className="h-3.5 w-3.5 text-cyber-emerald" />
                                          #{fp.id} - {fp.label}
                                        </span>
                                        <div className="flex gap-1.5 shrink-0 ml-2">
                                          <button
                                            onClick={() => {
                                              setRenamingFpId(fp.id);
                                              setRenamingLabel(fp.label);
                                            }}
                                            title="Rename fingerprint"
                                            className="p-1 text-slate-500 hover:text-cyber-accent transition-colors"
                                          >
                                            <Edit2 className="h-3 w-3" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteFp(fp.id)}
                                            disabled={isDeletingFp === fp.id}
                                            title="Delete fingerprint template"
                                            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                                          >
                                            {isDeletingFp === fp.id ? (
                                              <RefreshCw className="h-3 w-3 animate-spin text-slate-450" />
                                            ) : (
                                              <Trash2 className="h-3 w-3" />
                                            )}
                                          </button>
                                        </div>
                                      </>
                                    )}

                                  </div>
                                ))
                              ) : (
                                <span className="text-[10px] text-slate-500 font-medium italic block py-1">No biometric templates enrolled</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 4: ACCESS LOGS TABLE */}
              {activeTab === 'logs' && (
                <div className="glass-panel p-6 md:p-8 rounded-2xl space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-white">Consolidated Entry Logs</h3>
                    <p className="text-xs text-slate-500 mt-1">Comprehensive list of authorization audits recorded locally in SQLite.</p>
                  </div>

                  <div className="overflow-x-auto scrollbar">
                    <table className="w-full border-collapse text-left text-xs md:text-sm">
                      <thead>
                        <tr className="border-b border-white/5 text-slate-500 font-semibold">
                          <th className="pb-3 pr-4">Log ID</th>
                          <th className="pb-3 pr-4">Name</th>
                          <th className="pb-3 pr-4">System Role</th>
                          <th className="pb-3 pr-4">Authorization</th>
                          <th className="pb-3">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/3 text-slate-300 font-medium">
                        {logs.map((log) => (
                          <tr key={log.id} className="hover:bg-white/2">
                            <td className="py-3.5 text-slate-400 font-mono">#LOG-{log.id.toString().padStart(4, '0')}</td>
                            <td className="py-3.5 text-white font-bold">{log.userName || 'Unknown Identity'}</td>
                            <td className="py-3.5 text-slate-400">{log.userRole || 'External Entity'}</td>
                            <td className="py-3.5">
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                log.action === 'Granted'
                                  ? 'bg-cyber-emerald/10 text-cyber-emerald border border-cyber-emerald/20 shadow-glow-emerald/10'
                                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="py-3.5 text-slate-500 font-mono">{new Date(log.timestamp).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: ANALYTICS GRAPHS */}
              {activeTab === 'analytics' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    <div className="lg:col-span-2 glass-panel p-6 rounded-2xl flex flex-col h-[320px]">
                      <h4 className="text-sm font-bold text-white mb-4">Access Distribution Trends (7 Days)</h4>
                      <div className="flex-1 min-h-0 relative">
                        <Line
                          data={getWeeklyChartData()}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                              y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748b' } },
                              x: { grid: { display: false }, ticks: { color: '#64748b' } }
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="glass-panel p-6 rounded-2xl flex flex-col h-[320px]">
                      <h4 className="text-sm font-bold text-white mb-4">Access Auth Ratio</h4>
                      <div className="flex-1 min-h-0 relative flex items-center justify-center">
                        <Doughnut
                          data={getDoughnutChartData()}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', boxWidth: 12 } } }
                          }}
                        />
                      </div>
                    </div>

                  </div>

                  <div className="glass-panel p-6 rounded-2xl flex flex-col h-[300px]">
                    <h4 className="text-sm font-bold text-white mb-4">Peak Activity Hours (Traffic)</h4>
                    <div className="flex-1 min-h-0 relative">
                      <Bar
                        data={getBarChartData()}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                          scales: {
                            y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748b' } },
                            x: { grid: { display: false }, ticks: { color: '#64748b' } }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: SETTINGS */}
              {activeTab === 'settings' && (
                <div className="max-w-3xl glass-panel p-6 md:p-8 rounded-2xl space-y-8">
                  <div>
                    <h3 className="text-base font-bold text-white">System Settings</h3>
                    <p className="text-xs text-slate-500 mt-1">Configure hotspot network properties and local administration policies.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-cyber-accent uppercase tracking-wider">Wi-Fi Hotspot details</h4>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-semibold uppercase">SSID (Network Name)</label>
                          <input type="text" readOnly value="Apurv" className="w-full bg-white/5 border border-white/5 rounded-lg px-4 py-2 text-xs text-slate-400 cursor-not-allowed" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-semibold uppercase">WPA2 Password</label>
                          <input type="text" readOnly value="12345678" className="w-full bg-white/5 border border-white/5 rounded-lg px-4 py-2 text-xs text-slate-400 cursor-not-allowed" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-cyber-accent uppercase tracking-wider">Server Endpoint Configuration</h4>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-semibold uppercase">Server Bind Address</label>
                          <input type="text" readOnly value="0.0.0.0 (All interfaces)" className="w-full bg-white/5 border border-white/5 rounded-lg px-4 py-2 text-xs text-slate-400 cursor-not-allowed" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-semibold uppercase">Hotspot Access Endpoint</label>
                          <input type="text" readOnly value="http://192.168.137.1:3000" className="w-full bg-white/5 border border-white/5 rounded-lg px-4 py-2 text-xs text-slate-400 cursor-not-allowed" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5">
                    <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3">Database Maintenance</h4>
                    <button
                      onClick={() => alert('This offline system is self-contained. To clear databases, delete backend/data/database.db and restart.')}
                      className="py-2.5 px-4 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg text-xs font-bold transition-all"
                    >
                      Clear Audit Database
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* PROFESSIONAL FOOTER */}
            <footer className="px-8 py-4 border-t border-white/5 bg-slate-950/40 text-center text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-2 shrink-0">
              <p>© 2026 BioLocker Pro. All Rights Reserved.</p>
              <p className="flex items-center gap-1 font-semibold text-slate-400">
                Prototype engineered by
                <span className="text-cyber-accent hover:underline cursor-pointer">SITians CSE Batch 2027</span>
              </p>
            </footer>

          </main>

        </div>
      )}

    </div>
  );
}
