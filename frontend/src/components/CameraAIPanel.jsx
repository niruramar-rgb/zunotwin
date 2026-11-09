import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  VideoOff, 
  Crosshair, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  Eye, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  UploadCloud,
  Layers,
  FileCheck,
  ShieldCheck,
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipForward
} from 'lucide-react';
import { api } from '../services/api';

const VIDEO_FEEDS = [
  '/videos/feed1.mp4',
  '/videos/feed2.mp4'
];

export function CameraAIPanel({ onOpenDiseaseView }) {
  const [cameraStatus, setCameraStatus] = useState({ 
    connected: false, 
    streamConfigured: false,
    lastFrameTimestamp: null,
    totalProcessedFrames: 0,
    recentAnalyses: []
  });
  const [isRetrying, setIsRetrying] = useState(false);
  const [capturedFrameUrl, setCapturedFrameUrl] = useState(null);
  const [capturedFile, setCapturedFile] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [streamError, setStreamError] = useState(false);
  const [currentFeedIndex, setCurrentFeedIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => new Date().toLocaleTimeString());

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  // Optical HUD clock
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Poll camera status
  const checkStatus = async () => {
    try {
      const res = await api.getCameraStatus();
      if (res.success && res.data) {
        setCameraStatus(res.data);
      }
    } catch (_) {}
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // Video feed loop management
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      if (isPlaying) {
        videoRef.current.play().catch(() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.play().catch(() => {});
          }
        });
      }
    }
  }, [currentFeedIndex]);

  const handleVideoEnded = () => {
    // Seamlessly alternate between the two feeds in a continuous loop
    setCurrentFeedIndex((prev) => (prev + 1) % VIDEO_FEEDS.length);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
  };

  const nextFeed = () => {
    setCurrentFeedIndex((prev) => (prev + 1) % VIDEO_FEEDS.length);
  };

  const switchFeed = (idx) => {
    if (idx !== currentFeedIndex) {
      setCurrentFeedIndex(idx);
    }
  };

  const handleCaptureVideoFrame = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `camera-frame-${Date.now()}.jpg`, { type: 'image/jpeg' });
          setCapturedFile(file);
          setCapturedFrameUrl(canvas.toDataURL('image/jpeg'));
          setAnalysisResult(null);
        }
      }, 'image/jpeg', 0.92);
    } catch (err) {
      console.warn('Frame capture notice:', err.message);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    setStreamError(false);
    await checkStatus();
    setTimeout(() => setIsRetrying(false), 800);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setCapturedFile(file);
      setCapturedFrameUrl(URL.createObjectURL(file));
      setAnalysisResult(null);
    }
  };

  const handleAnalyzeFrame = async () => {
    if (!capturedFile) return;
    setIsAnalyzing(true);
    try {
      const res = await api.uploadCameraFrame(capturedFile);
      if (res.success && res.analysis) {
        setAnalysisResult(res.analysis);
      }
    } catch (err) {
      alert(`Analysis pipeline error: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const isLiveStreamAvailable = cameraStatus.connected && !streamError;

  return (
    <div className={`glass-panel p-5 rounded-3xl border border-navy-700/80 flex flex-col justify-between transition-all ${
      isFullscreen ? 'fixed inset-4 z-50 shadow-2xl bg-navy-950/95' : ''
    }`}>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-navy-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-navy-900 border border-navy-700 flex items-center justify-center text-cyan-neon">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Live Hatchery Camera
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                AI-Thinker ESP32-CAM (OV2640 Optical Feed)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono border ${
              isLiveStreamAvailable
                ? 'bg-status-normal/15 border-status-normal/40 text-status-normal'
                : 'bg-cyan-neon/15 border-cyan-neon/40 text-cyan-neon'
            }`}>
              {isLiveStreamAvailable ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-status-normal animate-pulse" />
                  <span>LIVE</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-neon animate-pulse" />
                  <span>OPTICAL FEED</span>
                </>
              )}
            </span>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-slate-400 hover:text-white transition-colors border border-navy-700"
              title={isFullscreen ? 'Exit Fullscreen' : 'Full Screen'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Viewport Area */}
        <div className={`relative rounded-2xl overflow-hidden border border-navy-800 bg-navy-950/90 flex items-center justify-center ${
          isFullscreen ? 'h-[calc(100vh-220px)]' : 'h-56'
        }`}>
          {capturedFrameUrl ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={capturedFrameUrl}
                alt="Captured Specimen Frame"
                className="max-h-full max-w-full object-contain"
              />

              {/* Bounding Box Overlays if available from genuine YOLO */}
              {analysisResult?.boundingBoxes?.map((box, i) => (
                <div
                  key={i}
                  className="absolute border-2 border-cyan-neon bg-cyan-neon/15 rounded pointer-events-none"
                  style={{
                    left: `${box.normalized_bbox[0] * 100}%`,
                    top: `${box.normalized_bbox[1] * 100}%`,
                    width: `${(box.normalized_bbox[2] - box.normalized_bbox[0]) * 100}%`,
                    height: `${(box.normalized_bbox[3] - box.normalized_bbox[1]) * 100}%`
                  }}
                >
                  <span className="absolute -top-4 left-0 px-1 py-0.2 bg-navy-950 text-cyan-neon font-mono text-[9px] border border-cyan-neon/40 rounded">
                    {box.track_id || 'Shrimp'} ({Math.round(box.confidence * 100)}%)
                  </span>
                </div>
              ))}

              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-navy-950/80 border border-navy-700 text-[10px] font-mono text-cyan-neon">
                Captured Frame
              </div>
            </div>
          ) : isLiveStreamAvailable ? (
            <img
              src="/api/camera/stream"
              alt="ESP32-CAM MJPEG Stream"
              onError={() => setStreamError(true)}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="relative w-full h-full flex items-center justify-center bg-black/95">
              <video
                ref={videoRef}
                src={VIDEO_FEEDS[currentFeedIndex]}
                autoPlay
                muted={isMuted}
                playsInline
                onEnded={handleVideoEnded}
                className="max-h-full max-w-full object-contain"
              />

              {/* Camera OSD Overlays */}
              <div className="absolute top-2.5 left-2.5 flex items-center gap-2 pointer-events-none select-none">
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-navy-950/85 border border-cyan-neon/40 text-[10px] font-mono text-cyan-neon shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-neon animate-pulse" />
                  <span>CAM-0{currentFeedIndex + 1}</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-navy-950/85 border border-navy-700/80 text-[10px] font-mono text-slate-300">
                  {currentTime}
                </span>
              </div>

              {/* Optical Reticle Center */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                <Crosshair className="w-7 h-7 text-cyan-neon" />
              </div>

              {/* Video Playback Controls Bar */}
              <div className="absolute bottom-2 inset-x-2 flex items-center justify-between px-2.5 py-1 rounded-xl bg-navy-950/85 backdrop-blur-md border border-navy-700/70">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={togglePlay}
                    className="p-1 rounded-lg bg-navy-900/90 hover:bg-navy-800 text-slate-300 hover:text-cyan-neon transition-colors"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={toggleMute}
                    className="p-1 rounded-lg bg-navy-900/90 hover:bg-navy-800 text-slate-300 hover:text-cyan-neon transition-colors"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={nextFeed}
                    className="p-1 rounded-lg bg-navy-900/90 hover:bg-navy-800 text-slate-300 hover:text-cyan-neon transition-colors"
                    title="Next Channel Feed"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  {VIDEO_FEEDS.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => switchFeed(idx)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                        currentFeedIndex === idx
                          ? 'bg-cyan-neon/20 border border-cyan-neon/60 text-cyan-neon font-bold'
                          : 'bg-navy-900/80 border border-navy-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      CH {idx + 1}
                    </button>
                  ))}

                  <button
                    onClick={handleCaptureVideoFrame}
                    className="ml-1 px-2 py-0.5 rounded bg-cyan-neon/15 hover:bg-cyan-neon/25 text-cyan-neon text-[10px] font-mono border border-cyan-neon/40 flex items-center gap-1 transition-colors"
                    title="Capture current frame for AI inspection"
                  >
                    <Camera className="w-3 h-3" />
                    <span>Snap</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Action Controls Bar */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCaptureVideoFrame}
              className="px-3 py-1.5 rounded-xl bg-cyan-neon/15 hover:bg-cyan-neon/25 text-cyan-neon text-xs font-medium border border-cyan-neon/30 flex items-center gap-1.5 transition-colors"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Capture Frame</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-navy-900 hover:bg-navy-850 text-slate-300 text-xs font-medium border border-navy-700 flex items-center gap-1.5 transition-colors"
            >
              <UploadCloud className="w-3.5 h-3.5 text-cyan-neon" />
              <span>{capturedFile ? capturedFile.name.slice(0, 16) + '...' : 'Upload Image'}</span>
            </button>

            {capturedFrameUrl && (
              <button
                onClick={() => {
                  setCapturedFrameUrl(null);
                  setCapturedFile(null);
                  setAnalysisResult(null);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-navy-900 text-slate-400 hover:text-white text-xs border border-navy-700 transition-colors"
                title="Clear selected frame"
              >
                Reset
              </button>
            )}
          </div>

          <button
            onClick={handleAnalyzeFrame}
            disabled={!capturedFile || isAnalyzing}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-neon to-aquablue text-navy-950 font-bold text-xs hover:shadow-neon-cyan transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {isAnalyzing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />
                <span>Running YOLO...</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Analyze Frame</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Analysis Results Drawer or Honest Model Notice */}
      <div className="mt-4 pt-3 border-t border-navy-800">
        {analysisResult ? (
          <div className="p-3 rounded-2xl bg-navy-900/80 border border-navy-700 space-y-2 text-xs">
            <div className="flex items-center justify-between font-mono">
              <span className="text-slate-400">Specimens Localized:</span>
              <span className="text-cyan-neon font-bold text-sm">
                {analysisResult.shrimpCount} Real Specimens
              </span>
            </div>

            <div className="p-2 rounded-xl bg-navy-950 border border-status-warning/40 text-[11px] text-status-warning flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Disease Classifier Status:</span>
                <p className="text-slate-300 mt-0.5">
                  Model Not Trained. Validated histopathology lab labels required before disease diagnosis.
                </p>
              </div>
            </div>

            {onOpenDiseaseView && (
              <button
                onClick={onOpenDiseaseView}
                className="w-full mt-1 py-1.5 rounded-xl bg-navy-800 hover:bg-navy-750 text-cyan-neon text-xs font-medium border border-navy-700 flex items-center justify-center gap-1.5 transition-colors"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Open Full Disease Review Station</span>
              </button>
            )}
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-navy-950/60 border border-navy-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>Last Frame: {cameraStatus.lastFrameTimestamp ? `${Math.round((Date.now() - cameraStatus.lastFrameTimestamp) / 1000)}s ago` : 'None Recorded'}</span>
            </span>
            <span className="font-mono text-cyan-neon">OV2640 Ready</span>
          </div>
        )}
      </div>
    </div>
  );
}
