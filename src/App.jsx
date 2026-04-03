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
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { SentinelClient, SentinelError } from './SentinelClient';

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
    sync: {
      title: 'Source Alpha Sync',
      subtitle: 'Autonomous Data Refresh Cycle by High ArchyTech Solutions',
      status: 'Synchronized',
      lastSync: 'Last Sync',
      nextSync: 'Next Sync',
      cycleTime: '60-min cycle',
      dataAge: 'Data Age',
      freshLabel: 'FRESH',
      staleLabel: 'STALE',
      minutes: 'min',
      sourceAlpha: 'Source Alpha (Google Doc)',
      pipeline: 'Apps Script Pipeline',
      sentinelEngine: 'Sentinel Engine',
      initiating: 'INITIATING HANDSHAKE...',
      verifying: 'VERIFYING POST-QUANTUM ROUTE...',
      verified: 'HANDSHAKE VERIFIED: AUTHORITY STAMP < 1HR',
      compromised: 'PIPELINE COMPROMISED. RETRYING...',
      connectionLabel: 'Edge Connection',
      payloadReceived: 'Source Alpha Payload Received',
    },
    terminal: {
      title: 'Query Terminal',
      subtitle: 'Interact with Sentinel Engine',
      placeholder: 'Enter intelligence query...',
      welcome: 'SENTINEL ENGINE v4.1 — Data Moat Active (BigQuery VECTOR_RAG)',
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
    switchLang: 'Cambiar a Español',
  },
  es: {
    brand: 'SENTINEL',
    brandSub: 'Inteligencia de Mercado Autónoma',
    tagline: 'Pipeline de Inteligencia Sin Middleware para Logística Global',
    nav: { dashboard: 'Panel', terminal: 'Terminal', sync: 'Sincronización', intel: 'Intel Feed' },
    hero: {
      title: 'El Futuro de la Inteligencia Logística',
      subtitle: 'Seguridad post-cuántica. Sin middleware. Autónomo.',
      description: 'Sentinel Engine por High ArchyTech Solutions reemplaza silos de datos estáticos con un pipeline de inteligencia en tiempo real impulsado por infraestructura edge. Cero middleware externo. Cero compromiso de latencia.',
      cta: 'Inicializar Terminal',
      ctaSecondary: 'Ver Estado de Sync',
    },
    stats: {
      activePorts: 'Puertos Activos Monitoreados',
      dataPoints: 'Puntos de Datos / Hora',
      latency: 'Latencia Promedio',
      uptime: 'Tiempo Activo del Sistema',
    },
    ticker: {
      title: 'EN VIVO',
      sources: 'Freightos • Xeneta • MarineTraffic',
    },
    sync: {
      title: 'Sync Source Alpha',
      subtitle: 'Ciclo de Actualización Autónomo por High ArchyTech Solutions',
      status: 'Sincronizado',
      lastSync: 'Última Sincronización',
      nextSync: 'Próxima Sincronización',
      cycleTime: 'Ciclo de 60 min',
      dataAge: 'Antigüedad de Datos',
      freshLabel: 'FRESCO',
      staleLabel: 'OBSOLETO',
      minutes: 'min',
      sourceAlpha: 'Source Alpha (Google Doc)',
      pipeline: 'Pipeline Apps Script',
      sentinelEngine: 'Sentinel Engine',
      initiating: 'INICIANDO HANDSHAKE...',
      verifying: 'VERIFICANDO RUTA POST-CUÁNTICA...',
      verified: 'HANDSHAKE VERIFICADO: SELLO DE AUTORIDAD < 1HR',
      compromised: 'PIPELINE COMPROMETIDO. REINTENTANDO...',
      connectionLabel: 'Conexión Edge',
      payloadReceived: 'Payload Source Alpha Recibido',
    },
    terminal: {
      title: 'Terminal de Consultas',
      subtitle: 'Interactuar con Sentinel Engine',
      placeholder: 'Ingrese consulta de inteligencia...',
      welcome: 'SENTINEL ENGINE v4.1 — Data Moat Activo (BigQuery VECTOR_RAG)',
      ready: 'Sistema listo. Escriba una consulta logística para comenzar.',
      thinking: 'Procesando consulta de inteligencia...',
      dataAuthority: 'Autoridad de respuesta basada en datos < 1hr',
      suggestions: [
        '¿Cuáles son las tarifas actuales Shanghai-Rotterdam?',
        'Mostrar congestión portuaria en Long Beach',
        'Analizar tendencias del Baltic Dry Index',
        'Retrasos de tránsito Canal de Suez hoy',
      ],
    },
    security: {
      title: 'Seguridad',
      postQuantum: 'Handshake Post-Cuántico',
      verified: 'Verificado',
      encryption: 'Encriptación',
      algorithm: 'CRYSTALS-Kyber',
      connection: 'Conexión',
      secure: 'Canal Seguro',
    },

    footer: {
      brand: 'High Archytech Solutions',
      tagline: 'No construimos sitios web. Construimos sistemas autónomos.',
      link: 'high-archy.tech',
    },
    lang: 'ES',
    langFull: 'Español',
    switchLang: 'Switch to English',
  },
};

