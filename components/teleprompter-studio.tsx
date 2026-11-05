"use client";

import {
  Aperture,
  ArrowDownToLine,
  Check,
  ChevronDown,
  CircleHelp,
  Clapperboard,
  ClipboardPaste,
  Clock3,
  FlipHorizontal2,
  Maximize2,
  Mic,
  Minimize2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Square,
  Trash2,
  Video,
  X,
  RectangleHorizontal,
} from "lucide-react";
import {
  type ChangeEvent,
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

function wrapScript(context: CanvasRenderingContext2D, script: string, width: number) {
  return script.split("\n").flatMap((paragraph) => {
    if (!paragraph.trim()) return [""];

    const lines: string[] = [];
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      const nextLine = line ? `${line} ${word}` : word;
      if (line && context.measureText(nextLine).width > width) {
        lines.push(line);
        line = word;
      } else {
        line = nextLine;
      }
    }
    if (line) lines.push(line);
    return lines;
  });
}

type VideoOrientation = "portrait" | "landscape";
type PromptLayout = {
  key: string;
  lines: string[];
  maxScroll: number;
};

function drawTeleprompterOverlay(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  script: string,
  fontSize: number,
  scrollPosition: number,
  stageWidth: number,
  isPlaying: boolean,
  speed: number,
  deltaSeconds: number,
  layout: PromptLayout,
) {
  const padding = stageWidth * 0.045;
  const canvasScale = width / stageWidth;
  const paddingOnCanvas = padding * canvasScale;
  const panelHeight = height * 0.31;
  const fontSizeOnCanvas = fontSize * canvasScale;
  const lineHeight = fontSizeOnCanvas * 1.42;
  const headerSize = 11 * canvasScale;
  const headerHeight = 19 * canvasScale;
  const textWidth = width - paddingOnCanvas * 2;

  context.clearRect(0, 0, width, height);
  context.save();
  const gradient = context.createLinearGradient(0, 0, 0, panelHeight);
  gradient.addColorStop(0, "rgba(14, 17, 15, 0.91)");
  gradient.addColorStop(0.82, "rgba(14, 17, 15, 0.76)");
  gradient.addColorStop(1, "rgba(14, 17, 15, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, panelHeight);

  context.font = `600 ${headerSize}px Arial, sans-serif`;
  context.fillStyle = "rgba(236, 241, 230, 0.78)";
  context.textBaseline = "top";
  context.fillText("READ ALONG", paddingOnCanvas, paddingOnCanvas * 0.72);

  context.font = `500 ${fontSizeOnCanvas}px Arial, sans-serif`;
  context.fillStyle = "#ffffff";
  const contentTop = paddingOnCanvas * 0.72 + headerHeight;
  const visibleHeight = Math.max(lineHeight, panelHeight - contentTop - paddingOnCanvas * 0.7);
  const layoutKey = `${width}:${height}:${stageWidth}:${fontSize}:${script}`;
  if (layout.key !== layoutKey) {
    layout.lines = wrapScript(context, script || "Add your script to see it here.", textWidth);
    layout.maxScroll = Math.max(
      0,
      (layout.lines.length * lineHeight - visibleHeight) / canvasScale,
    );
    layout.key = layoutKey;
  }
  const nextScroll = isPlaying
    ? Math.min(layout.maxScroll, scrollPosition + deltaSeconds * speed * 18)
    : scrollPosition;

  context.beginPath();
  context.rect(paddingOnCanvas, contentTop, textWidth, visibleHeight);
  context.clip();
  layout.lines.forEach((line, index) => {
    const y = contentTop + index * lineHeight - nextScroll * canvasScale;
    context.fillText(line, paddingOnCanvas, y);
  });
  context.restore();

  return nextScroll;
}

function getOrientationConstraints(
  orientation: VideoOrientation,
  requireAspectRatio = false,
): MediaTrackConstraints {
  const portrait = orientation === "portrait";
  const aspectRatio = portrait ? 9 / 16 : 16 / 9;
  return {
    facingMode: { ideal: "user" as const },
    width: { ideal: portrait ? 720 : 1280 },
    height: { ideal: portrait ? 1280 : 720 },
    aspectRatio: requireAspectRatio ? { exact: aspectRatio } : { ideal: aspectRatio },
    frameRate: { ideal: 30, max: 30 },
  };
}

export default function TeleprompterStudio() {
  const [script, setScript] = useState(initialScript);
  const [fontSize, setFontSize] = useState(24);
  const [speed, setSpeed] = useState(1);
  const [orientation, setOrientation] = useState<VideoOrientation>("portrait");
  const [mirror, setMirror] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedMimeType, setRecordedMimeType] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [cameraAspectRatio, setCameraAspectRatio] = useState<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [showScriptEditor, setShowScriptEditor] = useState(false);
  const [scriptActionMessage, setScriptActionMessage] = useState("");
  const [fullscreenFallback, setFullscreenFallback] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scriptInputRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAt = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const scrollPositionRef = useRef(0);
  const canvasHasFrameRef = useRef(false);
  const promptLayoutRef = useRef<PromptLayout>({ key: "", lines: [], maxScroll: 0 });

  useEffect(() => {
    const updateFullscreen = () => {
      const active = document.fullscreenElement === stageRef.current;
      setIsFullscreen(active || fullscreenFallback);
      if (!active && fullscreenFallback) setFullscreenFallback(false);
    };
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, [fullscreenFallback]);

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
    void videoRef.current.play().catch(() => {
      setCameraError("The camera preview couldn't start. Try enabling your camera again.");
    });
  }, [stream]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!stream || !video || !canvas || !context || recordedUrl) return;

    let previousFrame = performance.now();
    const renderFrame = (now: number) => {
      if (now - previousFrame < 1000 / 30) {
        animationRef.current = window.requestAnimationFrame(renderFrame);
        return;
      }

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth && video.videoHeight) {
        const scale = Math.min(1, 1280 / video.videoWidth, 1280 / video.videoHeight);
        const width = Math.max(1, Math.round(video.videoWidth * scale));
        const height = Math.max(1, Math.round(video.videoHeight * scale));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }

        if (!canvasHasFrameRef.current) {
          canvasHasFrameRef.current = true;
          setCanvasReady(true);
        }

        const deltaSeconds = Math.min((now - previousFrame) / 1000, 0.05);
        const stage = stageRef.current?.getBoundingClientRect();
        const stageWidth = Math.max(stage?.width ?? 0, 1);
        const stageHeight = Math.max(stage?.height ?? 0, 1);
        const sourceAspect = video.videoWidth / video.videoHeight;
        const displayedWidth = Math.min(stageWidth, stageHeight * sourceAspect);
        scrollPositionRef.current = drawTeleprompterOverlay(
          context,
          width,
          height,
          script,
          fontSize,
          scrollPositionRef.current,
          displayedWidth,
          isPlaying,
          speed,
          deltaSeconds,
          promptLayoutRef.current,
        );
      }

      previousFrame = now;
      animationRef.current = window.requestAnimationFrame(renderFrame);
    };

    animationRef.current = window.requestAnimationFrame(renderFrame);
    return () => {
      if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    };
  }, [fontSize, isPlaying, recordedUrl, script, speed, stream]);

  useEffect(() => {
    return () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

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

  const requestCamera = async (requestedOrientation: VideoOrientation) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera access requires a secure connection (HTTPS) and a supported browser.");
    }

    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: getOrientationConstraints(requestedOrientation, true),
      });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name !== "OverconstrainedError" && name !== "ConstraintNotSatisfiedError") {
        throw error;
      }
      media = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: getOrientationConstraints(requestedOrientation),
      });
    }

    const settings = media.getVideoTracks()[0]?.getSettings();
    const actualAspectRatio = settings?.aspectRatio ??
      (settings?.width && settings?.height ? settings.width / settings.height : null);
    return { media, actualAspectRatio };
  };

  const handleCameraError = (error: unknown) => {
      const name = error instanceof DOMException ? error.name : "";
      setCameraError(
        name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError"
          ? "This camera cannot provide the requested orientation. Try landscape or use a different camera app/browser."
          :
        name === "NotAllowedError"
          ? "Camera and microphone access was blocked. Allow access in your browser settings and try again."
          : name === "NotFoundError"
            ? "No camera or microphone was found on this device."
            : "We couldn't start your camera. Check that it's not being used by another app.",
      );
  };

  const setCameraAspectWarning = (aspectRatio: number | null, requestedOrientation: VideoOrientation) => {
    if (aspectRatio && Math.abs(aspectRatio - (requestedOrientation === "portrait" ? 9 / 16 : 16 / 9)) > 0.12) {
      setCameraError(
        `Your camera returned a ${aspectRatio.toFixed(2)}:1 video. The preview and saved recording will keep this original framing; this device or browser did not provide the requested ${requestedOrientation} orientation.`,
      );
    }
  };

  const openCamera = async () => {
    setCameraError("");
    setCameraReady(false);
    setCanvasReady(false);
    canvasHasFrameRef.current = false;
    try {
      const result = await requestCamera(orientation);
      setCameraAspectRatio(result.actualAspectRatio);
      setCameraAspectWarning(result.actualAspectRatio, orientation);
      setStream(result.media);
    } catch (error) {
      handleCameraError(error);
    }
  };

  const selectOrientation = async (nextOrientation: VideoOrientation) => {
    if (nextOrientation === orientation) return;
    setOrientation(nextOrientation);
    setCameraError("");
    setCameraAspectRatio(null);
    setCanvasReady(false);
    setCameraReady(false);
    canvasHasFrameRef.current = false;
    scrollPositionRef.current = 0;

    const previousStream = stream;
    setStream(null);
    previousStream?.getTracks().forEach((track) => track.stop());
    if (!previousStream) return;
    try {
      const result = await requestCamera(nextOrientation);
      setCameraAspectRatio(result.actualAspectRatio);
      setCameraAspectWarning(result.actualAspectRatio, nextOrientation);
      setStream(result.media);
    } catch (error) {
      handleCameraError(error);
    }
  };

  const startRecording = () => {
    if (!stream || !canvasReady) return;
    setCameraError("");
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
        if (!chunksRef.current.length) {
          setCameraError("No video data was captured. Please try recording again.");
          return;
        }
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
      scrollPositionRef.current = 0;
      recorder.start(1000);
      setRecording(true);
      setIsPlaying(true);
      setRecordedUrl(null);
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

  const toggleFullscreen = async () => {
    if (document.fullscreenElement === stageRef.current) {
      await document.exitFullscreen();
      return;
    }

    if (fullscreenFallback) {
      setFullscreenFallback(false);
      setIsFullscreen(false);
      return;
    }

    if (stageRef.current?.requestFullscreen) {
      try {
        await stageRef.current.requestFullscreen();
        return;
      } catch {
        setFullscreenFallback(true);
        setIsFullscreen(true);
        return;
      }
    }

    setFullscreenFallback(true);
    setIsFullscreen(true);
  };

  const changeFontSize = (change: number) => {
    setFontSize((size) => Math.min(36, Math.max(16, size + change)));
  };

  const onScriptChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setScript(event.target.value);
    scrollPositionRef.current = 0;
    setScriptActionMessage("");
  };

  const pasteScript = async () => {
    if (!navigator.clipboard?.readText) {
      setScriptActionMessage("Clipboard access isn't available here. Paste your script directly into the text box.");
      return;
    }

    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText) {
        setScriptActionMessage("Your clipboard is empty.");
        return;
      }
      setScript(clipboardText);
      scrollPositionRef.current = 0;
      setScriptActionMessage("Script pasted from clipboard.");
      scriptInputRef.current?.focus();
    } catch {
      setScriptActionMessage("Clipboard access was blocked. Allow clipboard permission or paste directly into the text box.");
    }
  };

  const previewOrientation = cameraAspectRatio
    ? cameraAspectRatio < 1 ? "portrait" : "landscape"
    : orientation;

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
                  {showScriptEditor ? "Done editing" : "Edit script"}
                </Button>
              </div>
            </div>

            <div className="mb-4 rounded-xl bg-[#f5f6f3] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-[#555b4f]">Prompt is for preview only; saved video is clean</span>
                <span className="text-muted-foreground">{script.trim() ? script.trim().split(/\s+/).length : 0} words</span>
              </div>
              {showScriptEditor && (
                <div className="mt-3">
                  <div className="script-editor-actions mb-2 flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 bg-white text-xs"
                      onClick={pasteScript}
                    >
                      <ClipboardPaste size={14} />
                      Paste
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 bg-white text-muted-foreground"
                      onClick={() => {
                        setScript("");
                        scrollPositionRef.current = 0;
                        setScriptActionMessage("Script cleared.");
                        scriptInputRef.current?.focus();
                      }}
                      aria-label="Clear script"
                      title="Clear all script text"
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                  <textarea
                    ref={scriptInputRef}
                    className="block min-h-24 w-full resize-y rounded-lg border border-[#e5e7e2] bg-white px-3 py-2.5 text-sm leading-6 text-[#383b35] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={script}
                    onChange={onScriptChange}
                    aria-label="Teleprompter script"
                    placeholder="Paste or type your script here…"
                  />
                  {scriptActionMessage && (
                    <p role="status" className="mb-0 mt-2 text-xs text-muted-foreground">
                      {scriptActionMessage}
                    </p>
                  )}
                </div>
              )}
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

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#edf1e9] text-[#728367]"><span className="text-xs">02</span></span>
                Camera preview
              </div>
              <div className="flex items-center gap-1">
                <div className="camera-orientation-selector flex items-center rounded-lg bg-[#f4f5f2] p-0.5" role="group" aria-label="Request camera orientation">
                  <button
                    type="button"
                    className={`flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition ${orientation === "portrait" ? "bg-white text-[#34382f] shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => void selectOrientation("portrait")}
                    aria-pressed={orientation === "portrait"}
                    disabled={recording || Boolean(recordedUrl)}
                  >
                    <Smartphone size={14} /> Portrait
                  </button>
                  <button
                    type="button"
                    className={`flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition ${orientation === "landscape" ? "bg-white text-[#34382f] shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => void selectOrientation("landscape")}
                    aria-pressed={orientation === "landscape"}
                    disabled={recording || Boolean(recordedUrl)}
                  >
                    <RectangleHorizontal size={14} /> Landscape
                  </button>
                </div>
                <button
                  onClick={() => setMirror(!mirror)}
                  className={`camera-mirror-button flex h-9 items-center gap-2 rounded-lg px-2 sm:px-3 text-xs font-medium transition ${mirror ? "bg-[#edf1e9] text-[#526547]" : "text-muted-foreground hover:bg-[#f4f5f2]"}`}
                  aria-pressed={mirror}
                >
                  <FlipHorizontal2 size={15} />
                  <span className="hidden sm:inline">Mirror</span>
                </button>
              </div>
            </div>

            <div
              ref={stageRef}
              className={`camera-stage orientation-${previewOrientation}${fullscreenFallback ? " fallback-fullscreen" : ""}`}
              style={cameraAspectRatio ? { aspectRatio: cameraAspectRatio } : undefined}
            >
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`camera-live-video${mirror ? " mirrored" : ""}`}
                aria-hidden="true"
                onLoadedMetadata={(event) => {
                  const video = event.currentTarget;
                  setCameraReady(true);
                  if (video.videoWidth && video.videoHeight) {
                    setCameraAspectRatio(video.videoWidth / video.videoHeight);
                  }
                }}
              />
              {!recordedUrl && (
                <canvas
                  ref={canvasRef}
                  className="camera-composite"
                  aria-label="Live camera preview with scrolling teleprompter"
                />
              )}
              {recordedUrl && !recording ? (
                <video
                  src={recordedUrl}
                  controls
                  playsInline
                  className="recorded-video"
                  aria-label="Recorded video without teleprompter overlay"
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
              {stream && !canvasReady && !recordedUrl && (
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
                aria-label={isFullscreen ? "Exit fullscreen preview" : "Fullscreen preview"}
                onClick={() => void toggleFullscreen()}
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <div className="fullscreen-actions">
                <span className="text-xs font-medium text-white/80">
                  {recording ? `REC ${formatTime(elapsed)}` : `Ready · ${orientation}`}
                </span>
                <div className="flex items-center gap-2">
                  {recording ? (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-10 bg-white/15 text-white hover:bg-white/25"
                        onClick={() => setIsPlaying(!isPlaying)}
                      >
                        {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                        {isPlaying ? "Pause prompt" : "Resume prompt"}
                      </Button>
                      <Button variant="destructive" size="sm" className="h-10" onClick={stopRecording}>
                        <Square size={13} fill="currentColor" /> Stop
                      </Button>
                    </>
                  ) : recordedUrl ? (
                    <Button size="sm" className="h-10" onClick={downloadRecording}>
                      <ArrowDownToLine size={15} /> Save video
                    </Button>
                  ) : stream ? (
                    <Button
                      size="sm"
                      className="h-10"
                      onClick={startRecording}
                      disabled={!canvasReady || !cameraReady}
                    >
                      <span className="h-2 w-2 rounded-full bg-[#f17a71]" /> Start recording
                    </Button>
                  ) : (
                    <Button size="sm" className="h-10" onClick={openCamera}>
                      <Video size={15} /> Enable camera
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {cameraError && (
              <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">
                <X size={15} className="mt-0.5 shrink-0" />
                {cameraError}
              </div>
            )}

            <div className="camera-action-row mt-4 flex flex-wrap items-center justify-between gap-3">
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
                      {isPlaying ? "Pause prompter" : "Resume prompter"}
                    </Button>
                    <Button variant="destructive" className="flex-1 sm:flex-none" onClick={stopRecording}>
                      <Square size={14} fill="currentColor" />
                      Finish take
                    </Button>
                  </>
                ) : recordedUrl ? (
                  <>
                    <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => {
                      setRecordedUrl(null);
                      setRecordedMimeType("");
                      setElapsed(0);
                      setCanvasReady(false);
                      canvasHasFrameRef.current = false;
                    }}>
                      <RotateCcw size={15} /> Retake
                    </Button>
                    <Button className="flex-1 sm:flex-none" onClick={downloadRecording}>
                      <ArrowDownToLine size={16} /> Save video
                    </Button>
                  </>
                ) : stream ? (
                  <Button className="flex-1 sm:flex-none" onClick={startRecording} disabled={!canvasReady || !cameraReady}>
                    <span className="h-2.5 w-2.5 rounded-full bg-[#f17a71]" />
                    {canvasReady && cameraReady ? "Start recording" : "Preparing preview…"}
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
                  <p className="m-0 text-xs leading-5 text-muted-foreground">The scrolling prompt is only on your preview. Your saved video contains the camera and microphone, without script text.</p>
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
      {!isFullscreen && (
        <div className="mobile-recording-dock" role="group" aria-label="Mobile recording controls">
          <div className="mobile-dock-status">
            {recording ? (
              <>
                <span className="recording-pulse h-2 w-2 rounded-full bg-[#e16a61]" />
                <span>{formatTime(elapsed)}</span>
              </>
            ) : recordedUrl ? (
              <>
                <Check size={15} />
                <span>Take ready</span>
              </>
            ) : (
              <>
                <Video size={15} />
                <span>{stream ? "Camera ready" : "Ready to record"}</span>
              </>
            )}
          </div>
          <div className="mobile-dock-actions">
            {recording ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-12 flex-1"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  {isPlaying ? "Pause prompt" : "Resume prompt"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="min-h-12 flex-1"
                  onClick={stopRecording}
                >
                  <Square size={14} fill="currentColor" />
                  Stop
                </Button>
              </>
            ) : recordedUrl ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-12 flex-1"
                  onClick={() => {
                    setRecordedUrl(null);
                    setRecordedMimeType("");
                    setElapsed(0);
                    setCanvasReady(false);
                    canvasHasFrameRef.current = false;
                  }}
                >
                  <RotateCcw size={15} /> Retake
                </Button>
                <Button type="button" className="min-h-12 flex-1" onClick={downloadRecording}>
                  <ArrowDownToLine size={16} /> Save video
                </Button>
              </>
            ) : stream ? (
              <Button
                type="button"
                className="min-h-12 w-full"
                onClick={startRecording}
                disabled={!canvasReady || !cameraReady}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-[#f17a71]" />
                {canvasReady && cameraReady ? "Start recording" : "Preparing camera…"}
              </Button>
            ) : (
              <Button type="button" className="min-h-12 w-full" onClick={openCamera}>
                <Video size={16} /> Enable camera
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
