const http = require('http');
const fs = require('fs');
const path = require('path');

// Wispbyte injecte le port assigné dans une variable d'environnement.
// On essaie les noms les plus courants, avec ton port en secours.
const PORT = process.env.SERVER_PORT || process.env.PORT || 9940;

const STATS_FILE = path.join(__dirname, 'stats.json');

// --- Chargement / initialisation des stats (persistées dans un fichier JSON) ---
function loadStats() {
  try {
    const raw = fs.readFileSync(STATS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return { visits: 0, salesCount: 0, revenue: 0, orders: [] };
  }
}

function saveStats(stats) {
  fs.writeFile(STATS_FILE, JSON.stringify(stats, null, 2), () => {});
}

let stats = loadStats();

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req, callback) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 1e6) req.destroy(); // garde-fou anti-flood
  });
  req.on('end', () => {
    try {
      callback(null, body ? JSON.parse(body) : {});
    } catch (err) {
      callback(err);
    }
  });
}

const server = http.createServer((req, res) => {
  // --- API stats (visites / ventes) ---
  if (req.url === '/api/stats' && req.method === 'GET') {
    sendJSON(res, 200, stats);
    return;
  }

  if (req.url === '/api/visit' && req.method === 'POST') {
    stats.visits += 1;
    saveStats(stats);
    sendJSON(res, 200, { visits: stats.visits });
    return;
  }

  if (req.url === '/api/sale' && req.method === 'POST') {
    readBody(req, (err, data) => {
      if (err || !data || typeof data.total !== 'number') {
        sendJSON(res, 400, { error: 'Requête invalide' });
        return;
      }

      const order = {
        items: Array.isArray(data.items) ? data.items : [],
        total: data.total,
        buyer: typeof data.buyer === 'string' && data.buyer.trim() ? data.buyer.trim() : 'Invité',
        date: new Date().toISOString(),
      };

      stats.orders.unshift(order);
      stats.orders = stats.orders.slice(0, 100); // on garde les 100 dernières commandes
      stats.salesCount += 1;
      stats.revenue += order.total;
      saveStats(stats);

      sendJSON(res, 200, { ok: true });
    });
    return;
  }

  // --- Fichier principal ---
  fs.readFile(path.join(__dirname, 'vibe-client.html'), (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Erreur : impossible de lire vibe-client.html');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Vibe-Client servi sur le port ${PORT}`);
});
