
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { TerminalWindow } from './components/TerminalWindow';
import { Sidebar } from './components/Sidebar';
import { Message, LeaderboardEntry, MessageAction } from './types';
import { getTeacherResponse } from './services/geminiService';

const PENGUIN_ASCII = `
          .---.
         /     \\
        (  o o  )
        |   V   |
       / \\     / \\
      (   '._.'   )
       \\__/_\\__/
         [===]
`;

const BOOT_MENU_MSG = (username: string): Message => ({
  id: 'menu-' + Date.now(),
  type: 'system',
  content: `
${PENGUIN_ASCII}
Guten Tag, ${username.toUpperCase()}.
Wählen Sie eine Operation aus dem GRUB_KERNEL_MENU:
`,
  timestamp: new Date(),
  actions: [
    { label: "[1] Terminal starten (Training)", value: "1" },
    { label: "[2] Leaderboard anzeigen", value: "2" },
    { label: "[3] System-Status prüfen", value: "3" }
  ]
});

const BACK_ACTION: MessageAction[] = [
  { label: "[ ESC ] BACK TO MENU", value: "menu" }
];

const formatLeaderboardTable = (entries: LeaderboardEntry[]): string => {
  const header = "\n--- BESTENLISTE: TOP 5 ABSORVENTEN ---\n";
  const subHeader = "RANG  NAME            SCORE\n";
  const divider = "-----------------------------\n";
  
  const rows = entries.slice(0, 5).map((e, i) => {
    const rank = (i + 1).toString().padEnd(6);
    const name = e.name.substring(0, 15).padEnd(16);
    const score = e.score.toString().padStart(5);
    return `${rank}${name}${score}`;
  }).join('\n');

  return `${header}${subHeader}${divider}${rows}\n${divider}`;
};

