// FILE PATH: server/index.js
// ============================================================================
// ZENVOX AI PRO — UNIFIED FULL-STACK BACKEND ENGINE (AUTO-MODEL DISCOVERY FIX)
// ============================================================================

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'production',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()),
  jwtSecret: process.env.JWT_SECRET || 'zenvox_pro_fallback_secret_2026',
  adminEmail: (process.env.ADMIN_EMAIL || 'admin@zenvox.ai').toLowerCase(),
  adminPassword: process.env.ADMIN_INITIAL_PASSWORD || 'ZenvoX@Admin2026',
  keys: {
    gemini: (process.env.GEMINI_API_KEY || '').trim(),
    openai: (process.env.OPENAI_API_KEY || '').trim(),
    anthropic: (process.env.ANTHROPIC_API_KEY || '').trim(),
    video: (process.env.VIDEO_GEN_API_KEY || '').trim()
  },
  defaults: {
    provider: process.env.DEFAULT_PROVIDER || 'gemini',
    model: process.env.DEFAULT_MODEL || 'gemini-3.8-flash'
  },
  limits: {
    rateWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    rateMax: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '35', 10),
    maxFileSizeBytes: parseInt(process.env.MAX_FILE_SIZE_MB || '15', 10) * 1024 * 1024,
    maxFiles: parseInt(process.env.MAX_FILES_PER_MESSAGE || '5', 10),
    timeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '60000', 10),
    dailyTokenBudget: parseInt(process.env.DAILY_TOKEN_BUDGET || '500000', 10)
  }
};

function isKeyConfigured(key) {
  return Boolean(key && key.trim().length > 10 && !key.includes('your_'));
}

function getAvailableModels() {
  const models = [];
  if (isKeyConfigured(config.keys.gemini)) {
    models.push(
      {
        id: 'gemini-3.8-flash',
        name: 'Gemini 3.8 Flash',
        provider: 'gemini',
        providerLabel: 'Google Gemini',
        vision: true,
        documents: true,
        streaming: true,
        badge: 'Latest & Multimodal'
      },
      {
        id: 'gemini-flash-latest',
        name: 'Gemini Flash (Auto-Latest)',
        provider: 'gemini',
        providerLabel: 'Google Gemini',
        vision: true,
        documents: true,
        streaming: true,
        badge: 'Auto-Updated'
      },
      {
        id: 'gemini-pro-latest',
        name: 'Gemini Pro (Deep STEM)',
        provider: 'gemini',
        providerLabel: 'Google Gemini',
        vision: true,
        documents: true,
        streaming: true,
        badge: 'Deep STEM & Solve'
      }
    );
  }
  if (isKeyConfigured(config.keys.openai)) {
    models.push(
      {
        id: 'gpt-4o',
        name: 'GPT-4o Omni',
        provider: 'openai',
        providerLabel: 'OpenAI',
        vision: true,
        documents: true,
        streaming: true,
        badge: 'Vision + Reasoning'
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        providerLabel: 'OpenAI',
        vision: true,
        documents: true,
        streaming: true,
        badge: 'Lightweight'
      }
    );
  }
  if (isKeyConfigured(config.keys.anthropic)) {
    models.push(
      {
        id: 'claude-3-7-sonnet-latest',
        name: 'Claude 3.7 Sonnet',
        provider: 'anthropic',
        providerLabel: 'Anthropic',
        vision: true,
        documents: true,
        streaming: true,
        badge: 'Coding & Analysis'
      }
    );
  }
  return models;
}

// ============================================================================
// PERSISTENT JSON DATABASE ENGINE
// ============================================================================
const dataDir = path.join(__dirname, '..', 'data');
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const dbFilePath = path.join(dataDir, 'zenvox-store.json');

function initStoreData() {
  const defaultData = { users: [], conversations: [], messages: [], usageLogs: [], mediaJobs: [] };
  const adminHash = bcrypt.hashSync(config.adminPassword, 10);
  defaultData.users.push({
    id: 'admin_root_01',
    name: 'ZenvoX Admin',
    email: config.adminEmail,
    password_hash: adminHash,
    role: 'admin',
    daily_budget: 2000000,
    created_at: Date.now()
  });
  return defaultData;
}

let dbCache = null;

