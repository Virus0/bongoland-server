# BongoLand - Online Mod Management System

**Complete control for developers. Simple activation for players.**

---

##  How It Works

###  Developer (You)
1. Upload mods to your server
2. Create player accounts (or let them register)
3. Grant players access to specific mods
4. See who's online/offline in real-time
5. Revoke access anytime

###  Player (Gamer)
1. Login to BongoLand Player
2. See available mods (granted by developer)
3. Click "Activate" on mods they want
4. Click "Start Session"
5. Play the game with mods active
6. Close BongoLand - mods are removed automatically

---

##  Key Features

- **No file sharing** - Everything happens through the server
- **Developer controls everything** - Who gets what mod
- **Real-time monitoring** - See who's online right now
- **Encrypted mods** - AES-256 encryption
- **Device-locked** - Can't share mods between computers
- **Session-based** - Mods only work while BongoLand is running
- **Activity logging** - Track everything

---

##  Quick Start

### 1. Start the Server
```cmd
cd server
npm install
npm start
```

### 2. Start Developer App (in new terminal)
```cmd
cd BongoLand
npm install
npm run start:dev
```

### 3. Register as Developer
- Click "Create Developer Account"
- This is the first account - it becomes the developer

### 4. Upload a Mod
- Click "Upload Mod" in sidebar
- Select your `.scs` file
- Fill in details
- Click "Upload to Server"

### 5. Create/Grant Player Access
- Go to "Manage Players"
- Grant access to players for specific mods

### 6. Start Player App (in new terminal)
```cmd
npm run start:player
```

### 7. Player Logs In
- Creates account
- Sees available mods
- Activates and plays!

---

##  File Structure

```
BongoLand/
├── server/                 ← Backend server
│   ├── index.js           ← Server code
│   ├── package.json       ← Server dependencies
│   └── data/              ← Server data (auto-created)
├── main.js                ← Electron main process
├── preload.js             ← API bridge
├── server-config.js       ← Server URL config
├── renderer/
│   ├── developer.html     ← Developer UI
│   ├── index.html         ← Player UI
│   └── ...
├── package.json           ← App dependencies
└── README.md              ← This file
```

---

##  Commands

```cmd
# Server
cd server && npm start

# Developer App
npm run start:dev

# Player App
npm run start:player

# Build Installers
npm run build:developer
npm run build:player

# Start All (Server + Developer)
start-all.bat
```

---

##  Network Setup (For Remote Players)

### Find Your IP
```cmd
ipconfig
```

### Update Config
Edit `server-config.js`:
```javascript
const NETWORK_SERVER = 'http://YOUR_IP:4242';
const SERVER_URL = NETWORK_SERVER;
```

### Open Firewall Port
- Windows Firewall → Inbound Rules → New Rule
- Port 4242 TCP → Allow

---

##  Developer Features

- Upload unlimited mods
- Manage player accounts
- Grant/revoke mod access
- See online/offline status
- Activity logs
- Mod statistics
- Real-time player monitoring

---

##  Player Features

- Browse available mods
- One-click activation
- Automatic mod deployment
- Session management
- Secure mod storage
- Anti-theft protection

---

##  Security

- All mods encrypted with AES-256
- Device fingerprinting prevents sharing
- HMAC signatures prevent tampering
- Session-based access (mods removed when offline)
- Player access controlled by developer
- Activity logging for audit trail

---

##  Troubleshooting

**"Cannot connect to server"**
- Make sure server is running
- Check `server-config.js` URL
- Check firewall settings

**"Player can't see mods"**
- Grant them access in Developer app
- Player needs to refresh (re-login)

**"Server won't start"**
- Port 4242 might be in use
- Change port in `server/index.js`

---

##  License

MIT License

---

**BongoLand - Your mods. Your rules. Your players.**
