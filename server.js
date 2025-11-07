// server.js
// Servidor Node.js com Express + WebSocket + integração BurntToast

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const { showToast } = require('./toast'); // importa a função de notificação

const app = express();
app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

const pending = new Map();
let lastCache = null;

// ===============================
// EVENTOS DE CONEXÃO WEBSOCKET
// ===============================
wss.on('connection', (ws, req) => {
  console.log('Extensão conectada via WebSocket. URL:', req.url);

  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      // Respostas diretas com correlacionamento (requisições pendentes)
      if (data.type === 'response' && data.corrId) {
        const resolver = pending.get(data.corrId);
        if (resolver) {
          resolver.resolve(data.payload);
          pending.delete(data.corrId);
        }
      }

      // Recebimento automático de registros
      else if (data.type === 'auto_upload') {
        lastCache = Array.isArray(data.data) ? data.data : [];
        // console.log('Auto-upload recebido:', lastCache.length, 'registros');

        // showToast("Extensão Sinceti", `Auto-upload com ${lastCache.length} registros recebido.`);
      }

    } catch (e) {
      console.error('Erro ao processar mensagem WS:', e);
    }
  });

  ws.on('close', () => console.log('Conexão WS encerrada.'));
});

// ===============================
// UPGRADE HTTP → WEBSOCKET
// ===============================
server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws' || req.url === '/ws/') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
  }
});

// ===============================
// FUNÇÕES AUXILIARES
// ===============================
function broadcastJSON(obj) {
  const raw = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(raw);
  }
}

// ===============================
// ENDPOINTS HTTP
// ===============================

// POST /upload - atualiza cache e resolve pendências
app.post('/upload', (req, res) => {
  const body = req.body || {};
  const corrId = body.corrId || req.query.corrId;
  const payload = Array.isArray(body) ? body : (body.registros || body.data || body);

  lastCache = Array.isArray(payload) || payload ? payload : lastCache;
  console.log('Upload recebido, cache atualizado com', Array.isArray(lastCache) ? lastCache.length : typeof lastCache);

  if (corrId && pending.has(corrId)) {
    const resolver = pending.get(corrId);
    resolver.resolve(payload);
    pending.delete(corrId);
    console.log('Pending resolvido via POST para corrId', corrId);
  }

  res.status(200).send('OK');
});

// GET /registros - devolve cache ou pede pra extensão
app.get('/registros', async (req, res) => {
  if (lastCache) return res.json({ registros: lastCache, cached: true });

  if (wss.clients.size === 0)
    return res.status(503).json({ error: 'Nenhuma extensão conectada e sem cache' });

  const corrId = Math.random().toString(36).slice(2);
  const payload = { type: 'get_registros', corrId };

  const promise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(corrId);
      reject(new Error('Timeout aguardando resposta da extensão'));
    }, 8000);

    pending.set(corrId, {
      resolve: (data) => {
        clearTimeout(timer);
        resolve(data);
      },
      reject
    });
  });

  broadcastJSON(payload);

  try {
    const dados = await promise;
    lastCache = dados;
    return res.json({ registros: dados, cached: false });
  } catch (err) {
    return res.status(504).json({ error: err.message });
  }
});

// Rota de diagnóstico
app.get('/health', (_, res) => res.send('ok'));

// Limpar cache manualmente
app.post('/clear-cache', (_, res) => {
  lastCache = null;
  res.send('cache cleared');
});


app.post('/toast', (req, res) => {
  try {
    const { title, message } = req.body || {};
    if (!title || !message) {
      return res.status(400).send('Faltou título ou mensagem.');
    }

    // chama diretamente a função showToast que você já importou no topo
    showToast(title, message);
    res.sendStatus(200);
  } catch (err) {
    console.error('Erro ao enviar toast:', err);
    res.status(500).json({ error: err.message });
  }
});


// ===============================
// INICIALIZAÇÃO
// ===============================
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🔥 Servidor rodando na porta ${PORT}. WS path: ws://localhost:${PORT}/ws`);
});
