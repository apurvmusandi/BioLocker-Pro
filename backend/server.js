import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import db from './db.js';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Hardware Live State
let hardwareState = {
  online: false,
  ip: null,
  lastSeen: null
};

// Pending fingerprint enrollment context
let pendingEnrollment = null;

// Track online status of ESP32
setInterval(() => {
  if (hardwareState.online && hardwareState.lastSeen && Date.now() - hardwareState.lastSeen > 8000) {
    hardwareState.online = false;
    hardwareState.ip = null;
    io.emit('hardware_status', { online: false, ip: null });
    console.log('Hardware went OFFLINE (heartbeat missed)');
  }
}, 3000);

// --- Auth Route ---
app.post('/api/auth/login', (req, res) => {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }

  try {
    const user = db.prepare('SELECT id, name, role FROM Users WHERE pin = ?').get(pin);
    if (user) {
      return res.json({ success: true, user });
    } else {
      return res.status(401).json({ error: 'Invalid security PIN' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- Users Routes ---
app.get('/api/users', (req, res) => {
  try {
    const users = db.prepare('SELECT id, name, role, locker_id FROM Users').all();
    const fingerprints = db.prepare('SELECT id, user_id, label FROM Fingerprints').all();
    
    // Attach fingerprints to users
    const usersWithFgp = users.map(user => ({
      ...user,
      fingerprints: fingerprints.filter(f => f.user_id === user.id)
    }));
    
    res.json(usersWithFgp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', (req, res) => {
  const { name, role, pin, lockerId } = req.body;
  if (!name || !role || !pin) {
    return res.status(400).json({ error: 'Missing name, role or pin' });
  }

  try {
    const result = db.prepare('INSERT INTO Users (name, role, pin, locker_id) VALUES (?, ?, ?, ?)').run(name, role, pin, lockerId || 1);
    const newUser = { id: result.lastInsertRowid, name, role, locker_id: lockerId || 1, fingerprints: [] };
    
    // Fetch all users to broadcast updated state
    const users = db.prepare('SELECT id, name, role, locker_id FROM Users').all();
    const fingerprints = db.prepare('SELECT id, user_id, label FROM Fingerprints').all();
    const usersWithFgp = users.map(user => ({
      ...user,
      fingerprints: fingerprints.filter(f => f.user_id === user.id)
    }));
    io.emit('users_list_update', usersWithFgp);
    
    res.json({ success: true, user: newUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Locker Routes ---
app.get('/api/lockers', (req, res) => {
  try {
    const lockers = db.prepare('SELECT * FROM Lockers').all();
    res.json(lockers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lockers/unlock', async (req, res) => {
  const { lockerId } = req.body;
  const targetLockerId = lockerId || 1;

  if (!hardwareState.online || !hardwareState.ip) {
    return res.status(503).json({ error: 'Solenoid Controller is offline' });
  }

  try {
    console.log(`Sending unlock request to ESP32 at http://${hardwareState.ip}/unlock`);
    
    // Call ESP32 local server endpoint (single physical lock triggers)
    const response = await fetch(`http://${hardwareState.ip}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      // Set the specific locker to unlocked temporarily (matching physical unlock period)
      db.prepare("UPDATE Lockers SET status = 'Unlocked' WHERE id = ?").run(targetLockerId);
      io.emit('locker_status', { id: targetLockerId, status: 'Unlocked' });

      // Automatically relock after 4 seconds (same as ESP32 delay)
      setTimeout(() => {
        db.prepare("UPDATE Lockers SET status = 'Locked' WHERE id = ?").run(targetLockerId);
        io.emit('locker_status', { id: targetLockerId, status: 'Locked' });
      }, 4000);

      // Create an audit log for the unlock event
      db.prepare('INSERT INTO AccessLogs (user_id, locker_id, action) VALUES (?, ?, ?)').run(
        1, // Log as system admin trigger
        targetLockerId,
        'Granted'
      );
      
      const newLog = db.prepare(`
        SELECT al.id, al.action, al.timestamp, u.name as userName, u.role as userRole
        FROM AccessLogs al
        LEFT JOIN Users u ON al.user_id = u.id
        WHERE al.id = last_insert_rowid()
      `).get();
      
      io.emit('access_log', newLog);

      return res.json({ success: true, status: 'Unlocked', lockerId: targetLockerId });
    } else {
      return res.status(500).json({ error: 'Failed to trigger ESP32 lock relay' });
    }
  } catch (err) {
    console.error('Remote unlock error:', err);
    return res.status(500).json({ error: 'Could not contact biometric unit: ' + err.message });
  }
});

// --- Fingerprint CRUD routes ---
app.post('/api/fingerprints/update', (req, res) => {
  const { id, label } = req.body;
  if (!id || !label) {
    return res.status(400).json({ error: 'Missing fingerprint ID or label' });
  }
  try {
    db.prepare('UPDATE Fingerprints SET label = ? WHERE id = ?').run(label, id);
    
    // Broadcast updated users list
    const users = db.prepare('SELECT id, name, role, locker_id FROM Users').all();
    const fingerprints = db.prepare('SELECT id, user_id, label FROM Fingerprints').all();
    const usersWithFgp = users.map(user => ({
      ...user,
      fingerprints: fingerprints.filter(f => f.user_id === user.id)
    }));
    io.emit('users_list_update', usersWithFgp);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fingerprints/delete', async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Missing fingerprint ID' });
  }
  try {
    // Attempt hardware delete if online
    if (hardwareState.online && hardwareState.ip) {
      try {
        console.log(`Sending delete-finger request to ESP32: Slot ${id}`);
        const response = await fetch(`http://${hardwareState.ip}/delete-finger?id=${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
          console.warn(`Hardware delete failed for slot ${id}`);
        }
      } catch (e) {
        console.warn(`Could not contact hardware to delete slot ${id}:`, e.message);
      }
    }

    // Delete from local SQLite
    db.prepare('DELETE FROM Fingerprints WHERE id = ?').run(id);

    // Broadcast updated users list
    const users = db.prepare('SELECT id, name, role, locker_id FROM Users').all();
    const fingerprints = db.prepare('SELECT id, user_id, label FROM Fingerprints').all();
    const usersWithFgp = users.map(user => ({
      ...user,
      fingerprints: fingerprints.filter(f => f.user_id === user.id)
    }));
    io.emit('users_list_update', usersWithFgp);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lockers/enroll', async (req, res) => {
  const { userId, fingerId, label } = req.body;
  if (!userId || !fingerId || !label) {
    return res.status(400).json({ error: 'Missing userId, fingerId, or label' });
  }

  if (fingerId < 1 || fingerId > 127) {
    return res.status(400).json({ error: 'Biometric hardware slots are limited to IDs 1-127' });
  }

  if (!hardwareState.online || !hardwareState.ip) {
    return res.status(503).json({ error: 'Solenoid Controller is offline' });
  }

  try {
    // Check if fingerId already exists
    const existing = db.prepare('SELECT id FROM Fingerprints WHERE id = ?').get(fingerId);
    if (existing) {
      return res.status(400).json({ error: `Hardware slot #${fingerId} is already occupied` });
    }

    pendingEnrollment = { userId, fingerId, label };
    console.log(`Sending enrollment request to ESP32: Slot ${fingerId}`);

    // Call ESP32 local server endpoint
    const response = await fetch(`http://${hardwareState.ip}/enroll?id=${fingerId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      io.emit('enroll_status', { message: 'Displaying instructions on LCD. Place finger...', step: 1 });
      return res.json({ success: true, status: 'Enrolling' });
    } else {
      pendingEnrollment = null;
      return res.status(500).json({ error: 'Failed to initiate ESP32 enrollment loop' });
    }
  } catch (err) {
    pendingEnrollment = null;
    return res.status(500).json({ error: 'Could not contact biometric unit: ' + err.message });
  }
});

// --- Inventory Routes ---
app.get('/api/inventory', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM Inventory WHERE locker_id = 1').all();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inventory', (req, res) => {
  const { id, item_name, quantity, status } = req.body;
  if (!item_name || quantity === undefined || !status) {
    return res.status(400).json({ error: 'Missing inventory parameters' });
  }

  try {
    if (id) {
      // Update
      db.prepare('UPDATE Inventory SET item_name = ?, quantity = ?, status = ? WHERE id = ?').run(
        item_name,
        quantity,
        status,
        id
      );
    } else {
      // Create
      db.prepare('INSERT INTO Inventory (locker_id, item_name, quantity, status) VALUES (?, ?, ?, ?)').run(
        1,
        item_name,
        quantity,
        status
      );
    }
    const items = db.prepare('SELECT * FROM Inventory WHERE locker_id = 1').all();
    io.emit('inventory_update', items);
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Access Logs Route ---
app.get('/api/logs', (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT al.id, al.action, al.timestamp, u.name as userName, u.role as userRole
      FROM AccessLogs al
      LEFT JOIN Users u ON al.user_id = u.id
      ORDER BY al.timestamp DESC
      LIMIT 100
    `).all();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Analytics Route ---
app.get('/api/analytics', (req, res) => {
  try {
    // 1. Last 7 Days Access Counts
    const dailyAccess = db.prepare(`
      SELECT date(timestamp) as day, 
             SUM(CASE WHEN action = 'Granted' THEN 1 ELSE 0 END) as granted,
             SUM(CASE WHEN action = 'Denied' THEN 1 ELSE 0 END) as denied
      FROM AccessLogs
      WHERE timestamp >= datetime('now', '-7 days')
      GROUP BY date(timestamp)
      ORDER BY day ASC
    `).all();

    // 2. Peak Hours (hour of the day)
    const peakHours = db.prepare(`
      SELECT strftime('%H', timestamp) as hour, COUNT(*) as count
      FROM AccessLogs
      GROUP BY hour
      ORDER BY count DESC
      LIMIT 5
    `).all();

    // 3. Overall Granted vs Denied
    const overallStats = db.prepare(`
      SELECT action, COUNT(*) as count
      FROM AccessLogs
      GROUP BY action
    `).all();

    res.json({ dailyAccess, peakHours, overallStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Hardware API Callback Integrations ---

app.post('/api/hardware/heartbeat', (req, res) => {
  const { ip } = req.body;
  if (!ip) {
    return res.status(400).json({ error: 'IP is required' });
  }

  const transitioned = !hardwareState.online;
  hardwareState = {
    online: true,
    ip,
    lastSeen: Date.now()
  };

  if (transitioned) {
    console.log(`Hardware came ONLINE at IP: ${ip}`);
  }
  
  io.emit('hardware_status', { online: true, ip });
  res.json({ success: true });
});

app.post('/api/hardware/access', (req, res) => {
  const { fingerID, action } = req.body;
  console.log(`Access log request from ESP32: ID=${fingerID}, action=${action}`);

  try {
    let userId = null;
    let targetLockerId = 1; // Default to Locker 001 if denied or not found
    
    if (action === 'Granted' && fingerID > 0) {
      // Find the user registered to this finger slot
      const fp = db.prepare('SELECT user_id FROM Fingerprints WHERE id = ?').get(fingerID);
      if (fp) {
        userId = fp.user_id;
        const u = db.prepare('SELECT locker_id FROM Users WHERE id = ?').get(userId);
        if (u && u.locker_id) {
          targetLockerId = u.locker_id;
        }
      }
    }

    // Insert Access log referencing specific locker
    db.prepare('INSERT INTO AccessLogs (user_id, locker_id, action) VALUES (?, ?, ?)').run(userId, targetLockerId, action);

    const logEntry = db.prepare(`
      SELECT al.id, al.action, al.timestamp, u.name as userName, u.role as userRole
      FROM AccessLogs al
      LEFT JOIN Users u ON al.user_id = u.id
      WHERE al.id = last_insert_rowid()
    `).get();

    // Broadcast log update to client dashboard
    io.emit('access_log', logEntry);

    // If access was granted, temporarily set specific locker to Unlocked
    if (action === 'Granted') {
      db.prepare("UPDATE Lockers SET status = 'Unlocked' WHERE id = ?").run(targetLockerId);
      io.emit('locker_status', { id: targetLockerId, status: 'Unlocked' });

      setTimeout(() => {
        db.prepare("UPDATE Lockers SET status = 'Locked' WHERE id = ?").run(targetLockerId);
        io.emit('locker_status', { id: targetLockerId, status: 'Locked' });
      }, 4000);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error logging access event:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/hardware/enroll-confirm', (req, res) => {
  const { id, success } = req.body;
  console.log(`Enrollment outcome received from ESP32: Slot ${id}, Success=${success}`);

  if (!pendingEnrollment || pendingEnrollment.fingerId !== id) {
    return res.status(400).json({ error: 'Unexpected hardware confirmation' });
  }

  try {
    if (success) {
      // Store record in Fingerprints table
      db.prepare('INSERT INTO Fingerprints (id, user_id, label) VALUES (?, ?, ?)').run(
        id,
        pendingEnrollment.userId,
        pendingEnrollment.label
      );

      console.log(`Saved Fingerprint: Slot ${id} for User ID ${pendingEnrollment.userId}`);
      io.emit('enroll_status', { success: true, id, message: `Fingerprint registered for slot ${id}!` });
      
      // Update users list on client
      const users = db.prepare('SELECT id, name, role, locker_id FROM Users').all();
      const fingerprints = db.prepare('SELECT id, user_id, label FROM Fingerprints').all();
      const usersWithFgp = users.map(user => ({
        ...user,
        fingerprints: fingerprints.filter(f => f.user_id === user.id)
      }));
      io.emit('users_list_update', usersWithFgp);
    } else {
      io.emit('enroll_status', { success: false, id, message: 'Enrollment process failed on hardware.' });
    }

    pendingEnrollment = null;
    res.json({ success: true });
  } catch (err) {
    console.error('Enroll confirmation database error:', err);
    pendingEnrollment = null;
    io.emit('enroll_status', { success: false, message: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Start listening
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`BioLocker Pro server running on http://0.0.0.0:${PORT}`);
});
