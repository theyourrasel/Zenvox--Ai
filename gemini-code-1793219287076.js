// FILE PATH: public/js/app.js
// ============================================================================
// ZENVOX AI PRO — UNIFIED FRONTEND APPLICATION ENGINE
// Includes: SSE Streaming, KaTeX Math, Highlight.js, Smart Attachments,
// Bengali/English Voice I/O, Study/Solve Mode, Auth & Admin Modals
// ============================================================================

(() => {
  const state = {
    conversationId: null,
    mode: 'chat',
    models: [],
    pendingAttachments: [],
    abortController: null,
    recognition: null,
    isListening: false,
    lastUserMessage: '',
    isRegisterMode: false,
    currentUser: null
  };

  const els = {
    sidebar: document.getElementById('sidebar'),
    mobileBackdrop: document.getElementById('mobileBackdrop'),
    toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
    closeSidebarBtn: document.getElementById('closeSidebarBtn'),
    newChatBtn: document.getElementById('newChatBtn'),
    searchConvInput: document.getElementById('searchConvInput'),
    convList: document.getElementById('convList'),
    usageLabel: document.getElementById('usageLabel'),
    usageBarFill: document.getElementById('usageBarFill'),
    exportChatBtn: document.getElementById('exportChatBtn'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    modeTabs: document.querySelectorAll('.mode-tab'),
    studyToolbar: document.getElementById('studyToolbar'),
    eduLevelSelect: document.getElementById('eduLevelSelect'),
    subjectSelect: document.getElementById('subjectSelect'),
    quickChips: document.querySelectorAll('.quick-chip[data-quick]'),
    ocrToggleCheckbox: document.getElementById('ocrToggleCheckbox'),
    voiceLangSelect: document.getElementById('voiceLangSelect'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    chatViewport: document.getElementById('chatViewport'),
    attachmentTray: document.getElementById('attachmentTray'),
    fileInput: document.getElementById('fileInput'),
    attachBtn: document.getElementById('attachBtn'),
    voiceInputBtn: document.getElementById('voiceInputBtn'),
    composerInput: document.getElementById('composerInput'),
    stopBtn: document.getElementById('stopBtn'),
    sendBtn: document.getElementById('sendBtn'),
    modelSelect: document.getElementById('modelSelect'),
    statusBanner: document.getElementById('statusBanner'),
    authOpenBtn: document.getElementById('authOpenBtn'),
    authModal: document.getElementById('authModal'),
    closeAuthModal: document.getElementById('closeAuthModal'),
    authForm: document.getElementById('authForm'),
    authNameInput: document.getElementById('authNameInput'),
    authEmailInput: document.getElementById('authEmailInput'),
    authPassInput: document.getElementById('authPassInput'),
    authErrorMsg: document.getElementById('authErrorMsg'),
    authSubmitBtn: document.getElementById('authSubmitBtn'),
    authSwitchBtn: document.getElementById('authSwitchBtn'),
    authSwitchPrompt: document.getElementById('authSwitchPrompt'),
    authUserView: document.getElementById('authUserView'),
    authUserName: document.getElementById('authUserName'),
    authUserRole: document.getElementById('authUserRole'),
    logoutBtn: document.getElementById('logoutBtn'),
    adminDashBtn: document.getElementById('adminDashBtn'),
    adminModal: document.getElementById('adminModal'),
    closeAdminModal: document.getElementById('closeAdminModal'),
    adminMetricsBody: document.getElementById('adminMetricsBody')
  };

  function getAuthHeaders(extra = {}) {
    const token = localStorage.getItem('zenvox_jwt');
    let guestId = localStorage.getItem('zenvox_guest_id');
    if (!guestId) {
      guestId = 'g_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('zenvox_guest_id', guestId);
    }
    const headers = { 'X-Guest-Id': guestId, ...extra };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  // Theme Control
  function initTheme() {
    if (localStorage.getItem('zenvox_theme') === 'light') {
      document.body.classList.add('theme-light');
    }
    els.themeToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('theme-light');
      localStorage.setItem('zenvox_theme', document.body.classList.contains('theme-light') ? 'light' : 'dark');
    });
  }

  // Markdown + DOMPurify + Highlight.js + KaTeX
  function renderFormattedContent(rawText) {
    const wrapper = document.createElement('div');
    wrapper.className = 'markdown-body';
    if (window.marked && window.DOMPurify) {
      marked.setOptions({ breaks: true, gfm: true });
      wrapper.innerHTML = DOMPurify.sanitize(marked.parse(rawText || ''));
    } else {
      wrapper.textContent = rawText || '';
    }

    wrapper.querySelectorAll('pre code').forEach((block) => {
      if (window.hljs) window.hljs.highlightElement(block);
      const pre = block.parentElement;
      const header = document.createElement('div');
      header.className = 'code-header';
      const lang = (block.className.match(/language-(\w+)/) || [null, 'code'])[1];
      header.innerHTML = `<span>${lang.toUpperCase()}</span><button class="icon-btn-sm copy-code-btn">Copy Code</button>`;
      header.querySelector('.copy-code-btn').onclick = () => {
        navigator.clipboard.writeText(block.innerText);
        header.querySelector('.copy-code-btn').textContent = 'Copied ✓';
      };
      pre.parentNode.insertBefore(header, pre);
    });

    if (window.renderMathInElement) {
      window.renderMathInElement(wrapper, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true }
        ],
        throwOnError: false
      });
    }
    return wrapper;
  }

  function renderWelcomeScreen() {
    els.chatViewport.innerHTML = `
      <div class="welcome-card">
        <div class="welcome-title">⚡ ZenvoX AI Pro Workspace</div>
        <p class="welcome-sub">Multimodal AI Assistant • 10-Step STEM Solve Engine • Bilingual Vision & Document Analyzer</p>
        <div class="prompt-grid">
          <div class="prompt-card" data-prompt="Solve a projectile motion problem where initial velocity u = 30 m/s at 45° angle. Find maximum height, time of flight, and horizontal range using the 10-step method.">
            <div class="prompt-card-tag">⚡ 10-Step Physics Solve</div>
            <div>Projectile Motion Derivation & Calculation</div>
          </div>
          <div class="prompt-card" data-prompt="Create HSC Physics 2nd Paper revision notes on Coulomb's Law and Electrostatic Field Intensity with LaTeX formulas and 3 MCQs.">
            <div class="prompt-card-tag">📘 Study Mode</div>
            <div>Electrostatics Revision Notes + MCQs</div>
          </div>
          <div class="prompt-card" data-prompt="নিউটনের মহাকর্ষ সূত্র এবং কেপলারের গ্রহগতির সূত্রগুলোর মধ্যে গাণিতিক সম্পর্ক সহজ বাংলায় ব্যাখ্যা করো।">
            <div class="prompt-card-tag">🇧🇩 বাংলা সহায়তা</div>
            <div>মহাকর্ষ ও কেপলারের সূত্রের গাণিতিক ব্যাখ্যা</div>
          </div>
        </div>
      </div>
    `;
    els.chatViewport.querySelectorAll('.prompt-card').forEach(card => {
      card.onclick = () => {
        els.composerInput.value = card.dataset.prompt;
        sendMessage();
      };
    });
  }

  async function loadModelsAndUsage() {
    try {
      const [mRes, uRes, meRes] = await Promise.all([
        fetch('/api/models', { headers: getAuthHeaders() }),
        fetch('/api/usage', { headers: getAuthHeaders() }),
        fetch('/api/auth/me', { headers: getAuthHeaders() })
      ]);
      const mData = await mRes.json();
      const uData = await uRes.json();
      const meData = await meRes.json();

      state.currentUser = meData.user;
      if (state.currentUser && state.currentUser.role !== 'guest') {
        els.authUserView.style.display = 'block';
        els.authForm.style.display = 'none';
        els.authUserName.textContent = `${state.currentUser.name} (${state.currentUser.email || ''})`;
        els.authUserRole.textContent = `Role: ${state.currentUser.role.toUpperCase()}`;
        els.adminDashBtn.style.display = state.currentUser.role === 'admin' ? 'inline-flex' : 'none';
      } else {
        els.authUserView.style.display = 'none';
        els.authForm.style.display = 'block';
        els.adminDashBtn.style.display = 'none';
      }

      state.models = mData.models || [];
      els.modelSelect.innerHTML = '';
      if (state.models.length === 0) {
        els.modelSelect.innerHTML = '<option value="">⚠ Set GEMINI_API_KEY in .env / Render</option>';
      } else {
        state.models.forEach(m => {
          const opt = document.createElement('option');
          opt.value = `${m.provider}:::${m.id}`;
          opt.textContent = `${m.name} (${m.providerLabel}) • ${m.badge}`;
          els.modelSelect.appendChild(opt);
        });
      }

      if (uData.dailyBudget) {
        const pct = Math.min(100, Math.round((uData.totalTokens / uData.dailyBudget) * 100));
        els.usageLabel.textContent = `${(uData.totalTokens / 1000).toFixed(1)}k / ${(uData.dailyBudget / 1000).toFixed(0)}k`;
        els.usageBarFill.style.width = `${pct}%`;
      }
    } catch (_) {
      els.statusBanner.textContent = 'Server unreachable';
    }
  }

  function appendMessageBubble({ role, content, model = '', attachments = [], streaming = false }) {
    const welcome = els.chatViewport.querySelector('.welcome-card');
    if (welcome) welcome.remove();

    const row = document.createElement('div');
    row.className = `msg-row ${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.innerHTML = role === 'user'
      ? `<span>You</span>`
      : `<span class="status-dot"></span><strong>ZenvoX AI</strong><span>${model}</span>`;
    bubble.appendChild(meta);

    if (attachments && attachments.length > 0) {
      const attWrap = document.createElement('div');
      attWrap.className = 'msg-attachments';
      attachments.forEach(a => {
        const badge = document.createElement('span');
        badge.className = 'att-badge';
        badge.textContent = `📎 ${a.name}`;
        attWrap.appendChild(badge);
      });
      bubble.appendChild(attWrap);
    }

    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'msg-content';
    if (streaming) bodyDiv.textContent = 'Thinking...';
    else bodyDiv.appendChild(renderFormattedContent(content));
    bubble.appendChild(bodyDiv);

    const toolbar = document.createElement('div');
    toolbar.className = 'msg-toolbar';

    if (role === 'assistant') {
      const copyBtn = document.createElement('button');
      copyBtn.className = 'msg-action-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(bodyDiv.innerText);
        copyBtn.textContent = 'Copied ✓';
      };

      const speakBtn = document.createElement('button');
      speakBtn.className = 'msg-action-btn';
      speakBtn.textContent = '🔊 Read Aloud';
      speakBtn.onclick = () => toggleReadAloud(bodyDiv.innerText, speakBtn);

      const regenBtn = document.createElement('button');
      regenBtn.className = 'msg-action-btn';
      regenBtn.textContent = '↻ Regenerate';
      regenBtn.onclick = () => {
        if (state.lastUserMessage) {
          els.composerInput.value = state.lastUserMessage;
          sendMessage();
        }
      };
      toolbar.append(copyBtn, speakBtn, regenBtn);
    } else {
      const editBtn = document.createElement('button');
      editBtn.className = 'msg-action-btn';
      editBtn.textContent = '✎ Edit & Resend';
      editBtn.onclick = () => {
        els.composerInput.value = content;
        els.composerInput.focus();
      };
      toolbar.appendChild(editBtn);
    }

    bubble.appendChild(toolbar);
    row.appendChild(bubble);
    els.chatViewport.appendChild(row);
    els.chatViewport.scrollTop = els.chatViewport.scrollHeight;
    return { row, bodyDiv };
  }

  async function sendMessage() {
    const text = els.composerInput.value.trim();
    if (!text && state.pendingAttachments.length === 0) return;

    if (state.mode === 'image') return handleImageGeneration(text);
    if (state.mode === 'video') return handleVideoGeneration(text);

    state.lastUserMessage = text;
    const currentAtts = [...state.pendingAttachments];
    state.pendingAttachments = [];
    renderAttachmentTray();
    els.composerInput.value = '';

    appendMessageBubble({ role: 'user', content: text, attachments: currentAtts });
    const [provider, model] = (els.modelSelect.value || 'gemini:::gemini-2.5-flash').split(':::');
    const { bodyDiv } = appendMessageBubble({ role: 'assistant', content: '', model: model || 'AI', streaming: true });

    state.abortController = new AbortController();
    els.stopBtn.style.display = 'inline-block';
    els.sendBtn.disabled = true;
    els.statusBanner.textContent = `Streaming from ${model || 'AI'}...`;

    let accumulated = '';
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        signal: state.abortController.signal,
        body: JSON.stringify({
          conversationId: state.conversationId,
          message: text,
          attachments: currentAtts,
          provider,
          model,
          mode: state.mode,
          eduLevel: els.eduLevelSelect.value,
          subject: els.subjectSelect.value
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          const ev = JSON.parse(part.slice(6));
          if (ev.type === 'chunk') {
            accumulated += ev.content;
            bodyDiv.innerHTML = '';
            bodyDiv.appendChild(renderFormattedContent(accumulated));
            els.chatViewport.scrollTop = els.chatViewport.scrollHeight;
          } else if (ev.type === 'done') {
            state.conversationId = ev.conversationId;
            loadConversations();
            loadModelsAndUsage();
          } else if (ev.type === 'error') {
            throw new Error(ev.error);
          }
        }
      }
      els.statusBanner.textContent = 'Response complete ✓';
    } catch (err) {
      bodyDiv.innerHTML = `<span style="color:var(--state-error);">⚠ ${err.message}</span>`;
      els.statusBanner.textContent = 'Error or stopped';
    } finally {
      els.stopBtn.style.display = 'none';
      els.sendBtn.disabled = false;
      state.abortController = null;
    }
  }

  async function handleImageGeneration(prompt) {
    if (!prompt) return;
    els.composerInput.value = '';
    appendMessageBubble({ role: 'user', content: `🎨 Generate Image: ${prompt}` });
    const { bodyDiv } = appendMessageBubble({ role: 'assistant', content: '', model: 'DALL-E 3', streaming: true });
    try {
      const res = await fetch('/api/generate/image', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      bodyDiv.innerHTML = `
        <img src="${data.url}" alt="Generated Image" style="max-width:100%;border-radius:12px;border:1px solid var(--border-color);" />
        <div style="margin-top:6px;"><a href="${data.url}" target="_blank" style="color:var(--accent-secondary);">⬇ Open Full Resolution</a></div>
      `;
    } catch (err) {
      bodyDiv.innerHTML = `<span style="color:var(--state-error);">⚠ ${err.message}</span>`;
    }
  }

  async function handleVideoGeneration(prompt) {
    if (!prompt) return;
    els.composerInput.value = '';
    appendMessageBubble({ role: 'user', content: `🎬 Generate Video: ${prompt}` });
    const { bodyDiv } = appendMessageBubble({ role: 'assistant', content: '', model: 'Video Engine', streaming: true });
    try {
      const res = await fetch('/api/generate/video', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      bodyDiv.innerHTML = `<span style="color:var(--accent-cyan);">⏳ Video Job Queued (${data.job.id.slice(0, 8)})...</span>`;
    } catch (err) {
      bodyDiv.innerHTML = `<span style="color:var(--state-error);">⚠ ${err.message}</span>`;
    }
  }

  // Attachments
  els.attachBtn.onclick = () => els.fileInput.click();
  els.fileInput.onchange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    fd.append('ocr', els.ocrToggleCheckbox.checked ? 'true' : 'false');
    els.statusBanner.textContent = 'Uploading & parsing attachments...';

    try {
      const res = await fetch('/api/attachments/upload', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      state.pendingAttachments.push(...data.attachments);
      renderAttachmentTray();
      els.statusBanner.textContent = `Attached ${data.attachments.length} file(s) ✓`;
    } catch (err) {
      alert(`Attachment Error: ${err.message}`);
      els.statusBanner.textContent = 'Attachment failed';
    } finally {
      els.fileInput.value = '';
    }
  };

  function renderAttachmentTray() {
    els.attachmentTray.innerHTML = '';
    els.attachmentTray.classList.toggle('has-items', state.pendingAttachments.length > 0);
    state.pendingAttachments.forEach((att, idx) => {
      const chip = document.createElement('div');
      chip.className = 'preview-chip';
      const thumb = att.previewDataUrl ? `<img src="${att.previewDataUrl}" alt="" />` : '<span>📄</span>';
      chip.innerHTML = `${thumb}<span>${att.name}</span><button class="icon-btn-sm">✕</button>`;
      chip.querySelector('button').onclick = () => {
        state.pendingAttachments.splice(idx, 1);
        renderAttachmentTray();
      };
      els.attachmentTray.appendChild(chip);
    });
  }

  // Voice Input & Read-Aloud
  function initVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.onstart = () => {
      state.isListening = true;
      els.voiceInputBtn.classList.add('listening');
      els.statusBanner.textContent = `Listening (${els.voiceLangSelect.value})...`;
    };
    rec.onend = () => {
      state.isListening = false;
      els.voiceInputBtn.classList.remove('listening');
    };
    rec.onresult = (e) => {
      const txt = e.results?.[0]?.[0]?.transcript || '';
      els.composerInput.value = (els.composerInput.value + ' ' + txt).trim();
      els.statusBanner.textContent = 'Voice captured ✓';
    };
    state.recognition = rec;

    els.voiceInputBtn.onclick = () => {
      if (!state.recognition) return alert('Speech recognition not supported in this browser.');
      if (state.isListening) state.recognition.stop();
      else {
        state.recognition.lang = els.voiceLangSelect.value;
        state.recognition.start();
      }
    };
  }

  function toggleReadAloud(text, btn) {
    if (!('speechSynthesis' in window)) return alert('Text-to-speech unsupported.');
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      btn.textContent = '🔊 Read Aloud';
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = /[\u0980-\u09FF]/.test(text) ? 'bn-BD' : 'en-US';
    utter.onend = () => { btn.textContent = '🔊 Read Aloud'; };
    btn.textContent = '⏹ Stop';
    window.speechSynthesis.speak(utter);
  }

  // History CRUD
  async function loadConversations(q = '') {
    try {
      const res = await fetch(`/api/conversations?q=${encodeURIComponent(q)}`, { headers: getAuthHeaders() });
      const data = await res.json();
      els.convList.innerHTML = '';
      (data.conversations || []).forEach(c => {
        const item = document.createElement('div');
        item.className = `conv-item ${c.id === state.conversationId ? 'active' : ''}`;
        item.innerHTML = `
          <span class="conv-title">${c.title}</span>
          <div class="conv-actions">
            <button class="icon-btn-sm ren-btn" title="Rename">✎</button>
            <button class="icon-btn-sm del-btn" title="Delete">🗑</button>
          </div>
        `;
        item.querySelector('.conv-title').onclick = () => openConversation(c.id);
        item.querySelector('.ren-btn').onclick = async (e) => {
          e.stopPropagation();
          const t = prompt('Rename conversation:', c.title);
          if (t?.trim()) {
            await fetch(`/api/conversations/${c.id}`, {
              method: 'PATCH',
              headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify({ title: t.trim() })
            });
            loadConversations();
          }
        };
        item.querySelector('.del-btn').onclick = async (e) => {
          e.stopPropagation();
          if (confirm('Delete this conversation?')) {
            await fetch(`/api/conversations/${c.id}`, { method: 'DELETE', headers: getAuthHeaders() });
            if (state.conversationId === c.id) startNewChat();
            loadConversations();
          }
        };
        els.convList.appendChild(item);
      });
    } catch (_) {}
  }

  async function openConversation(id) {
    const res = await fetch(`/api/conversations/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const conv = await res.json();
    state.conversationId = conv.id;
    els.chatViewport.innerHTML = '';
    (conv.messages || []).forEach(m => {
      appendMessageBubble({ role: m.role, content: m.content, model: m.model, attachments: m.attachments });
    });
    loadConversations();
    els.sidebar.classList.remove('mobile-open');
    els.mobileBackdrop.classList.remove('visible');
  }

  function startNewChat() {
    state.conversationId = null;
    renderWelcomeScreen();
    loadConversations();
  }

  // Auth & Admin Modals
  els.authOpenBtn.onclick = () => { els.authModal.style.display = 'flex'; };
  els.closeAuthModal.onclick = () => { els.authModal.style.display = 'none'; };
  els.authSwitchBtn.onclick = () => {
    state.isRegisterMode = !state.isRegisterMode;
    els.authNameInput.style.display = state.isRegisterMode ? 'block' : 'none';
    els.authSubmitBtn.textContent = state.isRegisterMode ? 'Create Account' : 'Sign In';
    els.authSwitchPrompt.textContent = state.isRegisterMode ? 'Already have an account?' : 'Need an account?';
    els.authSwitchBtn.textContent = state.isRegisterMode ? 'Sign In' : 'Register';
    els.authErrorMsg.textContent = '';
  };

  els.authForm.onsubmit = async (e) => {
    e.preventDefault();
    els.authErrorMsg.textContent = '';
    const endpoint = state.isRegisterMode ? '/api/auth/register' : '/api/auth/login';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: els.authNameInput.value,
          email: els.authEmailInput.value,
          password: els.authPassInput.value
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');
      localStorage.setItem('zenvox_jwt', data.token);
      els.authModal.style.display = 'none';
      loadModelsAndUsage();
      loadConversations();
    } catch (err) {
      els.authErrorMsg.textContent = err.message;
    }
  };

  els.logoutBtn.onclick = () => {
    localStorage.removeItem('zenvox_jwt');
    els.authModal.style.display = 'none';
    startNewChat();
    loadModelsAndUsage();
  };

  els.adminDashBtn.onclick = async () => {
    els.adminModal.style.display = 'flex';
    const res = await fetch('/api/admin/metrics', { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok) {
      els.adminMetricsBody.textContent = data.error || 'Failed to load metrics';
      return;
    }
    els.adminMetricsBody.innerHTML = `
      <p><strong>Date:</strong> ${data.date}</p>
      <p><strong>Total Registered Users:</strong> ${data.totalUsers}</p>
      <p><strong>Total Saved Conversations:</strong> ${data.totalConversations}</p>
      <hr style="border-color:var(--border-color);margin:10px 0;" />
      <p><strong>Today's Model Breakdown:</strong></p>
      <ul style="padding-left:18px;margin-top:6px;">
        ${(data.todayUsage || []).map(u => `<li>${u.model}: ${u.requests} requests (${u.tokens} tokens)</li>`).join('') || '<li>No requests logged today.</li>'}
      </ul>
    `;
  };
  els.closeAdminModal.onclick = () => { els.adminModal.style.display = 'none'; };

  // Main UI Events
  els.sendBtn.onclick = sendMessage;
  els.stopBtn.onclick = () => state.abortController?.abort();
  els.composerInput.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };
  els.newChatBtn.onclick = startNewChat;
  els.searchConvInput.oninput = (e) => loadConversations(e.target.value);

  els.modeTabs.forEach(tab => {
    tab.onclick = () => {
      els.modeTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.mode = tab.dataset.mode;
      els.studyToolbar.classList.toggle('visible', state.mode === 'study' || state.mode === 'solve');
    };
  });

  els.quickChips.forEach(chip => {
    chip.onclick = () => {
      els.composerInput.value = `${els.composerInput.value} ${chip.dataset.quick}`.trim();
      els.composerInput.focus();
    };
  });

  els.toggleSidebarBtn.onclick = () => {
    if (window.innerWidth <= 768) {
      els.sidebar.classList.toggle('mobile-open');
      els.mobileBackdrop.classList.toggle('visible');
    } else {
      els.sidebar.classList.toggle('collapsed');
    }
  };
  els.closeSidebarBtn.onclick = () => {
    els.sidebar.classList.remove('mobile-open');
    els.mobileBackdrop.classList.remove('visible');
  };
  els.mobileBackdrop.onclick = () => {
    els.sidebar.classList.remove('mobile-open');
    els.mobileBackdrop.classList.remove('visible');
  };

  els.exportChatBtn.onclick = () => {
    if (!state.conversationId) return alert('Open a conversation first to export.');
    window.open(`/api/conversations/${state.conversationId}/export?format=md`, '_blank');
  };

  els.clearHistoryBtn.onclick = async () => {
    if (confirm('Clear all conversation history?')) {
      await fetch('/api/conversations', { method: 'DELETE', headers: getAuthHeaders() });
      startNewChat();
    }
  };

  initTheme();
  initVoice();
  renderWelcomeScreen();
  loadModelsAndUsage();
  loadConversations();
})();