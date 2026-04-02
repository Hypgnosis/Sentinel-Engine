"""
Replace the old QueryTerminal (lines 682-1046) with the new Gemini Live API version.
Also update the imports to add Mic, MicOff.
"""
import re

f = r'd:\Documents\Sentinel Engine\src\App.jsx'
with open(f, 'r', encoding='utf-8') as fh:
    content = fh.read()

lines = content.split('\n')
print(f"Original: {len(lines)} lines")

# Fix import line: add Mic, MicOff
for i, line in enumerate(lines):
    if 'Volume2, VolumeX' in line and 'Mic' not in line:
        lines[i] = line.replace('Volume2, VolumeX', 'Volume2, VolumeX, Mic, MicOff')
        print(f"Updated import at line {i+1}")
        break

# Find the old QueryTerminal boundaries
start_idx = None
end_idx = None
footer_idx = None

for i, line in enumerate(lines):
    if '//  QUERY TERMINAL' in line and start_idx is None:
        start_idx = i - 1 if i > 0 and lines[i-1].startswith('// ') else i
        # Go back to the separator line
        if i > 0 and lines[i-1].strip().startswith('//'):
            start_idx = i - 1
        print(f"Found QueryTerminal start at line {i+1}")
    if 'const Footer' in line:
        footer_idx = i
        print(f"Found Footer at line {i+1}")
        break

# Find the end of old QueryTerminal: last line before Footer section
# Walk backward from footer_idx to find the closing };
for i in range(footer_idx - 1, start_idx, -1):
    stripped = lines[i].strip()
    if stripped == '};':
        end_idx = i
        print(f"Found QueryTerminal end at line {i+1}")
        break
    elif stripped:  # non-empty, non-closing
        end_idx = i
        print("Found QueryTerminal end (non-standard boundary) at line " + str(i+1))
        break

if start_idx is None or end_idx is None or footer_idx is None:
    print("ERROR: Could not find boundaries!")
    exit(1)

# Find the // === separator line before QUERY TERMINAL
while start_idx > 0 and lines[start_idx - 1].strip().startswith('// '):
    start_idx -= 1

print(f"Replacing lines {start_idx+1} to {end_idx+1}")

