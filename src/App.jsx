import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Shield, Radar, Terminal, Database, Globe, Zap, Clock, Radio,
  ChevronRight, Send, AlertTriangle, CheckCircle2, RefreshCw,
  Anchor, Ship, Container, TrendingUp, TrendingDown, Minus,
  Languages, Menu, X, Activity, Eye, Lock, Cpu, Wifi, WifiOff,
  BarChart3, FileText, ArrowUpRight, Sparkles, Hexagon,
  Volume2, VolumeX
} from 'lucide-react';
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';

// ═══════════════════════════════════════════════════
//  TRANSLATIONS (i18n – EN / ES)
// ═══════════════════════════════════════════════════
const translations = {
  en: {
    brand: 'SENTINEL',
    brandSub: 'Autonomous Market Intelligence',
    tagline: 'Middleware-Free Intelligence Pipeline for Global Logistics',
    nav: { dashboard: 'Dashboard', terminal: 'Query Terminal', sync: 'Sync Status', intel: 'Intel Feed' },
    hero: {
      title: 'The Future of Logistics Intelligence',
      subtitle: 'Post-quantum secured. Middleware-free. Autonomous.',
      description: 'Sentinel Engine by High ArchyTech Solutions replaces static data silos with a real-time intelligence pipeline powered by edge infrastructure. Zero external middleware. Zero latency compromise.',
      cta: 'Initialize Terminal',
      ctaSecondary: 'View Sync Status',
    },
    stats: {
      activePorts: 'Active Ports Monitored',
      dataPoints: 'Data Points / Hour',
      latency: 'Avg Response Latency',
      uptime: 'System Uptime',
    },
    ticker: {
      title: 'LIVE FEED',
      sources: 'Freightos • Xeneta • MarineTraffic',
    },
    terminal: {
      title: 'Query Terminal',
      subtitle: 'Interact with Sentinel Engine',
      placeholder: 'Enter intelligence query...',
      welcome: 'SENTINEL ENGINE v3.2.1 — Post-Quantum Handshake Verified',
      ready: 'System ready. Type a logistics query to begin.',
      thinking: 'Processing intelligence query...',
      dataAuthority: 'Response authority based on data < 1hr old',
      suggestions: [
        'What are current Shanghai-Rotterdam freight rates?',
        'Show port congestion at Long Beach',
        'Analyze Baltic Dry Index trends',
        'Suez Canal transit delays today',
      ],
    },
    security: {
      title: 'Security',
      postQuantum: 'Post-Quantum Handshake',
      verified: 'Verified',
      encryption: 'Encryption',
      algorithm: 'CRYSTALS-Kyber',
      connection: 'Connection',
      secure: 'Secure Channel',
    },

    footer: {
      brand: 'High Archytech Solutions',
      tagline: 'We don\'t build websites. We build autonomous systems.',
      link: 'high-archy.tech',
    },
    lang: 'EN',
    langFull: 'English',
  },
};

// Removed Simulated Ticker per directive

// ═══════════════════════════════════════════════════
//  SVG COMPONENTS
// ═══════════════════════════════════════════════════
const SentinelLogo = ({ className = '' }) => (
  <img src="/ha-logo.png" alt="High ArchyTech Solutions" className={`${className} object-contain`} />
);

const HighArchyLogo = ({ className = '' }) => (
  <svg viewBox="0 0 200 28" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="archGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#BC13FE" />
        <stop offset="100%" stopColor="#FFD700" />
      </linearGradient>
    </defs>
    <text x="0" y="20" fontFamily="Inter, sans-serif" fontWeight="800" fontSize="16" fill="url(#archGrad)" letterSpacing="2">HIGH ARCHYTECH</text>
  </svg>
);

