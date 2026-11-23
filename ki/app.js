// Kernel KI – private KI auf dem Handy. Alles läuft lokal im Browser.
const WEBLLM_URL = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.86/+esm';
const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js';
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';

const MODELS = [
  { key: 'klein', name: 'Klein & schnell', base: 'Qwen2.5-0.5B-Instruct', size: '≈ 1 GB', info: 'Für ältere Handys. Einfache Antworten.' },
  { key: 'standard', name: 'Standard', base: 'Qwen3.5-0.8B', size: '≈ 1,6 GB', info: 'Guter Mix aus Tempo und Qualität.', thinking: true },
  { key: 'stark', name: 'Stark', base: 'Qwen3.5-2B', size: '≈ 2,3 GB', info: 'Beste Antworten. Nur für neuere Handys.', thinking: true },
];

const PERSONAS = {
  assistent: 'Du bist ein freundlicher, hilfsbereiter Assistent. Antworte immer auf Deutsch, klar und verständlich.',
  linux: 'Du bist ein erfahrener Linux-Administrator und Lehrer. Antworte auf Deutsch. Erkläre Befehle mit kurzen Beispielen in Codeblöcken.',
  deutsch: 'Du bist ein geduldiger Deutschlehrer. Korrigiere Fehler im Text des Nutzers, erkläre kurz warum, und antworte einfach.',
  uebersetzer: 'Du bist ein Übersetzer. Ist der Text deutsch, übersetze ins Englische, sonst ins Deutsche. Gib nur die Übersetzung aus.',
  kurz: 'Antworte auf Deutsch in höchstens zwei Sätzen.',
};

// ---------- Helpers ----------
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const store = {
  get(k, d) { try { const v = localStorage.getItem('kki:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('kki:' + k, JSON.stringify(v)); } catch {} },
};
function toast(t, ms = 2600) {
  const el = $('#toast'); el.textContent = t; el.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), ms);
}
function esc(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function md(s) {
  let h = esc(s);
  h = h.replace(/```[\w-]*\n?([\s\S]*?)```/g, (_, c) => `<pre>${c.trim()}</pre>`);
  h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  h = h.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
  return h;
}
const stripThink = (s) => s.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').replace(/^\s+/, '');
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Laden fehlgeschlagen: ' + src));
    document.head.appendChild(s);
  });
}

// ---------- Navigation ----------
function go(view) {
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
  $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.goto === view));
  store.set('tab', view);
  if (view === 'kernel') setTimeout(() => $('#kInput').focus({ preventScroll: true }), 50);
}
$$('[data-goto]').forEach((b) => b.addEventListener('click', () => go(b.dataset.goto)));

// ---------- LLM (WebLLM, WebGPU) ----------
const llm = { engine: null, model: null, loading: false, f16: false, gpu: null };

async function checkGPU() {
  const el = $('#gpuState');
  if (!('gpu' in navigator)) {
    llm.gpu = false;
    el.className = 'note err';
    el.innerHTML = '⚠️ Dein Browser unterstützt kein <b>WebGPU</b>. Nötig: Android mit aktuellem Chrome, oder iPhone mit iOS 26 und Safari. Kamera-Texterkennung und Spracherkennung funktionieren trotzdem.';
    return;
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('kein Adapter');
    llm.gpu = true;
    llm.f16 = adapter.features.has('shader-f16');
    el.className = 'note';
    el.textContent = '✅ WebGPU verfügbar – deine KI kann direkt auf dem Grafikchip laufen.';
  } catch {
    llm.gpu = false;
    el.className = 'note warn';
    el.textContent = '⚠️ WebGPU ist gesperrt oder fehlt auf diesem Gerät. Versuch es mit aktuellem Chrome (Android) oder Safari (iOS 26).';
  }
}
function modelId(m) { return `${m.base}-${llm.f16 ? 'q4f16_1' : 'q4f32_1'}-MLC`; }

