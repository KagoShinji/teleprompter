"use client";

import {
  Aperture,
  ArrowDownToLine,
  Check,
  ChevronDown,
  CircleHelp,
  Clapperboard,
  Clock3,
  FlipHorizontal2,
  Maximize2,
  Mic,
  Minus,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Square,
  Video,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type CSSProperties,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";

const initialScript =
  "Hi there, and welcome.\n\nToday, I want to share a few thoughts on making your next big idea happen. It starts with a simple question: what would you make if you knew you couldn't fail?\n\nGive yourself the space to explore, to experiment, and to get it a little wrong. That's where the interesting things begin.\n\nSo take that first step. Your next chapter is waiting.";

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export default function TeleprompterStudio() {
  const [script, setScript] = useState(initialScript);
  const [fontSize, setFontSize] = useState(24);
  const [speed, setSpeed] = useState(1);
  const [mirror, setMirror] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedMimeType, setRecordedMimeType] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [showScriptEditor, setShowScriptEditor] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const teleprompterRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAt = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const scrollRemainder = useRef(0);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current);
    };
  }, [stream]);

  useEffect(() => {
    if (!videoRef.current || !stream) return;
    videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    if (!isPlaying || !teleprompterRef.current) {
      if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      return;
    }

    let previous = performance.now();
    const scroll = (now: number) => {
      const elapsedMs = Math.min(now - previous, 50);
      previous = now;
      scrollRemainder.current += elapsedMs * speed * 0.018;
      if (scrollRemainder.current >= 1 && teleprompterRef.current) {
        const pixels = Math.floor(scrollRemainder.current);
        teleprompterRef.current.scrollTop += pixels;
        scrollRemainder.current -= pixels;
      }
      animationRef.current = window.requestAnimationFrame(scroll);
    };
    animationRef.current = window.requestAnimationFrame(scroll);

    return () => {
      if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    };
  }, [isPlaying, speed]);

  useEffect(() => {
    if (!recording) return;
    timerRef.current = window.setInterval(() => {
      if (recordingStartedAt.current !== null) {
        setElapsed(Math.floor((Date.now() - recordingStartedAt.current) / 1000));
      }
    }, 250);
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [recording]);

  const openCamera = async () => {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access requires a secure connection (HTTPS) and a supported browser.");
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
      });
      setStream(media);
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setCameraError(
        name === "NotAllowedError"
          ? "Camera and microphone access was blocked. Allow access in your browser settings and try again."
          : name === "NotFoundError"
            ? "No camera or microphone was found on this device."
            : "We couldn't start your camera. Check that it's not being used by another app.",
      );
    }
  };

  const startRecording = () => {
    if (!stream) return;
    if (typeof MediaRecorder === "undefined") {
      setCameraError("Video recording is not supported in this browser. Try a recent version of Chrome, Safari, or Firefox.");
      return;
    }
    const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/mp4"]
      .find((type) => MediaRecorder.isTypeSupported(type));
    try {
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        setRecordedMimeType(recorder.mimeType || "video/webm");
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "video/webm",
        });
        setRecordedUrl((previousUrl) => {
          if (previousUrl) URL.revokeObjectURL(previousUrl);
          return URL.createObjectURL(blob);
        });
        setIsPlaying(false);
      };
      recorder.onerror = () => {
        setCameraError("Recording stopped unexpectedly. Please check your device and try again.");
        setRecording(false);
      };
      recorderRef.current = recorder;
      recordingStartedAt.current = Date.now();
      setElapsed(0);
      recorder.start(1000);
      setRecording(true);
      setIsPlaying(true);
      setRecordedUrl((previousUrl) => {
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        return null;
      });
    } catch {
      setCameraError("Your browser couldn't start recording. Try closing other camera apps and retry.");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
    setIsPlaying(false);
  };

  const downloadRecording = () => {
    if (!recordedUrl) return;
    const extension = recordedMimeType.includes("mp4") ? "mp4" : "webm";
    const link = document.createElement("a");
    link.href = recordedUrl;
    link.download = `cue-recording-${new Date().toISOString().slice(0, 10)}.${extension}`;
    link.click();
  };

  const changeFontSize = (change: number) => {
    setFontSize((size) => Math.min(36, Math.max(16, size + change)));
  };

  const onScriptChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setScript(event.target.value);
  };

  const style = { fontSize: `${fontSize}px` } as CSSProperties;

  return (
    <div className="studio-shell">
      <header className="studio-header">
        <a href="#" className="flex items-center gap-3 text-inherit no-underline" aria-label="Cue home">
          <span className="brand-mark"><Aperture size={19} strokeWidth={2.2} /></span>
          <span className="text-[17px] font-bold tracking-[-0.04em]">cue<span className="text-[#8b9b7a]">.</span></span>
        </a>
        <div className="header-secondary flex items-center gap-2 text-sm text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-[#9baa8f]" />
          Your studio, ready when you are
        </div>
        <Button variant="ghost" size="icon" aria-label="Help" title="Camera and recording stay on your device">
          <CircleHelp size={19} />
        </Button>
      </header>

      <main className="studio-main">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-[#78836e]">
              <Sparkles size={14} />
              Your recording space
            </div>
            <h1 className="m-0 text-[clamp(28px,4vw,36px)] font-semibold tracking-[-0.055em]">Make it sound like you.</h1>
            <p className="mb-0 mt-2 text-sm text-muted-foreground">Your script, your pace, your best take.</p>
          </div>
          <button className="mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#64685f] transition hover:bg-[#eceee9]">
            <Clapperboard size={16} />
            Untitled recording
            <ChevronDown size={15} />
          </button>
        </div>

        <div className="studio-grid">
          <section className="surface min-w-0 p-4 sm:p-5" aria-label="Recording studio">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#edf1e9] text-[#728367]"><span className="text-xs">01</span></span>
                Your script
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs text-muted-foreground"
                  onClick={() => setShowScriptEditor(!showScriptEditor)}
                >
                  {showScriptEditor ? "Preview" : "Edit script"}
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Script options">
                  <MoreHorizontal size={19} />
                </Button>
              </div>
            </div>

            <div className="teleprompter-window">
              {showScriptEditor ? (
                <textarea
                  className="script-input px-5 py-5"
                  style={style}
                  value={script}
                  onChange={onScriptChange}
                  aria-label="Teleprompter script"
                  placeholder="Paste or type your script here…"
                />
              ) : (
                <div
                  ref={teleprompterRef}
                  className="script-read px-5 py-5"
                  style={style}
                  aria-label="Teleprompter"
                >
                  {script || "Your script will appear here. Select Edit script to get started."}
                </div>
              )}
              <div className="pointer-events-none absolute bottom-3 left-1/2 z-[3] h-[2px] w-10 -translate-x-1/2 rounded-full bg-[#9ba58f]" />
            </div>

            <div className="my-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 rounded-xl bg-[#f4f5f2] p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => changeFontSize(-2)}
                  aria-label="Decrease script size"
                  disabled={fontSize <= 16}
                ><Minus size={16} /></Button>
                <span className="min-w-[42px] text-center text-xs font-medium text-[#666a62]">{fontSize}px</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => changeFontSize(2)}
                  aria-label="Increase script size"
                  disabled={fontSize >= 36}
                ><Plus size={16} /></Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Scroll speed</span>
                <input
                  aria-label="Teleprompter scroll speed"
                  className="w-24 cursor-pointer sm:w-32"
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={speed}
                  onChange={(event) => setSpeed(Number(event.target.value))}
                />
                <span className="w-8 text-right text-xs font-medium text-[#62665e]">{speed.toFixed(1)}×</span>
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#edf1e9] text-[#728367]"><span className="text-xs">02</span></span>
                Camera preview
              </div>
              <button
                onClick={() => setMirror(!mirror)}
                className={`flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium transition ${mirror ? "bg-[#edf1e9] text-[#526547]" : "text-muted-foreground hover:bg-[#f4f5f2]"}`}
                aria-pressed={mirror}
              >
                <FlipHorizontal2 size={15} />
                Mirror
              </button>
            </div>

            <div className="camera-stage">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={mirror ? "mirrored" : ""}
                aria-label={recordedUrl ? "Recorded video preview" : "Live camera preview"}
                onLoadedMetadata={() => setCameraReady(true)}
              />
              {recordedUrl && !recording ? (
                <video
                  src={recordedUrl}
                  controls
                  playsInline
                  className="!z-[1]"
                  aria-label="Recorded video"
                />
              ) : null}
              {!stream && !recordedUrl && (
                <div className="relative z-[1] flex flex-col items-center px-6 text-center">
                  <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.07] text-white/85">
                    <Video size={24} strokeWidth={1.6} />
                  </span>
                  <p className="mb-1 text-sm font-medium">Your camera will appear here</p>
                  <p className="m-0 text-xs text-white/55">A good light and a quiet space go a long way.</p>
                </div>
              )}
              {stream && !cameraReady && !recordedUrl && (
                <div className="absolute z-[2] text-xs text-white/70">Connecting to camera…</div>
              )}
              {recording && (
                <div className="absolute left-3 top-3 z-[3] flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                  <span className="recording-pulse h-2 w-2 rounded-full bg-[#f06b62]" />
                  REC {formatTime(elapsed)}
                </div>
              )}
              {stream && !recording && (
                <div className="absolute bottom-3 left-3 z-[3] flex items-center gap-2 rounded-full bg-black/40 px-2.5 py-1.5 text-[11px] text-white/90 backdrop-blur-sm">
                  <Mic size={13} /> Microphone on
                </div>
              )}
              <button
                className="absolute right-3 top-3 z-[3] grid h-9 w-9 place-items-center rounded-lg bg-black/35 text-white/90 backdrop-blur-sm transition hover:bg-black/55"
                aria-label="Fullscreen preview"
                onClick={() => videoRef.current?.requestFullscreen?.()}
              >
                <Maximize2 size={16} />
              </button>
            </div>

            {cameraError && (
              <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">
                <X size={15} className="mt-0.5 shrink-0" />
                {cameraError}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 size={15} />
                {formatTime(elapsed)}
                {recordedUrl && <span className="ml-1 inline-flex items-center gap-1 text-[#64765a]"><Check size={13} /> Take ready</span>}
              </div>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                {recording ? (
                  <>
                    <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => setIsPlaying(!isPlaying)}>
                      {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                      {isPlaying ? "Pause script" : "Resume script"}
                    </Button>
                    <Button variant="destructive" className="flex-1 sm:flex-none" onClick={stopRecording}>
                      <Square size={14} fill="currentColor" />
                      Finish take
                    </Button>
                  </>
                ) : recordedUrl ? (
                  <>
                    <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => { setRecordedUrl(null); setRecordedMimeType(""); setElapsed(0); }}>
                      <RotateCcw size={15} /> Retake
                    </Button>
                    <Button className="flex-1 sm:flex-none" onClick={downloadRecording}>
                      <ArrowDownToLine size={16} /> Save video
                    </Button>
                  </>
                ) : stream ? (
                  <Button className="flex-1 sm:flex-none" onClick={startRecording}>
                    <span className="h-2.5 w-2.5 rounded-full bg-[#f17a71]" />
                    Start recording
                  </Button>
                ) : (
                  <Button className="w-full sm:w-auto" onClick={openCamera}>
                    <Video size={16} /> Enable camera
                  </Button>
                )}
              </div>
            </div>
          </section>

          <aside className="surface p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold tracking-[-0.02em]">
                <Settings2 size={18} className="text-[#77846d]" />
                Studio settings
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => setShowSettings(!showSettings)}
                aria-label={showSettings ? "Hide settings" : "Show settings"}
              >
                <SlidersHorizontal size={16} />
              </Button>
            </div>

            {showSettings ? (
              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium" htmlFor="reading-speed">Reading speed</label>
                    <span className="rounded-md bg-[#f2f4ef] px-2 py-1 text-[11px] font-semibold text-[#66745b]">{speed.toFixed(1)}×</span>
                  </div>
                  <input
                    id="reading-speed"
                    className="w-full cursor-pointer"
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={speed}
                    onChange={(event) => setSpeed(Number(event.target.value))}
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>Slow</span><span>Fast</span></div>
                </div>

                <div className="h-px bg-[#eff0ed]" />

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium">Text size</label>
                    <span className="text-xs text-muted-foreground">{fontSize}px</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-[#f6f7f4] p-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => changeFontSize(-2)} disabled={fontSize <= 16} aria-label="Decrease text size"><Minus size={15} /></Button>
                    <span className="text-sm font-medium">Aa</span>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => changeFontSize(2)} disabled={fontSize >= 36} aria-label="Increase text size"><Plus size={15} /></Button>
                  </div>
                </div>

                <div className="h-px bg-[#eff0ed]" />

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="m-0 text-sm font-medium">Mirror preview</p>
                    <p className="mb-0 mt-1 text-xs text-muted-foreground">Flip camera horizontally</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={mirror}
                    aria-label="Mirror camera preview"
                    onClick={() => setMirror(!mirror)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${mirror ? "bg-[#718464]" : "bg-[#dfe1dc]"}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${mirror ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                  </button>
                </div>

                <div className="h-px bg-[#eff0ed]" />

                <div className="rounded-xl bg-[#f7f8f5] p-3.5">
                  <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-[#50564a]">
                    <Mic size={14} /> Audio & video
                  </div>
                  <p className="m-0 text-xs leading-5 text-muted-foreground">Camera and microphone stay on this device. Recordings are saved locally when you download them.</p>
                </div>
              </div>
            ) : (
              <p className="m-0 text-sm text-muted-foreground">Settings are hidden.</p>
            )}

            <div className="mt-6 rounded-xl border border-[#e9ebe5] p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#676c62]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#91a27f]" />
                A little reminder
              </div>
              <p className="m-0 text-xs leading-5 text-muted-foreground">Keep your script close to the camera lens for a more natural look. You’ve got this.</p>
            </div>
          </aside>
        </div>

        <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-[#898c84]">
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#a2b095]" /> Recordings stay on your device</span>
          <span className="inline-flex items-center gap-1.5"><Clapperboard size={12} /> Made for the moments that matter</span>
        </footer>
      </main>
    </div>
  );
}