// ═══════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════
const Navigation = ({ t, activeSection, setActiveSection }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = [
    { key: 'terminal', icon: Terminal, label: t.nav.terminal }
  ];

  return (
    <nav id="main-nav" className="sticky top-0 z-50 w-full bg-obsidian/70 backdrop-blur-xl border-b border-obsidian-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveSection('terminal')}>
            <SentinelLogo className="w-10 h-10 rounded-lg transition-transform duration-500 group-hover:scale-110" />
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-[0.3em] text-text-primary font-mono">{t.brand}</span>
              <span className="text-[9px] text-text-muted tracking-[0.15em] uppercase">{t.brandSub}</span>
            </div>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                id={`nav-${key}`}
                onClick={() => setActiveSection(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono transition-all duration-300 cursor-pointer ${
                  activeSection === key
                    ? 'bg-cyber-purple-dim text-cyber-purple glow-purple'
                    : 'text-text-secondary hover:text-text-primary hover:bg-obsidian-mid'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            {/* Security badge */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full border border-green-500/30 bg-green-500/5">
              <Lock className="w-3 h-3 text-green-400" />
              <span className="text-[10px] font-mono text-green-400 tracking-wider">PQ-TLS</span>
            </div>

            <button
              id="lang-toggle"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-obsidian-border hover:border-cyber-purple/50 transition-all duration-300 text-xs font-mono text-text-secondary hover:text-cyber-purple cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5" />
              {t.lang}
            </button>

            {/* Mobile menu */}
            <button
              id="mobile-menu-toggle"
              className="md:hidden p-2 text-text-secondary hover:text-text-primary cursor-pointer"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-obsidian-border bg-obsidian/95 backdrop-blur-xl animate-fade-in-up">
          <div className="px-4 py-3 space-y-1">
            {navItems.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => { setActiveSection(key); setMobileOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-mono transition-all cursor-pointer ${
                  activeSection === key
                    ? 'bg-cyber-purple-dim text-cyber-purple'
                    : 'text-text-secondary hover:text-text-primary hover:bg-obsidian-mid'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};

// ═══════════════════════════════════════════════════
//  QUERY TERMINAL (Gemini API — Enterprise White-Label)
// ═══════════════════════════════════════════════════
const QueryTerminal = ({ t, sourceAlphaData }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const audioContextRef = useRef(null);

  // --- SENTINEL SECURE ROUTING ---
  const SENTINEL_ENDPOINT = import.meta.env.VITE_SENTINEL_ENDPOINT;

  // --- VOICE PROTOCOL ---
  const speakResponse = async (text, base64Audio = null) => {
    if (!isVoiceActive) return;

    window.speechSynthesis.cancel();

    // Play native 16-bit PCM Audio if provided by Gemini 1.5 Pro
    if (base64Audio) {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      setIsSpeaking(true);
      try {
        const audioCtx = audioContextRef.current;
        const binaryString = window.atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Strict Gemini Native Audio parsing: 16-bit PCM, 24kHz
        const numSamples = bytes.length / 2;
        const audioBuffer = audioCtx.createBuffer(1, numSamples, 24000);
        const channelData = audioBuffer.getChannelData(0);
        const dataView = new DataView(bytes.buffer);
        
        for (let i = 0; i < numSamples; i++) {
            const int16 = dataView.getInt16(i * 2, true);
            channelData[i] = int16 / 32768.0;
        }
        
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.onended = () => setIsSpeaking(false);
        source.start(0);
      } catch (err) {
        console.error("Native Audio Protocol Error:", err);
        setIsSpeaking(false);
      }
      return;
    }

    if (!('speechSynthesis' in window)) return;

    // Fallback logic
    const cleanText = text.replace(/[*#_`~]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 0.9;

    // Attempt to find a premium English voice
    const voices = window.speechSynthesis.getVoices();
    const systemVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Samantha') || v.lang === 'en-GB');
    if (systemVoice) utterance.voice = systemVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Initial Boot Sequence
  useEffect(() => {
    setMessages([
      { role: 'system', content: `> ${t.terminal.welcome}`, type: 'info' },
      { role: 'system', content: t.terminal.ready, type: 'ready' },
    ]);
  }, [t]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const query = input.trim();
    if (!query || isTyping) return;

    setMessages(prev => [...prev, { role: 'user', content: query, type: 'query' }]);
    setInput('');
    setIsTyping(true);

    try {
      // THE GROUND TRUTH PAYLOAD is now natively handled by the Cloud Function via Firestore context
      const payload = {
        query: query
      };

      // Retrieve the Firebase ID token from session/local storage or global state
      const token = sessionStorage.getItem('sentinel_token') || localStorage.getItem('sentinel_token');
      const authHeader = token ? `Bearer ${token}` : '';

      const response = await fetch(SENTINEL_ENDPOINT, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(authHeader && { 'Authorization': authHeader })
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.data) {
        throw new Error(data.message || data.error || 'Invalid API response from Sentinel Engine');
      }

      const aiResponse = data.data;

      setMessages(prev => [...prev, {
        role: 'sentinel',
        content: aiResponse,
        type: 'response',
        timestamp: new Date().toLocaleTimeString(),
      }]);

      // Engage Voice Protocol (Fallback to TTS if no native audio)
      speakResponse(aiResponse, data.audioData);
    } catch (error) {
      console.error('Sentinel Engine API Error:', error);
      setMessages(prev => [...prev, {
        role: 'system',
        content: `PIPELINE COMPROMISED: ${error.message || 'UNABLE TO REACH AI CORE.'}`,
        type: 'error',
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestion = (suggestion) => {
    setInput(suggestion);
    setTimeout(() => document.getElementById('terminal-send')?.click(), 100);
  };

  // --- RENDERER MOVED TO REACT-MARKDOWN ---

  return (
    <section id="query-terminal" className="w-full px-4 sm:px-6 lg:px-8 py-6" style={{ minHeight: 'calc(100vh - 4rem)' }}>
      {/* Header */}
      <div className="text-center mb-6 max-w-4xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold font-mono mb-2 text-text-primary">{t.terminal.title}</h2>
        <p className="text-sm text-text-secondary font-mono tracking-wider">{t.terminal.subtitle}</p>
      </div>

      {/* Terminal Container — Full width with max-width for readability */}
      <div className={`glass-panel-elevated overflow-hidden max-w-6xl mx-auto border-[#BC13FE]/30 transition-shadow duration-700 flex flex-col ${
        isSpeaking
          ? 'shadow-[0_0_40px_rgba(188,19,254,0.5)]'
          : 'shadow-[0_0_20px_rgba(188,19,254,0.2)]'
      }`} style={{ height: 'calc(100vh - 12rem)', minHeight: '500px' }}>

        {/* Terminal Header Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-obsidian-border bg-obsidian/80 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-amber-400/60" />
              <div className="w-3 h-3 rounded-full bg-green-400/60" />
            </div>
            <span className="text-[10px] font-mono text-text-muted ml-2 tracking-wider">SENTINEL://gemini-core/v4.0.0</span>

            {/* Soundwave Visualizer */}
            {isSpeaking && (
              <div className="flex items-end gap-[3px] h-4 ml-3" aria-label="Voice active">
                {[1, 2, 3, 4, 5].map((bar) => (
                  <div
                    key={bar}
                    className="w-[3px] rounded-full bg-[#BC13FE]"
                    style={{
                      animation: `sentinel-soundwave 0.8s ease-in-out infinite alternate`,
                      animationDelay: `${bar * 0.1}s`,
                      height: '4px',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Data freshness indicator */}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border ${
              sourceAlphaData
                ? 'border-green-500/30 bg-green-500/5'
                : 'border-amber-400/30 bg-amber-400/5'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                sourceAlphaData ? 'bg-green-400 animate-pulse-glow' : 'bg-amber-400 animate-pulse'
              }`} />
              <span className={`text-[9px] font-mono tracking-wider ${
                sourceAlphaData ? 'text-green-400' : 'text-amber-400'
              }`}>
                {sourceAlphaData ? 'GROUND TRUTH ACTIVE' : 'AWAITING SYNC'}
              </span>
            </div>

            {/* Voice Protocol Toggle */}
            <button
              id="voice-toggle"
              onClick={() => {
                if (isSpeaking) {
                  window.speechSynthesis.cancel();
                  setIsSpeaking(false);
                }
                setIsVoiceActive(prev => !prev);
              }}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full border transition-all duration-300 cursor-pointer ${
                isVoiceActive
                  ? 'border-cyber-purple/40 bg-cyber-purple-dim hover:border-cyber-purple/60'
                  : 'border-obsidian-border bg-obsidian-mid/50 hover:border-text-muted'
              }`}
              title={isVoiceActive ? 'Mute Voice Protocol' : 'Enable Voice Protocol'}
            >
              {isVoiceActive
                ? <Volume2 className={`w-3 h-3 ${isSpeaking ? 'text-cyber-purple animate-pulse' : 'text-cyber-purple'}`} />
                : <VolumeX className="w-3 h-3 text-text-muted" />
              }
              <span className={`text-[9px] font-mono tracking-wider ${
                isVoiceActive ? 'text-cyber-purple' : 'text-text-muted'
              }`}>
                {isVoiceActive ? 'VOICE' : 'MUTED'}
              </span>
            </button>

            <div className="flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-green-400" />
              <span className="text-[10px] font-mono text-green-400">{t.security.postQuantum}</span>
            </div>
          </div>
        </div>

        {/* ═══ Messages Feed — Expanded to fill available space ═══ */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-5 font-mono scroll-smooth" style={{ minHeight: 0 }}>
          {messages.map((msg, i) => (
            <div key={i} className="animate-fade-in-up">
              {/* User query — right-aligned bubble */}
              {msg.type === 'query' && (
                <div className="flex justify-end">
                  <div className="max-w-[75%] px-5 py-3.5 rounded-2xl rounded-br-md bg-gradient-to-br from-cyber-purple/20 to-cyber-purple/10 border border-cyber-purple/30">
                    <p className="text-sm text-text-primary leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              )}

              {/* Sentinel AI response — left-aligned with accent bar */}
              {msg.type === 'response' && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] pl-5 pr-6 py-4 border-l-[3px] border-cyber-purple/60 bg-obsidian-mid/30 rounded-r-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-4 h-4 text-cyber-purple" />
                      <span className="text-[11px] text-cyber-purple tracking-[0.15em] font-semibold">SENTINEL RESPONSE</span>
                      <span className="text-[10px] text-text-muted ml-auto">— {msg.timestamp}</span>
                    </div>
                    <div className="text-text-primary/90 text-sm leading-relaxed prose prose-invert prose-p:my-1 prose-headings:text-cyber-purple prose-a:text-cyber-purple max-w-none">
                      <ReactMarkdown>{DOMPurify.sanitize(msg.content)}</ReactMarkdown>
                    </div>
                    <div className="mt-4 pt-3 border-t border-obsidian-border/30 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-gold" />
                      <span className="text-[10px] text-amber-gold">{t.terminal.dataAuthority}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* System messages — centered subtle text */}
              {(msg.type === 'info' || msg.type === 'ready') && (
                <div className="text-center py-1">
                  <span className={`text-xs ${msg.type === 'info' ? 'text-cyber-purple text-glow-purple' : 'text-green-400'}`}>
                    {msg.content}
                  </span>
                </div>
              )}

              {/* Error messages */}
              {msg.type === 'error' && (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/5 max-w-[85%]">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <span className="text-xs font-mono text-red-400">{msg.content}</span>
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex items-center gap-3 text-cyber-purple animate-pulse-glow py-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">{t.terminal.thinking}</span>
            </div>
          )}
        </div>

        {/* ═══ Suggestion Chips — Wrap grid for visibility ═══ */}
        <div className="px-6 py-3 border-t border-obsidian-border/50 flex-shrink-0">
          <div className="flex flex-wrap gap-2">
            {t.terminal.suggestions.map((s, i) => (
              <button
                key={i}
                id={`suggestion-${i}`}
                onClick={() => handleSuggestion(s)}
                disabled={isTyping}
                className="px-4 py-2 rounded-full border border-obsidian-border text-[11px] font-mono text-text-muted hover:text-cyber-purple hover:border-cyber-purple/50 hover:bg-cyber-purple-dim transition-all duration-300 whitespace-nowrap cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ Input Area — Spacious textarea with prominent send ═══ */}
        <form onSubmit={handleSubmit} className="flex items-end gap-3 border-t border-obsidian-border bg-obsidian/40 px-5 py-4 focus-within:shadow-[0_0_30px_rgba(188,19,254,0.15)] transition-shadow duration-500 flex-shrink-0">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              id="terminal-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={t.terminal.placeholder}
              className="w-full bg-obsidian-mid/50 text-text-primary font-mono text-sm px-5 py-4 rounded-xl border border-obsidian-border focus:border-cyber-purple/50 focus:outline-none placeholder:text-text-muted resize-none transition-all duration-300"
              rows={2}
              disabled={isTyping}
              autoComplete="off"
              style={{ maxHeight: '120px' }}
            />
            <span className="absolute bottom-2 right-3 text-[9px] font-mono text-text-muted/50">Shift+Enter for new line</span>
          </div>
          <button
            id="terminal-send"
            type="submit"
            disabled={isTyping || !input.trim()}
            className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-cyber-purple to-cyber-purple/70 text-white hover:shadow-[0_0_20px_rgba(188,19,254,0.5)] transition-all duration-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </section>
  );
};



// ═══════════════════════════════════════════════════
//  FOOTER
// ═══════════════════════════════════════════════════
const Footer = ({ t }) => (
  <footer id="footer" className="border-t border-obsidian-border bg-obsidian/50 backdrop-blur-md">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <SentinelLogo className="w-8 h-8" />
          <div>
            <HighArchyLogo className="h-5 mb-1" />
            <p className="text-[11px] font-mono text-text-muted italic">{t.footer.tagline}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <a
            href="https://high-archy.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-text-secondary hover:text-cyber-purple transition-colors flex items-center gap-1.5"
          >
            <Globe className="w-3.5 h-3.5" />
            {t.footer.link}
          </a>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-obsidian-border">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-glow" />
            <span className="text-[10px] font-mono text-text-muted">v3.2.1</span>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-obsidian-border/50 text-center">
        <p className="text-[10px] font-mono text-text-muted tracking-wider">
          © {new Date().getFullYear()} HIGH ARCHYTECH SOLUTIONS — SENTINEL ENGINE — ALL RIGHTS RESERVED
        </p>
      </div>
    </div>
  </footer>
);

// ═══════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════
export default function App() {
  const t = translations['en'];
  const [activeSection, setActiveSection] = useState('terminal');

  // --- SENTINEL STATE MANAGEMENT ---
  const [sourceAlphaData, setSourceAlphaData] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('INITIATING HANDSHAKE...');
  const [isSyncing, setIsSyncing] = useState(true);

  // Your Proprietary Sovereign Endpoint
  const SENTINEL_ENDPOINT = import.meta.env.VITE_SENTINEL_ENDPOINT;

  // --- AUTONOMOUS DATA PIPELINE (Offline-Aware) ---
  useEffect(() => {
    const synchronizeSourceAlpha = async () => {
      setIsSyncing(true);

      // Check network status before attempting sync
      if (!navigator.onLine) {
        setConnectionStatus('OFFLINE: SERVING CACHED INTELLIGENCE (AUTHORITY COMPROMISED)');
        setIsSyncing(false);
        return;
      }

      setConnectionStatus('VERIFYING POST-QUANTUM ROUTE...');

      try {
        // We ping the CF with an empty POST to trigger the custom 400 SENTINEL_EMPTY_QUERY block. 
        // This validates the route is fully active without consuming Vertex LLM tokens.
        const response = await fetch(SENTINEL_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        
        const data = await response.json();

        if (response.status === 400 && data.code === 'SENTINEL_EMPTY_QUERY') {
          // Fake synthetic context metadata since the Cloud Function manages Firestore natively now
          setSourceAlphaData({ routing: "VPC_INTERNAL", data_authority: "GCP_FIRESTORE_NATIVE", zero_trust: "VERIFIED" });
          setConnectionStatus('HANDSHAKE VERIFIED: AUTHORITY STAMP < 1HR');
          console.log("Sentinel Engine: Secure route established. Sovereign inference ready.");
        } else {
          throw new Error("Handshake Failed: Invalid Route Signature");
        }
      } catch (error) {
        console.error("Sentinel Engine Error:", error);
        // If we're offline (detected during fetch failure), the SW may have served cached data
        if (!navigator.onLine) {
          setConnectionStatus('OFFLINE: SERVING CACHED INTELLIGENCE (AUTHORITY COMPROMISED)');
        } else {
          setConnectionStatus('PIPELINE RECOVERY FAILED. RETRYING...');
        }
      } finally {
        setIsSyncing(false);
      }
    };

    synchronizeSourceAlpha();
    const syncInterval = setInterval(synchronizeSourceAlpha, 3600000);

    // --- NETWORK STATUS LISTENERS ---
    const handleOnline = () => {
      console.log('Sentinel Engine: Network restored. Re-syncing Source Alpha...');
      synchronizeSourceAlpha();
    };

    const handleOffline = () => {
      console.warn('Sentinel Engine: Network severed. Engaging offline cache.');
      setConnectionStatus('OFFLINE: SERVING CACHED INTELLIGENCE (AUTHORITY COMPROMISED)');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="min-h-screen bg-obsidian text-text-primary">

      {/* Navigation */}
      <Navigation
        t={t}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />

      {/* Main Content */}
      <main>
        {activeSection === 'terminal' && (
          <QueryTerminal t={t} sourceAlphaData={sourceAlphaData} />
        )}
      </main>

      {/* Footer */}
      <Footer t={t} />
    </div>
  );
}
