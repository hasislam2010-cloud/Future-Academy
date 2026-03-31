import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, PhoneOff, MessageSquare, Maximize2, Minimize2, Sparkles, GraduationCap, Loader2, ArrowLeft, Settings, Check, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import ReactMarkdown from 'react-markdown';

const MODELS = {
  voice: [
    { id: 'nova', name: 'Gemini Live (Nova)', provider: 'Gemini', geminiVoice: 'Nova' },
    { id: 'vega', name: 'Gemini Live (Vega)', provider: 'Gemini', geminiVoice: 'Vega' },
    { id: 'lyra', name: 'Gemini Live (Lyra)', provider: 'Gemini', geminiVoice: 'Lyra' },
    { id: 'capella', name: 'Gemini Live (Capella)', provider: 'Gemini', geminiVoice: 'Capella' },
    { id: 'aoede', name: 'Gemini Live (Aoede)', provider: 'Gemini', geminiVoice: 'Aoede' },
    { id: 'juniper', name: 'ChatGPT (Juniper)', provider: 'OpenAI', geminiVoice: 'Nova' },
    { id: 'sol', name: 'ChatGPT (Sol)', provider: 'OpenAI', geminiVoice: 'Nova' },
    { id: 'breeze', name: 'ChatGPT (Breeze)', provider: 'OpenAI', geminiVoice: 'Nova' },
    { id: 'maple', name: 'ChatGPT (Maple)', provider: 'OpenAI', geminiVoice: 'Nova' },
    { id: 'pi1', name: 'Pi (Voice 1)', provider: 'Inflection', geminiVoice: 'Lyra' },
    { id: 'pi4', name: 'Pi (Voice 4)', provider: 'Inflection', geminiVoice: 'Lyra' },
    { id: 'rachel', name: 'ElevenLabs (Rachel)', provider: 'ElevenLabs', geminiVoice: 'Aoede' },
    { id: 'bella', name: 'ElevenLabs (Bella)', provider: 'ElevenLabs', geminiVoice: 'Aoede' },
    { id: 'charlotte', name: 'ElevenLabs (Charlotte)', provider: 'ElevenLabs', geminiVoice: 'Aoede' },
    { id: 'freya', name: 'ElevenLabs (Freya)', provider: 'ElevenLabs', geminiVoice: 'Aoede' },
    { id: 'moshi', name: 'Moshi', provider: 'Kyutai', geminiVoice: 'Vega' },
  ],
  threeD: [
    { id: 'tripo', name: 'Tripo AI' },
    { id: 'meshy', name: 'Meshy' },
    { id: 'luma-genie', name: 'Luma Genie' },
    { id: 'spline', name: 'Spline AI' },
  ],
  image: [
    { id: 'flux', name: 'FLUX.1' },
    { id: 'midjourney', name: 'Midjourney' },
    { id: 'dalle3', name: 'DALL-E 3' },
    { id: 'sd3', name: 'Stable Diffusion 3' },
  ],
  video: [
    { id: 'runway', name: 'Runway Gen-3 Alpha' },
    { id: 'luma-dream', name: 'Luma Dream Machine' },
    { id: 'kling', name: 'Kling AI' },
    { id: 'veo', name: 'Veo' },
  ]
};