function renderModels() {
  const sel = store.get('model', 'standard');
  $('#models').innerHTML = MODELS.map((m) => `
    <label class="model"><input type="radio" name="model" value="${m.key}" ${m.key === sel ? 'checked' : ''}>
      <span><b>${m.name}</b><small>${m.info} Speicher: ${m.size}</small></span></label>`).join('');
  $$('input[name=model]').forEach((r) => r.addEventListener('change', () => store.set('model', r.value)));
}

function setBadge(text, cls = '') { const b = $('#modelBadge'); b.textContent = text; b.className = 'badge ' + cls; }

async function loadLLM() {
  if (llm.loading) return;
  if (llm.gpu === false) { toast('Ohne WebGPU kann die Chat-KI nicht laufen.'); return; }
  const m = MODELS.find((x) => x.key === store.get('model', 'standard'));
  if (llm.engine && llm.model === m) { toast('KI ist schon geladen.'); return; }
  llm.loading = true;
  $('#loadModel').disabled = true; $('#progWrap').hidden = false;
  setBadge('KI: lädt…', 'busy');
  try { await navigator.storage?.persist?.(); } catch {}
  try {
    const webllm = await import(WEBLLM_URL);
    const cb = (r) => {
      $('#progBar').style.width = Math.round((r.progress || 0) * 100) + '%';
      $('#progText').textContent = r.text || '';
    };
    if (llm.engine) { await llm.engine.unload(); llm.engine = null; }
    llm.engine = await webllm.CreateMLCEngine(modelId(m), { initProgressCallback: cb });
    llm.model = m;
    store.set('loaded', m.key);
    setBadge('KI: ' + m.name, 'ready');
    $('#progText').textContent = 'Fertig! Die KI läuft jetzt offline auf deinem Handy.';
    toast('🧠 KI bereit');
  } catch (e) {
    console.error(e);
    setBadge('KI: Fehler');
    $('#progText').textContent = 'Fehler: ' + (e.message || e) + ' – Tipp: kleineres Modell wählen oder andere Apps schließen.';
  } finally {
    llm.loading = false; $('#loadModel').disabled = false; updateStorage();
  }
}
$('#loadModel').addEventListener('click', loadLLM);

async function ensureLLM() {
  if (llm.engine) return true;
  if (llm.loading) { toast('KI lädt noch – einen Moment…'); return false; }
  toast('Erst die KI laden (Tab „KI“).');
  go('setup');
  return false;
}

// Streams an answer; onText receives the full text so far.
async function ask(messages, onText, opts = {}) {
  const req = { messages, stream: true, temperature: opts.temperature ?? 0.6, max_tokens: opts.max_tokens ?? 700 };
  if (llm.model?.thinking) req.extra_body = { enable_thinking: false };
  const chunks = await llm.engine.chat.completions.create(req);
  let out = '';
  for await (const c of chunks) {
    out += c.choices[0]?.delta?.content || '';
    onText(stripThink(out));
  }
  return stripThink(out).trim();
}

// Answer into an element, with cursor; returns the text.
async function answerInto(el, messages, opts) {
  el.classList.add('cursor'); el.textContent = '';
  try {
    const t = await ask(messages, (s) => { el.innerHTML = md(s); el.parentElement?.scrollTo?.(0, 1e9); }, opts);
    el.innerHTML = md(t); return t;
  } catch (e) {
    el.textContent = 'Fehler: ' + (e.message || e); return '';
  } finally { el.classList.remove('cursor'); }
}

// ---------- CHAT ----------
let chat = store.get('chat', []);
let busy = false;
const chatLog = $('#chatLog');
$('#persona').value = store.get('persona', 'assistent');
$('#persona').addEventListener('change', (e) => store.set('persona', e.target.value));

