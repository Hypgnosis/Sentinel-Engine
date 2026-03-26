import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Shield, Radar, Terminal, Database, Globe, Zap, Clock, Radio,
  ChevronRight, Send, AlertTriangle, CheckCircle2, RefreshCw,
  Anchor, Ship, Container, TrendingUp, TrendingDown, Minus,
  Languages, Menu, X, Activity, Eye, Lock, Cpu, Wifi, WifiOff,
  BarChart3, FileText, ArrowUpRight, Sparkles, Hexagon,
  Volume2, VolumeX
} from 'lucide-react';

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
      description: 'Sentinel Engine replaces static data silos with a real-time intelligence pipeline powered by edge infrastructure. Zero external middleware. Zero latency compromise.',
      cta: 'Initialize Terminal',
      ctaSecondary: 'View Architecture',
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
      subtitle: 'NotebookLM Data Refresh Cycle',
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
    architecture: {
      title: 'System Architecture',
      subtitle: 'Middleware-Free Intelligence Pipeline',
      layers: [
        { name: 'Data Sources', desc: 'Freightos, Xeneta, MarineTraffic APIs' },
        { name: 'Apps Script Sanitizer', desc: 'Autonomous data cleansing & normalization' },
        { name: 'Source Alpha', desc: 'Centralized Google Doc (Markdown headers)' },
        { name: 'NotebookLM Ingestion', desc: '60-min refresh cycle synchronization' },
        { name: 'Sentinel Engine', desc: 'Edge-compute intelligence layer' },
        { name: 'Client Interface', desc: 'React PWA with post-quantum TLS' },
      ],
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
      description: 'Sentinel Engine reemplaza silos de datos estáticos con un pipeline de inteligencia en tiempo real impulsado por infraestructura edge. Cero middleware externo. Cero compromiso de latencia.',
      cta: 'Inicializar Terminal',
      ctaSecondary: 'Ver Arquitectura',
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
      subtitle: 'Ciclo de Actualización NotebookLM',
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
      welcome: 'SENTINEL ENGINE v3.2.1 — Handshake Post-Cuántico Verificado',
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
    architecture: {
      title: 'Arquitectura del Sistema',
      subtitle: 'Pipeline de Inteligencia Sin Middleware',
      layers: [
        { name: 'Fuentes de Datos', desc: 'APIs de Freightos, Xeneta, MarineTraffic' },
        { name: 'Sanitizador Apps Script', desc: 'Limpieza y normalización autónoma de datos' },
        { name: 'Source Alpha', desc: 'Google Doc Centralizado (headers Markdown)' },
        { name: 'Ingesta NotebookLM', desc: 'Sincronización ciclo de 60 min' },
        { name: 'Sentinel Engine', desc: 'Capa de inteligencia edge-compute' },
        { name: 'Interfaz Cliente', desc: 'React PWA con TLS post-cuántico' },
      ],
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
  <svg viewBox="0 0 48 48" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#BC13FE" />
        <stop offset="100%" stopColor="#FFD700" />
      </linearGradient>
    </defs>
    <path d="M24 4 L44 16 L44 32 L24 44 L4 32 L4 16 Z" stroke="url(#logoGrad)" strokeWidth="2" fill="none" />
    <path d="M24 12 L36 19 L36 33 L24 40 L12 33 L12 19 Z" stroke="url(#logoGrad)" strokeWidth="1.5" fill="none" opacity="0.5" />
    <circle cx="24" cy="24" r="6" fill="url(#logoGrad)" opacity="0.8" />
    <circle cx="24" cy="24" r="2.5" fill="#0A0A0A" />
  </svg>
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
            <SentinelLogo className="w-9 h-9 transition-transform duration-500 group-hover:rotate-[60deg]" />
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
            onClick={() => setActiveSection('intel')}
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
//  NOTEBOOKLM SYNC TRACKER
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

  // GEMINI API CONFIGURATION
  const GEMINI_API_KEY = "***REDACTED_API_KEY***";
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  // --- VOICE PROTOCOL ---
  const speakResponse = (text) => {
    if (!isVoiceActive || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    // Clean markdown symbols before speaking
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
      // THE GROUND TRUTH PAYLOAD: Injecting Source Alpha into the LLM Context
      const groundTruth = sourceAlphaData
        ? (typeof sourceAlphaData === 'string' ? sourceAlphaData : JSON.stringify(sourceAlphaData, null, 2))
        : 'No live data currently available. Respond based on general logistics knowledge and state that live data sync is pending.';

      const systemInstruction = `You are the Sentinel Engine, an autonomous market intelligence AI built by High Archytech Solutions. You provide real-time insights on global shipping, freight rates, port congestion, and supply chain analytics.\n\nRULES:\n- Base your answers STRICTLY on the following live data payload (refreshed every 60 minutes from Source Alpha).\n- Do NOT invent data points. If the data doesn't cover the query, say so.\n- Maintain a clinical, authoritative, and concise tone.\n- Use specific numbers, percentages, and trends when available.\n- Format responses with clear structure: use bullet points or short paragraphs.\n\n--- BEGIN SOURCE ALPHA PAYLOAD ---\n${groundTruth}\n--- END SOURCE ALPHA PAYLOAD ---`;

      const payload = {
        contents: [{ parts: [{ text: query }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.4,
          topP: 0.8,
          maxOutputTokens: 1024,
        },
      };

      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error(data.error?.message || 'Invalid API response');
      }

      const aiResponse = data.candidates[0].content.parts[0].text;

      setMessages(prev => [...prev, {
        role: 'sentinel',
        content: aiResponse,
        type: 'response',
        timestamp: new Date().toLocaleTimeString(),
      }]);

      // Engage Voice Protocol
      speakResponse(aiResponse);
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

  // --- MARKDOWN-LITE RENDERER ---
  const renderContent = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, i) => {
      // Bold
      let processed = line.replace(/\*\*(.+?)\*\*/g, '<strong class="text-text-primary font-semibold">$1</strong>');
      // Inline code
      processed = processed.replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 rounded bg-cyber-purple-dim text-cyber-purple text-[12px] font-mono">$1</code>');
      // Bullet points
      if (/^\s*[-*•]\s/.test(line)) {
        const content = processed.replace(/^\s*[-*•]\s/, '');
        return (
          <div key={i} className="flex items-start gap-2 ml-2 my-0.5">
            <span className="text-cyber-purple mt-1.5 text-[6px]">●</span>
            <span className="text-[13px] leading-relaxed" dangerouslySetInnerHTML={{ __html: content }} />
          </div>
        );
      }
      // Headings (### etc)
      if (/^#{1,3}\s/.test(line)) {
        const content = processed.replace(/^#{1,3}\s/, '');
        return <div key={i} className="text-sm font-semibold text-cyber-purple mt-3 mb-1 tracking-wider" dangerouslySetInnerHTML={{ __html: content }} />;
      }
      // Empty line = spacer
      if (!line.trim()) return <div key={i} className="h-2" />;
      // Normal text
      return <p key={i} className="text-[13px] leading-relaxed my-0.5" dangerouslySetInnerHTML={{ __html: processed }} />;
    });
  };

  return (
    <section id="query-terminal" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h2 className="text-2xl sm:text-3xl font-bold font-mono mb-2 text-text-primary">{t.terminal.title}</h2>
        <p className="text-sm text-text-secondary font-mono tracking-wider">{t.terminal.subtitle}</p>
      </div>

      <div className={`glass-panel-elevated overflow-hidden max-w-5xl mx-auto border-[#BC13FE]/30 transition-shadow duration-700 ${
        isSpeaking
          ? 'shadow-[0_0_30px_rgba(188,19,254,0.4)]'
          : 'shadow-[0_0_20px_rgba(188,19,254,0.3)]'
      }`}>
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-obsidian-border bg-obsidian/80">
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

        {/* Messages Feed */}
        <div ref={scrollRef} className="h-[480px] overflow-y-auto p-5 space-y-4 font-mono text-sm scroll-smooth">
          {messages.map((msg, i) => (
            <div key={i} className={`animate-fade-in-up ${
              msg.type === 'info' ? 'text-cyber-purple text-glow-purple' :
              msg.type === 'ready' ? 'text-green-400' :
              msg.type === 'error' ? 'text-red-400' :
              msg.type === 'query' ? 'text-amber-gold' :
              'text-text-primary'
            }`}>
              {/* User query */}
              {msg.type === 'query' && (
                <div className="flex items-start gap-2">
                  <span className="text-cyber-purple flex-shrink-0 mt-0.5">❯</span>
                  <span className="text-[13px]">{msg.content}</span>
                </div>
              )}

              {/* Sentinel AI response */}
              {msg.type === 'response' && (
                <div className="pl-4 border-l-2 border-cyber-purple/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-3.5 h-3.5 text-cyber-purple" />
                    <span className="text-[10px] text-cyber-purple tracking-[0.15em] font-semibold">SENTINEL RESPONSE</span>
                    <span className="text-[10px] text-text-muted">— {msg.timestamp}</span>
                  </div>
                  <div className="text-text-primary/90">
                    {renderContent(msg.content)}
                  </div>
                  <div className="mt-3 pt-2 border-t border-obsidian-border/30 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-amber-gold" />
                    <span className="text-[10px] text-amber-gold">{t.terminal.dataAuthority}</span>
                  </div>
                </div>
              )}

              {/* System messages */}
              {(msg.type === 'info' || msg.type === 'ready') && (
                <span className="text-[13px]">{msg.content}</span>
              )}

              {/* Error messages */}
              {msg.type === 'error' && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-red-500/30 bg-red-500/5">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className="text-[12px] font-mono">{msg.content}</span>
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex items-center gap-2 text-cyber-purple animate-pulse-glow">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span className="text-[13px]">{t.terminal.thinking}</span>
            </div>
          )}
        </div>

        {/* Suggestion Chips */}
        <div className="px-5 py-3 border-t border-obsidian-border/50 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {t.terminal.suggestions.map((s, i) => (
              <button
                key={i}
                id={`suggestion-${i}`}
                onClick={() => handleSuggestion(s)}
                disabled={isTyping}
                className="px-3 py-1.5 rounded-full border border-obsidian-border text-[10px] font-mono text-text-muted hover:text-cyber-purple hover:border-cyber-purple/50 transition-all duration-300 whitespace-nowrap flex-shrink-0 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex items-center border-t border-obsidian-border bg-obsidian/30 focus-within:shadow-[0_0_20px_rgba(188,19,254,0.15)] transition-shadow duration-500">
          <span className="text-cyber-purple font-mono text-sm pl-5 flex-shrink-0">❯</span>
          <input
            ref={inputRef}
            id="terminal-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.terminal.placeholder}
            className="terminal-input flex-1 bg-transparent text-text-primary font-mono text-sm px-3 py-4 placeholder:text-text-muted focus:outline-none"
            disabled={isTyping}
            autoComplete="off"
          />
          <button
            id="terminal-send"
            type="submit"
            disabled={isTyping || !input.trim()}
            className="px-5 py-4 text-cyber-purple hover:text-amber-gold transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════
//  ARCHITECTURE SECTION
// ═══════════════════════════════════════════════════
const ArchitectureSection = ({ t }) => (
  <section id="architecture-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
    <div className="text-center mb-12">
      <h2 className="text-2xl sm:text-3xl font-bold font-mono mb-2 text-text-primary">{t.architecture.title}</h2>
      <p className="text-sm text-text-secondary font-mono tracking-wider">{t.architecture.subtitle}</p>
    </div>

    <div className="max-w-3xl mx-auto space-y-3">
      {t.architecture.layers.map((layer, i) => (
        <div
          key={i}
          className="glass-panel flex items-center gap-4 p-4 animate-fade-in-up group hover:glow-purple transition-all duration-500"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          {/* Layer number */}
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-cyber-purple/20 to-amber-gold/20 border border-obsidian-border flex items-center justify-center">
            <span className="text-sm font-mono font-bold bg-gradient-to-r from-cyber-purple to-amber-gold bg-clip-text text-transparent">{String(i).padStart(2, '0')}</span>
          </div>
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-mono font-semibold text-text-primary group-hover:text-cyber-purple transition-colors">{layer.name}</div>
            <div className="text-xs text-text-secondary font-mono truncate">{layer.desc}</div>
          </div>
          {/* Connector */}
          {i < t.architecture.layers.length - 1 && (
            <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0 group-hover:text-cyber-purple transition-colors" />
          )}
        </div>
      ))}
    </div>

    {/* Security panel */}
    <div className="max-w-3xl mx-auto mt-12 glass-panel-elevated p-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-5 h-5 text-green-400" />
        <span className="text-sm font-mono font-semibold text-text-primary">{t.security.title}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-obsidian-mid/50 border border-green-500/20">
          <div className="text-[10px] font-mono text-text-muted mb-1 tracking-wider">{t.security.postQuantum}</div>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-green-400" />
            <span className="text-sm font-mono font-semibold text-green-400">{t.security.verified}</span>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-obsidian-mid/50 border border-cyber-purple/20">
          <div className="text-[10px] font-mono text-text-muted mb-1 tracking-wider">{t.security.encryption}</div>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyber-purple" />
            <span className="text-sm font-mono font-semibold text-cyber-purple">{t.security.algorithm}</span>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-obsidian-mid/50 border border-amber-gold/20">
          <div className="text-[10px] font-mono text-text-muted mb-1 tracking-wider">{t.security.connection}</div>
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-amber-gold" />
            <span className="text-sm font-mono font-semibold text-amber-gold">{t.security.secure}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
);

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

  // --- SENTINEL STATE MANAGEMENT ---
  const [sourceAlphaData, setSourceAlphaData] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('INITIATING HANDSHAKE...');
  const [isSyncing, setIsSyncing] = useState(true);

  // Your Proprietary Edge Endpoint
  const EDGE_ENDPOINT = 'https://script.google.com/macros/s/AKfycby5EnpomeA-7z7DyNMj-XEpkvQ0LWZpttVpdFPZvy1hWQORK1XFIidRB1T44KfsXc8f/exec';

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

      setConnectionStatus(translations[lang]?.sync?.verifying || 'VERIFYING POST-QUANTUM ROUTE...');

      try {
        const response = await fetch(EDGE_ENDPOINT);
        const data = await response.json();

        if (data.status === "POST-QUANTUM HANDSHAKE VERIFIED") {
          setSourceAlphaData(data.payload);
          setConnectionStatus(translations[lang]?.sync?.verified || 'HANDSHAKE VERIFIED: AUTHORITY STAMP < 1HR');
          console.log("Sentinel Engine: Source Alpha Synchronized.");
        } else {
          throw new Error("Handshake Failed: Invalid Signature");
        }
      } catch (error) {
        console.error("Sentinel Engine Error:", error);
        // If we're offline (detected during fetch failure), the SW may have served cached data
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
            <ArchitectureSection t={t} />
          </>
        )}

        {activeSection === 'terminal' && (
          <QueryTerminal t={t} sourceAlphaData={sourceAlphaData} />
        )}

        {activeSection === 'sync' && (
          <SyncTracker t={t} connectionStatus={connectionStatus} isSyncing={isSyncing} sourceAlphaData={sourceAlphaData} />
        )}

        {activeSection === 'intel' && (
          <>
            <ArchitectureSection t={t} />
            <SyncTracker t={t} connectionStatus={connectionStatus} isSyncing={isSyncing} sourceAlphaData={sourceAlphaData} />
          </>
        )}
      </main>

      {/* Footer */}
      <Footer t={t} />
    </div>
  );
}
