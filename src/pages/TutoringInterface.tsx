import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, PhoneOff, MessageSquare, Maximize2, Minimize2, Sparkles, GraduationCap, Loader2, ArrowLeft } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import ReactMarkdown from 'react-markdown';

const SYSTEM_INSTRUCTION = `You are Dr. Sam, the Lead Faculty Intelligence at Future Academy, an elite, next-generation online STEM institution. You teach Social Science subjects. You operate exclusively using a highly professional, articulate Female Voice Persona.

Your overarching mandate is the "Visual-First" approach. You do not merely explain complex science; you manifest it visually in real-time by commanding a strict, pre-approved stack of generative and rendering models.

Whenever a student asks ANY question, you MUST call the \`update_ui\` tool to update the visual board and sidebar notes, and then speak your explanation naturally.

Engine A: The Logic Renderer (Math, Physics, Live Data)
Approved Models: Three.js, Manim, D3.js.
Action: Output executable code payloads to simulate physics or draw data dynamically. The payload MUST be a complete, valid HTML document containing all necessary scripts and styles.

Engine B: The 3D Architect (Biology, Chemistry, Spatial Geometry, Geography)
Approved Models: Tripo AI, Meshy, Luma Genie, Spline AI.
Action: Output a precise API JSON payload to generate or retrieve a high-fidelity static 3D model.

Engine C: The Precision Illustrator (2D Cross-sections, Anatomy, Diagrams, History)
Approved Models: FLUX.1, Midjourney, DALL-E 3, Stable Diffusion 3.
Action: Output an ultra-detailed text prompt explicitly commanding accurate typographic labeling.

Engine D: The Dynamic Animator (Simulations, Complex Reactions, Macro-scale Events)
Approved Models: Runway Gen-3 Alpha, Luma Dream Machine, Kling AI, Veo.
Action: Output a highly descriptive cinematic video prompt to simulate the event.

When you speak, be warm, wise, friendly, and highly intelligent.`;