function addMsg(log, role, text) {
  const d = document.createElement('div');
  d.className = 'msg ' + role; d.innerHTML = md(text);
  log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
}
function renderChat() {
  chatLog.innerHTML = '';
  if (!chat.length) addMsg(chatLog, 'sys', 'Deine private KI. Alles bleibt auf diesem Handy.\nWähle oben eine Rolle und frag los.');
  chat.forEach((m) => addMsg(chatLog, m.role === 'user' ? 'user' : 'ai', m.content));
}
renderChat();

const chatInput = $('#chatInput');
chatInput.addEventListener('input', () => { chatInput.style.height = 'auto'; chatInput.style.height = chatInput.scrollHeight + 'px'; });
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer:coarse)').matches) { e.preventDefault(); $('#chatForm').requestSubmit(); }
});
$('#chatClear').addEventListener('click', () => { chat = []; store.set('chat', chat); renderChat(); });

$('#chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text || busy || !(await ensureLLM())) return;
  if (!chat.length) chatLog.innerHTML = '';
  chat.push({ role: 'user', content: text }); addMsg(chatLog, 'user', text);
  chatInput.value = ''; chatInput.style.height = 'auto';
  busy = true; $('#chatSend').disabled = true;
  const el = addMsg(chatLog, 'ai', '');
  const sys = { role: 'system', content: PERSONAS[$('#persona').value] };
  const t = await answerInto(el, [sys, ...chat.slice(-10)]);
  chatLog.scrollTop = chatLog.scrollHeight;
  if (t) { chat.push({ role: 'assistant', content: t }); store.set('chat', chat.slice(-40)); }
  busy = false; $('#chatSend').disabled = false;
});

