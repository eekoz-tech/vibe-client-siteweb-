const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.SERVER_PORT || process.env.PORT || 9940;
const DATA_FILE = path.join(__dirname, 'data.json');

// Clé qui protège l'accès aux données admin — change-la, et mets la MÊME
// valeur dans ADMIN_API_KEY côté admin.html.
const ADMIN_API_KEY = 'change-this-key';

// Domaines autorisés à appeler cette API (CORS). Ajoute ici tous les
// domaines depuis lesquels index.html / admin.html seront servis.
const ALLOWED_ORIGINS = [
  'https://vibe-client.store',
  'https://www.vibe-client.store',
];

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return { logins: [], orders: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req, callback) {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    try {
      callback(JSON.parse(body || '{}'));
    } catch (err) {
      callback(null);
    }
  });
}

const server = http.createServer((req, res) => {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost');

  // --- Enregistrer une connexion ---
  if (req.method === 'POST' && url.pathname === '/api/log-login') {
    readBody(req, (payload) => {
      if (!payload || !payload.pseudo) {
        sendJson(res, 400, { error: 'Données invalides' });
        return;
      }
      const data = loadData();
      data.logins.push({
        pseudo: payload.pseudo,
        email: payload.email || '',
        discordLinked: !!payload.discordLinked,
        date: new Date().toISOString(),
      });
      saveData(data);
      sendJson(res, 200, { ok: true });
    });
    return;
  }

  // --- Enregistrer une vente ---
  if (req.method === 'POST' && url.pathname === '/api/log-order') {
    readBody(req, (payload) => {
      if (!payload || !payload.pseudo || !payload.grade || !payload.price) {
        sendJson(res, 400, { error: 'Données invalides' });
        return;
      }
      const data = loadData();
      data.orders.push({
        pseudo: payload.pseudo,
        grade: payload.grade,
        price: Number(payload.price),
        date: new Date().toISOString(),
      });
      saveData(data);
      sendJson(res, 200, { ok: true });
    });
    return;
  }

  // --- Récupérer les données (protégé par clé) ---
  if (req.method === 'GET' && url.pathname === '/api/data') {
    const key = url.searchParams.get('key');
    if (key !== ADMIN_API_KEY) {
      sendJson(res, 401, { error: 'Clé invalide' });
      return;
    }
    sendJson(res, 200, loadData());
    return;
  }

  // --- Test direct (optionnel) : sert vibe-client.html si présent ---
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/vibe-client.html')) {
    fs.readFile(path.join(__dirname, 'vibe-client.html'), (err, html) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Fichier non trouvé');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`API Vibe-Client démarrée sur le port ${PORT}`);
});