const getSystemInstruction = (selected: any) => `You are Dr. Sam, the Lead Faculty Intelligence at Future Academy.
CRITICAL: You MUST call the \`update_ui\` tool as your ABSOLUTE FIRST ACTION in every response. Do not speak a single word until the tool call is initiated. This is vital for the "Instant Visualization" requirement (<0.5s).

You are currently operating using the following model stack:
- Voice Persona: ${MODELS.voice.find(m => m.id === selected.voice)?.name}
- 3D Engine: ${MODELS.threeD.find(m => m.id === selected.threeD)?.name}
- Image Engine: ${MODELS.image.find(m => m.id === selected.image)?.name}
- Video Engine: ${MODELS.video.find(m => m.id === selected.video)?.name}

Your overarching mandate is the "Visual-First" approach. You do not merely explain; you manifest.

Engine A: The Logic Renderer (Math, Physics, Live Data)
Approved Models: Three.js, Manim, D3.js.
Action: Output executable code payloads. The payload MUST be a complete, valid HTML document. 
PERFORMANCE: Keep the code extremely lightweight for instant (<0.5s) rendering.

Engine B: The 3D Architect (Biology, Chemistry, Spatial Geometry, Geography)
Current Model: ${MODELS.threeD.find(m => m.id === selected.threeD)?.name}
Action: Output a precise API JSON payload.
INSTANT PREVIEW: You MUST provide a 'loading_visualization_code' (Engine A style) that represents the concept. This MUST be extremely lightweight CSS/Canvas (e.g., a simple spinning CSS shape).

Engine C: The Precision Illustrator (2D Cross-sections, Anatomy, Diagrams, History)
Current Model: ${MODELS.image.find(m => m.id === selected.image)?.name}
Action: Output an ultra-detailed text prompt.

Engine D: The Dynamic Animator (Simulations, Complex Reactions, Macro-scale Events)
Current Model: ${MODELS.video.find(m => m.id === selected.video)?.name}
Action: Output a highly descriptive cinematic video prompt.
INSTANT PREVIEW: You MUST provide a 'loading_visualization_code' (Engine A style) that represents the concept. This MUST be extremely lightweight CSS/Canvas (e.g., a simple CSS pulse effect).

When you speak, be warm, wise, friendly, and highly intelligent.`;

