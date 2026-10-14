import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS Lockers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Locked' CHECK(status IN ('Locked', 'Unlocked')),
    available_material TEXT
  );

  CREATE TABLE IF NOT EXISTS Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('Super Admin', 'Admin', 'Staff', 'Student')),
    pin TEXT NOT NULL,
    locker_id INTEGER DEFAULT 1,
    FOREIGN KEY (locker_id) REFERENCES Lockers(id) ON DELETE SET DEFAULT
  );

  CREATE TABLE IF NOT EXISTS Fingerprints (
    id INTEGER PRIMARY KEY CHECK(id BETWEEN 1 AND 127),
    user_id INTEGER NOT NULL,
    locker_id INTEGER NOT NULL DEFAULT 1,
    label TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (locker_id) REFERENCES Lockers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS AccessLogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    locker_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('Granted', 'Denied')),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE SET NULL,
    FOREIGN KEY (locker_id) REFERENCES Lockers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS Inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    locker_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK(status IN ('In Stock', 'Out of Stock', 'Low Stock')),
    FOREIGN KEY (locker_id) REFERENCES Lockers(id) ON DELETE CASCADE
  );
`);

// Auto-migration: Check if locker_id exists in Users, if not add it
try {
  db.prepare('SELECT locker_id FROM Users LIMIT 1').get();
} catch (e) {
  try {
    db.exec('ALTER TABLE Users ADD COLUMN locker_id INTEGER DEFAULT 1');
    console.log('Database migrated: added locker_id to Users table');
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

// Seeding function
const seed = () => {
  // Check if we have lockers
  const lockerCount = db.prepare('SELECT COUNT(*) as count FROM Lockers').get();
  if (lockerCount.count < 5) {
    const insertLocker = db.prepare('INSERT OR IGNORE INTO Lockers (id, name, status, available_material) VALUES (?, ?, ?, ?)');
    insertLocker.run(1, 'LOCKER-001 - Main Equipment Locker', 'Locked', 'ESP32, Multimeter, Soldering Iron');
    insertLocker.run(2, 'LOCKER-002 - Secondary Lab Drawer', 'Locked', 'Oscilloscope, Breadboards');
    insertLocker.run(3, 'LOCKER-003 - Sensors Cabinet', 'Locked', 'Ultrasonic, DHT11, R307 Sensors');
    insertLocker.run(4, 'LOCKER-004 - Tools Chest', 'Locked', 'Soldering Wire, Wire Strippers');
    insertLocker.run(5, 'LOCKER-005 - Microcontrollers Rack', 'Locked', 'Arduino Uno, Raspberry Pi');
  }

  // Check if we already have users
  const userCount = db.prepare('SELECT COUNT(*) as count FROM Users').get();
  if (userCount.count === 0) {
    db.prepare('INSERT INTO Users (name, role, pin, locker_id) VALUES (?, ?, ?, ?)').run(
      'Apurv Musandi',
      'Super Admin',
      '1234',
      1
    );
  }

  // Check if we have inventory
  const inventoryCount = db.prepare('SELECT COUNT(*) as count FROM Inventory').get();
  if (inventoryCount.count === 0) {
    const insertInventory = db.prepare('INSERT INTO Inventory (locker_id, item_name, quantity, status) VALUES (?, ?, ?, ?)');
    insertInventory.run(1, 'ESP32 DevKit C', 5, 'In Stock');
    insertInventory.run(1, 'Digital Multimeter', 3, 'In Stock');
    insertInventory.run(1, 'Soldering Iron Kit', 2, 'In Stock');
    insertInventory.run(2, 'Handheld Oscilloscope', 1, 'In Stock');
    insertInventory.run(3, 'DHT22 Temp Sensor', 12, 'In Stock');
  }
};

seed();

export default db;