function readDb() {
  if (dbCache) return dbCache;
  if (!fs.existsSync(dbFilePath)) {
    dbCache = initStoreData();
    fs.writeFileSync(dbFilePath, JSON.stringify(dbCache, null, 2), 'utf8');
    return dbCache;
  }
  try {
    dbCache = JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));
    if (!dbCache.users) dbCache.users = [];
    if (!dbCache.conversations) dbCache.conversations = [];
    if (!dbCache.messages) dbCache.messages = [];
    if (!dbCache.usageLogs) dbCache.usageLogs = [];
    if (!dbCache.mediaJobs) dbCache.mediaJobs = [];
    return dbCache;
  } catch (_) {
    dbCache = initStoreData();
    return dbCache;
  }
}

function writeDb() {
  if (!dbCache) return;
  try { fs.writeFileSync(dbFilePath, JSON.stringify(dbCache, null, 2), 'utf8'); } catch (_) {}
}

const todayKey = () => new Date().toISOString().slice(0, 10);

const store = {
  createUser({ name, email, password }) {
    const db = readDb();
    const cleanEmail = email.trim().toLowerCase();
    if (db.users.some(u => u.email === cleanEmail)) throw new Error('An account with this email already exists.');
    const user = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: cleanEmail,
      password_hash: bcrypt.hashSync(password, 10),
      role: 'user',
      daily_budget: config.limits.dailyTokenBudget,
      created_at: Date.now()
    };
    db.users.push(user);
    writeDb();
    return { id: user.id, name: user.name, email: user.email, role: user.role, dailyBudget: user.daily_budget };
  },
  verifyUser(email, password) {
    const db = readDb();
    const user = db.users.find(u => u.email === email.trim().toLowerCase());
    if (!user || !bcrypt.compareSync(password, user.password_hash)) throw new Error('Invalid email or password.');
    return { id: user.id, name: user.name, email: user.email, role: user.role, dailyBudget: user.daily_budget };
  },
  getUserById(id) {
    const u = readDb().users.find(x => x.id === id);
    return u ? { id: u.id, name: u.name, email: u.email, role: u.role, dailyBudget: u.daily_budget } : null;
  },
  listConversations(userId, search = '') {
    const q = search.trim().toLowerCase();
    return readDb().conversations
      .filter(c => c.user_id === userId && (!q || c.title.toLowerCase().includes(q)))
      .sort((a, b) => b.updated_at - a.updated_at);
  },
  getConversation(id, userId) {
    const db = readDb();
    const conv = db.conversations.find(c => c.id === id && c.user_id === userId);
    if (!conv) return null;
    const messages = db.messages.filter(m => m.conversation_id === id).sort((a, b) => a.created_at - b.created_at);
    return { ...conv, messages };
  },
  upsertConversation({ id, userId, title, mode = 'chat', eduLevel = 'Class 11-12 (HSC)', subject = 'Physics' }) {
    const db = readDb();
    const now = Date.now();
    let conv = db.conversations.find(c => c.id === id && c.user_id === userId);
    if (conv) {
      conv.title = title || conv.title;
      conv.mode = mode || conv.mode;
      conv.edu_level = eduLevel || conv.edu_level;
      conv.subject = subject || conv.subject;
      conv.updated_at = now;
    } else {
      conv = { id: id || crypto.randomUUID(), user_id: userId, title: title || 'New Conversation', mode, edu_level: eduLevel, subject, created_at: now, updated_at: now };
      db.conversations.push(conv);
    }
    writeDb();
    return conv;
  },
  renameConversation(id, title, userId) {
    const db = readDb();
    const conv = db.conversations.find(c => c.id === id && c.user_id === userId);
    if (!conv) return null;
    conv.title = title;
    conv.updated_at = Date.now();
    writeDb();
    return conv;
  },
  deleteConversation(id, userId) {
    const db = readDb();
    const exists = db.conversations.some(c => c.id === id && c.user_id === userId);
    if (!exists) return false;
    db.conversations = db.conversations.filter(c => !(c.id === id && c.user_id === userId));
    db.messages = db.messages.filter(m => m.conversation_id !== id);
    writeDb();
    return true;
  },
  clearAllConversations(userId) {
    const db = readDb();
    const userConvIds = new Set(db.conversations.filter(c => c.user_id === userId).map(c => c.id));
    db.conversations = db.conversations.filter(c => c.user_id !== userId);
    db.messages = db.messages.filter(m => !userConvIds.has(m.conversation_id));
    writeDb();
    return true;
  },
  addMessage({ id, conversationId, role, content, model = '', provider = '', attachments = [], tokensUsed = 0 }) {
    const db = readDb();
    const now = Date.now();
    const msg = { id: id || crypto.randomUUID(), conversation_id: conversationId, role, content, model, provider, attachments, tokens_used: tokensUsed, created_at: now };
    db.messages.push(msg);
    const conv = db.conversations.find(c => c.id === conversationId);
    if (conv) conv.updated_at = now;
    writeDb();
    return msg;
  },
  logUsage({ userId, provider, model, promptTokens = 0, completionTokens = 0 }) {
    const db = readDb();
    const total = (promptTokens || 0) + (completionTokens || 0);
    db.usageLogs.push({ id: db.usageLogs.length + 1, date_key: todayKey(), user_id: userId, provider, model, prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: total, created_at: Date.now() });
    writeDb();
  },
  getDailyUsage(userId) {
    const dKey = todayKey();
    const logs = readDb().usageLogs.filter(u => u.date_key === dKey && u.user_id === userId);
    return { date: dKey, requests: logs.length, totalTokens: logs.reduce((acc, r) => acc + (r.total_tokens || 0), 0) };
  },
  getAdminMetrics() {
    const db = readDb();
    const dKey = todayKey();
    const todayLogs = db.usageLogs.filter(u => u.date_key === dKey);
    const modelMap = {};
    todayLogs.forEach(l => {
      const k = `${l.provider} (${l.model})`;
      if (!modelMap[k]) modelMap[k] = { model: k, requests: 0, tokens: 0 };
      modelMap[k].requests += 1;
      modelMap[k].tokens += l.total_tokens;
    });
    return { date: dKey, totalUsers: db.users.length, totalConversations: db.conversations.length, totalMessages: db.messages.length, todayUsage: Object.values(modelMap) };
  },
  createMediaJob({ id, userId, type, prompt, status = 'queued', resultUrl = null }) {
    const db = readDb();
    const job = { id: id || crypto.randomUUID(), user_id: userId, type, prompt, status, result_url: resultUrl, error: null, created_at: Date.now(), updated_at: Date.now() };
    db.mediaJobs.push(job);
    writeDb();
    return job;
  },
  getMediaJob(id, userId) {
    return readDb().mediaJobs.find(j => j.id === id && j.user_id === userId) || null;
  }
};

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, config.jwtSecret, { expiresIn: '7d' });
}