// ═══════════════════════════════════════════════════
//  SIMULATED LIVE FEED DATA
// ═══════════════════════════════════════════════════
const generateTickerItems = () => [
  { id: 1, source: 'Freightos', text: 'FBX Global Index: $1,847/FEU ▲ 3.2% WoW', trend: 'up', time: '2m ago' },
  { id: 2, source: 'Xeneta', text: 'Asia-Europe long-term rates: $2,340/FEU — contract renewal surge', trend: 'up', time: '5m ago' },
  { id: 3, source: 'MarineTraffic', text: 'Port of Shanghai: 147 vessels at anchor — congestion level HIGH', trend: 'neutral', time: '3m ago' },
  { id: 4, source: 'Freightos', text: 'Trans-Pacific spot rates stabilizing at $1,520/FEU', trend: 'neutral', time: '8m ago' },
  { id: 5, source: 'Xeneta', text: 'Mediterranean short-term rates ▼ 1.8% — seasonal adjustment', trend: 'down', time: '11m ago' },
  { id: 6, source: 'MarineTraffic', text: 'Suez Canal: 12-hour avg transit delay — northbound flow restricted', trend: 'up', time: '7m ago' },
  { id: 7, source: 'Freightos', text: 'Baltic Dry Index: 1,892 pts ▲ 42 pts — Capesize demand surge', trend: 'up', time: '14m ago' },
  { id: 8, source: 'Xeneta', text: 'US East Coast import rates ▲ 5.1% — pre-tariff frontloading', trend: 'up', time: '9m ago' },
  { id: 9, source: 'MarineTraffic', text: 'Port of Rotterdam: vessel turnaround avg 2.3 days — optimal', trend: 'neutral', time: '16m ago' },
  { id: 10, source: 'Freightos', text: 'Air freight TACA index: $3.42/kg — capacity tightening Q2', trend: 'up', time: '19m ago' },
];


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
//  INTELLIGENCE BAR (Live Ticker)
// ═══════════════════════════════════════════════════
const IntelligenceBar = ({ t }) => {
  const items = useMemo(() => generateTickerItems(), []);
  const TrendIcon = ({ trend }) => {
    if (trend === 'up') return <TrendingUp className="w-3.5 h-3.5 text-green-400" />;
    if (trend === 'down') return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
    return <Minus className="w-3.5 h-3.5 text-amber-400" />;
  };

  return (
    <div id="intelligence-bar" className="w-full bg-obsidian-light/80 backdrop-blur-md border-b border-obsidian-border relative overflow-hidden">
      {/* Scan line effect */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-cyber-purple/30 to-transparent animate-scan-line" />
      </div>

      <div className="flex items-center h-10">
        {/* Live badge */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 border-r border-obsidian-border bg-obsidian/80 h-full z-10">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse-glow" />
          <span className="text-[10px] font-mono font-bold text-red-400 tracking-[0.2em] uppercase">{t.ticker.title}</span>
        </div>

        {/* Scrolling ticker */}
        <div className="flex-1 overflow-hidden">
          <div className="flex animate-ticker whitespace-nowrap">
            {[...items, ...items].map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-6 flex-shrink-0">
                <span className="text-[10px] font-mono font-semibold text-cyber-purple tracking-wider">{item.source}</span>
                <span className="text-[11px] font-mono text-text-primary/80">{item.text}</span>
                <TrendIcon trend={item.trend} />
                <span className="text-[10px] font-mono text-text-muted">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Source badge */}
        <div className="flex-shrink-0 hidden sm:flex items-center gap-1.5 px-4 border-l border-obsidian-border h-full bg-obsidian/80">
          <Wifi className="w-3 h-3 text-green-400" />
          <span className="text-[9px] font-mono text-text-muted tracking-wider">{t.ticker.sources}</span>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════
const Navigation = ({ t, lang, setLang, activeSection, setActiveSection }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = [
    { key: 'dashboard', icon: Radar, label: t.nav.dashboard },
    { key: 'terminal', icon: Terminal, label: t.nav.terminal },
    { key: 'sync', icon: RefreshCw, label: t.nav.sync },
    { key: 'intel', icon: Activity, label: t.nav.intel },
  ];

  return (
    <nav id="main-nav" className="sticky top-0 z-50 w-full bg-obsidian/70 backdrop-blur-xl border-b border-obsidian-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveSection('dashboard')}>
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

            {/* Language toggle */}
            <button
              id="lang-toggle"
              onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-obsidian-border hover:border-cyber-purple/50 transition-all duration-300 text-xs font-mono text-text-secondary hover:text-cyber-purple cursor-pointer"
              title={t.switchLang}
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
//  STAT CARD
// ═══════════════════════════════════════════════════
const StatCard = ({ icon: Icon, label, value, accent = 'purple', delay = 0 }) => (
  <div
    className={`glass-panel p-5 animate-fade-in-up ${accent === 'gold' ? 'hover:glow-gold' : 'hover:glow-purple'} transition-all duration-500 group`}
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="flex items-start justify-between mb-3">
      <div className={`p-2 rounded-lg ${accent === 'gold' ? 'bg-amber-gold-dim' : 'bg-cyber-purple-dim'}`}>
        <Icon className={`w-5 h-5 ${accent === 'gold' ? 'text-amber-gold' : 'text-cyber-purple'}`} />
      </div>
      <ArrowUpRight className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
    </div>
    <div className={`text-2xl font-bold font-mono mb-1 ${accent === 'gold' ? 'text-amber-gold' : 'text-cyber-purple'}`}>
      {value}
    </div>
    <div className="text-xs text-text-secondary font-mono tracking-wider uppercase">{label}</div>
  </div>
);

// ═══════════════════════════════════════════════════
//  HERO SECTION
// ═══════════════════════════════════════════════════
const HeroSection = ({ t, setActiveSection }) => (
  <section id="hero-section" className="relative overflow-hidden">
    {/* Background grid */}
    <div className="absolute inset-0 opacity-[0.03]"
      style={{
        backgroundImage: `linear-gradient(rgba(188,19,254,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(188,19,254,0.5) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }}
    />
    {/* Radial glow */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-cyber-purple/8 via-transparent to-transparent rounded-full pointer-events-none" />

    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
      <div className="max-w-3xl">
        {/* Status pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-green-500/30 bg-green-500/5 mb-8 animate-fade-in-up">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse-glow" />
          <span className="text-[11px] font-mono text-green-400 tracking-wider">SYSTEM ONLINE — ALL FEEDS ACTIVE</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] mb-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <span className="text-text-primary">{t.hero.title.split(' ').slice(0, -2).join(' ')} </span>
          <span className="bg-gradient-to-r from-cyber-purple to-amber-gold bg-clip-text text-transparent">
            {t.hero.title.split(' ').slice(-2).join(' ')}
          </span>
        </h1>

        <p className="text-lg text-cyber-purple font-mono tracking-wider mb-4 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          {t.hero.subtitle}
        </p>

        <p className="text-base text-text-secondary leading-relaxed mb-10 max-w-xl animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          {t.hero.description}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <button
            id="cta-primary"
            onClick={() => setActiveSection('terminal')}
            className="group flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyber-purple to-cyber-purple/80 text-white font-mono text-sm font-semibold tracking-wider hover:shadow-[0_0_30px_rgba(188,19,254,0.5)] transition-all duration-500 cursor-pointer"
          >
            <Terminal className="w-4 h-4" />
            {t.hero.cta}
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
          <button
            id="cta-secondary"
            onClick={() => setActiveSection('sync')}
            className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-obsidian-border text-text-secondary font-mono text-sm tracking-wider hover:border-cyber-purple/50 hover:text-text-primary transition-all duration-300 cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            {t.hero.ctaSecondary}
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="mt-20 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Anchor} label={t.stats.activePorts} value="2,847" accent="purple" delay={0} />
        <StatCard icon={Database} label={t.stats.dataPoints} value="14.2M" accent="gold" delay={100} />
        <StatCard icon={Zap} label={t.stats.latency} value="23ms" accent="purple" delay={200} />
        <StatCard icon={Activity} label={t.stats.uptime} value="99.97%" accent="gold" delay={300} />
      </div>
    </div>
  </section>
);

// ═══════════════════════════════════════════════════
//  SOURCE ALPHA SYNC TRACKER
// ═══════════════════════════════════════════════════
const SyncTracker = ({ t, connectionStatus, isSyncing, sourceAlphaData }) => {
  const [progress, setProgress] = useState(0);
  const [minutesElapsed, setMinutesElapsed] = useState(0);

  useEffect(() => {
    // Simulate a 60-minute cycle that loops
    const startOffset = Math.floor(Math.random() * 50) + 5;
    setMinutesElapsed(startOffset);
    setProgress((startOffset / 60) * 100);

    const interval = setInterval(() => {
      setMinutesElapsed(prev => {
        const next = prev >= 59 ? 0 : prev + 1;
        setProgress((next / 60) * 100);
        return next;
      });
    }, 2000); // Accelerated for demo

    return () => clearInterval(interval);
  }, []);

  const circumference = 2 * Math.PI * 45;
  const dashOffset = circumference - (progress / 100) * circumference;
  const isFresh = minutesElapsed < 55;

  return (
    <section id="sync-tracker" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h2 className="text-2xl sm:text-3xl font-bold font-mono mb-2 text-text-primary">{t.sync.title}</h2>
        <p className="text-sm text-text-secondary font-mono tracking-wider">{t.sync.subtitle}</p>
      </div>

      {/* Live Connection Status Bar */}
      {(() => {
        const isOffline = connectionStatus.includes('OFFLINE');
        return (
          <div className={`max-w-3xl mx-auto mb-8 p-4 rounded-xl border transition-all duration-700 ${
            isSyncing
              ? 'border-[#BC13FE] shadow-[0_0_20px_rgba(188,19,254,0.3)] bg-cyber-purple-dim animate-pulse-glow'
              : isOffline
                ? 'border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.2)] bg-red-500/5'
                : 'border-[#FFD700]/40 shadow-[0_0_20px_rgba(255,215,0,0.3)] bg-amber-gold-dim'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isSyncing ? (
                  <RefreshCw className="w-4 h-4 text-cyber-purple animate-spin" />
                ) : isOffline ? (
                  <WifiOff className="w-4 h-4 text-red-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-[#FFD700]" />
                )}
                <span className={`text-xs font-mono font-bold tracking-[0.15em] transition-colors duration-700 ${
                  isSyncing ? 'text-cyber-purple' : isOffline ? 'text-red-400' : 'text-[#FFD700]'
                }`}>
                  {connectionStatus}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-text-muted">{t.sync.connectionLabel}</span>
                <div className={`w-2 h-2 rounded-full transition-colors duration-700 ${
                  isSyncing ? 'bg-cyber-purple animate-pulse-glow' : isOffline ? 'bg-red-400 animate-pulse' : 'bg-[#FFD700]'
                }`} />
              </div>
            </div>
            {sourceAlphaData && !isSyncing && (
              <div className={`mt-3 pt-3 border-t flex items-center gap-2 ${
                isOffline ? 'border-red-500/20' : 'border-[#FFD700]/20'
              }`}>
                <Database className={`w-3.5 h-3.5 ${isOffline ? 'text-red-400' : 'text-[#FFD700]'}`} />
                <span className={`text-[10px] font-mono tracking-wider ${
                  isOffline ? 'text-red-400/80' : 'text-[#FFD700]/80'
                }`}>
                  {isOffline ? 'CACHED PAYLOAD ACTIVE' : t.sync.payloadReceived} — {Object.keys(sourceAlphaData).length} fields ingested
                </span>
              </div>
            )}
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radial Progress */}
        <div className={`glass-panel-elevated p-8 flex flex-col items-center justify-center transition-all duration-700 ${
          isSyncing ? 'border-[#BC13FE] shadow-[0_0_20px_rgba(188,19,254,0.3)]' : ''
        }`}>
          <div className="relative w-40 h-40 mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" className="radial-progress-bg" strokeWidth="3" />
              <circle
                cx="50" cy="50" r="45" fill="none"
                className="radial-progress-fill"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold font-mono text-amber-gold">{minutesElapsed}</span>
              <span className="text-[10px] text-text-muted font-mono tracking-wider">{t.sync.minutes}</span>
            </div>
          </div>

          {/* Synchronized badge */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-700 ${
            isSyncing
              ? 'border-[#BC13FE]/40 bg-cyber-purple-dim shadow-[0_0_20px_rgba(188,19,254,0.3)]'
              : 'border-[#FFD700]/40 bg-amber-gold-dim shadow-[0_0_20px_rgba(255,215,0,0.3)]'
          }`}>
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 text-cyber-purple animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#FFD700]" />
            )}
            <span className={`text-xs font-mono font-bold tracking-[0.2em] transition-colors duration-700 ${
              isSyncing ? 'text-cyber-purple' : 'text-[#FFD700]'
            }`}>
              {isSyncing ? t.sync.initiating : t.sync.status}
            </span>
          </div>
        </div>

        {/* Pipeline visualization */}
        <div className="glass-panel-elevated p-8 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Source Alpha */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-obsidian-border bg-obsidian-mid/50">
              <FileText className="w-5 h-5 text-cyber-purple flex-shrink-0" />
              <div>
                <div className="text-xs font-mono font-semibold text-text-primary">{t.sync.sourceAlpha}</div>
                <div className="text-[10px] text-text-muted font-mono">Markdown Headers • LLM Optimized</div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <div className="flex flex-col items-center gap-1">
                <div className="w-0.5 h-4 bg-gradient-to-b from-cyber-purple to-amber-gold" />
                <Zap className="w-4 h-4 text-amber-gold" />
                <div className="w-0.5 h-4 bg-gradient-to-b from-amber-gold to-cyber-purple" />
              </div>
            </div>

            {/* Pipeline */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-obsidian-border bg-obsidian-mid/50">
              <Cpu className="w-5 h-5 text-amber-gold flex-shrink-0" />
              <div>
                <div className="text-xs font-mono font-semibold text-text-primary">{t.sync.pipeline}</div>
                <div className="text-[10px] text-text-muted font-mono">Zero Zapier • Zero Make</div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <div className="flex flex-col items-center gap-1">
                <div className="w-0.5 h-4 bg-gradient-to-b from-cyber-purple to-amber-gold" />
                <Sparkles className="w-4 h-4 text-cyber-purple" />
                <div className="w-0.5 h-4 bg-gradient-to-b from-amber-gold to-cyber-purple" />
              </div>
            </div>

            {/* Sentinel */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-cyber-purple/30 bg-cyber-purple-dim glow-purple">
              <Hexagon className="w-5 h-5 text-cyber-purple flex-shrink-0" />
              <div>
                <div className="text-xs font-mono font-semibold text-cyber-purple">{t.sync.sentinelEngine}</div>
                <div className="text-[10px] text-text-muted font-mono">Edge Intelligence Layer</div>
              </div>
            </div>
          </div>
        </div>

        {/* Data freshness */}
        <div className="glass-panel-elevated p-8 space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-5 h-5 text-amber-gold" />
            <span className="text-sm font-mono font-semibold text-text-primary">{t.sync.cycleTime}</span>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono text-text-secondary">{t.sync.lastSync}</span>
              <span className="text-xs font-mono text-text-primary">{minutesElapsed} {t.sync.minutes} ago</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono text-text-secondary">{t.sync.nextSync}</span>
              <span className="text-xs font-mono text-amber-gold">{60 - minutesElapsed} {t.sync.minutes}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-obsidian-border overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyber-purple to-amber-gold transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-obsidian-border">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-mono text-text-secondary">{t.sync.dataAge}</span>
              <span className={`text-[10px] font-mono font-bold tracking-[0.2em] px-2 py-0.5 rounded-full ${
                isFresh
                  ? 'text-green-400 bg-green-400/10 border border-green-400/30'
                  : 'text-red-400 bg-red-400/10 border border-red-400/30'
              }`}>
                {isFresh ? t.sync.freshLabel : t.sync.staleLabel}
              </span>
            </div>
            <div className="text-3xl font-bold font-mono text-text-primary">
              {minutesElapsed}<span className="text-lg text-text-muted ml-1">{t.sync.minutes}</span>
            </div>
          </div>

          {/* Micro-indicators */}
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-obsidian-border">
            {[
              { icon: Wifi, label: 'API', ok: true },
              { icon: Shield, label: 'PQ-TLS', ok: true },
              { icon: Database, label: 'Cache', ok: true },
            ].map(({ icon: Icon, label, ok }) => (
              <div key={label} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-obsidian-mid/50">
                <Icon className={`w-3.5 h-3.5 ${ok ? 'text-green-400' : 'text-red-400'}`} />
                <span className="text-[9px] font-mono text-text-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════
//  METRICS CARD — Structured Data Display
// ═══════════════════════════════════════════════════
const MetricsCard = ({ metrics }) => {
  if (!metrics || metrics.length === 0) return null;

  const trendConfig = {
    up: { icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-400/10' },
    down: { icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-400/10' },
    stable: { icon: Minus, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  };

  return (
    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
      {metrics.slice(0, 6).map((metric, i) => {
        const trend = trendConfig[metric.trend] || trendConfig.stable;
        const TrendIcon = trend.icon;
        return (
          <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-obsidian-border/50 ${trend.bg}`}>
            <TrendIcon className={`w-3.5 h-3.5 flex-shrink-0 ${trend.color}`} />
            <div className="min-w-0">
              <div className="text-[10px] text-text-muted truncate">{metric.label}</div>
              <div className={`text-xs font-mono font-semibold ${trend.color}`}>{metric.value}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════
//  QUERY TERMINAL (v4.0 — Structured JSON Output)
// ═══════════════════════════════════════════════════
const QueryTerminal = ({ t, sourceAlphaData }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // --- SENTINEL CLIENT (Headless) ---
  const clientRef = useRef(null);
  if (!clientRef.current) {
    clientRef.current = new SentinelClient(import.meta.env.VITE_SENTINEL_ENDPOINT);
  }

  // --- VOICE PROTOCOL (Web Speech API Only) ---
  const speakResponse = (text) => {
    if (!isVoiceActive || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    const cleanText = text.replace(/[*#_`~]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 0.9;

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
      // Execute structured query via SentinelClient
      const result = await clientRef.current.query(query);

      setMessages(prev => [...prev, {
        role: 'sentinel',
        content: result.narrative,
        metrics: result.metrics,
        confidence: result.confidence,
        sources: result.sources,
        dataAuthority: result.dataAuthority,
        type: 'response',
        timestamp: new Date().toLocaleTimeString(),
      }]);

      // Engage Voice Protocol (Web Speech API)
      speakResponse(result.narrative);
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
            <span className="text-[10px] font-mono text-text-muted ml-2 tracking-wider">SENTINEL://data-moat/v4.1.0</span>

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

              {/* Sentinel AI response — left-aligned with accent bar + metrics */}
              {msg.type === 'response' && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] pl-5 pr-6 py-4 border-l-[3px] border-cyber-purple/60 bg-obsidian-mid/30 rounded-r-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-4 h-4 text-cyber-purple" />
                      <span className="text-[11px] text-cyber-purple tracking-[0.15em] font-semibold">SENTINEL RESPONSE</span>
                      {msg.confidence != null && (
                        <span className="text-[9px] text-amber-gold bg-amber-gold-dim px-1.5 py-0.5 rounded-full font-mono">
                          {Math.round(msg.confidence * 100)}% confidence
                        </span>
                      )}
                      <span className="text-[10px] text-text-muted ml-auto">— {msg.timestamp}</span>
                    </div>
                    <div className="text-text-primary/90 text-sm leading-relaxed prose prose-invert prose-sm prose-p:my-1 prose-headings:text-cyber-purple prose-strong:text-text-primary prose-code:text-cyber-purple prose-code:bg-cyber-purple-dim prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[12px] prose-code:font-mono prose-a:text-cyber-purple max-w-none">
                      <ReactMarkdown>{DOMPurify.sanitize(msg.content)}</ReactMarkdown>
                    </div>

                    {/* Structured Metrics Cards */}
                    <MetricsCard metrics={msg.metrics} />

                    <div className="mt-4 pt-3 border-t border-obsidian-border/30 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-gold" />
                        <span className="text-[10px] text-amber-gold">{t.terminal.dataAuthority}</span>
                      </div>
                      {msg.dataAuthority && (
                        <span className={`text-[9px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                          msg.dataAuthority === 'GCP_BIGQUERY_VECTOR_RAG'
                            ? 'text-cyber-purple border-cyber-purple/40 bg-cyber-purple-dim'
                            : 'text-amber-400 border-amber-400/30 bg-amber-400/10'
                        }`}>
                          {msg.dataAuthority}
                        </span>
                      )}
                      {msg.sources && msg.sources.length > 0 && (
                        <span className="text-[9px] text-text-muted ml-auto">
                          Sources: {msg.sources.join(' • ')}
                        </span>
                      )}
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
  const [lang, setLang] = useState('en');
  const [activeSection, setActiveSection] = useState('dashboard');
  const t = translations[lang];

  // --- AUTHENTICATION STATE ---
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Listen to Firebase Auth state changes.
  // This fires once on mount (with null or user) then on every sign-in/sign-out.
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const auth = getAuth();
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      // onAuthStateChanged will fire and set authUser automatically
    } catch (err) {
      const messages = {
        'auth/invalid-credential': 'Invalid email or password.',
        'auth/user-disabled': 'This account has been disabled. Contact your administrator.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
        'auth/network-request-failed': 'Network error. Check your connection.',
      };
      setLoginError(messages[err.code] || `Authentication failed: ${err.message}`);
    } finally {
      setLoginLoading(false);
    }
  };

  // --- SENTINEL STATE MANAGEMENT ---
  const [sourceAlphaData, setSourceAlphaData] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('INITIATING HANDSHAKE...');
  const [isSyncing, setIsSyncing] = useState(true);

  // Headless Sentinel Client (singleton)
  const sentinelClientRef = useRef(null);
  if (!sentinelClientRef.current) {
    sentinelClientRef.current = new SentinelClient(import.meta.env.VITE_SENTINEL_ENDPOINT);
  }

  // --- AUTONOMOUS DATA PIPELINE (Offline-Aware, via SentinelClient) ---
  useEffect(() => {
    const synchronizeSourceAlpha = async () => {
      setIsSyncing(true);

      // Check network status before attempting sync
      if (!navigator.onLine) {
        setConnectionStatus('OFFLINE: SERVING CACHED INTELLIGENCE (AUTHORITY COMPROMISED)');
        setIsSyncing(false);
        return;
      }

      setConnectionStatus(translations[lang]?.sync?.verifying || 'VERIFYING POST-QUANTUM ROUTE...');

      try {
        const health = await sentinelClientRef.current.healthCheck();

        if (health.online) {
          setSourceAlphaData(health.details);
          setConnectionStatus(translations[lang]?.sync?.verified || 'HANDSHAKE VERIFIED: AUTHORITY STAMP < 1HR');
          console.log('Sentinel Engine: Secure route established. Sovereign inference ready.');
        } else {
          throw new Error('Handshake Failed: Invalid Route Signature');
        }
      } catch (error) {
        console.error('Sentinel Engine Error:', error);
        if (!navigator.onLine) {
          setConnectionStatus('OFFLINE: SERVING CACHED INTELLIGENCE (AUTHORITY COMPROMISED)');
        } else {
          setConnectionStatus(translations[lang]?.sync?.compromised || 'PIPELINE COMPROMISED. RETRYING...');
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
  }, [lang]);

  // ── Auth Loading Screen ──
  if (authLoading) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary text-sm font-mono">INITIALIZING SECURE SESSION...</p>
        </div>
      </div>
    );
  }

  // ── Login Overlay ──
  if (!authUser) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Shield className="w-8 h-8 text-accent-cyan" />
              <h1 className="text-2xl font-bold text-text-primary font-mono tracking-widest">SENTINEL</h1>
            </div>
            <p className="text-text-secondary text-sm">Autonomous Market Intelligence</p>
            <p className="text-text-tertiary text-xs mt-1">High ArchyTech Solutions</p>
          </div>

          <form onSubmit={handleLogin} className="bg-surface-primary border border-border-subtle rounded-lg p-6 space-y-4">
            <div>
              <label className="block text-text-secondary text-xs font-mono mb-1 uppercase tracking-wider">Operator Email</label>
              <input
                id="login-email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-obsidian border border-border-subtle rounded px-3 py-2 text-text-primary font-mono text-sm focus:outline-none focus:border-accent-cyan transition-colors"
                placeholder="operator@enterprise.com"
              />
            </div>
            <div>
              <label className="block text-text-secondary text-xs font-mono mb-1 uppercase tracking-wider">Access Key</label>
              <input
                id="login-password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-obsidian border border-border-subtle rounded px-3 py-2 text-text-primary font-mono text-sm focus:outline-none focus:border-accent-cyan transition-colors"
                placeholder="••••••••••••"
              />
            </div>

            {loginError && (
              <div className="flex items-center gap-2 text-status-danger text-xs font-mono bg-status-danger/10 border border-status-danger/30 rounded px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              disabled={loginLoading}
              className="w-full bg-accent-cyan text-obsidian font-mono font-bold text-sm py-2.5 rounded hover:bg-accent-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loginLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-obsidian border-t-transparent rounded-full animate-spin"></div>
                  AUTHENTICATING...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  AUTHENTICATE
                </>
              )}
            </button>

            <p className="text-text-tertiary text-xs text-center font-mono mt-3">
              Access restricted to provisioned enterprise operators.
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian text-text-primary">
      {/* Intelligence Bar */}
      <IntelligenceBar t={t} />

      {/* Navigation */}
      <Navigation
        t={t}
        lang={lang}
        setLang={setLang}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />

      {/* Main Content */}
      <main>
        {activeSection === 'dashboard' && (
          <>
            <HeroSection t={t} setActiveSection={setActiveSection} />
            <SyncTracker t={t} connectionStatus={connectionStatus} isSyncing={isSyncing} sourceAlphaData={sourceAlphaData} />
          </>
        )}

        {activeSection === 'terminal' && (
          <QueryTerminal t={t} sourceAlphaData={sourceAlphaData} />
        )}

        {activeSection === 'sync' && (
          <SyncTracker t={t} connectionStatus={connectionStatus} isSyncing={isSyncing} sourceAlphaData={sourceAlphaData} />
        )}

        {activeSection === 'intel' && (
          <SyncTracker t={t} connectionStatus={connectionStatus} isSyncing={isSyncing} sourceAlphaData={sourceAlphaData} />
        )}
      </main>

      {/* Footer */}
      <Footer t={t} />
    </div>
  );
}
