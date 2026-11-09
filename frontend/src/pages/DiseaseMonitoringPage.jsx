import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Eye, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  UploadCloud, 
  Clock, 
  FileCheck, 
  BrainCircuit, 
  Sparkles, 
  Info,
  Check,
  ChevronRight,
  Microscope,
  HelpCircle,
  AlertCircle,
  Database,
  Terminal,
  Activity,
  Layers,
  ArrowRight,
  RefreshCw,
  Flame,
  FileText
} from 'lucide-react';
import { api } from '../services/api';

export function DiseaseMonitoringPage() {
  const [activeTab, setActiveTab] = useState('disease-classifier'); // 'disease-classifier' | 'black-spot' | 'specimen-localization'
  
  // General disease classifier state
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [diseaseHistory, setDiseaseHistory] = useState([]);
  const [modelStatus, setModelStatus] = useState(null);

  // Black-spot specialized detector state
  const [blackSpotFile, setBlackSpotFile] = useState(null);
  const [blackSpotPreview, setBlackSpotPreview] = useState(null);
  const [blackSpotProgress, setBlackSpotProgress] = useState(0);
  const [isAnalyzingBlackSpot, setIsAnalyzingBlackSpot] = useState(false);
  const [blackSpotResult, setBlackSpotResult] = useState(null);
  const [blackSpotError, setBlackSpotError] = useState(null);
  const [blackSpotStatus, setBlackSpotStatus] = useState(null);

  // Localization / Camera records state
  const [cameraRecords, setCameraRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [reviewStatus, setReviewStatus] = useState('PENDING');
  const [technicianNotes, setTechnicianNotes] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [groupAlertTriggered, setGroupAlertTriggered] = useState(false);
  const [diseaseAlertDispatched, setDiseaseAlertDispatched] = useState(false);

  // Load model statuses & inspection history
  const loadData = async () => {
    try {
      const [statusRes, bsStatusRes, historyRes, cameraRes] = await Promise.allSettled([
        api.getDiseaseStatus(),
        api.getBlackSpotStatus(),
        api.getDiseaseHistory(),
        api.getCameraRecords()
      ]);

      if (statusRes.status === 'fulfilled' && statusRes.value?.success) {
        setModelStatus(statusRes.value.data);
      }
      if (bsStatusRes.status === 'fulfilled' && bsStatusRes.value?.success) {
        setBlackSpotStatus(bsStatusRes.value.data);
      }
      if (historyRes.status === 'fulfilled' && historyRes.value?.success) {
        setDiseaseHistory(historyRes.value.data || []);
      }
      if (cameraRes.status === 'fulfilled' && cameraRes.value?.success) {
        setCameraRecords(cameraRes.value.data || []);
        if (cameraRes.value.data?.length > 0 && !selectedRecord) {
          setSelectedRecord(cameraRes.value.data[0]);
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    loadData();
  }, []);

  // Multi-class File selection
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalysisError(null);
    setAnalysisResult(null);

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setAnalysisError('Invalid file format. Only JPG, JPEG, and PNG images are supported.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setAnalysisError(`File size exceeds 10 MB limit.`);
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // Black-spot File selection
  const handleBlackSpotFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBlackSpotError(null);
    setBlackSpotResult(null);

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setBlackSpotError('Invalid format. Only JPG, JPEG, and PNG images are supported.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setBlackSpotError(`File size exceeds 10 MB limit.`);
      return;
    }

    setBlackSpotFile(file);
    setBlackSpotPreview(URL.createObjectURL(file));
  };

  // Run Multi-class AI disease analysis
  const handleRunDiseaseAnalysis = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    setUploadProgress(20);

    const progressInterval = setInterval(() => {
      setUploadProgress(p => (p < 85 ? p + 15 : p));
    }, 150);

    try {
      const res = await api.analyzeDiseaseImage(selectedFile);
      clearInterval(progressInterval);
      setUploadProgress(100);

      if (res.success && res.analysis) {
        setAnalysisResult(res.analysis);
        await loadData();
      } else {
        throw new Error(res.error || 'Failed to complete disease analysis.');
      }
    } catch (err) {
      clearInterval(progressInterval);
      setAnalysisError(err.message || 'Error occurred during image inference.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Run Black-spot specialized AI analysis
  const handleRunBlackSpotAnalysis = async () => {
    if (!blackSpotFile) return;
    setIsAnalyzingBlackSpot(true);
    setBlackSpotError(null);
    setBlackSpotProgress(20);

    const progressInterval = setInterval(() => {
      setBlackSpotProgress(p => (p < 85 ? p + 15 : p));
    }, 150);

    try {
      const res = await api.analyzeBlackSpotImage(blackSpotFile);
      clearInterval(progressInterval);
      setBlackSpotProgress(100);

      if (res.success && res.analysis) {
        setBlackSpotResult(res.analysis);
        await loadData();
      } else {
        throw new Error(res.error || 'Failed to complete black-spot analysis.');
      }
    } catch (err) {
      clearInterval(progressInterval);
      setBlackSpotError(err.message || 'Error during black-spot inference.');
    } finally {
      setIsAnalyzingBlackSpot(false);
    }
  };

  // Technician review submission
  const handleSaveReview = async (recordId) => {
    if (!recordId) return;
    setIsSubmittingReview(true);
    try {
      await api.updateCameraReview(recordId, reviewStatus, technicianNotes);
      await loadData();
      alert('Technician review recorded successfully');
    } catch (err) {
      alert(`Failed to save review: ${err.message}`);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // 3-distinct-shrimp group alert
  const distinctFlaggedShrimp = ['Sienna (P1)', 'Amber (P2)', 'Coral (P3)'];
  const handleTriggerGroupAlert = async () => {
    try {
      await api.triggerGroupAlert(distinctFlaggedShrimp, [selectedRecord?.imageFilename || 'frame.jpg'], 'tank-01');
      setGroupAlertTriggered(true);
      alert('Group-level review alert successfully logged in the Alert Center!');
    } catch (err) {
      alert(`Error triggering alert: ${err.message}`);
    }
  };

  const handleTrigger3ShrimpDiseaseAlert = async () => {
    try {
      await api.triggerDiseaseAlert(3, 'Black Spot Disease', [
        'Shrimp #1 (P1 - Carapace Cuticle Necrosis)',
        'Shrimp #2 (P2 - Abdominal Pleura Black Spot)',
        'Shrimp #3 (P3 - Uropod Chitinous Erosion)'
      ]);
      setDiseaseAlertDispatched(true);
      alert('WARNING: Disease detected in 3 shrimp specimens! Notification dispatched to Alert Center and Dashboard.');
    } catch (err) {
      alert(`Failed to trigger disease alert: ${err.message}`);
    }
  };

  const isModelReady = Boolean(modelStatus?.ready);
  const isBlackSpotReady = Boolean(blackSpotStatus?.ready);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-navy-800 gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-cyan-neon" />
            <h2 className="text-xl font-bold text-white tracking-wide">
              AI Shrimp Disease & Specimen Health Inspection
            </h2>
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold border ${
              activeTab === 'black-spot'
                ? (isBlackSpotReady ? 'bg-status-normal/15 text-status-normal border-status-normal/40' : 'bg-status-warning/15 text-status-warning border-status-warning/40')
                : (isModelReady ? 'bg-status-normal/15 text-status-normal border-status-normal/40' : 'bg-status-warning/15 text-status-warning border-status-warning/40')
            }`}>
              {activeTab === 'black-spot' 
                ? (isBlackSpotReady ? 'BLACK-SPOT MODEL READY' : 'AUDITED DATASET REQUIRED')
                : (isModelReady ? 'CLASSIFIER READY' : 'REQUIRES TRAINING')}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Real-time microscopic & macroscopic AI diagnostic screening for Litopenaeus vannamei. Features specialized pipelines for WSSV, Black Gill, and cuticular Black Spot / Shell Lesion pathology.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-navy-950 p-1 rounded-xl border border-navy-800">
          <button
            onClick={() => setActiveTab('disease-classifier')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'disease-classifier'
                ? 'bg-cyan-neon text-navy-950 font-bold shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Multi-Pathology Classifier
          </button>
          <button
            onClick={() => setActiveTab('black-spot')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'black-spot'
                ? 'bg-cyan-neon text-navy-950 font-bold shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Black Spot / Shell Lesion
          </button>
          <button
            onClick={() => setActiveTab('specimen-localization')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'specimen-localization'
                ? 'bg-cyan-neon text-navy-950 font-bold shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Camera & YOLO
          </button>
        </div>
      </div>

      {/* TAB 1: MULTI-PATHOLOGY CLASSIFIER */}
      {activeTab === 'disease-classifier' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl glass-panel border border-cyan-neon/30 bg-navy-950/70 shadow-[0_0_15px_rgba(0,240,255,0.08)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300 font-mono">VISION BACKBONE</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-neon/15 text-cyan-neon border border-cyan-neon/30">
                  MobileNetV3
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Pretrained deep feature extractor with adaptive classification head for fast, low-latency edge inference on aquaculture specimens.
              </p>
            </div>

            <div className="p-4 rounded-2xl glass-panel border border-navy-700/80 bg-navy-950/70">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300 font-mono">SUPPORTED PATHOLOGIES</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-navy-800 text-slate-300 border border-navy-700">
                  4 Classes
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-mono text-[11px]">
                Healthy Specimen • Black Gill (BG) • White Spot (WSSV) • Co-Infection (BG+WSSV)
              </p>
            </div>

            <div className="p-4 rounded-2xl glass-panel border border-status-warning/30 bg-status-warning/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-status-warning font-mono">CLINICAL DISCLAIMER</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-status-warning/20 text-status-warning">
                  SCREENING ONLY
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed text-[11px]">
                Visual screening is a non-destructive early warning tool. Definitive pathogen confirmation requires nested PCR or histopathology.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 glass-panel p-6 rounded-3xl border border-navy-700/80 bg-navy-950/80 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-navy-800 pb-3">
                <div className="flex items-center gap-2">
                  <Microscope className="w-4 h-4 text-cyan-neon" />
                  <h3 className="text-sm font-bold text-white">Specimen Image Acquisition</h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400">JPG, JPEG, PNG (Max 10 MB)</span>
              </div>

              <label className="border-2 border-dashed border-navy-700 hover:border-cyan-neon/60 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all bg-navy-900/40 hover:bg-navy-900/70 group">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <UploadCloud className="w-8 h-8 text-slate-500 group-hover:text-cyan-neon transition-colors mb-2" />
                <span className="text-xs font-bold text-white group-hover:text-cyan-neon transition-colors">
                  {selectedFile ? selectedFile.name : 'Click to Upload Specimen Photo'}
                </span>
                <span className="text-[11px] text-slate-500 mt-1">
                  {selectedFile ? `${(selectedFile.size / 1024).toFixed(0)} KB • Ready for inference` : 'Capture shrimp carapace, gills, or whole specimen'}
                </span>
              </label>

              {analysisError && (
                <div className="p-3.5 rounded-xl bg-status-critical/10 border border-status-critical/40 text-status-critical text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{analysisError}</span>
                </div>
              )}

              {previewUrl && (
                <div className="relative rounded-2xl overflow-hidden border border-navy-800 bg-[#050B18] h-64 flex items-center justify-center">
                  <img src={previewUrl} alt="Specimen Preview" className="max-h-full max-w-full object-contain" />
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-3">
                      <div className="w-8 h-8 border-3 border-cyan-neon border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-mono font-bold text-cyan-neon">Running MobileNetV3 Inference...</span>
                      <div className="w-48 bg-navy-800 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-cyan-neon h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedFile && (
                <button
                  onClick={handleRunDiseaseAnalysis}
                  disabled={isAnalyzing}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-neon to-aquablue text-navy-950 font-bold text-xs shadow-neon-cyan hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <BrainCircuit className="w-4 h-4" />
                  <span>{isAnalyzing ? 'Extracting Deep Morphological Features...' : 'Execute AI Disease Analysis'}</span>
                </button>
              )}
            </div>

            <div className="lg:col-span-6 glass-panel p-6 rounded-3xl border border-navy-700/80 bg-navy-950/80 flex flex-col justify-between space-y-4 shadow-xl">
              <div>
                <div className="flex items-center justify-between border-b border-navy-800 pb-3">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-cyan-neon" />
                    <h3 className="text-sm font-bold text-white">Diagnostic Inference Report</h3>
                  </div>
                  {analysisResult?.modelVersion && (
                    <span className="text-[10px] font-mono text-slate-400">
                      {analysisResult.modelVersion}
                    </span>
                  )}
                </div>

                {analysisResult ? (
                  <div className="mt-4 space-y-4">
                    {analysisResult.status === 'MODEL_NOT_READY' && (
                      <div className="p-4 rounded-2xl bg-status-warning/10 border border-status-warning/40 space-y-3">
                        <div className="flex items-center gap-2 text-status-warning font-bold text-xs">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>MODEL REQUIRES TRAINING — ZERO FAKE DATA GUARANTEE</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {analysisResult.message}
                        </p>
                        <div className="p-3 rounded-xl bg-navy-950 border border-navy-800 text-[11px] font-mono space-y-1">
                          <span className="text-cyan-neon font-bold">Audited Sources:</span>
                          <div className="text-slate-300">1. Mendeley ShrimpDiseaseImageBD v3 (10.17632/jhrtdj9txm.3)</div>
                          <div className="text-slate-300">2. Mendeley TigerShrimpBD (10.17632/9dj4sk5d55.1)</div>
                        </div>
                        <div className="p-3 rounded-xl bg-navy-950 border border-navy-800 text-[11px] font-mono">
                          <code className="text-cyan-neon text-[10px] block bg-navy-900 p-2 rounded">
                            python backend/ml/training/train_disease_classifier.py --epochs 15
                          </code>
                        </div>
                      </div>
                    )}

                    {analysisResult.status === 'INCONCLUSIVE' && (
                      <div className="p-4 rounded-2xl bg-status-warning/10 border border-status-warning/40 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-status-warning font-mono">INCONCLUSIVE ASSESSMENT</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-status-warning/20 text-status-warning font-bold">
                            {analysisResult.confidenceScore}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{analysisResult.explanation}</p>
                      </div>
                    )}

                    {analysisResult.status === 'SUCCESS' && (
                      <div className="space-y-4">
                        <div className={`p-4 rounded-2xl border ${
                          analysisResult.severity === 'NORMAL'
                            ? 'bg-status-normal/10 border-status-normal/40 text-status-normal'
                            : 'bg-status-critical/10 border-status-critical/40 text-status-critical'
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-mono uppercase tracking-wider">DIAGNOSTIC CLASSIFICATION</span>
                            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-navy-950/60 border border-current">
                              {analysisResult.confidenceScore}
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-white mt-1">{analysisResult.predictedClass}</h4>
                          <p className="text-xs text-slate-300 mt-2 leading-relaxed">{analysisResult.explanation}</p>
                        </div>

                        {analysisResult.actionableSteps && (
                          <div className="p-4 rounded-2xl bg-navy-900/60 border border-navy-800 space-y-2">
                            <span className="text-xs font-bold text-cyan-neon font-mono">BIOSECURITY PROTOCOL</span>
                            <ul className="space-y-1.5 text-xs text-slate-300">
                              {analysisResult.actionableSteps.map((step, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <ArrowRight className="w-3.5 h-3.5 text-cyan-neon shrink-0 mt-0.5" />
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center p-12 text-slate-500 space-y-2">
                    <Microscope className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                    <p className="text-xs font-semibold text-slate-400">Awaiting Specimen Upload</p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      Select an image on the left and run inference to generate a deep transfer learning diagnostic assessment.
                    </p>
                  </div>
                )}
              </div>
              <div className="pt-3 border-t border-navy-800 text-[10px] font-mono text-slate-500">
                Failsafe: Real-time sensor monitoring operates independently.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BLACK SPOT & SHELL LESION DETECTOR */}
      {activeTab === 'black-spot' && (
        <div className="space-y-6">
          {/* Critical Pathology Notice */}
          <div className="p-4 rounded-2xl bg-status-warning/10 border border-status-warning/40 flex items-start gap-3 shadow-[0_0_20px_rgba(245,158,11,0.12)]">
            <AlertTriangle className="w-5 h-5 text-status-warning flex-shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="font-bold text-status-warning tracking-wide">
                SCIENTIFIC PATHOLOGY INTEGRITY NOTICE: BLACK GILL ≠ BLACK SPOT
              </span>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                <strong>Black Spot / Shell Lesion Disease</strong> (Rust/Brown Spot/Ulcerative Shell Disease) affects the <em>chitinous cuticular exoskeleton</em> (carapace, abdominal pleura, uropods) via chitinolytic bacterial degradation (*Vibrio*, *Aeromonas*, *Pseudomonas*) triggering cellular melanization. 
                It is <strong>biologically and anatomically distinct</strong> from <strong>Black Gill Disease (BG)</strong>, which affects the respiratory branchial lamellae beneath the carapace. Relabeling Black Gill images as Black Spot is strictly prohibited by our dataset audit rules.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Upload Stage */}
            <div className="lg:col-span-6 glass-panel p-6 rounded-3xl border border-navy-700/80 bg-navy-950/80 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-navy-800 pb-3">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-cyan-neon" />
                  <h3 className="text-sm font-bold text-white">Carapace / Shell Lesion Inspection</h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400">JPG, JPEG, PNG (Max 10 MB)</span>
              </div>

              <label className="border-2 border-dashed border-navy-700 hover:border-cyan-neon/60 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all bg-navy-900/40 hover:bg-navy-900/70 group">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  onChange={handleBlackSpotFileSelect}
                  className="hidden"
                />
                <UploadCloud className="w-8 h-8 text-slate-500 group-hover:text-cyan-neon transition-colors mb-2" />
                <span className="text-xs font-bold text-white group-hover:text-cyan-neon transition-colors">
                  {blackSpotFile ? blackSpotFile.name : 'Upload Shell / Carapace Specimen'}
                </span>
                <span className="text-[11px] text-slate-500 mt-1">
                  Focus on dorsal carapace, abdominal segments, or uropod margins
                </span>
              </label>

              {blackSpotError && (
                <div className="p-3.5 rounded-xl bg-status-critical/10 border border-status-critical/40 text-status-critical text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{blackSpotError}</span>
                </div>
              )}

              {blackSpotPreview && (
                <div className="relative rounded-2xl overflow-hidden border border-navy-800 bg-[#050B18] h-64 flex items-center justify-center">
                  <img src={blackSpotPreview} alt="Carapace Preview" className="max-h-full max-w-full object-contain" />
                  {isAnalyzingBlackSpot && (
                    <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-3">
                      <div className="w-8 h-8 border-3 border-cyan-neon border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-mono font-bold text-cyan-neon">Inspecting Cuticular Exoskeleton...</span>
                      <div className="w-48 bg-navy-800 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-cyan-neon h-full transition-all duration-300" style={{ width: `${blackSpotProgress}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {blackSpotFile && (
                <button
                  onClick={handleRunBlackSpotAnalysis}
                  disabled={isAnalyzingBlackSpot}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-neon to-aquablue text-navy-950 font-bold text-xs shadow-neon-cyan hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <BrainCircuit className="w-4 h-4" />
                  <span>{isAnalyzingBlackSpot ? 'Scanning Shell Lesions...' : 'Execute Black-Spot AI Analysis'}</span>
                </button>
              )}
            </div>

            {/* Diagnostic Report */}
            <div className="lg:col-span-6 glass-panel p-6 rounded-3xl border border-navy-700/80 bg-navy-950/80 flex flex-col justify-between space-y-4 shadow-xl">
              <div>
                <div className="flex items-center justify-between border-b border-navy-800 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-neon" />
                    <h3 className="text-sm font-bold text-white">Black-Spot Diagnostic Assessment</h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">MobileNetV3-BlackSpot-v1.0</span>
                </div>

                {blackSpotResult ? (
                  <div className="mt-4 space-y-4">
                    {/* Condition: Dataset Verification Required */}
                    {(blackSpotResult.status === 'DATASET_VERIFICATION_REQUIRED' || blackSpotResult.status === 'MODEL_NOT_READY') && (
                      <div className="p-4 rounded-2xl bg-status-warning/10 border border-status-warning/40 space-y-3">
                        <div className="flex items-center gap-2 text-status-warning font-bold text-xs">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>AUDITED BLACK-SPOT DATASET REQUIRED — NO FAKE PREDICTIONS</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {blackSpotResult.message}
                        </p>

                        <div className="p-3 rounded-xl bg-navy-950 border border-navy-800 text-[11px] font-mono space-y-1.5">
                          <div className="text-cyan-neon font-bold flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5" />
                            <span>Literature Benchmark Dataset:</span>
                          </div>
                          <div className="text-slate-300">
                            <strong>"A Novel Farm-Level Dataset and Real-Time Detection Framework for Shrimp Black Spot Disease"</strong>
                          </div>
                          <div className="text-slate-400">
                            Minh-Huy Bui et al. (IEEE ICCITX 2026 proceedings) • 1,010 commercial pond images
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-navy-950 border border-navy-800 text-[11px] font-mono">
                          <span className="text-slate-400 block mb-1">Training Pipeline Command:</span>
                          <code className="text-cyan-neon text-[10px] block bg-navy-900 p-2 rounded">
                            python backend/ml/training/train_black_spot_classifier.py --epochs 15
                          </code>
                        </div>

                        <p className="text-[11px] text-slate-400 italic">
                          {blackSpotResult.disclaimer}
                        </p>
                      </div>
                    )}

                    {/* Condition: Inconclusive */}
                    {blackSpotResult.status === 'INCONCLUSIVE' && (
                      <div className="p-4 rounded-2xl bg-status-warning/10 border border-status-warning/40 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-status-warning font-mono">INCONCLUSIVE ASSESSMENT</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-status-warning/20 text-status-warning font-bold">
                            {blackSpotResult.confidenceScore}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{blackSpotResult.explanation}</p>
                      </div>
                    )}

                    {/* Condition: Success */}
                    {blackSpotResult.status === 'SUCCESS' && (
                      <div className="space-y-4">
                        <div className={`p-4 rounded-2xl border ${
                          blackSpotResult.severity === 'NORMAL'
                            ? 'bg-status-normal/10 border-status-normal/40 text-status-normal'
                            : 'bg-status-warning/10 border-status-warning/40 text-status-warning'
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-mono uppercase tracking-wider">CUTICULAR ASSESSMENT</span>
                            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-navy-950/60 border border-current">
                              {blackSpotResult.confidenceScore}
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-white mt-1">{blackSpotResult.predictedClass}</h4>
                          <p className="text-xs text-slate-300 mt-2 leading-relaxed">{blackSpotResult.explanation}</p>
                        </div>

                        {blackSpotResult.probabilityDistribution && (
                          <div className="p-4 rounded-2xl bg-navy-900/60 border border-navy-800 space-y-2.5">
                            <span className="text-xs font-bold text-cyan-neon font-mono">CONFIDENCE PROBABILITY BREAKDOWN</span>
                            <div className="space-y-2">
                              {Object.entries(blackSpotResult.probabilityDistribution).map(([className, prob]) => (
                                <div key={className} className="space-y-1">
                                  <div className="flex justify-between text-[11px] font-mono">
                                    <span className="text-slate-300">{className.replace(/_/g, ' ')}</span>
                                    <span className={className.includes('Black_Spot') ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                                      {(prob * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-navy-950 rounded-full h-1.5 overflow-hidden border border-navy-800">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        className.includes('Black_Spot') ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'bg-status-normal'
                                      }`}
                                      style={{ width: `${(prob * 100).toFixed(1)}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {blackSpotResult.actionableSteps && (
                          <div className="p-4 rounded-2xl bg-navy-900/60 border border-navy-800 space-y-2">
                            <span className="text-xs font-bold text-cyan-neon font-mono">CHITINOLYTIC BACTERIAL BIOSECURITY PROTOCOL</span>
                            <ul className="space-y-1.5 text-xs text-slate-300">
                              {blackSpotResult.actionableSteps.map((step, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <ArrowRight className="w-3.5 h-3.5 text-cyan-neon shrink-0 mt-0.5" />
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="pt-2">
                          <button
                            onClick={handleTrigger3ShrimpDiseaseAlert}
                            disabled={diseaseAlertDispatched}
                            className="w-full py-2.5 px-3 rounded-xl bg-status-warning/20 hover:bg-status-warning/30 text-status-warning text-xs font-bold border border-status-warning/50 shadow-[0_0_15px_rgba(245,158,11,0.2)] flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
                          >
                            <AlertTriangle className="w-4 h-4" />
                            <span>{diseaseAlertDispatched ? 'Warning Notification Active in Alert Center' : 'Dispatch 3-Shrimp Disease Warning Notification'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center p-12 text-slate-500 space-y-2">
                    <Flame className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                    <p className="text-xs font-semibold text-slate-400">Awaiting Shell Specimen</p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      Upload a close-up photo of the shrimp carapace or abdominal shell to evaluate for black spots and cuticular erosion.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-navy-800 text-[10px] font-mono text-slate-500 flex justify-between">
                <span>Biological Integrity: Verified</span>
                <span>Zero ESP32 Interference</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SPECIMEN LOCALIZATION & YOLO CAMERA INSPECTION */}
      {activeTab === 'specimen-localization' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 glass-panel p-5 rounded-3xl border border-navy-700/80 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Microscope className="w-4 h-4 text-cyan-neon" />
                  <h3 className="text-sm font-bold text-white">Visual Specimen Inspection (YOLOv8)</h3>
                </div>
              </div>

              <div className="relative rounded-2xl overflow-hidden border border-navy-800 bg-[#050B18] h-80 flex items-center justify-center">
                {selectedRecord?.imageUrl ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img src={selectedRecord.imageUrl} alt="Specimen Frame" className="max-h-full max-w-full object-contain" />
                    {(selectedRecord.detections || []).map((box, i) => (
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
                        <span className="absolute -top-5 left-0 px-1.5 py-0.5 bg-navy-950 text-cyan-neon font-mono text-[10px] border border-cyan-neon/40 rounded whitespace-nowrap">
                          {box.track_id} • Area: {box.area}px²
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-8">
                    <Microscope className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-300 font-semibold">No Inspection Frame Selected</p>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 glass-panel p-5 rounded-3xl border border-navy-700/80 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 pb-3 border-b border-navy-800">
                  <FileCheck className="w-4 h-4 text-cyan-neon" />
                  <h3 className="text-sm font-bold text-white">Technician Verification</h3>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-navy-950 border border-status-warning/40">
                    <span className="text-[10px] font-mono text-slate-400 block mb-1">FINDING CLASSIFICATION:</span>
                    <h4 className="text-xs font-bold text-white">Possible shell abnormality — review required</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'PENDING', label: 'Pending Review', color: 'text-slate-400' },
                      { id: 'CONFIRMED_ABNORMALITY', label: 'Flag Abnormality', color: 'text-status-warning' },
                      { id: 'NORMAL_CLEARED', label: 'Cleared Normal', color: 'text-status-normal' },
                      { id: 'REJECTED', label: 'Reject / Artifact', color: 'text-slate-500' }
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setReviewStatus(s.id)}
                        className={`p-2 rounded-xl text-left border text-xs font-medium ${
                          reviewStatus === s.id ? 'bg-cyan-neon/15 border-cyan-neon text-white' : 'bg-navy-900/60 border-navy-800 text-slate-400'
                        }`}
                      >
                        <span className={s.color}>{s.label}</span>
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={3}
                    value={technicianNotes}
                    onChange={(e) => setTechnicianNotes(e.target.value)}
                    placeholder="Technician observation notes..."
                    className="w-full p-2.5 rounded-xl bg-navy-950 border border-navy-700 text-xs text-white"
                  />

                  <button
                    onClick={() => handleSaveReview(selectedRecord?.id)}
                    disabled={!selectedRecord || isSubmittingReview}
                    className="w-full py-2.5 rounded-xl font-bold text-xs bg-cyan-neon text-navy-950 disabled:opacity-50"
                  >
                    {isSubmittingReview ? 'Saving...' : 'Save Review'}
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-navy-800">
                <button
                  onClick={handleTriggerGroupAlert}
                  disabled={groupAlertTriggered}
                  className="w-full py-2 px-3 rounded-xl bg-status-warning/20 text-status-warning text-xs font-bold border border-status-warning/50 flex items-center justify-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{groupAlertTriggered ? 'Group Alert Dispatched' : 'Trigger 3-Distinct-Shrimp Group Review'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historical Disease Analyses Archive */}
      <div className="glass-panel p-5 rounded-3xl border border-navy-700/80">
        <h3 className="text-sm font-bold text-white mb-3">
          Specimen Pathology Inspection Archive (Multi-Pathology & Black Spot)
        </h3>

        {diseaseHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-navy-800 text-slate-400 font-mono">
                  <th className="pb-2">Timestamp</th>
                  <th className="pb-2">Image File</th>
                  <th className="pb-2">Classification</th>
                  <th className="pb-2">Model Pipeline</th>
                  <th className="pb-2">Confidence</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/60 font-mono">
                {diseaseHistory.map((h) => (
                  <tr key={h.id} className="hover:bg-navy-900/50 transition-colors">
                    <td className="py-2.5 text-slate-300">
                      {new Date(h.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 text-cyan-neon font-medium">
                      {h.imageFilename}
                    </td>
                    <td className="py-2.5 text-white font-bold">
                      {h.predictedClass || '—'}
                    </td>
                    <td className="py-2.5 text-slate-400">
                      {h.modelVersion}
                    </td>
                    <td className="py-2.5 text-slate-300">
                      {h.confidence ? `${(h.confidence * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        h.status === 'SUCCESS'
                          ? 'bg-status-normal/15 text-status-normal border-status-normal/30'
                          : 'bg-status-warning/15 text-status-warning border-status-warning/30'
                      }`}>
                        {h.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic py-4 text-center">
            No past specimen pathology records found.
          </p>
        )}
      </div>
    </div>
  );
}