function authenticateOptional(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), config.jwtSecret);
      const dbUser = store.getUserById(decoded.id);
      if (dbUser) { req.user = dbUser; return next(); }
    } catch (_) {}
  }
  const rawGuest = (req.headers['x-guest-id'] || 'default_guest').replace(/[^a-zA-Z0-9_-]/g, '');
  req.user = { id: `guest_${rawGuest}`, name: 'Guest Scholar', role: 'guest', dailyBudget: config.limits.dailyTokenBudget };
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator privileges required.' });
  next();
}

// ============================================================================
// MULTIMODAL FILE PARSER & OCR
// ============================================================================
const SUPPORTED_IMAGES = ['image/jpeg', 'image/png', 'image/webp'];
const TEXT_EXTENSIONS = ['.txt', '.md', '.csv', '.json', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.html', '.css', '.sql', '.xml', '.yaml', '.yml', '.sh'];

async function runLocalOcr(buffer) {
  if (process.env.ENABLE_LOCAL_OCR === 'false') return null;
  try {
    const Tesseract = require('tesseract.js');
    const langs = process.env.OCR_LANGUAGES || 'eng+ben';
    const { data: { text } } = await Tesseract.recognize(buffer, langs);
    return (text || '').trim();
  } catch (_) {
    return null;
  }
}

async function processUploadedFile(file, enableOcr = false) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;
  const buffer = fs.readFileSync(file.path);

  try {
    if (SUPPORTED_IMAGES.includes(mime)) {
      const base64 = buffer.toString('base64');
      let ocrText = null;
      if (enableOcr) ocrText = await runLocalOcr(buffer);
      return {
        id: path.basename(file.filename),
        name: file.originalname,
        mimeType: mime,
        size: file.size,
        category: 'image',
        status: ocrText ? 'vision+ocr_ready' : 'processed',
        base64Data: base64,
        previewDataUrl: `data:${mime};base64,${base64}`,
        extractedText: ocrText ? `[OCR Extracted Text from ${file.originalname}]:\n${ocrText}` : null
      };
    }

    if (mime === 'application/pdf' || ext === '.pdf') {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      const text = (data.text || '').trim();
      return {
        id: path.basename(file.filename),
        name: file.originalname,
        mimeType: 'application/pdf',
        size: file.size,
        category: 'document',
        pages: data.numpages || 1,
        status: text.length > 0 ? 'processed' : 'ocr_needed',
        extractedText: text.length > 0 ? text.slice(0, 60000) : '[Scanned PDF]'
      };
    }

    if (ext === '.docx' || mime.includes('wordprocessingml')) {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return { id: path.basename(file.filename), name: file.originalname, mimeType: mime, size: file.size, category: 'document', status: 'processed', extractedText: (result.value || '').trim().slice(0, 60000) };
    }

    if (ext === '.xlsx' || ext === '.xls' || mime.includes('spreadsheet')) {
      const xlsx = require('xlsx');
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheetsText = workbook.SheetNames.map(name => `--- Sheet: ${name} ---\n${xlsx.utils.sheet_to_csv(workbook.Sheets[name])}`).join('\n\n');
      return { id: path.basename(file.filename), name: file.originalname, mimeType: mime, size: file.size, category: 'spreadsheet', status: 'processed', extractedText: sheetsText.slice(0, 60000) };
    }

    if (TEXT_EXTENSIONS.includes(ext) || mime.startsWith('text/') || mime === 'application/json') {
      return { id: path.basename(file.filename), name: file.originalname, mimeType: mime || 'text/plain', size: file.size, category: 'code_or_text', status: 'processed', extractedText: buffer.toString('utf-8').slice(0, 60000) };
    }

    throw new Error(`Unsupported file format (${ext || mime}).`);
  } finally {
    fs.unlink(file.path, () => {});
  }
}

