/**
 * BongoLand - Backend Server
 * Central hub where Developer uploads mods and Players access them
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 4242;

// ==================== CONFIG ====================

const DATA_DIR = path.join(__dirname, 'data');
const MODS_DIR = path.join(DATA_DIR, 'mods');
const LOGS_DIR = path.join(DATA_DIR, 'logs');

// Ensure directories exist
[DATA_DIR, MODS_DIR, LOGS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(cors());
app.use(express.json());

// ==================== DATA STORE ====================

const Store = {
  load(filename, defaultData = {}) {
    const filePath = path.join(DATA_DIR, filename);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return defaultData;
  },
  save(filename, data) {
    const filePath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
};

// Load all data
let users = Store.load('users.json', []);
let mods = Store.load('mods.json', []);
let playerAccess = Store.load('player_access.json', {}); // {playerId: [modId1, modId2]}
let sessions = Store.load('sessions.json', []);
let activityLog = Store.load('activity_log.json', []);

function saveAll() {
  Store.save('users.json', users);
  Store.save('mods.json', mods);
  Store.save('player_access.json', playerAccess);
  Store.save('sessions.json', sessions);
  Store.save('activity_log.json', activityLog);
}

// ==================== UTILS ====================

function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

function logActivity(type, userId, details) {
  activityLog.push({
    id: generateId(),
    type,
    userId,
    details,
    timestamp: new Date().toISOString()
  });
  // Keep only last 5000 entries
  if (activityLog.length > 5000) activityLog = activityLog.slice(-5000);
  saveAll();
}

function getUser(id) {
  return users.find(u => u.id === id);
}

function getDeveloper() {
  return users.find(u => u.role === 'developer');
}

// ==================== MIDDLEWARE ====================

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  const session = sessions.find(s => s.token === token && !s.expired);
  
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  // Check if session is active (last ping within 5 minutes)
  const lastPing = session.lastPing || session.createdAt;
  const minutesSincePing = (Date.now() - new Date(lastPing).getTime()) / 60000;
  session.isOnline = minutesSincePing < 5;
  
  req.session = session;
  req.user = getUser(session.userId);
  next();
}

// ==================== AUTH ROUTES ====================

// Register
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role } = req.body;
  
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Email already registered' });
  }
  
  // Only allow developer registration if no developer exists yet
  if (role === 'developer' && users.find(u => u.role === 'developer')) {
    return res.status(403).json({ error: 'Developer slot already taken' });
  }
  
  const salt = crypto.randomBytes(16).toString('hex');
  const user = {
    id: generateId(),
    name,
    email,
    passwordHash: hashPassword(password, salt),
    salt,
    role: role || 'player',
    deviceId: null,
    createdAt: new Date().toISOString(),
    lastSeen: null,
    isOnline: false
  };
  
  users.push(user);
  
  // Initialize player access
  playerAccess[user.id] = [];
  
  logActivity('user_registered', user.id, { name, role: user.role });
  saveAll();
  
  res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password, deviceId } = req.body;
  
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  if (hashPassword(password, user.salt) !== user.passwordHash) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Generate session token
  const token = crypto.randomBytes(32).toString('hex');
  const session = {
    id: generateId(),
    userId: user.id,
    token,
    deviceId,
    createdAt: new Date().toISOString(),
    lastPing: new Date().toISOString(),
    isOnline: true,
    expired: false
  };
  
  sessions.push(session);
  
  // Update user
  user.deviceId = deviceId;
  user.lastSeen = new Date().toISOString();
  user.isOnline = true;
  
  logActivity('user_login', user.id, { deviceId });
  saveAll();
  
  res.json({ 
    success: true, 
    token, 
    user: { id: user.id, name: user.name, email: user.email, role: user.role } 
  });
});

// Logout
app.post('/api/auth/logout', authMiddleware, (req, res) => {
  req.session.expired = true;
  req.session.isOnline = false;
  
  const user = getUser(req.session.userId);
  if (user) {
    user.isOnline = false;
  }
  
  logActivity('user_logout', req.session.userId, {});
  saveAll();
  
  res.json({ success: true });
});

// Heartbeat (keep session alive)
app.post('/api/auth/heartbeat', authMiddleware, (req, res) => {
  req.session.lastPing = new Date().toISOString();
  req.session.isOnline = true;
  
  const user = getUser(req.session.userId);
  if (user) {
    user.lastSeen = new Date().toISOString();
    user.isOnline = true;
    saveAll();
  }
  
  res.json({ success: true, isOnline: true });
});

// Get current user
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ==================== MOD ROUTES (Developer) ====================

// Upload mod (Developer only)
app.post('/api/mods/upload', authMiddleware, (req, res) => {
  if (req.user.role !== 'developer') {
    return res.status(403).json({ error: 'Developer only' });
  }
  
  const { name, description, category, version, tags, fileData, fileName } = req.body;
  
  if (!name || !fileData) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const modId = generateId();
  const modDir = path.join(MODS_DIR, modId);
  fs.mkdirSync(modDir, { recursive: true });
  
  // Save mod file (base64 decoded)
  const fileBuffer = Buffer.from(fileData, 'base64');
  fs.writeFileSync(path.join(modDir, fileName || `${name}.scs`), fileBuffer);
  
  // Create mod signature
  const signature = crypto.createHmac('sha256', `BongoLand_${modId}_${req.user.id}`)
    .update(fileBuffer)
    .digest('hex');
  
  const mod = {
    id: modId,
    name,
    description: description || '',
    category: category || 'other',
    version: version || '1.0.0',
    tags: tags || [],
    author: req.user.name,
    authorId: req.user.id,
    fileName: fileName || `${name}.scs`,
    fileSize: fileBuffer.length,
    signature,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    active: true,
    playerCount: 0,
    grantedPlayers: []
  };
  
  mods.push(mod);
  playerAccess[modId] = [];
  
  logActivity('mod_uploaded', req.user.id, { modId, name });
  saveAll();
  
  res.json({ success: true, mod });
});

// Get all mods (Developer sees all, Player sees only granted)
app.get('/api/mods', authMiddleware, (req, res) => {
  let availableMods = mods.filter(m => m.active);
  
  if (req.user.role === 'player') {
    // Only show mods this player has access to
    const playerMods = playerAccess[req.user.id] || [];
    availableMods = availableMods.filter(m => playerMods.includes(m.id));
  }
  
  // Don't expose file data in list
  const safeMods = availableMods.map(m => ({
    id: m.id,
    name: m.name,
    description: m.description,
    category: m.category,
    version: m.version,
    tags: m.tags,
    author: m.author,
    authorId: m.authorId,
    fileSize: m.fileSize,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    active: m.active,
    playerCount: playerAccess[m.id]?.length || 0,
    grantedPlayers: req.user.role === 'developer' ? playerAccess[m.id]?.length || 0 : undefined
  }));
  
  res.json({ success: true, mods: safeMods });
});

// Download mod file (Player downloads to activate)
app.get('/api/mods/:modId/download', authMiddleware, (req, res) => {
  const mod = mods.find(m => m.id === req.params.modId);
  if (!mod) {
    return res.status(404).json({ error: 'Mod not found' });
  }
  
  // Check if player has access
  if (req.user.role === 'player') {
    const playerMods = playerAccess[req.user.id] || [];
    if (!playerMods.includes(mod.id)) {
      return res.status(403).json({ error: 'You do not have access to this mod' });
    }
  }
  
  const modPath = path.join(MODS_DIR, mod.id, mod.fileName);
  if (!fs.existsSync(modPath)) {
    return res.status(404).json({ error: 'Mod file not found' });
  }
  
  const fileBuffer = fs.readFileSync(modPath);
  const signature = crypto.createHmac('sha256', `BongoLand_${mod.id}_${mod.authorId}`)
    .update(fileBuffer)
    .digest('hex');
  
  logActivity('mod_downloaded', req.user.id, { modId: mod.id, modName: mod.name });
  
  res.json({
    success: true,
    mod: {
      id: mod.id,
      name: mod.name,
      version: mod.version,
      signature,
      fileSize: mod.fileSize,
      fileData: fileBuffer.toString('base64')
    }
  });
});

// Delete mod (Developer only)
app.delete('/api/mods/:modId', authMiddleware, (req, res) => {
  if (req.user.role !== 'developer') {
    return res.status(403).json({ error: 'Developer only' });
  }
  
  const modIndex = mods.findIndex(m => m.id === req.params.modId);
  if (modIndex === -1) {
    return res.status(404).json({ error: 'Mod not found' });
  }
  
  const mod = mods[modIndex];
  
  // Delete files
  const modDir = path.join(MODS_DIR, mod.id);
  if (fs.existsSync(modDir)) {
    fs.rmSync(modDir, { recursive: true });
  }
  
  // Remove from player access
  delete playerAccess[mod.id];
  
  mods.splice(modIndex, 1);
  
  logActivity('mod_deleted', req.user.id, { modId: mod.id, name: mod.name });
  saveAll();
  
  res.json({ success: true });
});

// Update mod (Developer only)
app.patch('/api/mods/:modId', authMiddleware, (req, res) => {
  if (req.user.role !== 'developer') {
    return res.status(403).json({ error: 'Developer only' });
  }
  
  const mod = mods.find(m => m.id === req.params.modId);
  if (!mod) {
    return res.status(404).json({ error: 'Mod not found' });
  }
  
  const allowed = ['name', 'description', 'category', 'version', 'tags', 'active'];
  allowed.forEach(key => {
    if (req.body[key] !== undefined) {
      mod[key] = req.body[key];
    }
  });
  
  mod.updatedAt = new Date().toISOString();
  
  logActivity('mod_updated', req.user.id, { modId: mod.id });
  saveAll();
  
  res.json({ success: true, mod });
});

// ==================== PLAYER ACCESS (Developer grants access) ====================

// Grant player access to a mod (Developer only)
app.post('/api/access/grant', authMiddleware, (req, res) => {
  if (req.user.role !== 'developer') {
    return res.status(403).json({ error: 'Developer only' });
  }
  
  const { playerId, modId } = req.body;
  
  if (!playerId || !modId) {
    return res.status(400).json({ error: 'Missing playerId or modId' });
  }
  
  const player = getUser(playerId);
  const mod = mods.find(m => m.id === modId);
  
  if (!player) {
    return res.status(404).json({ error: 'Player not found' });
  }
  if (!mod) {
    return res.status(404).json({ error: 'Mod not found' });
  }
  if (player.role !== 'player') {
    return res.status(400).json({ error: 'Not a player account' });
  }
  
  if (!playerAccess[playerId]) {
    playerAccess[playerId] = [];
  }
  
  if (!playerAccess[playerId].includes(modId)) {
    playerAccess[playerId].push(modId);
  }
  
  logActivity('access_granted', req.user.id, { playerId, playerName: player.name, modId, modName: mod.name });
  saveAll();
  
  res.json({ success: true });
});

// Revoke player access (Developer only)
app.post('/api/access/revoke', authMiddleware, (req, res) => {
  if (req.user.role !== 'developer') {
    return res.status(403).json({ error: 'Developer only' });
  }
  
  const { playerId, modId } = req.body;
  
  if (playerAccess[playerId]) {
    playerAccess[playerId] = playerAccess[playerId].filter(id => id !== modId);
  }
  
  const player = getUser(playerId);
  const mod = mods.find(m => m.id === modId);
  
  logActivity('access_revoked', req.user.id, { playerId, playerName: player?.name, modId, modName: mod?.name });
  saveAll();
  
  res.json({ success: true });
});

// Get player access list (Developer sees all players and their access)
app.get('/api/access/list', authMiddleware, (req, res) => {
  if (req.user.role !== 'developer') {
    return res.status(403).json({ error: 'Developer only' });
  }
  
  const players = users.filter(u => u.role === 'player').map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    isOnline: u.isOnline,
    lastSeen: u.lastSeen,
    createdAt: u.createdAt,
    grantedMods: (playerAccess[u.id] || []).map(modId => {
      const mod = mods.find(m => m.id === modId);
      return mod ? { id: mod.id, name: mod.name, category: mod.category } : null;
    }).filter(Boolean)
  }));
  
  res.json({ success: true, players });
});

// Get players for a specific mod (Developer)
app.get('/api/access/mod/:modId', authMiddleware, (req, res) => {
  if (req.user.role !== 'developer') {
    return res.status(403).json({ error: 'Developer only' });
  }
  
  const mod = mods.find(m => m.id === req.params.modId);
  if (!mod) {
    return res.status(404).json({ error: 'Mod not found' });
  }
  
  const grantedPlayerIds = playerAccess[req.params.modId] || [];
  const players = grantedPlayerIds.map(id => {
    const user = getUser(id);
    return user ? {
      id: user.id,
      name: user.name,
      email: user.email,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen
    } : null;
  }).filter(Boolean);
  
  res.json({ success: true, mod, players });
});

// ==================== STATS & ANALYTICS (Developer) ====================

app.get('/api/stats', authMiddleware, (req, res) => {
  if (req.user.role !== 'developer') {
    return res.status(403).json({ error: 'Developer only' });
  }
  
  const totalMods = mods.length;
  const activeMods = mods.filter(m => m.active).length;
  const totalPlayers = users.filter(u => u.role === 'player').length;
  const onlinePlayers = users.filter(u => u.role === 'player' && u.isOnline).length;
  
  const totalSize = mods.reduce((sum, m) => sum + (m.fileSize || 0), 0);
  
  const recentActivity = activityLog.slice(-50).reverse();
  
  res.json({
    success: true,
    stats: {
      totalMods,
      activeMods,
      totalPlayers,
      onlinePlayers,
      totalSize,
      totalGrants: Object.values(playerAccess).reduce((sum, arr) => sum + arr.length, 0)
    },
    recentActivity
  });
});

// Get all users (Developer)
app.get('/api/users', authMiddleware, (req, res) => {
  if (req.user.role !== 'developer') {
    return res.status(403).json({ error: 'Developer only' });
  }
  
  const userList = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isOnline: u.isOnline,
    lastSeen: u.lastSeen,
    createdAt: u.createdAt
  }));
  
  res.json({ success: true, users: userList });
});

// ==================== ACTIVITY LOG ====================

app.get('/api/logs', authMiddleware, (req, res) => {
  if (req.user.role !== 'developer') {
    return res.status(403).json({ error: 'Developer only' });
  }
  
  const limit = parseInt(req.query.limit) || 100;
  const recentLogs = activityLog.slice(-limit).reverse();
  
  res.json({ success: true, logs: recentLogs });
});

// ==================== CATALOG (Public - no auth needed for listing) ====================

app.get('/api/catalog', (req, res) => {
  // Public catalog - shows available mods (but players need login to see/access)
  const publicMods = mods.filter(m => m.active).map(m => ({
    id: m.id,
    name: m.name,
    description: m.description,
    category: m.category,
    version: m.version,
    author: m.author,
    fileSize: m.fileSize,
    createdAt: m.createdAt
  }));
  
  res.json({ success: true, mods: publicMods });
});

// ==================== SESSION STATUS ====================

// Track when player activates/deactivates a mod session
app.post('/api/session/activate', authMiddleware, (req, res) => {
  const { modIds } = req.body;
  
  logActivity('session_activated', req.user.id, { 
    modCount: modIds?.length || 0,
    mods: modIds?.slice(0, 10)
  });
  
  // Update last seen
  const user = getUser(req.user.id);
  if (user) {
    user.lastSeen = new Date().toISOString();
    user.isOnline = true;
    saveAll();
  }
  
  res.json({ success: true });
});

app.post('/api/session/deactivate', authMiddleware, (req, res) => {
  logActivity('session_deactivated', req.user.id, {});
  
  const user = getUser(req.user.id);
  if (user) {
    user.isOnline = false;
    saveAll();
  }
  
  res.json({ success: true });
});

// ==================== START SERVER ====================

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       BongoLand Server v1.0                      ║');
  console.log('║                                                  ║');
  console.log(`║  Running on: http://localhost:${PORT}               ║`);
  console.log('║                                                  ║');
  console.log('║  Endpoints:                                      ║');
  console.log('║  POST /api/auth/register                         ║');
  console.log('║  POST /api/auth/login                            ║');
  console.log('║  GET  /api/mods                                  ║');
  console.log('║  POST /api/mods/upload  (Developer)              ║');
  console.log('║  POST /api/access/grant (Developer)              ║');
  console.log('║  GET  /api/access/list  (Developer)              ║');
  console.log('║  GET  /api/stats          (Developer)              ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log('Server is ready! Keep this running while players connect.');
  console.log('');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Server shutting down...');
  saveAll();
  process.exit(0);
});
