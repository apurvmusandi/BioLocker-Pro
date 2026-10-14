# 🔐 BioLocker Pro

> **Intelligent Biometric Equipment Access & Locker Management System**  
> An end-to-end IoT and Web solution combining ESP32 biometric hardware, real-time WebSockets, and a modern React dashboard.

---

## 🚀 Teammate Quickstart (Run on your laptop)

### Prerequisites
Make sure you have installed on your laptop:
1. **Node.js** (v18 or higher recommended) - [Download Node.js](https://nodejs.org/)
2. **Git** - [Download Git](https://git-scm.com/)
3. *(Optional for Hardware)* **Arduino IDE** (v2.x) with ESP32 board support if you are flashing the hardware.

---

### Step 1: Clone the Repository
Open PowerShell or your terminal and run:
```bash
git clone https://github.com/apurvmusandi/BioLocker-Pro.git
cd BioLocker-Pro
```

---

### Step 2: Install All Dependencies
Install the root, backend, and frontend packages with a single command:
```bash
npm run install:all
```
*(Alternatively, you can run `npm install` inside the root, `backend/`, and `frontend/` folders manually).*

---

### Step 3: Run the Application
Start both the Backend (Express + SQLite + WebSockets) and Frontend (React + Vite) simultaneously:
```bash
npm run dev
```

- **Frontend Dashboard:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:3000](http://localhost:3000)

---

## 🛠️ Project Structure

```text
BioLocker-Pro/
├── backend/                  # Node.js + Express API & Socket.IO
│   ├── data/                 # SQLite database storage (database.db)
│   ├── db.js                 # SQLite schema initialization and seeders
│   ├── server.js             # REST API & WebSocket handlers
│   └── package.json
│
├── frontend/                 # React 18 + Vite + Tailwind CSS UI
│   ├── src/                  # React components & dashboard pages
│   ├── public/               # Static assets & media
│   └── package.json
│
├── hardware/                 # ESP32 Microcontroller firmware
│   └── hardwarecode.ino      # Biometric sensor & WiFi client code
│
├── package.json              # Monorepo scripts (concurrent dev runner)
└── README.md                 # Project documentation
```

---

## 🔑 Default Credentials & Access
- The backend automatically initializes and seeds the SQLite database (`backend/data/database.db`) on startup.
- **Super Admin:** Apurv Musandi
- **Default PIN:** `1234`

---

## 🔌 Hardware Setup (ESP32)
1. Open [`hardware/hardwarecode.ino`](hardware/hardwarecode.ino) in Arduino IDE.
2. Update the WiFi credentials and Server IP:
   ```cpp
   const char* ssid     = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   const char* serverUrl = "http://YOUR_LAPTOP_IP:3000";
   ```
3. Connect your ESP32 board and flash the sketch.

---

## 👥 Contributors & Team
- **Apurv Musandi** (Lead)
- **BioLocker Pro Engineering Team**
