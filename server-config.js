/**
 * BongoLand - Server Configuration
 * Change this to your server's IP/URL when deploying
 */

// For LOCAL testing (same computer as server):
const LOCAL_SERVER = 'http://localhost:4242';

// For NETWORK testing (other computers on same WiFi):
// Replace with your computer's IP address:
// Run "ipconfig" in Windows to find it (usually 192.168.x.x)
const NETWORK_SERVER = 'http://192.168.1.100:4242';

// For INTERNET deployment:
// Replace with your domain or VPS IP:
const INTERNET_SERVER = 'https://api.bongoland.com';

// ==================== ACTIVE CONFIG ====================

// Change this to LOCAL_SERVER, NETWORK_SERVER, or INTERNET_SERVER
const SERVER_URL = LOCAL_SERVER;

// Server heartbeat interval (how often to ping server to stay "online")
const HEARTBEAT_INTERVAL = 60000; // 60 seconds

// Session timeout (how long before marked offline)
const SESSION_TIMEOUT = 300000; // 5 minutes

module.exports = {
  SERVER_URL,
  HEARTBEAT_INTERVAL,
  SESSION_TIMEOUT
};