// ============================================================================
// SYSTEM PROMPTS (CHAT, STUDY MODE, 10-STEP SOLVE MODE)
// ============================================================================
function buildSystemPrompt({ mode = 'chat', eduLevel = 'Class 11-12 (HSC)', subject = 'Physics' }) {
  const coreRules = `You are ZenvoX AI, an advanced multimodal AI assistant and STEM academic mentor.
CRITICAL RULES:
1. Format all mathematical formulas using LaTeX delimiters: inline $...$ and block $$...$$ for KaTeX rendering.
2. Support both Bengali (বাংলা) and English seamlessly.`;

  if (mode === 'study') {
    return `${coreRules}
ACTIVE MODE: ADVANCED EDUCATIONAL STUDY MODE (${eduLevel} | ${subject})
Provide:
- **Concept Overview**: Intuitive explanation tailored to ${eduLevel}.
- **Key Formulas & Theorems**: Rendered in LaTeX ($$...$$) with variable definitions.
- **Exam Revision & Creative Question (সৃজনশীল) Notes**: High-yield board/university exam points.
- **Self-Test MCQs**: 3 practice MCQs with detailed explanations at the end.`;
  }

  if (mode === 'solve') {
    return `${coreRules}
ACTIVE MODE: PRECISION 10-STEP STEM SOLVE MODE (${eduLevel} | ${subject})
For every numerical, physics, chemistry, or mathematics problem, strictly follow this 10-step structure:
1. **Identify the Problem**
2. **Given Values (উপাত্ত)**
3. **Required Quantity (নির্ণেয় রাশি)**
4. **Relevant Formula / Principle (সূত্র)** in LaTeX ($$...$$)
5. **Why This Principle Applies**
6. **Step-by-Step Substitution & Calculation**
7. **Units & Dimensional Conversion**
8. **Final Answer**
9. **Verification / Sanity Check**
10. **Common Exam Mistakes to Avoid**`;
  }

  return `${coreRules}\nProvide clear, well-structured Markdown responses with syntax-highlighted code blocks, tables where useful, and accurate LaTeX equations ($...$ and $$...$$).`;
}

// ============================================================================
// SMART GEMINI ADAPTER WITH AUTO-MODEL DISCOVERY (SOLVES DEPRECATION ERRORS)
// ============================================================================
function formatAttachmentsContext(attachments = []) {
  return attachments
    .filter(a => a.extractedText)
    .map(a => `\n--- ATTACHED DOCUMENT: "${a.name}" (${a.mimeType}) ---\n${a.extractedText}\n--- END OF "${a.name}" ---\n`)
    .join('\n');
}