NEW_QUERY_TERMINAL = r'''// ═══════════════════════════════════════════════════
//  QUERY TERMINAL (Gemini Live API — Voice Agent)
// ═══════════════════════════════════════════════════

// --- Audio Utilities (inline — no external deps) ---
const base64Encode = (bytes) => {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};
const base64Decode = (b64) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};
const pcmTo16kInt16 = (floats, inputRate) => {
  const ratio = inputRate / 16000;
  const len = Math.ceil(floats.length / ratio);
  const out = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    const idx = i * ratio;
    const floor = Math.floor(idx);
    const frac = idx - floor;
    const s1 = floats[floor] || 0;
    const s2 = floats[Math.ceil(idx)] || s1;
    const s = Math.max(-1, Math.min(1, s1 + (s2 - s1) * frac));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return out;
};
const rawPcmToAudioBuffer = (data, ctx, sampleRate) => {
  const int16 = new Int16Array(data.buffer);
  const buffer = ctx.createBuffer(1, int16.length, sampleRate);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < int16.length; i++) channelData[i] = int16[i] / 32768.0;
  return buffer;
};

const LIVE_MODEL = 'gemini-2.5-flash-native-audio-latest';
const TEXT_MODEL = 'gemini-2.5-flash';
const OUTPUT_SAMPLE_RATE = 24000;

const QueryTerminal = ({ t, sourceAlphaData }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [voiceState, setVoiceState] = useState('IDLE');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // WebSocket + Audio refs
  const wsRef = useRef(null);
  const sessionReady = useRef(false);
  const inputCtxRef = useRef(null);
  const outputCtxRef = useRef(null);
  const outputAnalyserRef = useRef(null);
  const processorRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const streamRef = useRef(null);
  const nextPlayTime = useRef(0);
  const outputSources = useRef(new Set());
  const currentInputTranscript = useRef({ id: -1, text: '' });
  const currentOutputTranscript = useRef({ id: -1, text: '' });

  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const TEXT_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Boot messages
  useEffect(() => {
    setMessages([
      { role: 'system', content: `> ${t.terminal.welcome}`, type: 'info' },
      { role: 'system', content: t.terminal.ready, type: 'ready' },
    ]);
  }, [t]);

  // --- Build system instruction ---
  const getSystemInstruction = useCallback(() => {
    const groundTruth = sourceAlphaData
      ? (typeof sourceAlphaData === 'string' ? sourceAlphaData : JSON.stringify(sourceAlphaData, null, 2))
      : 'No live data currently available. Respond based on general logistics knowledge and state that live data sync is pending.';
    return `You are the Sentinel Engine, an autonomous market intelligence AI built by High Archytech Solutions. You provide real-time insights on global shipping, freight rates, port congestion, and supply chain analytics.\n\nRULES:\n- Base your answers STRICTLY on the following live data payload (refreshed every 60 minutes from Source Alpha).\n- Do NOT invent data points. If the data doesn\'t cover the query, say so.\n- Maintain a clinical, authoritative, and concise tone.\n- Use specific numbers, percentages, and trends when available.\n- Format responses with clear structure.\n\n--- BEGIN SOURCE ALPHA PAYLOAD ---\n${groundTruth}\n--- END SOURCE ALPHA PAYLOAD ---`;
  }, [sourceAlphaData]);

  // ═══ GEMINI LIVE API — Voice Agent ═══
  const cleanupVoice = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
    if (mediaSourceRef.current) { mediaSourceRef.current.disconnect(); mediaSourceRef.current = null; }
    if (inputCtxRef.current?.state !== 'closed') { inputCtxRef.current?.close().catch(() => {}); inputCtxRef.current = null; }
    if (outputAnalyserRef.current) { outputAnalyserRef.current.disconnect(); outputAnalyserRef.current = null; }
    if (outputCtxRef.current?.state !== 'closed') { outputCtxRef.current?.close().catch(() => {}); outputCtxRef.current = null; }
    outputSources.current.forEach(s => s.stop());
    outputSources.current.clear();
    nextPlayTime.current = 0;
    setMicVolume(0);
    setIsSpeaking(false);
  }, []);

  const handleWsMessage = useCallback(async (event) => {
    let data;
    try {
      if (typeof event.data === 'string') data = JSON.parse(event.data);
      else if (event.data instanceof Blob) data = JSON.parse(await event.data.text());
      else data = JSON.parse(new TextDecoder().decode(event.data));
    } catch { return; }

    if (data.setupComplete !== undefined) { sessionReady.current = true; console.log('Sentinel Engine: Voice session ready (Puck)'); return; }

    if (data.serverContent) {
      if (data.serverContent.inputTranscription?.text) {
        const { text } = data.serverContent.inputTranscription;
        setMessages(prev => {
          const idx = prev.findIndex(m => m._liveId === currentInputTranscript.current.id);
          if (idx === -1) {
            const id = Date.now();
            currentInputTranscript.current = { id, text };
            return [...prev, { role: 'user', content: text, type: 'query', _liveId: id }];
          }
          const updated = [...prev];
          updated[idx] = { ...updated[idx], content: text };
          currentInputTranscript.current.text = text;
          return updated;
        });
      }
      if (data.serverContent.outputTranscription?.text) {
        const { text } = data.serverContent.outputTranscription;
        setMessages(prev => {
          const idx = prev.findIndex(m => m._liveId === currentOutputTranscript.current.id);
          if (idx === -1) {
            const id = Date.now();
            currentOutputTranscript.current = { id, text };
            return [...prev, { role: 'sentinel', content: text, type: 'response', timestamp: new Date().toLocaleTimeString(), _liveId: id }];
          }
          const updated = [...prev];
          const newText = updated[idx].content + text;
          updated[idx] = { ...updated[idx], content: newText };
          currentOutputTranscript.current.text = newText;
          return updated;
        });
      }
      if (data.serverContent.turnComplete) {
        currentInputTranscript.current = { id: -1, text: '' };
        currentOutputTranscript.current = { id: -1, text: '' };
      }
      if (data.serverContent.modelTurn?.parts) {
        for (const part of data.serverContent.modelTurn.parts) {
          const audioData = part?.inlineData?.data;
          if (audioData && outputCtxRef.current) {
            try {
              if (outputCtxRef.current.state === 'suspended') await outputCtxRef.current.resume();
              const pcmBytes = base64Decode(audioData);
              const audioBuffer = rawPcmToAudioBuffer(pcmBytes, outputCtxRef.current, 24000);
              const now = outputCtxRef.current.currentTime;
              nextPlayTime.current = Math.max(nextPlayTime.current, now);
              const source = outputCtxRef.current.createBufferSource();
              source.buffer = audioBuffer;
              if (outputAnalyserRef.current) source.connect(outputAnalyserRef.current);
              else source.connect(outputCtxRef.current.destination);
              source.onended = () => { outputSources.current.delete(source); setIsSpeaking(outputSources.current.size > 0); };
              source.start(nextPlayTime.current);
              nextPlayTime.current += audioBuffer.duration;
              outputSources.current.add(source);
              setIsSpeaking(true);
            } catch (e) { console.error('Sentinel audio playback error:', e); }
          }
        }
      }
      if (data.serverContent.interrupted) {
        outputSources.current.forEach(s => s.stop());
        outputSources.current.clear();
        nextPlayTime.current = 0;
        setIsSpeaking(false);
      }
    }
  }, []);

  const startVoiceAgent = useCallback(async () => {
    if (!GEMINI_API_KEY) { setMessages(prev => [...prev, { role: 'system', content: 'PIPELINE COMPROMISED: No API key. Set VITE_GEMINI_API_KEY in .env', type: 'error' }]); return; }
    setVoiceState('CONNECTING');
    sessionReady.current = false;
    cleanupVoice();
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      inputCtxRef.current = new AudioCtx();
      outputCtxRef.current = new AudioCtx({ sampleRate: OUTPUT_SAMPLE_RATE });
      outputAnalyserRef.current = outputCtxRef.current.createAnalyser();
      outputAnalyserRef.current.fftSize = 256;
      outputAnalyserRef.current.smoothingTimeConstant = 0.7;
      outputAnalyserRef.current.connect(outputCtxRef.current.destination);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });
      streamRef.current = stream;
      await inputCtxRef.current.resume();
      await outputCtxRef.current.resume();
      mediaSourceRef.current = inputCtxRef.current.createMediaStreamSource(stream);

      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          setup: {
            model: `models/${LIVE_MODEL}`,
            generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } } },
            systemInstruction: { parts: [{ text: getSystemInstruction() }] },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          }
        }));
        setVoiceState('LIVE');

        const processAudio = (inputData) => {
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
          setMicVolume(prev => prev * 0.8 + Math.min(Math.sqrt(sum / inputData.length) * 15, 1.5) * 0.2);
          if (inputCtxRef.current && ws.readyState === WebSocket.OPEN && sessionReady.current) {
            const int16 = pcmTo16kInt16(inputData, inputCtxRef.current.sampleRate);
            ws.send(JSON.stringify({ realtimeInput: { mediaChunks: [{ data: base64Encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' }] } }));
          }
        };
        const scriptNode = inputCtxRef.current.createScriptProcessor(2048, 1, 1);
        scriptNode.onaudioprocess = (e) => processAudio(e.inputBuffer.getChannelData(0));
        mediaSourceRef.current.connect(scriptNode);
        const silentGain = inputCtxRef.current.createGain();
        silentGain.gain.value = 0;
        scriptNode.connect(silentGain);
        silentGain.connect(inputCtxRef.current.destination);
        processorRef.current = scriptNode;
      };
      ws.onmessage = handleWsMessage;
      ws.onerror = () => { setVoiceState('ERROR'); setMessages(prev => [...prev, { role: 'system', content: 'VOICE LINK FAILED: Could not connect to AI Core.', type: 'error' }]); };
      ws.onclose = () => { cleanupVoice(); setVoiceState('IDLE'); };
    } catch (err) {
      setMessages(prev => [...prev, { role: 'system', content: `VOICE PROTOCOL ERROR: ${err.message}`, type: 'error' }]);
      cleanupVoice();
      setVoiceState('ERROR');
    }
  }, [GEMINI_API_KEY, cleanupVoice, handleWsMessage, getSystemInstruction]);

  const stopVoiceAgent = useCallback(() => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    cleanupVoice();
    setVoiceState('IDLE');
  }, [cleanupVoice]);

  // ═══ TEXT API (typed queries) ═══
  const handleSubmit = async (e) => {
    e?.preventDefault();
    const query = input.trim();
    if (!query || isTyping) return;
    setMessages(prev => [...prev, { role: 'user', content: query, type: 'query' }]);
    setInput('');
    setIsTyping(true);
    try {
      const payload = {
        contents: [{ parts: [{ text: query }] }],
        systemInstruction: { parts: [{ text: getSystemInstruction() }] },
        generationConfig: { temperature: 0.4, topP: 0.8, maxOutputTokens: 1024 },
      };
      const response = await fetch(TEXT_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok || !data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error(data.error?.message || 'Invalid API response');
      setMessages(prev => [...prev, { role: 'sentinel', content: data.candidates[0].content.parts[0].text, type: 'response', timestamp: new Date().toLocaleTimeString() }]);
    } catch (error) {
      console.error('Sentinel Engine API Error:', error);
      setMessages(prev => [...prev, { role: 'system', content: `PIPELINE COMPROMISED: ${error.message}`, type: 'error' }]);
    } finally { setIsTyping(false); }
  };

  const handleSuggestion = (suggestion) => { setInput(suggestion); setTimeout(() => document.getElementById('terminal-send')?.click(), 100); };

  const renderContent = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      let processed = line.replace(/\*\*(.+?)\*\*/g, '<strong class="text-text-primary font-semibold">$1</strong>');
      processed = processed.replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 rounded bg-cyber-purple-dim text-cyber-purple text-[12px] font-mono">$1</code>');
      if (/^\s*[-*\u2022]\s/.test(line)) {
        const content = processed.replace(/^\s*[-*\u2022]\s/, '');
        return (<div key={i} className="flex items-start gap-2 ml-2 my-0.5"><span className="text-cyber-purple mt-1.5 text-[6px]">{'\u25cf'}</span><span className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: content }} /></div>);
      }
      if (/^#{1,3}\s/.test(line)) { const content = processed.replace(/^#{1,3}\s/, ''); return <div key={i} className="text-sm font-semibold text-cyber-purple mt-3 mb-1 tracking-wider" dangerouslySetInnerHTML={{ __html: content }} />; }
      if (!line.trim()) return <div key={i} className="h-2" />;
      return <p key={i} className="text-sm leading-relaxed my-0.5" dangerouslySetInnerHTML={{ __html: processed }} />;
    });
  };

  const isLive = voiceState === 'LIVE';

  return (
    <section id="query-terminal" className="w-full px-4 sm:px-6 lg:px-8 py-6" style={{ minHeight: 'calc(100vh - 4rem)' }}>
      <div className="text-center mb-6 max-w-4xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold font-mono mb-2 text-text-primary">{t.terminal.title}</h2>
        <p className="text-sm text-text-secondary font-mono tracking-wider">{t.terminal.subtitle}</p>
      </div>

      <div className={`glass-panel-elevated overflow-hidden max-w-6xl mx-auto border-[#BC13FE]/30 transition-shadow duration-700 flex flex-col ${
        isSpeaking ? 'shadow-[0_0_40px_rgba(188,19,254,0.5)]' : isLive ? 'shadow-[0_0_25px_rgba(188,19,254,0.3)]' : 'shadow-[0_0_20px_rgba(188,19,254,0.2)]'
      }`} style={{ height: 'calc(100vh - 12rem)', minHeight: '500px' }}>

        {/* Terminal Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-obsidian-border bg-obsidian/80 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-amber-400/60" />
              <div className="w-3 h-3 rounded-full bg-green-400/60" />
            </div>
            <span className="text-[10px] font-mono text-text-muted ml-2 tracking-wider">SENTINEL://gemini-core/v4.0.0</span>
            {isSpeaking && (
              <div className="flex items-end gap-[3px] h-4 ml-3" aria-label="Voice active">
                {[1, 2, 3, 4, 5].map((bar) => (
                  <div key={bar} className="w-[3px] rounded-full bg-[#BC13FE]" style={{ animation: `sentinel-soundwave 0.8s ease-in-out infinite alternate`, animationDelay: `${bar * 0.1}s`, height: '4px' }} />
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border ${isLive ? 'border-green-500/40 bg-green-500/10' : voiceState === 'CONNECTING' ? 'border-amber-400/30 bg-amber-400/5' : 'border-obsidian-border bg-obsidian-mid/50'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-400 animate-pulse-glow' : voiceState === 'CONNECTING' ? 'bg-amber-400 animate-pulse' : 'bg-text-muted'}`} />
              <span className={`text-[9px] font-mono tracking-wider ${isLive ? 'text-green-400' : voiceState === 'CONNECTING' ? 'text-amber-400' : 'text-text-muted'}`}>
                {isLive ? 'VOICE LIVE' : voiceState === 'CONNECTING' ? 'CONNECTING...' : 'VOICE IDLE'}
              </span>
            </div>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border ${sourceAlphaData ? 'border-green-500/30 bg-green-500/5' : 'border-amber-400/30 bg-amber-400/5'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${sourceAlphaData ? 'bg-green-400 animate-pulse-glow' : 'bg-amber-400 animate-pulse'}`} />
              <span className={`text-[9px] font-mono tracking-wider ${sourceAlphaData ? 'text-green-400' : 'text-amber-400'}`}>
                {sourceAlphaData ? 'DATA ACTIVE' : 'AWAITING SYNC'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-green-400" />
              <span className="text-[10px] font-mono text-green-400">{t.security.postQuantum}</span>
            </div>
          </div>
        </div>

        {/* Messages Feed */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-5 font-mono scroll-smooth" style={{ minHeight: 0 }}>
          {messages.map((msg, i) => (
            <div key={i} className="animate-fade-in-up">
              {msg.type === 'query' && (
                <div className="flex justify-end">
                  <div className="max-w-[75%] px-5 py-3.5 rounded-2xl rounded-br-md bg-gradient-to-br from-cyber-purple/20 to-cyber-purple/10 border border-cyber-purple/30">
                    <p className="text-sm text-text-primary leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              )}
              {msg.type === 'response' && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] pl-5 pr-6 py-4 border-l-[3px] border-cyber-purple/60 bg-obsidian-mid/30 rounded-r-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-4 h-4 text-cyber-purple" />
                      <span className="text-[11px] text-cyber-purple tracking-[0.15em] font-semibold">SENTINEL RESPONSE</span>
                      {msg.timestamp && <span className="text-[10px] text-text-muted ml-auto">{'\u2014'} {msg.timestamp}</span>}
                    </div>
                    <div className="text-text-primary/90 text-sm leading-relaxed">{renderContent(msg.content)}</div>
                    <div className="mt-4 pt-3 border-t border-obsidian-border/30 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-gold" />
                      <span className="text-[10px] text-amber-gold">{t.terminal.dataAuthority}</span>
                    </div>
                  </div>
                </div>
              )}
              {(msg.type === 'info' || msg.type === 'ready') && (
                <div className="text-center py-1"><span className={`text-xs ${msg.type === 'info' ? 'text-cyber-purple text-glow-purple' : 'text-green-400'}`}>{msg.content}</span></div>
              )}
              {msg.type === 'error' && (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/5 max-w-[85%]">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <span className="text-xs font-mono text-red-400">{msg.content}</span>
                </div>
              )}
            </div>
          ))}
          {isTyping && (
            <div className="flex items-center gap-3 text-cyber-purple animate-pulse-glow py-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">{t.terminal.thinking}</span>
            </div>
          )}
        </div>

        {/* Suggestion Chips */}
        <div className="px-6 py-3 border-t border-obsidian-border/50 flex-shrink-0">
          <div className="flex flex-wrap gap-2">
            {t.terminal.suggestions.map((s, i) => (
              <button key={i} id={`suggestion-${i}`} onClick={() => handleSuggestion(s)} disabled={isTyping}
                className="px-4 py-2 rounded-full border border-obsidian-border text-[11px] font-mono text-text-muted hover:text-cyber-purple hover:border-cyber-purple/50 hover:bg-cyber-purple-dim transition-all duration-300 whitespace-nowrap cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Input Area + Voice Agent */}
        <form onSubmit={handleSubmit} className="flex items-end gap-3 border-t border-obsidian-border bg-obsidian/40 px-5 py-4 focus-within:shadow-[0_0_30px_rgba(188,19,254,0.15)] transition-shadow duration-500 flex-shrink-0">
          <button id="voice-agent-btn" type="button" onClick={isLive ? stopVoiceAgent : startVoiceAgent} disabled={voiceState === 'CONNECTING'}
            className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-500 cursor-pointer flex-shrink-0 ${
              isLive ? 'bg-red-500/80 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                : voiceState === 'CONNECTING' ? 'bg-amber-500/50 text-white animate-pulse'
                : 'bg-obsidian-mid/80 border border-obsidian-border hover:border-cyber-purple/50 hover:bg-cyber-purple-dim text-text-muted hover:text-cyber-purple'
            }`} title={isLive ? 'Stop Voice Agent' : 'Start Voice Agent (Puck)'}>
            {isLive ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          {isLive && (
            <div className="flex flex-col justify-center h-12 flex-shrink-0" title="Mic Level">
              <div className="w-2 h-10 rounded-full bg-obsidian-mid/80 overflow-hidden flex flex-col justify-end">
                <div className="w-full rounded-full bg-green-400 transition-all duration-75" style={{ height: `${Math.min(micVolume * 100, 100)}%` }} />
              </div>
            </div>
          )}
          <div className="flex-1 relative">
            <textarea ref={inputRef} id="terminal-input" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
              placeholder={isLive ? 'Voice active \u2014 speak to Sentinel or type here...' : t.terminal.placeholder}
              className="w-full bg-obsidian-mid/50 text-text-primary font-mono text-sm px-5 py-4 rounded-xl border border-obsidian-border focus:border-cyber-purple/50 focus:outline-none placeholder:text-text-muted resize-none transition-all duration-300"
              rows={2} disabled={isTyping} autoComplete="off" style={{ maxHeight: '120px' }} />
            <span className="absolute bottom-2 right-3 text-[9px] font-mono text-text-muted/50">{isLive ? 'Voice: Puck' : 'Shift+Enter for new line'}</span>
          </div>
          <button id="terminal-send" type="submit" disabled={isTyping || !input.trim()}
            className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-cyber-purple to-cyber-purple/70 text-white hover:shadow-[0_0_20px_rgba(188,19,254,0.5)] transition-all duration-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0">
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </section>
  );
};'''

new_lines = NEW_QUERY_TERMINAL.split('\n')

# Build the final file
# start_idx is 0-indexed, the line of "// ═══" before QUERY TERMINAL
# end_idx is 0-indexed, the "};' closing line
# footer_idx is 0-indexed, the "const Footer" line
# Find the blank lines between end of old QT and footer
blank_end = end_idx + 1
while blank_end < footer_idx and not lines[blank_end].strip():
    blank_end += 1

result = lines[:start_idx] + new_lines + ['', '', ''] + lines[blank_end:]
print(f"Result: {len(result)} lines")

with open(f, 'w', encoding='utf-8') as fh:
    fh.write('\n'.join(result))
print("Done!")