// ---------- HERR KERNEL ----------
const LABS = [
  // Level 1
  { l: 1, q: 'Zeig alle Dateien im aktuellen Ordner an, auch versteckte.', a: [/^ls\s+(-\w*a\w*|--all)/], h: 'ls mit einer Option für „all“' },
  { l: 1, q: 'In welchem Ordner bist du gerade?', a: [/^pwd$/], h: 'print working directory' },
  { l: 1, q: 'Wechsle in dein Home-Verzeichnis.', a: [/^cd(\s+~\/?)?$/, /^cd\s+\$HOME$/], h: 'cd ohne Argument oder mit ~' },
  { l: 1, q: 'Lege den Ordner „projekte“ an.', a: [/^mkdir\s+(-p\s+)?projekte\/?$/], h: 'make directory' },
  { l: 1, q: 'Erstelle eine leere Datei „notiz.txt“.', a: [/^touch\s+notiz\.txt$/, /^>\s*notiz\.txt$/], h: 'Ein Befehl, der eigentlich Zeitstempel ändert' },
  { l: 1, q: 'Zeig den Inhalt von „notiz.txt“ an.', a: [/^(cat|less|more|bat)\s+notiz\.txt$/], h: 'concatenate' },
  { l: 1, q: 'Kopiere „a.txt“ nach „b.txt“.', a: [/^cp\s+a\.txt\s+b\.txt$/], h: 'copy' },
  { l: 1, q: 'Benenne „alt.txt“ in „neu.txt“ um.', a: [/^mv\s+alt\.txt\s+neu\.txt$/], h: 'Umbenennen = verschieben' },
  { l: 1, q: 'Lösche den Ordner „tmp“ samt Inhalt.', a: [/^rm\s+(-rf|-fr|-r|-R|-Rf|-r\s+-f|-f\s+-r)\s+tmp\/?$/], h: 'rm rekursiv' },
  { l: 1, q: 'Wer bist du? Zeig deinen Benutzernamen.', a: [/^whoami$/, /^id\s+-un$/], h: 'who am i – zusammengeschrieben' },
  // Level 2
  { l: 2, q: 'Setze die Rechte von „script.sh“ auf 755.', a: [/^chmod\s+755\s+script\.sh$/], h: 'change mode' },
  { l: 2, q: 'Mach „run.sh“ für alle ausführbar.', a: [/^chmod\s+(a?\+x|755)\s+run\.sh$/], h: 'chmod mit +x' },
  { l: 2, q: 'Ändere den Besitzer von „data.db“ auf „admin“.', a: [/^(sudo\s+)?chown\s+admin(:\w*)?\s+data\.db$/], h: 'change owner' },
  { l: 2, q: 'Suche „error“ in „/var/log/syslog“.', a: [/^grep\s+(-\w+\s+)*["']?error["']?\s+\/var\/log\/syslog$/], h: 'grep MUSTER DATEI' },
  { l: 2, q: 'Zeig die letzten 20 Zeilen von „app.log“.', a: [/^tail\s+(-n\s*20|-20)\s+app\.log$/], h: 'Das Ende einer Datei' },
  { l: 2, q: 'Verfolge „app.log“ live, während neue Zeilen kommen.', a: [/^tail\s+(-\w*f\w*|--follow)(\s+-n\s*\d+)?\s+app\.log$/], h: 'tail mit follow' },
  { l: 2, q: 'Hänge „fertig“ an die Datei „log.txt“ an.', a: [/^echo\s+["']?fertig["']?\s*>>\s*log\.txt$/], h: 'Zwei spitze Klammern' },
  { l: 2, q: 'Zeig alle laufenden Prozesse.', a: [/^ps\s+(aux|-ef|-e|ax)$/, /^h?top$/], h: 'process status' },
  { l: 2, q: 'Beende Prozess 1234 sofort und hart.', a: [/^(sudo\s+)?kill\s+(-9|-KILL|-SIGKILL|-s\s+(KILL|9))\s+1234$/], h: 'kill mit Signal 9' },
  { l: 2, q: 'Wie viel Speicherplatz ist auf den Laufwerken frei (lesbar)?', a: [/^df\s+-h\w*$/], h: 'disk free, human-readable' },
  // Level 3
  { l: 3, q: 'Stoppe den Dienst „nginx“.', a: [/^(sudo\s+)?systemctl\s+stop\s+nginx(\.service)?$/], h: 'systemctl …' },
  { l: 3, q: 'Starte „nginx“ automatisch beim Booten.', a: [/^(sudo\s+)?systemctl\s+enable\s+(--now\s+)?nginx(\.service)?$/], h: 'systemctl enable' },
  { l: 3, q: 'Zeig die Logs von „sshd“ mit journalctl.', a: [/^(sudo\s+)?journalctl\s+(-\w+\s+)*-u\s+sshd?(\.service)?(\s+-\w+)*$/], h: 'journalctl -u DIENST' },
  { l: 3, q: 'Finde alle „.conf“-Dateien unter /etc.', a: [/^(sudo\s+)?find\s+\/etc\/?\s+(-type\s+f\s+)?-i?name\s+["']?\*\.conf["']?$/], h: 'find PFAD -name MUSTER' },
  { l: 3, q: 'Zähle die Zeilen in „liste.txt“.', a: [/^wc\s+-l\s+liste\.txt$/, /^wc\s+-l\s*<\s*liste\.txt$/], h: 'word count, Zeilen' },
  { l: 3, q: 'Zeig nur Prozesse, die „python“ enthalten (mit ps und grep).', a: [/^ps\s+(aux|-ef)\s*\|\s*grep\s+["']?python["']?$/], h: 'Pipe: ps … | grep …' },
  { l: 3, q: 'Packe den Ordner „web“ in „web.tar.gz“.', a: [/^tar\s+-?(czf|czvf|cvzf|zcf|zcvf)\s+web\.tar\.gz\s+web\/?$/], h: 'tar c=create z=gzip f=file' },
  { l: 3, q: 'Welche Ports lauschen gerade auf TCP?', a: [/^(sudo\s+)?(ss|netstat)\s+-\w*t\w*l\w*/], h: 'ss mit -tln' },
  { l: 3, q: 'Verbinde dich per SSH als „root“ mit 10.0.0.5.', a: [/^ssh\s+root@10\.0\.0\.5$/, /^ssh\s+-l\s+root\s+10\.0\.0\.5$/], h: 'ssh BENUTZER@HOST' },
  { l: 3, q: 'Lade die Paketlisten neu (Debian/Ubuntu).', a: [/^sudo\s+apt(-get)?\s+update$/], h: 'apt braucht Root-Rechte' },
];

const kLog = $('#kLog');
let K = store.get('kernel', null) || { lives: 3, score: 0, level: 1, done: [], cur: null, streak: 0 };
const kSave = () => store.set('kernel', K);

function kLine(cls, text) { const d = document.createElement('div'); d.className = cls; d.innerHTML = md(text); kLog.appendChild(d); kLog.scrollTop = kLog.scrollHeight; return d; }
function kStats() {
  const full = Math.floor(K.lives), half = K.lives % 1 ? '💔' : '';
  $('#kLives').textContent = ('❤️'.repeat(Math.max(0, full)) + half) || '☠️';
  $('#kScore').textContent = K.score; $('#kLevel').textContent = K.level;
}
function kNext() {
  let pool = LABS.map((x, i) => i).filter((i) => LABS[i].l <= K.level && !K.done.includes(i));
  if (!pool.length) {
    if (K.level < 3) { K.level++; kLine('ok', `⬆️ LEVEL ${K.level} freigeschaltet!`); return kNext(); }
    K.done = []; pool = LABS.map((x, i) => i);
    kLine('ok', '🏆 Alle Aufgaben gelöst! Neue Runde.');
  }
  const prefer = pool.filter((i) => LABS[i].l === K.level);
  const from = prefer.length ? prefer : pool;
  K.cur = from[Math.floor(Math.random() * from.length)];
  kLine('q', `PRÜFUNG [L${LABS[K.cur].l}]: ${LABS[K.cur].q}`);
  kSave();
}
function kStart(fresh) {
  kLog.innerHTML = '';
  if (fresh) K = { lives: 3, score: 0, level: 1, done: [], cur: null, streak: 0 };
  kLine('t', "Guten Tag. Ich bin Herr Kernel.\nTipp den passenden Linux-Befehl ein.\nRichtig: +100 Punkte × Level. Falsch: −½ ❤️.");
  kStats();
  if (K.cur != null && !fresh) kLine('q', `PRÜFUNG [L${LABS[K.cur].l}]: ${LABS[K.cur].q}`); else kNext();
}
const norm = (s) => s.trim().replace(/\s+/g, ' ');

async function kExplain(lab, given, correct) {
  if (!llm.engine) return;
  const el = kLine('t', ''); el.classList.add('cursor');
  const prompt = correct
    ? `Aufgabe: ${lab.q}\nDer Schüler hat richtig geantwortet mit: ${given}\nErkläre in 2 kurzen Sätzen auf Deutsch, was der Befehl genau tut, und nenne eine nützliche Variante.`
    : `Aufgabe: ${lab.q}\nDer Schüler schrieb: ${given}\nDas ist falsch. Erkläre in 2 kurzen Sätzen auf Deutsch, was an seinem Befehl falsch ist, OHNE die Lösung zu verraten.`;
  await answerInto(el, [{ role: 'system', content: PERSONAS.linux + ' Du bist Herr Kernel, streng aber fair.' }, { role: 'user', content: prompt }], { max_tokens: 160, temperature: 0.4 });
  kLog.scrollTop = kLog.scrollHeight;
}

$('#kForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = norm($('#kInput').value); if (!v) return;
  $('#kInput').value = '';
  kLine('u', '> ' + v);
  if (K.lives <= 0) { kLine('bad', 'GAME OVER. Tippe ↺ Neustart.'); return; }
  const lab = LABS[K.cur];
  if (lab.a.some((r) => r.test(v))) {
    K.streak++; const pts = 100 * lab.l + (K.streak >= 3 ? 50 : 0);
    K.score += pts; K.done.push(K.cur);
    kLine('ok', `[PASS] +${pts} ${K.streak >= 3 ? '🔥 Serie!' : ''}`);
    kStats(); kSave();
    await kExplain(lab, v, true);
    kNext();
  } else {
    K.streak = 0; K.lives -= 0.5; kStats(); kSave();
    kLine('bad', '[FAIL] Falsch. −½ ❤️');
    if (K.lives <= 0) {
      kLine('bad', `☠️ GAME OVER – Endstand: ${K.score} Punkte.\nRichtige Lösung wäre z. B. gewesen: ${lab.h}`);
      const best = store.get('best', 0); if (K.score > best) { store.set('best', K.score); kLine('ok', '🏅 Neuer Rekord!'); }
      return;
    }
    await kExplain(lab, v, false);
  }
});
$('#kHint').addEventListener('click', () => {
  if (K.lives <= 0 || K.cur == null) return;
  K.lives -= 0.5; kStats(); kSave();
  kLine('t', '💡 Tipp: ' + LABS[K.cur].h);
});
$('#kSkip').addEventListener('click', () => { if (K.lives > 0) { K.streak = 0; kLine('t', '⏭ Übersprungen.'); kNext(); } });
$('#kRestart').addEventListener('click', () => kStart(true));
$('#kKeys').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const inp = $('#kInput'); const t = b.textContent;
  const s = inp.selectionStart ?? inp.value.length;
  inp.value = inp.value.slice(0, s) + t + inp.value.slice(inp.selectionEnd ?? s);
  inp.focus(); inp.setSelectionRange(s + t.length, s + t.length);
});
kStart(false);

// ---------- KAMERA ----------
let camFile = null, ocrWorker = null, captioner = null, tf = null;
async function transformers() {
  if (!tf) { tf = await import(TRANSFORMERS_URL); tf.env.allowLocalModels = false; }
  return tf;
}
$('#camInput').addEventListener('change', (e) => {
  camFile = e.target.files[0]; if (!camFile) return;
  const img = $('#camPreview'); img.src = URL.createObjectURL(camFile); img.hidden = false;
  $('#camPlaceholder').hidden = true; $('#camOcr').disabled = $('#camWhat').disabled = false;
});
$('#camOcr').addEventListener('click', async () => {
  const btn = $('#camOcr'); btn.disabled = true; const old = btn.textContent;
  try {
    if (!ocrWorker) {
      btn.textContent = '⏳ Lade Leser…';
      if (!window.Tesseract) await loadScript(TESSERACT_URL);
      ocrWorker = await window.Tesseract.createWorker('deu+eng', 1, {
        logger: (m) => { if (m.progress != null) btn.textContent = `⏳ ${Math.round(m.progress * 100)}%`; },
      });
    }
    btn.textContent = '⏳ Lese…';
    const { data } = await ocrWorker.recognize(camFile);
    $('#camText').value = data.text.trim() || '(Kein Text erkannt)';
  } catch (e) { toast('Texterkennung fehlgeschlagen: ' + e.message); }
  btn.textContent = old; btn.disabled = false;
});
$('#camWhat').addEventListener('click', async () => {
  const btn = $('#camWhat'); btn.disabled = true; const old = btn.textContent;
  try {
    btn.textContent = '⏳ Lade Modell…';
    const { pipeline } = await transformers();
    if (!captioner) {
      captioner = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning', {
        dtype: 'q8', device: 'wasm',
        progress_callback: (p) => { if (p.status === 'progress' && p.progress) btn.textContent = `⏳ ${Math.round(p.progress)}%`; },
      });
    }
    btn.textContent = '⏳ Schaue…';
    const url = URL.createObjectURL(camFile);
    const [r] = await captioner(url);
    URL.revokeObjectURL(url);
    const en = r?.generated_text?.trim() || '';
    $('#camText').value = en;
    if (llm.engine && en) {
      await answerInto($('#camAnswer'), [{ role: 'user', content: `Eine Bilderkennung beschreibt ein Foto so: "${en}". Sag auf Deutsch in 1–2 Sätzen, was auf dem Bild zu sehen ist.` }], { max_tokens: 120 });
    }
  } catch (e) { toast('Bilderkennung fehlgeschlagen: ' + e.message); }
  btn.textContent = old; btn.disabled = false;
});
const CAM_TASKS = {
  erklaeren: 'Erkläre den folgenden Text einfach und verständlich auf Deutsch:',
  uebersetzen: 'Übersetze den folgenden Text ins Deutsche. Gib nur die Übersetzung aus:',
  englisch: 'Translate the following text into English. Output only the translation:',
  zusammenfassen: 'Fasse den folgenden Text in 3 Stichpunkten auf Deutsch zusammen:',
};
$$('[data-cam]').forEach((b) => b.addEventListener('click', async () => {
  const text = $('#camText').value.trim();
  if (!text) return toast('Erst ein Foto lesen lassen.');
  if (!(await ensureLLM())) return;
  await answerInto($('#camAnswer'), [{ role: 'user', content: `${CAM_TASKS[b.dataset.cam]}\n\n${text.slice(0, 3000)}` }]);
}));

// ---------- SPRACHE ----------
let rec = null, recChunks = [], asr = null, lastAnswer = '';
const micBtn = $('#micBtn'), micState = $('#micState');

async function getASR() {
  if (asr) return asr;
  const { pipeline } = await transformers();
  micState.textContent = 'Lade Spracherkennung (einmalig)…';
  asr = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-base', {
    dtype: 'q8', device: 'wasm',
    progress_callback: (p) => { if (p.status === 'progress' && p.progress) micState.textContent = `Lade Spracherkennung… ${Math.round(p.progress)}%`; },
  });
  return asr;
}
async function toMono16k(blob) {
  const buf = await blob.arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const audio = await ctx.decodeAudioData(buf);
  ctx.close?.();
  const off = new OfflineAudioContext(1, Math.ceil(audio.duration * 16000), 16000);
  const src = off.createBufferSource(); src.buffer = audio; src.connect(off.destination); src.start();
  const out = await off.startRendering();
  return out.getChannelData(0);
}
micBtn.addEventListener('click', async () => {
  if (rec && rec.state === 'recording') { rec.stop(); return; }
  try {
    getASR().catch(() => {}); // im Hintergrund vorladen
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recChunks = [];
    rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => e.data.size && recChunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      micBtn.classList.remove('rec'); micBtn.disabled = true;
      try {
        const pcm = await toMono16k(new Blob(recChunks, { type: rec.mimeType }));
        const model = await getASR();
        micState.textContent = 'Erkenne Sprache…';
        const r = await model(pcm, { language: 'german', task: 'transcribe', chunk_length_s: 30 });
        const t = (r.text || '').trim();
        $('#voiceText').value = ($('#voiceText').value ? $('#voiceText').value + ' ' : '') + t;
        micState.textContent = t ? 'Fertig. Wähle eine Aktion.' : 'Nichts verstanden – nochmal?';
      } catch (e) { micState.textContent = 'Fehler: ' + e.message; }
      micBtn.disabled = false;
    };
    rec.start(); micBtn.classList.add('rec'); micState.textContent = '● Aufnahme… tippen zum Stoppen';
  } catch (e) { micState.textContent = 'Kein Mikrofonzugriff: ' + e.message; }
});

const VOICE_TASKS = {
  antworten: (t) => [{ role: 'system', content: PERSONAS.assistent }, { role: 'user', content: t }],
  zusammenfassen: (t) => [{ role: 'user', content: `Fasse das Folgende in 2–3 Stichpunkten auf Deutsch zusammen:\n\n${t}` }],
  nachricht: (t) => [{ role: 'user', content: `Formuliere aus diesem gesprochenen Text eine freundliche, gut lesbare Kurznachricht (WhatsApp-Stil) auf Deutsch. Gib nur die Nachricht aus:\n\n${t}` }],
};
$$('[data-voice]').forEach((b) => b.addEventListener('click', async () => {
  const t = $('#voiceText').value.trim(); if (!t) return toast('Erst etwas sagen oder tippen.');
  if (b.dataset.voice === 'notiz') { addNote(t); $('#voiceText').value = ''; return toast('📝 Notiz gespeichert'); }
  if (!(await ensureLLM())) return;
  lastAnswer = await answerInto($('#voiceAnswer'), VOICE_TASKS[b.dataset.voice](t));
  $('#speakBtn').disabled = $('#copyBtn').disabled = !lastAnswer;
}));
$('#speakBtn').addEventListener('click', () => {
  if (!lastAnswer) return; speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(lastAnswer.replace(/[`*#]/g, '')); u.lang = 'de-DE';
  const v = speechSynthesis.getVoices().find((x) => x.lang?.startsWith('de') && x.localService);
  if (v) u.voice = v;
  speechSynthesis.speak(u);
});
$('#copyBtn').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(lastAnswer); toast('Kopiert'); } catch { toast('Kopieren nicht erlaubt'); }
});

let notes = store.get('notes', []);
function renderNotes() {
  $('#notes').innerHTML = notes.length ? notes.map((n, i) => `<li><span><small>${new Date(n.d).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</small>${esc(n.t)}</span><button data-del="${i}" aria-label="Löschen">✕</button></li>`).join('') : '<li class="muted"><span>Noch keine Notizen.</span></li>';
}
function addNote(t) { notes.unshift({ t, d: Date.now() }); store.set('notes', notes); renderNotes(); }
$('#notes').addEventListener('click', (e) => { const i = e.target.dataset.del; if (i != null) { notes.splice(+i, 1); store.set('notes', notes); renderNotes(); } });
renderNotes();

// ---------- SETUP: Speicher & Installation ----------
async function updateStorage() {
  try {
    const { usage, quota } = await navigator.storage.estimate();
    $('#storage').textContent = `Belegt: ${(usage / 1e9).toFixed(2)} GB von ca. ${(quota / 1e9).toFixed(1)} GB verfügbar.`;
  } catch { $('#storage').textContent = 'Speicherinfo nicht verfügbar.'; }
}
$('#wipe').addEventListener('click', async () => {
  if (!confirm('Alle heruntergeladenen KI-Modelle löschen? Chats und Notizen bleiben.')) return;
  try { await llm.engine?.unload(); } catch {}
  llm.engine = null; llm.model = null; asr = null; captioner = null;
  try { await ocrWorker?.terminate(); } catch {} ocrWorker = null;
  for (const k of await caches.keys()) if (!k.startsWith('kki-shell')) await caches.delete(k);
  try { for (const db of (await indexedDB.databases?.()) || []) if (db.name) indexedDB.deleteDatabase(db.name); } catch {}
  store.set('loaded', null); setBadge('KI: aus'); updateStorage(); toast('🗑️ KI-Daten gelöscht');
});

let installEvt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; $('#installBtn').hidden = false; });
$('#installBtn').addEventListener('click', async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; $('#installBtn').hidden = true; });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ---------- Start ----------
renderModels();
go(store.get('tab', 'chat'));
updateStorage();
checkGPU().then(() => {
  // Wenn schon mal geladen: automatisch aus dem Cache starten (geht offline schnell).
  if (store.get('loaded', null) && llm.gpu) { store.set('model', store.get('loaded')); renderModels(); loadLLM(); }
});