export default function TutoringInterface() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const grade = searchParams.get('grade') || 'High School';
  const topic = searchParams.get('topic') || 'History';

  const [isCallActive, setIsCallActive] = useState(false);
  const isCallActiveRef = useRef(isCallActive);
  const setCallActive = (active: boolean) => {
    setIsCallActive(active);
    isCallActiveRef.current = active;
  };
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(isMuted);
  const setMuted = (muted: boolean) => {
    setIsMuted(muted);
    isMutedRef.current = muted;
  };
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ id: string; role: 'user' | 'tutor'; text: string }[]>([]);
  const [currentVisual, setCurrentVisual] = useState<{ type: '3d' | 'image' | 'video' | 'code' | 'none'; url?: string; prompt?: string; engine?: string }>({ type: 'none' });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStep, setConnectionStep] = useState<string>("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);
  const sessionRef = useRef<any>(null);
  const activeSessionRef = useRef<any>(null);
  const isClosingRef = useRef(false);
  const aiRef = useRef<GoogleGenAI | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Monkey-patch WebSocket.send to permanently suppress "CLOSING or CLOSED" errors
    // This is the most robust way to handle libraries that don't catch their own teardown errors.
    const originalSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function(...args) {
      if (this.readyState === WebSocket.CLOSING || this.readyState === WebSocket.CLOSED) {
        return; // Silently ignore
      }
      try {
        return originalSend.apply(this, args);
      } catch (e: any) {
        const errStr = String(e?.message || e).toLowerCase();
        if (errStr.includes('closing') || errStr.includes('closed')) {
          return; // Ignore
        }
        throw e;
      }
    };

    const handleGlobalError = (event: ErrorEvent) => {
      const errorStr = (event.error instanceof Error ? event.error.message : String(event.message || event.error)).toLowerCase();
      if (errorStr.includes('websocket') && (errorStr.includes('closing') || errorStr.includes('closed'))) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reasonStr = (event.reason instanceof Error ? event.reason.message : String(event.reason)).toLowerCase();
      if (reasonStr.includes('websocket') && (reasonStr.includes('closing') || reasonStr.includes('closed'))) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    };
    
    // Also use window.onerror for legacy/broader support
    const originalOnError = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      const msg = String(message || error?.message || error).toLowerCase();
      if (msg.includes('websocket') && (msg.includes('closing') || msg.includes('closed'))) {
        return true; // Suppress
      }
      if (originalOnError) {
        return originalOnError(message, source, lineno, colno, error);
      }
      return false;
    };

    window.addEventListener('error', handleGlobalError, true);
    window.addEventListener('unhandledrejection', handleUnhandledRejection, true);
    return () => {
      window.removeEventListener('error', handleGlobalError, true);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
      window.onerror = originalOnError;
      WebSocket.prototype.send = originalSend; // Restore on unmount
    };
  }, []);

  const handleStartCall = async () => {
    setCallError(null);
    setConnectionStep("Initializing...");
    isClosingRef.current = false;
    setIsConnecting(true);
    try {
      setConnectionStep("Checking API Key...");
      if ((window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await (window as any).aistudio.openSelectKey();
        }
      }

      // More resilient API key retrieval with sanitization
      let apiKey = process.env.API_KEY || 
                   process.env.GEMINI_API_KEY || 
                   (import.meta as any).env?.VITE_GEMINI_API_KEY ||
                   localStorage.getItem('CUSTOM_GEMINI_API_KEY') ||
                   (window as any)._env_?.GEMINI_API_KEY ||
                   ""; 
      
      apiKey = apiKey.trim(); // Remove any invisible spaces

      if (!apiKey && !(window as any).aistudio) {
        setConnectionStep("API Key Missing");
        // Instead of throwing, we'll show a prompt to enter the key if it's missing on a custom domain
        const manualKey = window.prompt("Gemini API Key is missing. Please enter your API key to continue (this will be saved locally):");
        if (manualKey) {
          localStorage.setItem('CUSTOM_GEMINI_API_KEY', manualKey.trim());
          window.location.reload();
          return;
        }
        throw new Error("Gemini API Key is missing. Please ensure the GEMINI_API_KEY environment variable is set in your project settings.");
      }
      
      setConnectionStep("Setting up Audio...");
      aiRef.current = new GoogleGenAI({ apiKey: apiKey as string });
      
      // Setup Audio Context for playback
      try {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      } catch (e) {
        console.warn("Failed to create AudioContext with 24kHz, falling back to default:", e);
        audioContextRef.current = new AudioContext();
      }

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      setConnectionStep("Accessing Microphone...");
      // Setup Microphone
      try {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (micErr) {
        throw new Error("Microphone access denied. Please allow microphone permissions to use voice tutoring.");
      }
      
      const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
      
      setConnectionStep("Loading Audio Processor...");
      const workletCode = `
        class PCMProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.buffer = new Float32Array(4096);
            this.bufferSize = 0;
          }
          process(inputs, outputs, parameters) {
            const input = inputs[0];
            if (input && input.length > 0) {
              const channelData = input[0];
              for (let i = 0; i < channelData.length; i++) {
                this.buffer[this.bufferSize++] = channelData[i];
                if (this.bufferSize >= 4096) {
                  this.port.postMessage(this.buffer);
                  this.buffer = new Float32Array(4096);
                  this.bufferSize = 0;
                }
              }
            }
            return true;
          }
        }
        registerProcessor('pcm-processor', PCMProcessor);
      `;
      
      // Use data URL instead of blob URL to bypass some CSP restrictions
      const workletUrl = `data:application/javascript;base64,${btoa(workletCode)}`;
      try {
        await audioContextRef.current.audioWorklet.addModule(workletUrl);
      } catch (workletErr) {
        console.error("AudioWorklet failed, trying blob fallback:", workletErr);
        const workletBlob = new Blob([workletCode], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(workletBlob);
        await audioContextRef.current.audioWorklet.addModule(blobUrl);
      }
      
      processorRef.current = new AudioWorkletNode(audioContextRef.current, 'pcm-processor');
      
      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      setConnectionStep("Connecting to AI...");
      const sessionPromise = aiRef.current.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } }
          },
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{
            functionDeclarations: [{
              name: "update_ui",
              description: "Updates the visual board and sidebar notes.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  ui_action: { type: Type.STRING, description: "ENGINE_A_CODE, ENGINE_B_3D, ENGINE_C_IMAGE, or ENGINE_D_VIDEO" },
                  visual_payload: { type: Type.STRING, description: "Target model name and logic string/prompt" },
                  sidebar_notes: { type: Type.STRING, description: "Markdown breakdown of core facts" }
                },
                required: ["ui_action", "visual_payload", "sidebar_notes"]
              }
            }]
          }]
        },
        callbacks: {
          onopen: () => {
            setConnectionStep("Connected!");
            // Handshake delay: Wait 500ms before sending the first message
            // This prevents Cloudflare from dropping the connection due to immediate traffic
            setTimeout(() => {
              if (isClosingRef.current) return;
              
              setIsConnecting(false);
              setCallActive(true);
              
              // Send initial context
              sessionPromise.then(session => {
                if (isClosingRef.current) {
                  try { session.close(); } catch (e) {}
                  return;
                }
                activeSessionRef.current = session;
                if (isCallActiveRef.current && activeSessionRef.current) {
                  try {
                    activeSessionRef.current.sendRealtimeInput({
                      text: `Hello Dr. Sam! I am a ${grade} student and I want to learn about ${topic}. Please introduce yourself.`
                    });
                  } catch (e: any) {
                    if (!e?.message?.toLowerCase().includes('closing') && !e?.message?.toLowerCase().includes('closed')) {
                      console.error("Error sending initial context:", e);
                    }
                  }
                }
              });
            }, 500);

            processorRef.current!.port.onmessage = (e) => {
              if (isMutedRef.current || !isCallActiveRef.current || !activeSessionRef.current || isClosingRef.current) return;
              
              // Extra safety check on internal WebSocket state if accessible
              if (activeSessionRef.current.ws && activeSessionRef.current.ws.readyState !== 1) {
                activeSessionRef.current = null;
                return;
              }

              const inputData = e.data as Float32Array;
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
              }
              const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
              
              try {
                activeSessionRef.current.sendRealtimeInput({
                  audio: {
                    mimeType: "audio/pcm;rate=24000",
                    data: base64
                  }
                });
              } catch (e: any) {
                // Silently catch WebSocket state errors
                if (!e?.message?.includes('CLOSING') && !e?.message?.includes('CLOSED')) {
                  console.error("Error sending audio:", e);
                }
              }
            };
          },
          onmessage: async (message: LiveServerMessage) => {
            if (!isCallActiveRef.current || isClosingRef.current || !audioContextRef.current) return;

            if (message.serverContent?.interrupted) {
              nextPlayTimeRef.current = audioContextRef.current.currentTime;
              activeSourcesRef.current.forEach(source => {
                try { source.stop(); } catch (e) {}
              });
              activeSourcesRef.current = [];
            }
            
            if (message.serverContent?.modelTurn) {
              const parts = message.serverContent.modelTurn.parts;
              for (const part of parts) {
                if (part.inlineData && part.inlineData.data) {
                  if (!audioContextRef.current) break;
                  // Play raw PCM audio (16-bit, 24kHz, mono)
                  const binaryString = atob(part.inlineData.data);
                  const pcm16 = new Int16Array(binaryString.length / 2);
                  for (let i = 0; i < pcm16.length; i++) {
                    // Little-endian
                    pcm16[i] = binaryString.charCodeAt(i * 2) | (binaryString.charCodeAt(i * 2 + 1) << 8);
                  }
                  
                  const audioBuffer = audioContextRef.current.createBuffer(1, pcm16.length, 24000);
                  const channelData = audioBuffer.getChannelData(0);
                  for (let i = 0; i < pcm16.length; i++) {
                    channelData[i] = pcm16[i] / 32768.0;
                  }
                  
                  const source = audioContextRef.current.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(audioContextRef.current.destination);
                  
                  const currentTime = audioContextRef.current.currentTime;
                  if (nextPlayTimeRef.current < currentTime) {
                    nextPlayTimeRef.current = currentTime;
                  }
                  
                  source.start(nextPlayTimeRef.current);
                  nextPlayTimeRef.current += audioBuffer.duration;
                  
                  activeSourcesRef.current.push(source);
                  source.onended = () => {
                    activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
                  };
                }
              }
            }
            
            if (message.toolCall) {
              const call = message.toolCall.functionCalls[0];
              if (call.name === "update_ui") {
                const args = call.args as any;
                
                // Update Sidebar Notes
                setMessages(prev => [...prev, { id: Date.now().toString(), role: 'tutor', text: args.sidebar_notes }]);
                
                // Update Visual Board
                let visualType: 'image' | 'video' | '3d' | 'code' | 'none' = 'none';
                let url = '';
                
                if (args.ui_action === 'ENGINE_C_IMAGE' || args.ui_action === 'ENGINE_B_3D' || args.ui_action === 'ENGINE_D_VIDEO') {
                  if (args.ui_action === 'ENGINE_C_IMAGE') visualType = 'image';
                  else if (args.ui_action === 'ENGINE_B_3D') visualType = '3d';
                  else if (args.ui_action === 'ENGINE_D_VIDEO') visualType = 'video';

                  setCurrentVisual({
                    type: visualType,
                    prompt: args.visual_payload,
                    url: `https://picsum.photos/seed/${encodeURIComponent(args.visual_payload.substring(0, 20))}/1920/1080?blur=2`,
                    engine: args.ui_action
                  });

                  // Generate real image in background
                  const imageApiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
                  if (imageApiKey) {
                    const imageAi = new GoogleGenAI({ apiKey: imageApiKey as string });
                    imageAi.models.generateContent({
                      model: 'gemini-2.5-flash-image',
                      contents: args.visual_payload,
                      config: {
                        imageConfig: { aspectRatio: "16:9" }
                      }
                    }).then(response => {
                      for (const part of response.candidates?.[0]?.content?.parts || []) {
                        if (part.inlineData) {
                          const imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                          setCurrentVisual(prev => prev.prompt === args.visual_payload ? { ...prev, url: imageUrl } : prev);
                          break;
                        }
                      }
                    }).catch(err => {
                      console.error("Image generation failed:", err);
                      if (err.message && (err.message.includes("403") || err.message.includes("PERMISSION_DENIED") || err.message.includes("Requested entity was not found"))) {
                        if ((window as any).aistudio) {
                          (window as any).aistudio.openSelectKey();
                        }
                      }
                    });
                  } else {
                    console.error("API_KEY is missing for image generation. Please select an API key.");
                    if ((window as any).aistudio) {
                      (window as any).aistudio.openSelectKey();
                    }
                  }

                } else if (args.ui_action === 'ENGINE_A_CODE') {
                  visualType = 'code';
                  setCurrentVisual({
                    type: 'code',
                    prompt: args.visual_payload,
                    engine: args.ui_action
                  });
                } else {
                  setCurrentVisual({
                    type: visualType,
                    prompt: args.visual_payload,
                    url,
                    engine: args.ui_action
                  });
                }

                // Send tool response
                if (isCallActiveRef.current && activeSessionRef.current && !isClosingRef.current) {
                  try {
                    activeSessionRef.current.sendToolResponse({
                      functionResponses: [{
                        id: call.id,
                        name: call.name,
                        response: { result: "UI updated successfully" }
                      }]
                    });
                  } catch (e: any) {
                    if (!e?.message?.toLowerCase().includes('closing') && !e?.message?.toLowerCase().includes('closed')) {
                      console.error("Error sending tool response:", e);
                    }
                  }
                }
              }
            }
          },
          onclose: (event: any) => {
            const reason = event?.reason || "No reason provided";
            const code = event?.code || "Unknown code";
            console.warn(`Live API connection closed. Code: ${code}, Reason: ${reason}`);
            console.log(`Current document referrer: ${document.referrer || "<empty>"}`);
            
            if (isCallActiveRef.current || isConnecting) {
              let errorMessage = `Connection lost (Code: ${code}).`;
              
              if (reason.includes('referer <empty>')) {
                errorMessage = "Browser is blocking the 'Referer' header. Please disable privacy extensions or check your Cloudflare Referrer-Policy settings.";
              } else if (reason.includes('API_KEY')) {
                errorMessage = "Check your API Key. It might be invalid or restricted.";
              } else {
                errorMessage += ` ${reason}`;
              }
              
              setCallError(errorMessage);
            }
            handleEndCall();
          },
          onerror: (err) => {
            if (err?.message?.includes("Network error")) {
              console.warn("Live API Network Error - likely connection drop:", err);
              setCallError("Network error: Connection dropped. Check your internet or Cloudflare settings.");
            } else {
              console.error("Live API Error:", err);
              setCallError(`Live API Error: ${err?.message || "Unknown error"}`);
            }
            handleEndCall();
          }
        }
      });
      
      sessionPromise.catch(async (error) => {
        console.error("Failed to connect to Live API:", error);
        setCallError(error.message || "Failed to connect to the AI service.");
        if (error.message && (error.message.includes("API key not valid") || error.message.includes("Requested entity was not found") || error.message.includes("403") || error.message.includes("PERMISSION_DENIED"))) {
          if ((window as any).aistudio) {
            await (window as any).aistudio.openSelectKey();
          }
        }
        handleEndCall();
      });
      
      sessionRef.current = sessionPromise;
    } catch (error: any) {
      console.error("Failed to start call:", error);
      setCallError(error.message || "An unexpected error occurred.");
      setIsConnecting(false);
    }
  };

  const handleEndCall = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    
    if (processorRef.current) {
      processorRef.current.port.onmessage = null;
    }
    
    activeSessionRef.current = null;
    setCallActive(false);
    setIsConnecting(false);
    setConnectionStep("");
    setMessages([]);
    setCurrentVisual({ type: 'none' });
    
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    activeSourcesRef.current = [];
    nextPlayTimeRef.current = 0;
    
    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch (e) {}
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      try { mediaStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }
    
    const sessionToClose = sessionRef.current;
    sessionRef.current = null;
    
    if (sessionToClose) {
      sessionToClose.then((session: any) => {
        try {
          if (session && typeof session.close === 'function') {
            session.close();
          }
        } catch (e) {
          // Ignore close errors
        }
      }).catch(() => {});
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className="h-screen w-full bg-slate-950 flex flex-col md:flex-row overflow-hidden font-sans selection:bg-indigo-500/30">
      {/* Main Visual Board */}
      <div className={cn(
        "relative flex-1 bg-slate-900 flex flex-col transition-all duration-500 ease-in-out",
        isFullscreen ? "absolute inset-0 z-50" : "md:w-2/3 lg:w-3/4"
      )}>
        {/* Top Bar Overlay */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-slate-950/80 to-transparent">
          <div className="flex items-center gap-4">
            <button onClick={() => { handleEndCall(); navigate(-1); }} className="px-3 py-1.5 rounded-full bg-indigo-600/20 backdrop-blur-md flex items-center gap-1.5 justify-center hover:bg-indigo-600/40 transition-colors border border-indigo-500/30 text-indigo-300">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <div className="flex flex-col">
              <span className="text-white font-semibold text-sm flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-indigo-400" /> Dr. Sam
              </span>
              <span className="text-indigo-300 text-xs flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> {topic} • {grade}
              </span>
            </div>
          </div>
          <button 
            onClick={toggleFullscreen}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-colors text-white border border-white/10"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>

        {/* Visual Content Area */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait">
            {callError && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-rose-500/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-rose-400/50 max-w-md text-center"
              >
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <span className="font-bold">!</span>
                </div>
                <p className="text-sm font-medium">{callError}</p>
                <button onClick={() => setCallError(null)} className="ml-2 text-white/60 hover:text-white">✕</button>
              </motion.div>
            )}
            {!isCallActive ? (
              <motion.div 
                key="inactive"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="text-center"
              >
                <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-1 shadow-2xl shadow-indigo-500/20">
                  <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center border-4 border-slate-900">
                    <Sparkles className="w-12 h-12 text-indigo-400" />
                  </div>
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">Ready to explore?</h2>
                <p className="text-slate-400">Start the voice call to begin your session with Dr. Sam.</p>
              </motion.div>
            ) : (
              <motion.div
                key="active"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                {currentVisual.type === 'image' && currentVisual.url && (
                  <img 
                    src={currentVisual.url} 
                    alt="Visual explanation" 
                    className="w-full h-full object-cover opacity-60"
                    referrerPolicy="no-referrer"
                  />
                )}
                
                {currentVisual.type === 'code' && currentVisual.prompt && (
                  <div className="w-full h-full bg-white">
                    <iframe
                      srcDoc={currentVisual.prompt}
                      className="w-full h-full border-none"
                      title="Code Visualization"
                      sandbox="allow-scripts allow-same-origin"
                    />
                  </div>
                )}

                {currentVisual.type === 'video' && (
                  <div className="w-full h-full bg-slate-900 flex items-center justify-center relative">
                    {currentVisual.url && (
                      <img 
                        src={currentVisual.url} 
                        alt="Video Thumbnail" 
                        className="absolute inset-0 w-full h-full object-cover opacity-50"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="text-center relative z-10">
                      <div className="w-16 h-16 mx-auto mb-4 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-indigo-300 font-medium">Generating Video Simulation...</p>
                    </div>
                  </div>
                )}

                {currentVisual.type === '3d' && (
                  <div className="w-full h-full bg-slate-900 flex items-center justify-center relative">
                    {currentVisual.url && (
                      <img 
                        src={currentVisual.url} 
                        alt="3D Model Thumbnail" 
                        className="absolute inset-0 w-full h-full object-cover opacity-50"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="text-center relative z-10">
                      <div className="w-16 h-16 mx-auto mb-4 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-emerald-300 font-medium">Generating 3D Model...</p>
                    </div>
                  </div>
                )}
                
                {currentVisual.type === 'image' && !currentVisual.url?.startsWith('data:') && (
                  <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center p-8">
                     <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border border-indigo-500/30 max-w-2xl text-center shadow-2xl">
                        <div className="w-12 h-12 mx-auto mb-4 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-white text-lg font-medium">Generating image...</p>
                     </div>
                  </div>
                )}

                {/* 3D Avatar Overlay (Simulated) */}
                <div className="absolute bottom-24 right-8 w-48 h-48 md:w-64 md:h-64 rounded-full bg-gradient-to-t from-indigo-900/80 to-transparent backdrop-blur-sm border border-indigo-500/30 flex items-end justify-center overflow-hidden shadow-2xl shadow-indigo-900/50">
                  <div className="w-3/4 h-3/4 bg-indigo-400/20 rounded-t-full relative">
                    {/* Simulated Avatar Silhouette */}
                    <div className="absolute inset-x-4 bottom-0 top-8 bg-indigo-300/40 rounded-t-full backdrop-blur-md border-t border-indigo-200/50"></div>
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-20 bg-indigo-200/50 rounded-full backdrop-blur-md border border-indigo-100/50"></div>
                  </div>
                  {/* Speaking Indicator */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
                    {[1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ height: ['4px', '12px', '4px'] }}
                        transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.2 }}
                        className="w-1.5 bg-emerald-400 rounded-full"
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Voice Controls (Floating Bottom Center) */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/80 backdrop-blur-xl p-3 rounded-full border border-slate-700/50 shadow-2xl">
          {!isCallActive ? (
            <button
              onClick={handleStartCall}
              disabled={isConnecting}
              className="flex flex-col items-center gap-1 px-8 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-white font-bold transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-2">
                {isConnecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
                {isConnecting ? 'Connecting...' : 'Start Voice Call'}
              </div>
              {isConnecting && connectionStep && (
                <span className="text-[10px] font-normal opacity-70 animate-pulse">{connectionStep}</span>
              )}
            </button>
          ) : (
            <>
              <button
                onClick={() => setMuted(!isMuted)}
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                  isMuted 
                    ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30" 
                    : "bg-slate-700 text-white hover:bg-slate-600"
                )}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button
                onClick={handleEndCall}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-rose-500 hover:bg-rose-400 text-white font-bold transition-all shadow-lg shadow-rose-500/20 hover:shadow-rose-500/40 hover:-translate-y-0.5"
              >
                <PhoneOff className="w-5 h-5" />
                End Call
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sidebar Chat Section */}
      {!isFullscreen && (
        <div className="w-full md:w-1/3 lg:w-1/4 h-1/3 md:h-full bg-white flex flex-col border-l border-slate-200 shadow-2xl z-20">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
            <MessageSquare className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-800">Academic Notes</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                <MessageSquare className="w-8 h-8 opacity-20" />
                <p className="text-sm text-center px-4">Start the voice call to see Dr. Sam's notes and explanations here.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={msg.id}
                  className={cn(
                    "p-4 rounded-2xl w-full text-sm leading-relaxed",
                    msg.role === 'tutor' 
                      ? "bg-indigo-50 text-indigo-950 rounded-tl-sm border border-indigo-100/50" 
                      : "bg-slate-100 text-slate-800 rounded-tr-sm self-end ml-auto max-w-[90%]"
                  )}
                >
                  {msg.role === 'tutor' && (
                    <span className="block text-xs font-bold text-indigo-500 mb-2 uppercase tracking-wider">Dr. Sam</span>
                  )}
                  <div className="prose prose-sm prose-indigo max-w-none">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                </motion.div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
