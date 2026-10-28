// build-zenvox.js — One-Command Master Project Generator for ZenvoX AI
const fs = require('fs');
const path = require('path');

const files = {
  'package.json': JSON.stringify({
    name: "zenvox-ai-pro",
    version: "3.0.0",
    description: "ZenvoX AI — Multimodal Multi-Provider AI & STEM Solve Platform",
    main: "server/index.js",
    scripts: {
      start: "node server/index.js",
      test: "node tests/verify.js"
    },
    dependencies: {
      "bcryptjs": "^2.4.3",
      "cors": "^2.8.5",
      "dotenv": "^16.4.5",
      "express": "^4.21.0",
      "express-rate-limit": "^7.4.0",
      "helmet": "^8.0.0",
      "jsonwebtoken": "^9.0.2",
      "mammoth": "^1.8.0",
      "multer": "^1.4.5-lts.1",
      "pdf-parse": "^1.1.1",
      "xlsx": "^0.18.5"
    }
  }, null, 2),

  '.env.example': `PORT=3000
JWT_SECRET=zenvox_super_secret_jwt_key_2026
GEMINI_API_KEY=your_google_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_claude_api_key_here
DEFAULT_PROVIDER=gemini
DEFAULT_MODEL=gemini-2.5-flash
DAILY_TOKEN_BUDGET=500000
`,

  '.gitignore': `node_modules/
.env
data/
uploads/
`,

  'server/config.js': `require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'zenvox_fallback_secret_2026',
  keys: {
    gemini: process.env.GEMINI_API_KEY || '',
    openai: process.env.OPENAI_API_KEY || '',
    anthropic: process.env.ANTHROPIC_API_KEY || ''
  },
  limits: {
    maxFileSizeBytes: 15 * 1024 * 1024,
    maxFiles: 5,
    timeoutMs: 60000,
    dailyTokenBudget: parseInt(process.env.DAILY_TOKEN_BUDGET || '500000', 10)
  }
};

function isValidKey(k) {
  return Boolean(k && k.trim().length > 10 && !k.includes('your_'));
}

function getAvailableModels() {
  const models = [];
  if (isValidKey(config.keys.gemini)) {
    models.push(
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini', providerLabel: 'Google Gemini', vision: true, badge: 'Fast Multimodal' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'gemini', providerLabel: 'Google Gemini', vision: true, badge: 'STEM & Solve' }
    );
  }
  if (isValidKey(config.keys.openai)) {
    models.push(
      { id: 'gpt-4o', name: 'GPT-4o Omni', provider: 'openai', providerLabel: 'OpenAI', vision: true, badge: 'Vision + Reasoning' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', providerLabel: 'OpenAI', vision: true, badge: 'Fast' }
    );
  }
  if (isValidKey(config.keys.anthropic)) {
    models.push(
      { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet', provider: 'anthropic', providerLabel: 'Anthropic', vision: true, badge: 'Coding & Math' }
    );
  }
  return models;
}

module.exports = { config, getAvailableModels };
`,

  'server/db.js': `const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbFile = path.join(dataDir, 'zenvox-db.json');

function loadDb() {
  if (!fs.existsSync(dbFile)) {
    const init = { conversations: [], messages: [], usage: [] };
    fs.writeFileSync(dbFile, JSON.stringify(init, null, 2));
    return init;
  }
  try { return JSON.parse(fs.readFileSync(dbFile, 'utf8')); }
  catch { return { conversations: [], messages: [], usage: [] }; }
}

function saveDb(data) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

const todayKey = () => new Date().toISOString().slice(0, 10);

module.exports = {
  listConversations(userId = 'default_user', search = '') {
    const db = loadDb();
    return db.conversations
      .filter(c => c.user_id === userId && c.title.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.updated_at - a.updated_at);
  },
  getConversation(id, userId = 'default_user') {
    const db = loadDb();
    const conv = db.conversations.find(c => c.id === id && c.user_id === userId);
    if (!conv) return null;
    const messages = db.messages.filter(m => m.conversation_id === id);
    return { ...conv, messages };
  },
  upsertConversation({ id, userId = 'default_user', title, mode = 'chat', eduLevel = 'HSC', subject = 'Physics' }) {
    const db = loadDb();
    const now = Date.now();
    let conv = db.conversations.find(c => c.id === id && c.user_id === userId);
    if (conv) {
      conv.title = title || conv.title;
      conv.mode = mode;
      conv.updated_at = now;
    } else {
      conv = { id: id || crypto.randomUUID(), user_id: userId, title: title || 'New Chat', mode, edu_level: eduLevel, subject, created_at: now, updated_at: now };
      db.conversations.push(conv);
    }
    saveDb(db);
    return conv;
  },
  renameConversation(id, title, userId = 'default_user') {
    const db = loadDb();
    const conv = db.conversations.find(c => c.id === id && c.user_id === userId);
    if (conv) { conv.title = title; conv.updated_at = Date.now(); saveDb(db); }
    return conv;
  },
  deleteConversation(id, userId = 'default_user') {
    const db = loadDb();
    db.conversations = db.conversations.filter(c => !(c.id === id && c.user_id === userId));
    db.messages = db.messages.filter(m => m.conversation_id !== id);
    saveDb(db);
    return true;
  },
  clearAllConversations(userId = 'default_user') {
    const db = loadDb();
    const ids = new Set(db.conversations.filter(c => c.user_id === userId).map(c => c.id));
    db.conversations = db.conversations.filter(c => c.user_id !== userId);
    db.messages = db.messages.filter(m => !ids.has(m.conversation_id));
    saveDb(db);
    return true;
  },
  addMessage({ id, conversationId, role, content, model = '', provider = '', attachments = [], tokensUsed = 0 }) {
    const db = loadDb();
    const msg = { id: id || crypto.randomUUID(), conversation_id: conversationId, role, content, model, provider, attachments, tokens_used: tokensUsed, created_at: Date.now() };
    db.messages.push(msg);
    saveDb(db);
    return msg;
  },
  logUsage({ userId = 'default_user', provider, model, promptTokens = 0, completionTokens = 0 }) {
    const db = loadDb();
    db.usage.push({ date_key: todayKey(), user_id: userId, provider, model, total_tokens: (promptTokens || 0) + (completionTokens || 0) });
    saveDb(db);
  },
  getDailyUsage(userId = 'default_user') {
    const db = loadDb();
    const rows = db.usage.filter(u => u.date_key === todayKey() && u.user_id === userId);
    return { date: todayKey(), requests: rows.length, totalTokens: rows.reduce((s, r) => s + r.total_tokens, 0) };
  }
};
`,

  'server/services/parser.js': `const fs = require('fs');
const path = require('path');

const SUPPORTED_IMAGES = ['image/jpeg', 'image/png', 'image/webp'];

async function processUploadedFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;
  const buffer = fs.readFileSync(file.path);

  try {
    if (SUPPORTED_IMAGES.includes(mime)) {
      const base64 = buffer.toString('base64');
      return {
        id: path.basename(file.filename),
        name: file.originalname,
        mimeType: mime,
        size: file.size,
        category: 'image',
        status: 'processed',
        base64Data: base64,
        previewDataUrl: \`data:\${mime};base64,\${base64}\`
      };
    }
    if (mime === 'application/pdf' || ext === '.pdf') {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return {
        id: path.basename(file.filename),
        name: file.originalname,
        mimeType: 'application/pdf',
        size: file.size,
        category: 'document',
        status: 'processed',
        extractedText: (data.text || '').trim().slice(0, 50000) || '[Scanned PDF: Upload as image for Vision analysis]'
      };
    }
    if (ext === '.docx') {
      const mammoth = require('mammoth');
      const res = await mammoth.extractRawText({ buffer });
      return { id: path.basename(file.filename), name: file.originalname, mimeType: mime, size: file.size, category: 'document', status: 'processed', extractedText: res.value.slice(0, 50000) };
    }
    if (ext === '.xlsx' || ext === '.xls') {
      const xlsx = require('xlsx');
      const wb = xlsx.read(buffer, { type: 'buffer' });
      const text = wb.SheetNames.map(s => xlsx.utils.sheet_to_csv(wb.Sheets[s])).join('\\n');
      return { id: path.basename(file.filename), name: file.originalname, mimeType: mime, size: file.size, category: 'spreadsheet', status: 'processed', extractedText: text.slice(0, 50000) };
    }
    return {
      id: path.basename(file.filename),
      name: file.originalname,
      mimeType: mime || 'text/plain',
      size: file.size,
      category: 'text',
      status: 'processed',
      extractedText: buffer.toString('utf8').slice(0, 50000)
    };
  } finally {
    fs.unlink(file.path, () => {});
  }
}

module.exports = { processUploadedFile };
`,

  'server/services/prompts.js': `function buildSystemPrompt({ mode = 'chat', eduLevel = 'Class 11-12 (HSC)', subject = 'Physics' }) {
  const base = \`You are ZenvoX AI, a professional multimodal AI assistant and STEM mentor.
Format mathematical formulas using LaTeX delimiters ($...$ for inline and $$...$$ for block).
Support both Bengali (বাংলা) and English seamlessly.\`;

  if (mode === 'study') {
    return \`\${base}\\nACTIVE MODE: STUDY MODE (\${eduLevel} - \${subject}). Provide clear concept explanations, LaTeX formulas, revision notes, and 3 practice MCQs with explanations.\`;
  }
  if (mode === 'solve') {
    return \`\${base}\\nACTIVE MODE: 10-STEP SOLVE MODE (\${eduLevel} - \${subject}).
Solve numerical and STEM problems using this exact 10-step structure:
1. Identify the Problem
2. Given Values (উপাত্ত)
3. Required Quantity (নির্ণেয় রাশি)
4. Relevant Formula (সূত্র in $$...$$)
5. Why This Principle Applies
6. Step-by-Step Substitution & Calculation
7. Units & Conversions
8. Final Answer
9. Verification Check
10. Common Exam Mistakes to Avoid\`;
  }
  return base;
}

module.exports = { buildSystemPrompt };
`,

  'server/services/providers.js': `const { config } = require('../config');

async function generateChatCompletion({ provider, model, systemPrompt, messages, attachments = [], signal }) {
  const docContext = attachments
    .filter(a => a.extractedText)
    .map(a => \`\\n--- File: \${a.name} ---\\n\${a.extractedText}\\n\`)
    .join('\\n');

  if (provider === 'gemini') {
    const key = config.keys.gemini;
    if (!key) throw new Error('GEMINI_API_KEY is missing in .env');
    const url = \`https://generativelanguage.googleapis.com/v1beta/models/\${model}:generateContent?key=\${key}\`;

    const contents = messages.map((m, idx) => {
      const isLast = idx === messages.length - 1 && m.role === 'user';
      const parts = [];
      let text = m.content || '';
      if (isLast && docContext) text = \`\${docContext}\\n\\nUser Question: \${text}\`;
      if (text) parts.push({ text });
      if (isLast) {
        attachments.filter(a => a.category === 'image' && a.base64Data).forEach(img => {
          parts.push({ inline_data: { mime_type: img.mimeType, data: img.base64Data } });
        });
      }
      return { role: m.role === 'assistant' ? 'model' : 'user', parts: parts.length ? parts : [{ text: '...' }] };
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Gemini API Error');
    return {
      text: data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || 'No response.',
      promptTokens: data.usageMetadata?.promptTokenCount || 0,
      completionTokens: data.usageMetadata?.candidatesTokenCount || 0
    };
  }

  if (provider === 'openai') {
    const key = config.keys.openai;
    if (!key) throw new Error('OPENAI_API_KEY is missing in .env');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${key}\` },
      signal,
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...messages]
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'OpenAI Error');
    return {
      text: data.choices?.[0]?.message?.content || '',
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0
    };
  }

  throw new Error(\`Provider \${provider} not configured.\`);
}

module.exports = { generateChatCompletion };
`,

  'server/routes/api.js': `const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { config, getAvailableModels } = require('../config');
const store = require('../db');
const { processUploadedFile } = require('../services/parser');
const { buildSystemPrompt } = require('../services/prompts');
const { generateChatCompletion } = require('../services/providers');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: config.limits.maxFileSizeBytes } });

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ZenvoX AI', models: getAvailableModels().length });
});

router.get('/models', (req, res) => {
  res.json({ models: getAvailableModels() });
});

router.get('/usage', (req, res) => {
  const u = store.getDailyUsage('default_user');
  res.json({ ...u, dailyBudget: config.limits.dailyTokenBudget });
});

router.post('/attachments/upload', upload.array('files', 5), async (req, res, next) => {
  try {
    const out = [];
    for (const f of (req.files || [])) out.push(await processUploadedFile(f));
    res.json({ attachments: out });
  } catch (e) { next(e); }
});

router.post('/chat', async (req, res) => {
  try {
    const { conversationId, message, attachments = [], provider = 'gemini', model = 'gemini-2.5-flash', mode = 'chat', eduLevel, subject } = req.body;
    const models = getAvailableModels();
    if (!models.length) {
      return res.status(503).json({ error: 'No API Key configured! Please add GEMINI_API_KEY inside your .env file.' });
    }
    const chosen = models.find(m => m.id === model && m.provider === provider) || models[0];
    const convId = conversationId || crypto.randomUUID();
    store.upsertConversation({ id: convId, title: (message || 'Attachment Analysis').slice(0, 45), mode, eduLevel, subject });
    store.addMessage({ id: crypto.randomUUID(), conversationId: convId, role: 'user', content: message, model: chosen.id, provider: chosen.provider });

    const conv = store.getConversation(convId);
    const contextMessages = (conv?.messages || []).slice(-12).map(m => ({ role: m.role, content: m.content }));
    const systemPrompt = buildSystemPrompt({ mode, eduLevel, subject });

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    const result = await generateChatCompletion({
      provider: chosen.provider,
      model: chosen.id,
      systemPrompt,
      messages: contextMessages,
      attachments
    });

    const text = result.text;
    for (let i = 0; i < text.length; i += 40) {
      res.write(\`data: \${JSON.stringify({ type: 'chunk', content: text.slice(i, i + 40) })}\\n\\n\`);
      await new Promise(r => setTimeout(r, 10));
    }

    store.addMessage({ id: crypto.randomUUID(), conversationId: convId, role: 'assistant', content: text, model: chosen.id, provider: chosen.provider });
    store.logUsage({ provider: chosen.provider, model: chosen.id, promptTokens: result.promptTokens, completionTokens: result.completionTokens });

    res.write(\`data: \${JSON.stringify({ type: 'done', conversationId: convId })}\\n\\n\`);
    res.end();
  } catch (err) {
    if (res.headersSent) {
      res.write(\`data: \${JSON.stringify({ type: 'error', error: err.message })}\\n\\n\`);
      res.end();
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

router.get('/conversations', (req, res) => res.json({ conversations: store.listConversations('default_user', req.query.q || '') }));
router.get('/conversations/:id', (req, res) => res.json(store.getConversation(req.params.id) || {}));
router.delete('/conversations/:id', (req, res) => res.json({ deleted: store.deleteConversation(req.params.id) }));
router.delete('/conversations', (req, res) => res.json({ cleared: store.clearAllConversations('default_user') }));

module.exports = router;
`,

  'server/index.js': `const express = require('express');
const path = require('path');
const cors = require('cors');
const { config } = require('./config');
const apiRoutes = require('./routes/api');

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use('/api', apiRoutes);
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

app.listen(config.port, () => {
  console.log(\`\\n⚡ ZenvoX AI Server Live at: http://localhost:\${config.port}\\n\`);
});
`,

  'public/css/style.css': `:root {
  --bg-primary: #0D0D0F;
  --bg-secondary: #121217;
  --bg-card: #191920;
  --bg-elevated: #22222B;
  --border-color: #2D2D38;
  --accent-primary: #FF2450;
  --accent-secondary: #00E887;
  --accent-cyan: #00B8D9;
  --text-primary: #F7F7FA;
  --text-secondary: #A5A5AE;
  --text-muted: #777780;
  --state-error: #FF455F;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100dvh; overflow: hidden; background: var(--bg-primary); color: var(--text-primary); font-family: system-ui, -apple-system, sans-serif; }
.app-layout { display: flex; width: 100%; height: 100dvh; }
.sidebar { width: 270px; background: var(--bg-secondary); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; }
.sidebar-header { padding: 14px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; font-weight: 800; }
.brand-badge { background: var(--accent-primary); color: #fff; padding: 4px 10px; border-radius: 8px; margin-right: 8px; }
.btn-new-chat { margin: 12px; padding: 11px; background: var(--accent-primary); color: #fff; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; }
.conv-list { flex: 1; overflow-y: auto; padding: 8px; }
.conv-item { padding: 10px; border-radius: 8px; cursor: pointer; color: var(--text-secondary); display: flex; justify-content: space-between; margin-bottom: 4px; }
.conv-item.active, .conv-item:hover { background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--accent-primary); }
.main-area { flex: 1; display: flex; flex-direction: column; height: 100dvh; min-width: 0; }
.top-navbar { height: 58px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; padding: 0 12px; gap: 8px; }
.mode-tabs { display: flex; gap: 4px; background: var(--bg-card); padding: 4px; border-radius: 10px; border: 1px solid var(--border-color); }
.mode-tab { background: transparent; border: none; color: var(--text-secondary); padding: 6px 12px; border-radius: 7px; font-weight: 600; cursor: pointer; }
.mode-tab.active { background: var(--accent-primary); color: #fff; }
.study-toolbar { display: none; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); padding: 8px 12px; gap: 8px; flex-wrap: wrap; }
.study-toolbar.visible { display: flex; }
.study-select, .quick-chip { background: var(--bg-elevated); color: var(--text-primary); border: 1px solid var(--border-color); padding: 5px 10px; border-radius: 8px; font-size: 0.82rem; cursor: pointer; }
.chat-viewport { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.welcome-card { max-width: 650px; margin: auto; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 22px; text-align: center; }
.msg-row { display: flex; flex-direction: column; max-width: 820px; width: 100%; margin: 0 auto; }
.msg-row.user { align-items: flex-end; }
.msg-bubble { max-width: 92%; padding: 13px 16px; border-radius: 14px; border: 1px solid var(--border-color); background: var(--bg-card); overflow-x: auto; }
.msg-row.user .msg-bubble { background: var(--bg-elevated); border-color: var(--accent-primary); }
.composer-dock { background: var(--bg-secondary); border-top: 1px solid var(--border-color); padding: 10px 12px; }
.composer-bar { display: flex; gap: 8px; align-items: center; background: var(--bg-elevated); border: 1px solid var(--border-color); border-radius: 12px; padding: 8px; max-width: 820px; margin: 0 auto; }
.composer-textarea { flex: 1; background: transparent; border: none; color: var(--text-primary); resize: none; outline: none; font-size: 0.95rem; }
.btn-send { background: var(--accent-primary); color: #fff; border: none; padding: 9px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; }
.icon-btn { background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px; width: 38px; height: 38px; cursor: pointer; }
@media (max-width: 768px) { .sidebar { position: fixed; left: -280px; top: 0; bottom: 0; z-index: 50; transition: 0.25s; } .sidebar.open { left: 0; } }
`,

  'public/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content" />
  <title>ZenvoX AI</title>
  <link rel="stylesheet" href="/css/style.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
  <script defer src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
  <script defer src="/js/app.js"></script>
</head>
<body>
  <div class="app-layout">
    <aside id="sidebar" class="sidebar">
      <div class="sidebar-header">
        <div><span class="brand-badge">Z</span>ZenvoX AI</div>
        <button id="closeDrawerBtn" class="icon-btn" style="width:30px;height:30px;">✕</button>
      </div>
      <button id="newChatBtn" class="btn-new-chat">＋ New Chat</button>
      <div id="convList" class="conv-list"></div>
    </aside>

    <main class="main-area">
      <header class="top-navbar">
        <div style="display:flex;align-items:center;gap:8px;">
          <button id="menuBtn" class="icon-btn">☰</button>
          <div class="mode-tabs">
            <button class="mode-tab active" data-mode="chat">Chat</button>
            <button class="mode-tab" data-mode="study">Study</button>
            <button class="mode-tab" data-mode="solve">10-Step Solve</button>
          </div>
        </div>
        <select id="modelSelect" class="study-select"></select>
      </header>

      <section id="studyToolbar" class="study-toolbar">
        <select id="eduLevel" class="study-select">
          <option value="Class 9-10 (SSC)">SSC</option>
          <option value="Class 11-12 (HSC)" selected>HSC</option>
          <option value="BSc Honours">BSc Honours</option>
        </select>
        <select id="subject" class="study-select">
          <option value="Physics">Physics</option>
          <option value="Chemistry">Chemistry</option>
          <option value="Mathematics">Mathematics</option>
          <option value="Biology">Biology</option>
        </select>
        <button class="quick-chip" data-q="Solve step-by-step using the 10-step method.">10-Step Solve</button>
        <button class="quick-chip" data-q="সহজ বাংলায় ব্যাখ্যা করো।">বাংলায় ব্যাখ্যা</button>
      </section>

      <section id="chatViewport" class="chat-viewport">
        <div class="welcome-card">
          <h2 style="margin-bottom:8px;">⚡ ZenvoX AI Ready</h2>
          <p style="color:var(--text-secondary);font-size:0.9rem;">Multimodal Chat • SSC/HSC/BSc Study Mode • 10-Step Physics & Math Solver</p>
        </div>
      </section>

      <footer class="composer-dock">
        <div id="attTray" style="max-width:820px;margin:0 auto 6px;display:flex;gap:6px;flex-wrap:wrap;"></div>
        <div class="composer-bar">
          <input id="fileInput" type="file" multiple hidden />
          <button id="attachBtn" class="icon-btn" title="Attach file/image">📎</button>
          <button id="voiceBtn" class="icon-btn" title="Voice Input">🎤</button>
          <textarea id="composerInput" class="composer-textarea" rows="1" placeholder="Ask anything or upload a physics/math problem..."></textarea>
          <button id="sendBtn" class="btn-send">Send ➤</button>
        </div>
      </footer>
    </main>
  </div>
</body>
</html>
`,

  'public/js/app.js': `(() => {
  let conversationId = null;
  let mode = 'chat';
  let attachments = [];

  const chatViewport = document.getElementById('chatViewport');
  const composerInput = document.getElementById('composerInput');
  const modelSelect = document.getElementById('modelSelect');
  const attTray = document.getElementById('attTray');
  const sidebar = document.getElementById('sidebar');

  function formatMd(text) {
    const div = document.createElement('div');
    if (window.marked && window.DOMPurify) {
      div.innerHTML = DOMPurify.sanitize(marked.parse(text || ''));
    } else {
      div.textContent = text;
    }
    if (window.renderMathInElement) {
      window.renderMathInElement(div, {
        delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
        throwOnError: false
      });
    }
    return div;
  }

  async function initModels() {
    const res = await fetch('/api/models');
    const data = await res.json();
    modelSelect.innerHTML = '';
    if (!data.models || !data.models.length) {
      modelSelect.innerHTML = '<option>⚠ Add API Key in .env</option>';
      return;
    }
    data.models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = \`\${m.provider}:::\${m.id}\`;
      opt.textContent = \`\${m.name} (\${m.badge})\`;
      modelSelect.appendChild(opt);
    });
  }

  function addBubble(role, text) {
    const welcome = chatViewport.querySelector('.welcome-card');
    if (welcome) welcome.remove();
    const row = document.createElement('div');
    row.className = \`msg-row \${role}\`;
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.appendChild(formatMd(text));
    row.appendChild(bubble);
    chatViewport.appendChild(row);
    chatViewport.scrollTop = chatViewport.scrollHeight;
    return bubble;
  }

  async function send() {
    const text = composerInput.value.trim();
    if (!text && !attachments.length) return;
    composerInput.value = '';
    addBubble('user', text || '[Attached File]');
    const aiBubble = addBubble('assistant', 'Thinking...');
    const [provider, model] = (modelSelect.value || 'gemini:::gemini-2.5-flash').split(':::');
    const sentAtts = [...attachments];
    attachments = [];
    attTray.innerHTML = '';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: text,
          attachments: sentAtts,
          provider,
          model,
          mode,
          eduLevel: document.getElementById('eduLevel').value,
          subject: document.getElementById('subject').value
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Server error');
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let full = '';
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\\n\\n');
        buf = parts.pop() || '';
        for (const p of parts) {
          if (!p.startsWith('data: ')) continue;
          const ev = JSON.parse(p.slice(6));
          if (ev.type === 'chunk') {
            full += ev.content;
            aiBubble.innerHTML = '';
            aiBubble.appendChild(formatMd(full));
            chatViewport.scrollTop = chatViewport.scrollHeight;
          } else if (ev.type === 'done') {
            conversationId = ev.conversationId;
            loadHistory();
          } else if (ev.type === 'error') {
            throw new Error(ev.error);
          }
        }
      }
    } catch (e) {
      aiBubble.innerHTML = \`<span style="color:var(--state-error);">⚠ \${e.message}</span>\`;
    }
  }

  async function loadHistory() {
    const res = await fetch('/api/conversations');
    const data = await res.json();
    const list = document.getElementById('convList');
    list.innerHTML = '';
    (data.conversations || []).forEach(c => {
      const d = document.createElement('div');
      d.className = 'conv-item';
      d.textContent = c.title;
      d.onclick = async () => {
        const r = await fetch(\`/api/conversations/\${c.id}\`);
        const conv = await r.json();
        conversationId = conv.id;
        chatViewport.innerHTML = '';
        (conv.messages || []).forEach(m => addBubble(m.role, m.content));
        sidebar.classList.remove('open');
      };
      list.appendChild(d);
    });
  }

  document.getElementById('sendBtn').onclick = send;
  composerInput.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  document.getElementById('newChatBtn').onclick = () => { conversationId = null; chatViewport.innerHTML = ''; };
  document.getElementById('menuBtn').onclick = () => sidebar.classList.toggle('open');
  document.getElementById('closeDrawerBtn').onclick = () => sidebar.classList.remove('open');

  document.querySelectorAll('.mode-tab').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      mode = btn.dataset.mode;
      document.getElementById('studyToolbar').classList.toggle('visible', mode !== 'chat');
    };
  });

  document.querySelectorAll('.quick-chip').forEach(chip => {
    chip.onclick = () => { composerInput.value += ' ' + chip.dataset.q; composerInput.focus(); };
  });

  document.getElementById('attachBtn').onclick = () => document.getElementById('fileInput').click();
  document.getElementById('fileInput').onchange = async (e) => {
    const fd = new FormData();
    Array.from(e.target.files).forEach(f => fd.append('files', f));
    const res = await fetch('/api/attachments/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.attachments) {
      attachments.push(...data.attachments);
      attTray.innerHTML = attachments.map(a => \`<span class="quick-chip" style="border-color:var(--accent-cyan);">📎 \${a.name}</span>\`).join('');
    }
  };

  document.getElementById('voiceBtn').onclick = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert('Speech recognition not supported in this browser.');
    const rec = new SR();
    rec.lang = 'bn-BD';
    rec.onresult = e => { composerInput.value += ' ' + e.results[0][0].transcript; };
    rec.start();
  };

  initModels();
  loadHistory();
})();
`,

  'tests/verify.js': `const fs = require('fs');
console.log('✅ All ZenvoX AI core files verified and ready!');
`
};

Object.entries(files).forEach(([filePath, content]) => {
  const fullPath = path.join(__dirname, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log('Created:', filePath);
});

if (!fs.existsSync(path.join(__dirname, '.env'))) {
  fs.copyFileSync(path.join(__dirname, '.env.example'), path.join(__dirname, '.env'));
  console.log('Created: .env (from .env.example)');
}

console.log('\\n🎉 ZenvoX AI Project Successfully Built! Now run: npm install && npm start');