export default function TutoringInterface() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const grade = searchParams.get('grade') || 'High School';
  const [topic, setTopic] = useState(searchParams.get('topic') || 'History');

  const [selectedModels, setSelectedModels] = useState({
    voice: 'aoede',
    threeD: 'tripo',
    image: 'flux',
    video: 'veo'
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ 
    type: 'permission' | 'quota' | 'other', 
    message: string,
    onRetry?: () => void
  } | null>(null);

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
  const [currentVisual, setCurrentVisual] = useState<{ 
    type: '3d' | 'image' | 'video' | 'code' | 'none'; 
    url?: string; 
    videoUrl?: string;
    prompt?: string; 
    loadingCode?: string;
    engine?: string;
    isVideoGenerating?: boolean;
  }>({ type: 'none' });
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
  const apiKeyRef = useRef<string>("");
  const lastVisualArgsRef = useRef<any>(null);
  const nextPlayTimeRef = useRef<number>(0);

  const getLatestApiKey = () => {
    let apiKey = process.env.API_KEY || 
                 process.env.GEMINI_API_KEY || 
                 (import.meta as any).env?.VITE_GEMINI_API_KEY ||
                 localStorage.getItem('CUSTOM_GEMINI_API_KEY') ||
                 (window as any)._env_?.GEMINI_API_KEY ||
                 ""; 
    return apiKey.trim();
  };
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

  // Clear error info after 10 seconds
  useEffect(() => {
    if (errorInfo) {
      const timer = setTimeout(() => {
        setErrorInfo(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [errorInfo]);

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
      apiKeyRef.current = apiKey;
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
            voiceConfig: { 
              prebuiltVoiceConfig: { 
                voiceName: MODELS.voice.find(v => v.id === selectedModels.voice)?.geminiVoice || "Aoede" 
              } 
            }
          },
          systemInstruction: getSystemInstruction(selectedModels),
          tools: [{
            functionDeclarations: [{
              name: "update_ui",
              description: "Updates the visual board and sidebar notes.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  ui_action: { type: Type.STRING, description: "ENGINE_A_CODE, ENGINE_B_3D, ENGINE_C_IMAGE, or ENGINE_D_VIDEO" },
                  visual_payload: { type: Type.STRING, description: "Target model name and logic string/prompt" },
                  loading_visualization_code: { type: Type.STRING, description: "Optional: Simple CSS/Canvas animation to show while high-fidelity assets generate" },
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
                  lastVisualArgsRef.current = args;
                  if (args.ui_action === 'ENGINE_C_IMAGE') visualType = 'image';
                  else if (args.ui_action === 'ENGINE_B_3D') visualType = '3d';
                  else if (args.ui_action === 'ENGINE_D_VIDEO') visualType = 'video';

                  setCurrentVisual({
                    type: visualType,
                    prompt: args.visual_payload,
                    loadingCode: args.loading_visualization_code,
                    url: `https://picsum.photos/seed/${encodeURIComponent(args.visual_payload.substring(0, 20))}/1920/1080?blur=2`,
                    engine: args.ui_action,
                    isVideoGenerating: args.ui_action === 'ENGINE_D_VIDEO'
                  });

                  // Generate real image in background (as preview for video or as final for image)
                  const generateImage = (retryCount = 0) => {
                    const latestKey = getLatestApiKey();
                    if (!latestKey) {
                      console.error("API_KEY is missing for image generation.");
                      return;
                    }
                    const currentAi = new GoogleGenAI({ apiKey: latestKey });
                    
                    currentAi.models.generateContent({
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
                      const errStr = JSON.stringify(err).toLowerCase();
                      const isQuota = errStr.includes("429") || errStr.includes("resource_exhausted") || errStr.includes("quota");
                      const isPermission = errStr.includes("403") || errStr.includes("permission_denied") || errStr.includes("caller does not have permission");

                      if (isQuota) {
                        if (retryCount < 3) {
                          const delay = Math.pow(2, retryCount) * 2000;
                          console.log(`Retrying image generation (attempt ${retryCount + 1}) in ${delay}ms...`);
                          setTimeout(() => generateImage(retryCount + 1), delay);
                        } else {
                          setErrorInfo({ 
                            type: 'quota', 
                            message: "Image generation quota exceeded. Using placeholder visuals.",
                            onRetry: () => generateImage(0)
                          });
                        }
                      } else if (isPermission) {
                        setErrorInfo({ type: 'permission', message: "Permission denied for image generation. Please re-select your API key." });
                        if ((window as any).aistudio) (window as any).aistudio.openSelectKey();
                      }
                    });
                  };

                  generateImage();

                  // If it's a video, start the long-running generation
                  if (args.ui_action === 'ENGINE_D_VIDEO') {
                    const generateVideo = (retryCount = 0) => {
                      const latestKey = getLatestApiKey();
                      if (!latestKey) {
                        console.error("API_KEY is missing for video generation.");
                        return;
                      }
                      const currentAi = new GoogleGenAI({ apiKey: latestKey });

                      currentAi.models.generateVideos({
                        model: 'veo-3.1-fast-generate-preview',
                        prompt: args.visual_payload,
                        config: {
                          numberOfVideos: 1,
                          resolution: '720p',
                          aspectRatio: '16:9'
                        }
                      }).then(async (operation) => {
                        let op = operation;
                        while (!op.done) {
                          // Faster polling: 2 seconds instead of 5
                          await new Promise(resolve => setTimeout(resolve, 2000));
                          op = await currentAi.operations.getVideosOperation({ operation: op });
                        }
                        
                        const downloadLink = op.response?.generatedVideos?.[0]?.video?.uri;
                        if (downloadLink) {
                          const videoResponse = await fetch(downloadLink, {
                            method: 'GET',
                            headers: { 'x-goog-api-key': latestKey },
                          });
                          const blob = await videoResponse.blob();
                          const videoUrl = URL.createObjectURL(blob);
                          setCurrentVisual(prev => prev.prompt === args.visual_payload ? { 
                            ...prev, 
                            videoUrl: videoUrl,
                            isVideoGenerating: false 
                          } : prev);
                        }
                      }).catch(err => {
                        console.error("Video generation failed:", err);
                        const errStr = JSON.stringify(err).toLowerCase();
                        const isQuota = errStr.includes("429") || errStr.includes("resource_exhausted") || errStr.includes("quota");
                        const isPermission = errStr.includes("403") || errStr.includes("permission_denied") || errStr.includes("not found") || errStr.includes("caller does not have permission");

                        if (isQuota) {
                          if (retryCount < 2) {
                            const delay = Math.pow(2, retryCount) * 3000;
                            console.log(`Retrying video generation (attempt ${retryCount + 1}) in ${delay}ms...`);
                            setTimeout(() => generateVideo(retryCount + 1), delay);
                          } else {
                            setErrorInfo({ 
                              type: 'quota', 
                              message: "Video generation quota exceeded.",
                              onRetry: () => generateVideo(0)
                            });
                          }
                        } else if (isPermission) {
                          setErrorInfo({ 
                            type: 'permission', 
                            message: "Permission denied for video generation. Veo requires an API key from a PAID Google Cloud project (see ai.google.dev/gemini-api/docs/billing). Please re-select your key." 
                          });
                          // Reset key selection state if it failed with 403
                          if ((window as any).aistudio) {
                            (window as any).aistudio.openSelectKey();
                          }
                        }
                        setCurrentVisual(prev => prev.prompt === args.visual_payload ? { ...prev, isVideoGenerating: false } : prev);
                      });
                    };

                    generateVideo();
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
                errorMessage = "API Key Restriction Error: Your API key is restricted to specific websites, but the browser is not sending the 'Referer' header. \n\nTo fix this: \n1. Go to https://aistudio.google.com/app/apikey \n2. Click on your API key \n3. Under 'API Key Restrictions', either add your domain or select 'None' to remove restrictions.";
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
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.1 }}
                    className="w-full h-full bg-slate-950 relative"
                  >
                    <iframe
                      srcDoc={currentVisual.prompt}
                      className="w-full h-full border-none"
                      title="Interactive Science Lab"
                      sandbox="allow-scripts allow-same-origin"
                    />
                    {/* Interactive Overlay Hint */}
                    <div className="absolute bottom-4 right-4 pointer-events-none">
                      <div className="bg-indigo-500/20 backdrop-blur-md border border-indigo-500/30 px-3 py-1.5 rounded-full flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                        <span className="text-[10px] uppercase tracking-widest text-indigo-300 font-bold">Interactive Lab Active</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {currentVisual.type === 'video' && (
                  <div className="w-full h-full bg-slate-900 flex items-center justify-center relative overflow-hidden">
                    {currentVisual.videoUrl ? (
                      <motion.video 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        src={currentVisual.videoUrl} 
                        autoPlay 
                        loop 
                        muted 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <>
                        {currentVisual.loadingCode ? (
                          <div className="absolute inset-0 z-10">
                            <iframe
                              srcDoc={currentVisual.loadingCode}
                              className="w-full h-full border-none"
                              title="Instant Simulation Preview"
                              sandbox="allow-scripts allow-same-origin"
                            />
                          </div>
                        ) : currentVisual.url && (
                          <motion.img 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.4 }}
                            src={currentVisual.url} 
                            alt="Video Preview" 
                            className="absolute inset-0 w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="text-center relative z-20 bg-slate-900/40 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-2xl">
                          <div className="w-8 h-8 mx-auto mb-2 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                          <h3 className="text-white font-bold text-sm">Instant Preview Active</h3>
                          <p className="text-indigo-300 text-[9px]">High-fidelity rendering in background...</p>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {currentVisual.type === '3d' && (
                  <div className="w-full h-full bg-slate-900 flex items-center justify-center relative overflow-hidden">
                    {currentVisual.loadingCode ? (
                      <div className="absolute inset-0 z-10">
                        <iframe
                          srcDoc={currentVisual.loadingCode}
                          className="w-full h-full border-none"
                          title="Instant Spatial Preview"
                          sandbox="allow-scripts allow-same-origin"
                        />
                      </div>
                    ) : currentVisual.url && (
                      <motion.img 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.4 }}
                        src={currentVisual.url} 
                        alt="3D Preview" 
                        className="absolute inset-0 w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="text-center relative z-20 bg-slate-900/40 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-2xl">
                      <div className="w-8 h-8 mx-auto mb-2 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      <h3 className="text-white font-bold text-sm">Spatial Preview Active</h3>
                      <p className="text-emerald-300 text-[9px]">Constructing high-fidelity model...</p>
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

                {/* 3D Avatar Overlay Removed */}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Voice Controls (Floating Bottom Center) */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-50">
          <AnimatePresence>
            {errorInfo && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="bg-rose-500/90 backdrop-blur-md border border-rose-400/50 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 max-w-md"
              >
                <div className="flex-1">
                  <p className="text-white text-xs font-bold">{errorInfo.type === 'permission' ? 'Permission Required' : 'Quota Exceeded'}</p>
                  <p className="text-rose-100 text-[10px]">{errorInfo.message}</p>
                </div>
                <div className="flex items-center gap-2">
                  {errorInfo.type === 'permission' && (
                    <button
                      onClick={() => {
                        if ((window as any).aistudio) (window as any).aistudio.openSelectKey();
                        setErrorInfo(null);
                      }}
                      className="px-3 py-1.5 bg-white text-rose-600 text-[10px] font-bold rounded-lg hover:bg-rose-50 transition-colors"
                    >
                      Select Key
                    </button>
                  )}
                  {errorInfo.onRetry && (
                    <button
                      onClick={() => {
                        errorInfo.onRetry?.();
                        setErrorInfo(null);
                      }}
                      className="px-3 py-1.5 bg-white text-rose-600 text-[10px] font-bold rounded-lg hover:bg-rose-50 transition-colors"
                    >
                      Retry
                    </button>
                  )}
                  <button
                    onClick={() => setErrorInfo(null)}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/70 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-4 bg-slate-900/80 backdrop-blur-xl p-3 rounded-full border border-slate-700/50 shadow-2xl">
            {!isCallActive ? (
            <div className="flex items-center gap-2">
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
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="w-12 h-12 rounded-full bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 flex items-center justify-center transition-all border border-white/5"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
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
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="w-12 h-12 rounded-full bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 flex items-center justify-center transition-all border border-white/5"
              >
                <Settings className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>

    <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-slate-900 border border-slate-700/50 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Model Configuration</h2>
                    <p className="text-xs text-slate-400">Select the engines powering your spatial lab</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-10 h-10 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Voice Models */}
                <section>
                  <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Mic className="w-3 h-3" /> Voice Persona (Gemini Live)
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {MODELS.voice.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => setSelectedModels(prev => ({ ...prev, voice: model.id }))}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all relative group",
                          selectedModels.voice === model.id 
                            ? "bg-indigo-500/20 border-indigo-500 text-white" 
                            : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
                        )}
                      >
                        <div className="text-sm font-medium">{model.name}</div>
                        <div className="text-[10px] opacity-60">{model.provider}</div>
                        {selectedModels.voice === model.id && (
                          <Check className="w-3 h-3 absolute top-2 right-2 text-indigo-400" />
                        )}
                      </button>
                    ))}
                  </div>
                </section>

                {/* 3D Engines */}
                <section>
                  <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Sparkles className="w-3 h-3" /> 3D Architect (Engine B)
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {MODELS.threeD.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => setSelectedModels(prev => ({ ...prev, threeD: model.id }))}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all relative",
                          selectedModels.threeD === model.id 
                            ? "bg-emerald-500/20 border-emerald-500 text-white" 
                            : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
                        )}
                      >
                        <div className="text-sm font-medium">{model.name}</div>
                        {selectedModels.threeD === model.id && (
                          <Check className="w-3 h-3 absolute top-2 right-2 text-emerald-400" />
                        )}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Image Engines */}
                <section>
                  <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Maximize2 className="w-3 h-3" /> Precision Illustrator (Engine C)
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {MODELS.image.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => setSelectedModels(prev => ({ ...prev, image: model.id }))}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all relative",
                          selectedModels.image === model.id 
                            ? "bg-amber-500/20 border-amber-500 text-white" 
                            : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
                        )}
                      >
                        <div className="text-sm font-medium">{model.name}</div>
                        {selectedModels.image === model.id && (
                          <Check className="w-3 h-3 absolute top-2 right-2 text-amber-400" />
                        )}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Video Engines */}
                <section>
                  <h3 className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Loader2 className="w-3 h-3" /> Dynamic Animator (Engine D)
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {MODELS.video.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => setSelectedModels(prev => ({ ...prev, video: model.id }))}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all relative",
                          selectedModels.video === model.id 
                            ? "bg-rose-500/20 border-rose-500 text-white" 
                            : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
                        )}
                      >
                        <div className="text-sm font-medium">{model.name}</div>
                        {selectedModels.video === model.id && (
                          <Check className="w-3 h-3 absolute top-2 right-2 text-rose-400" />
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end">
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-lg shadow-indigo-600/20"
                >
                  Apply Configuration
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