const App: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentMode, setCurrentMode] = useState<'MENU' | 'TRAINING'>('MENU');
  const [history, setHistory] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [lives, setLives] = useState(3.0);
  const [score, setScore] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const hasRecordedGameOver = useRef(false);
  
  const audioCtxRef = useRef<AudioContext | null>(null);

  const isGameOver = lives <= 0;

  useEffect(() => {
    const saved = localStorage.getItem('kernel_leaderboard');
    if (saved) {
      try {
        setLeaderboard(JSON.parse(saved));
      } catch (e) {
        setLeaderboard([]);
      }
    }
  }, []);

  useEffect(() => {
    if (isGameOver && isLoggedIn && !hasRecordedGameOver.current) {
      hasRecordedGameOver.current = true;
      
      const newEntry: LeaderboardEntry = { name: username || 'Unknown', score };
      const updated = [...leaderboard, newEntry]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      
      setLeaderboard(updated);
      localStorage.setItem('kernel_leaderboard', JSON.stringify(updated));

      const tableContent = formatLeaderboardTable(updated);
      const leaderboardMsg: Message = {
        id: 'leaderboard-' + Date.now(),
        type: 'system',
        content: `[!] KERNEL PANIC: SYSTEM HALTED\n${tableContent}\nStatus: Account suspended.`,
        timestamp: new Date(),
      };
      
      setHistory(prev => [...prev, leaderboardMsg]);
    }
  }, [isGameOver, isLoggedIn, username, score, leaderboard]);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playCorrectSound = () => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  };

  const playWrongSound = () => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(40, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      setIsLoggedIn(true);
      setCurrentMode('MENU');
      setHistory([BOOT_MENU_MSG(username)]);
      initAudio();
    }
  };

  const handleRestart = useCallback(() => {
    setLives(3.0);
    setScore(0);
    hasRecordedGameOver.current = false;
    setCurrentMode('MENU');
    setHistory([BOOT_MENU_MSG(username)]);
    setIsThinking(false);
    initAudio();
  }, [username]);

  const processTeacherResponse = useCallback((rawResponse: string) => {
    let content = rawResponse;
    let failed = false;
    let passed = false;

    if (content.includes('[FAIL]')) {
      failed = true;
      content = content.replace('[FAIL]', '').trim();
    }
    if (content.includes('[PASS]')) {
      passed = true;
      content = content.replace('[PASS]', '').trim();
    }

    if (failed) {
      setLives((prev) => Math.max(0, prev - 1));
      playWrongSound();
    } else if (passed) {
      setScore(prev => prev + 100); // Standardbelohnung
      playCorrectSound();
    }

    return content;
  }, []);

  const handleCommand = useCallback(async (content: string) => {
    if (isGameOver) return;
    initAudio();

    const normalizedCmd = content.trim().toLowerCase();

    if (normalizedCmd === 'menu') {
        setCurrentMode('MENU');
        setHistory(prev => [...prev, BOOT_MENU_MSG(username)]);
        return;
    }

    // Help/Hint feature
    if (currentMode === 'TRAINING' && (normalizedCmd === 'help' || normalizedCmd === 'hint')) {
      const userMsg: Message = { id: Date.now().toString(), type: 'user', content, timestamp: new Date() };
      setHistory((prev) => [...prev, userMsg]);
      setIsThinking(true);

      // Deduct cost
      if (score >= 50) {
        setScore(prev => prev - 50);
      } else {
        setLives(prev => Math.max(0, prev - 0.5));
      }
      playWrongSound(); // Snarky penalty sound

      try {
        const rawResponse = await getTeacherResponse("HINWEIS_ANFRAGE: Gib einen hilfreichen Tipp zur aktuellen Linux-Aufgabe. Sei dabei extrem herablassend und snarky in den Kommentaren, wie: 'Ach, der feine Herr braucht Hilfe? Wie wäre es mit einem Buch?'.");
        const teacherMsg: Message = { 
          id: 'hint-' + Date.now(), 
          type: 'teacher', 
          content: rawResponse, 
          timestamp: new Date(), 
          actions: BACK_ACTION 
        };
        setHistory((prev) => [...prev, teacherMsg]);
      } catch (err) {
        setHistory((prev) => [...prev, { id: Date.now().toString(), type: 'system', content: "[!!] ERROR: Hint engine failure.", timestamp: new Date() }]);
      } finally {
        setIsThinking(false);
      }
      return;
    }

    if (currentMode === 'MENU') {
      if (content === '1') {
        setCurrentMode('TRAINING');
        setHistory([]); // Sofort leeren
        playCorrectSound();
        setIsThinking(true);
        try {
          const rawResponse = await getTeacherResponse("STARTE_TRAINING: Begrüße den Schüler kurz und stelle die allererste Linux-Aufgabe.");
          const cleanedResponse = processTeacherResponse(rawResponse);
          setHistory([{ 
            id: 'init-' + Date.now(), 
            type: 'teacher', 
            content: cleanedResponse, 
            timestamp: new Date(),
            actions: BACK_ACTION 
          }]);
        } catch (err) {
          setHistory([{ id: 'err-' + Date.now(), type: 'system', content: "[!!] ERROR: Initial prompt failed.", timestamp: new Date(), actions: BACK_ACTION }]);
        } finally {
          setIsThinking(false);
        }
      } else if (content === '2') {
        const userMsg: Message = { id: Date.now().toString(), type: 'user', content, timestamp: new Date() };
        const table = formatLeaderboardTable(leaderboard);
        setHistory(prev => [...prev, userMsg, { id: 'lb-' + Date.now(), type: 'system', content: table, timestamp: new Date(), actions: BACK_ACTION }]);
      } else if (content === '3') {
        const userMsg: Message = { id: Date.now().toString(), type: 'user', content, timestamp: new Date() };
        const stats = `\n--- SYSTEM STATUS ---\nKERNEL: v3.2.0-STRICT\nUPTIME: 142 days\nMEMORY: 16GB / 32GB\nCPU: 64-bit Kernel Instructor\nUSERS: 1 (YOU)\nSTATUS: ALL SYSTEMS NOMINAL\n`;
        setHistory(prev => [...prev, userMsg, { id: 'stats-' + Date.now(), type: 'system', content: stats, timestamp: new Date(), actions: BACK_ACTION }]);
      } else {
        const userMsg: Message = { id: Date.now().toString(), type: 'user', content, timestamp: new Date() };
        setHistory(prev => [...prev, userMsg, { id: 'err-' + Date.now(), type: 'system', content: "[!] Invalid Option. Use 1, 2 or 3.", timestamp: new Date() }]);
        playWrongSound();
      }
      return;
    }

    // Main Training Mode logic
    const userMsg: Message = { id: Date.now().toString(), type: 'user', content, timestamp: new Date() };
    setHistory((prev) => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const rawResponse = await getTeacherResponse(content);
      const cleanedResponse = processTeacherResponse(rawResponse);
      const teacherMsg: Message = { id: (Date.now() + 1).toString(), type: 'teacher', content: cleanedResponse, timestamp: new Date(), actions: BACK_ACTION };
      setHistory((prev) => [...prev, teacherMsg]);
    } catch (err) {
      setHistory((prev) => [...prev, { id: Date.now().toString(), type: 'system', content: "[!!] ERROR: Link failure.", timestamp: new Date() }]);
    } finally {
      setIsThinking(false);
    }
  }, [isGameOver, currentMode, username, leaderboard, score, processTeacherResponse]);

  const handleExamRequest = useCallback(async () => {
    if (isGameOver || currentMode !== 'TRAINING') return;
    initAudio();

    const systemMsg: Message = {
      id: Date.now().toString(),
      type: 'system',
      content: "[!] PRÜFUNG STARTET...",
      timestamp: new Date(),
    };
    
    setHistory((prev) => [...prev, systemMsg]);
    setIsThinking(true);

    try {
      const rawResponse = await getTeacherResponse("GENERIEREN_PRÜFUNG: Stelle eine Quizfrage.");
      const cleanedResponse = processTeacherResponse(rawResponse);
      const teacherMsg: Message = { id: (Date.now() + 1).toString(), type: 'teacher', content: cleanedResponse, timestamp: new Date(), actions: BACK_ACTION };
      setHistory((prev) => [...prev, teacherMsg]);
    } catch (err) {
      setHistory((prev) => [...prev, { id: Date.now().toString(), type: 'system', content: "[!!] ERROR: Exam server offline.", timestamp: new Date() }]);
    } finally {
      setIsThinking(false);
    }
  }, [isGameOver, currentMode, processTeacherResponse]);

  const hearts = useMemo(() => {
    const full = Math.floor(lives);
    const half = (lives % 1 !== 0) ? "💔" : "";
    const empty = Math.max(0, 3 - Math.ceil(lives));
    return "❤️".repeat(full) + half + "🖤".repeat(empty);
  }, [lives]);

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-black p-4 font-mono">
        <form onSubmit={handleLogin} className="max-w-xs w-full space-y-4 border border-zinc-800 p-6 rounded bg-zinc-950">
          <div className="text-emerald-500 text-xs mb-4">
            {PENGUIN_ASCII}
            <div className="mt-2">KERNEL_SYSTEM_V3.2_LOGIN</div>
          </div>
          <div>
            <label className="block text-[10px] text-zinc-500 uppercase mb-1">Username / UID</label>
            <input 
              autoFocus
              required
              className="w-full bg-black border border-zinc-800 p-2 text-emerald-500 outline-none focus:border-emerald-500 transition-colors"
              placeholder="root..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-bold py-2 rounded text-sm transition-colors">
            LOGIN
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-black text-emerald-500 selection:bg-emerald-900 selection:text-emerald-100 overflow-hidden relative">
      
      {isGameOver && (
        <div className="absolute inset-0 z-[100] bg-red-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
          <div className="max-w-sm space-y-4 bg-black/40 p-8 rounded-lg border border-red-500/30">
            <h2 className="text-5xl md:text-7xl font-black text-white leading-tight">HALTED</h2>
            <div className="text-lg font-mono text-red-200 border-y border-red-500 py-2">
              USER_DELETED
            </div>
            <div className="text-amber-500 font-bold text-xl">DEIN SCORE: {score}</div>
            <p className="text-red-300 text-xs opacity-80">
              Checke die Bestenliste im Terminal hinter diesem Fenster.
            </p>
            <button 
              onClick={handleRestart}
              className="w-full py-3 bg-white text-red-900 font-bold rounded shadow-xl hover:bg-red-100 transition-all uppercase text-sm"
            >
              System Restore
            </button>
          </div>
        </div>
      )}

      <Sidebar 
        messageCount={history.length} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        leaderboard={leaderboard}
        currentScore={score}
      />

      <main className="flex-1 flex flex-col p-2 sm:p-4 md:p-8 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
        
        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden w-8 h-8 flex items-center justify-center text-emerald-500 border border-zinc-800 rounded bg-zinc-950"
            >
              ☰
            </button>
            <div className="flex flex-col">
              <h1 className="text-sm md:text-lg font-bold text-zinc-100 uppercase leading-none">Herr Kernel</h1>
              <span className="text-[9px] text-zinc-600 font-mono hidden sm:inline">UID: {username}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end mr-1 sm:mr-4">
              <span className="text-[9px] sm:text-[10px] text-zinc-500 uppercase tracking-tighter">{hearts}</span>
              <span className="text-[10px] sm:text-xs text-amber-500 font-bold">{score} pts</span>
            </div>

            <button 
              onClick={handleExamRequest}
              disabled={isThinking || isGameOver || currentMode !== 'TRAINING'}
              className="p-1.5 sm:px-4 sm:py-1.5 text-[10px] sm:text-xs rounded border border-amber-900/50 bg-amber-950/20 text-amber-500 font-bold disabled:opacity-50"
            >
              PRÜFUNG
            </button>

            <button 
              onClick={handleRestart}
              disabled={isGameOver}
              className="p-1.5 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs rounded border border-zinc-800 text-zinc-400"
            >
              RESTART
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 relative">
          <TerminalWindow 
            history={history} 
            isThinking={isThinking} 
            onCommand={handleCommand}
            isDisabled={isGameOver}
            mode={currentMode}
          />
        </div>

        <footer className="mt-2 text-[9px] text-zinc-700 flex justify-between font-mono">
          <span>{username.toUpperCase()}@ROOT</span>
          <span className="hidden sm:inline">MODE: {currentMode}</span>
          <span>LINUX_ACADEMY v3.2</span>
        </footer>
      </main>
    </div>
  );
};

export default App;