async function discoverWorkingGeminiModels(apiKey) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    if (!data.models) return [];
    return data.models
      .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name.replace(/^models\//, ''))
      .filter(name => name.includes('gemini'));
  } catch (_) {
    return [];
  }
}

async function callGemini({ model, systemPrompt, messages, attachments = [], signal }) {
  const apiKey = config.keys.gemini;
  if (!isKeyConfigured(apiKey)) throw new Error('GEMINI_API_KEY is not configured on the server.');

  const contents = messages.map((m, idx) => {
    const isLastUser = m.role === 'user' && idx === messages.length - 1;
    const parts = [];
    let textPayload = m.content || '';

    if (isLastUser && attachments.length > 0) {
      const docText = formatAttachmentsContext(attachments);
      if (docText) textPayload = `${docText}\n\nUser Question:\n${textPayload}`;
    }
    if (textPayload) parts.push({ text: textPayload });

    if (isLastUser && attachments.length > 0) {
      for (const att of attachments) {
        if (att.category === 'image' && att.base64Data) {
          parts.push({ inline_data: { mime_type: att.mimeType, data: att.base64Data } });
        }
      }
    }
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: parts.length ? parts : [{ text: 'Analyze the input.' }]
    };
  });

  // Primary candidate models including gemini-3.8-flash
  const candidates = Array.from(new Set([
    'gemini-3.8-flash',
    model,
    'gemini-flash-latest',
    'gemini-3.0-flash',
    'gemini-pro-latest',
    'gemini-2.0-flash'
  ])).filter(Boolean);

  let lastError = null;

  for (const candidateModel of candidates) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidateModel)}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 8192 }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        lastError = new Error(data.error?.message || `Gemini API Error (${response.status})`);
        continue;
      }

      const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || 'No response generated.';
      return {
        text,
        usedModel: candidateModel,
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0
      };
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      lastError = err;
    }
  }

  // Dynamic Auto-Discovery Fallback: Query Google API for active models on this key
  const discovered = await discoverWorkingGeminiModels(apiKey);
  const flashFirst = discovered.sort((a, b) => (b.includes('flash') ? 1 : 0) - (a.includes('flash') ? 1 : 0));

  for (const dynModel of flashFirst.slice(0, 5)) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(dynModel)}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 8192 }
        })
      });
      const data = await response.json();
      if (!response.ok) continue;
      const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || 'No response generated.';
      return {
        text,
        usedModel: dynModel,
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0
      };
    } catch (_) {}
  }

  throw lastError || new Error('Failed to generate response from Gemini API.');
}

// ============================================================================
// EXPRESS SERVER & ROUTES (SUPPORTS BOTH SSE STREAMING & JSON)
// ============================================================================
const app = express();
app.set('trust proxy', 1);
const router = express.Router();

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

const apiLimiter = rateLimit({
  windowMs: config.limits.rateWindowMs,
  max: config.limits.rateMax,
  standardHeaders: true,
  legacyHeaders: false
});

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: config.limits.maxFileSizeBytes, files: config.limits.maxFiles }
});

router.use(authenticateOptional);

router.get('/health', (req, res) => {
  res.json({ status: 'ok', geminiConfigured: isKeyConfigured(config.keys.gemini) });
});

router.get('/models', (req, res) => {
  res.json({
    models: getAvailableModels(),
    defaultProvider: 'gemini',
    defaultModel: 'gemini-3.8-flash',
    geminiConfigured: isKeyConfigured(config.keys.gemini)
  });
});

router.post('/auth/register', (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 6) {
      return res.status(400).json({ error: 'Name, valid email, and password (6+ chars) required.' });
    }
    const user = store.createUser({ name, email, password });
    res.json({ token: signToken(user), user });
  } catch (err) { next(err); }
});

router.post('/auth/login', (req, res) => {
  try {
    const user = store.verifyUser(req.body.email || '', req.body.password || '');
    res.json({ token: signToken(user), user });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

router.get('/auth/me', (req, res) => res.json({ user: req.user }));
router.get('/admin/metrics', requireAdmin, (req, res) => res.json(store.getAdminMetrics()));

router.get('/usage', (req, res) => {
  const u = store.getDailyUsage(req.user.id);
  const budget = req.user.dailyBudget || config.limits.dailyTokenBudget;
  res.json({ ...u, dailyBudget: budget, remainingBudget: Math.max(0, budget - u.totalTokens) });
});

router.post('/attachments/upload', upload.array('files', config.limits.maxFiles), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files selected.' });
    const enableOcr = req.body.ocr === 'true';
    const processed = [];
    for (const file of req.files) processed.push(await processUploadedFile(file, enableOcr));
    res.json({ attachments: processed });
  } catch (err) { next(err); }
});

router.post('/chat', async (req, res) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.limits.timeoutMs);
  req.on('close', () => controller.abort());

  try {
    const {
      conversationId,
      message,
      attachments = [],
      model = 'gemini-3.8-flash',
      mode = 'chat',
      eduLevel = 'Class 11-12 (HSC)',
      subject = 'Physics'
    } = req.body;

    if (!message?.trim() && attachments.length === 0) {
      return res.status(400).json({ error: 'Please enter a message or attach a file.' });
    }

    const convId = conversationId || crypto.randomUUID();
    const autoTitle = (message || attachments[0]?.name || 'New Chat').slice(0, 46).trim();
    store.upsertConversation({ id: convId, userId: req.user.id, title: autoTitle, mode, eduLevel, subject });

    const safeMeta = attachments.map(a => ({ id: a.id, name: a.name, mimeType: a.mimeType, size: a.size, category: a.category, status: a.status }));
    store.addMessage({
      id: crypto.randomUUID(),
      conversationId: convId,
      role: 'user',
      content: message || `[Attached ${attachments.length} file(s)]`,
      model,
      provider: 'gemini',
      attachments: safeMeta
    });

    const convData = store.getConversation(convId, req.user.id);
    const contextMessages = (convData?.messages || []).slice(-14).map(m => ({ role: m.role, content: m.content }));
    const systemPrompt = buildSystemPrompt({ mode, eduLevel, subject });

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const result = await callGemini({
      model,
      systemPrompt,
      messages: contextMessages,
      attachments,
      signal: controller.signal
    });

    const fullText = result.text;
    const chunkSize = 45;
    for (let i = 0; i < fullText.length; i += chunkSize) {
      if (controller.signal.aborted) break;
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: fullText.slice(i, i + chunkSize) })}\n\n`);
      await new Promise(r => setTimeout(r, 10));
    }

    const totalTokens = (result.promptTokens || 0) + (result.completionTokens || 0);
    store.addMessage({
      id: crypto.randomUUID(),
      conversationId: convId,
      role: 'assistant',
      content: fullText,
      model: result.usedModel || model,
      provider: 'gemini',
      tokensUsed: totalTokens
    });

    store.logUsage({
      userId: req.user.id,
      provider: 'gemini',
      model: result.usedModel || model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens
    });

    res.write(`data: ${JSON.stringify({
      type: 'done',
      conversationId: convId,
      model: result.usedModel || model,
      provider: 'gemini',
      tokensUsed: totalTokens
    })}\n\n`);
    res.end();
  } catch (err) {
    const safeMsg = err.name === 'AbortError' ? 'Generation stopped.' : (err.message || 'AI request failed.');
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: safeMsg })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: safeMsg });
    }
  } finally {
    clearTimeout(timeout);
  }
});

router.get('/conversations', (req, res) => res.json({ conversations: store.listConversations(req.user.id, req.query.q || '') }));
router.get('/conversations/:id', (req, res) => {
  const c = store.getConversation(req.params.id, req.user.id);
  if (!c) return res.status(404).json({ error: 'Conversation not found.' });
  res.json(c);
});
router.patch('/conversations/:id', (req, res) => res.json(store.renameConversation(req.params.id, (req.body.title || 'Chat').trim(), req.user.id)));
router.delete('/conversations/:id', (req, res) => res.json({ deleted: store.deleteConversation(req.params.id, req.user.id) }));
router.delete('/conversations', (req, res) => res.json({ cleared: store.clearAllConversations(req.user.id) }));

router.get('/conversations/:id/export', (req, res) => {
  const conv = store.getConversation(req.params.id, req.user.id);
  if (!conv) return res.status(404).send('Not found');
  const lines = [`# ${conv.title}\n`];
  for (const m of conv.messages) lines.push(`### ${m.role === 'user' ? 'User' : 'ZenvoX AI'}\n${m.content}\n`);
  res.setHeader('Content-Disposition', `attachment; filename="zenvox-${conv.id.slice(0, 8)}.md"`);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(lines.join('\n'));
});

app.use('/api', apiLimiter, router);
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

app.listen(config.port, '0.0.0.0', () => {
  console.log(`⚡ ZenvoX AI Pro Live on port ${config.port}`);
});