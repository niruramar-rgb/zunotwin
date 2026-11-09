import React, { useState, useEffect } from 'react';
import { CameraAIPanel } from '../components/CameraAIPanel';
import { BrainCircuit, Eye, Sparkles, AlertCircle, BarChart3, HelpCircle } from 'lucide-react';
import { api } from '../services/api';

export function CameraAIPage() {
  const [modelsStatus, setModelsStatus] = useState(null);
  const [shapExplanation, setShapExplanation] = useState(null);
  const [riskPrediction, setRiskPrediction] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadAI() {
      setLoading(true);
      try {
        const [modelsRes, shapRes, riskRes] = await Promise.allSettled([
          api.getModelsStatus(),
          api.getShapExplanation(),
          api.predictRisk()
        ]);
        if (modelsRes.status === 'fulfilled' && modelsRes.value.success) {
          setModelsStatus(modelsRes.value.data);
        }
        if (shapRes.status === 'fulfilled' && shapRes.value.success) {
          setShapExplanation(shapRes.value.data);
        }
        if (riskRes.status === 'fulfilled' && riskRes.value.success) {
          setRiskPrediction(riskRes.value.data);
        }
      } catch (_) {}
      finally {
        setLoading(false);
      }
    }
    loadAI();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-navy-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Computer Vision & Explainable AI Studio</h2>
          <p className="text-xs text-slate-400 mt-1">
            YOLOv8 specimen tracking, XGBoost risk regression, AutoGluon benchmarking, and SHAP Shapley attributions
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Camera Inspection Panel */}
        <div className="lg:col-span-6">
          <CameraAIPanel />
        </div>

        {/* Right: Explainable AI & Machine Learning Insights */}
        <div className="lg:col-span-6 space-y-5">
          {/* SHAP Natural Language Advisory */}
          <div className="glass-panel p-5 rounded-2xl border border-cyan-neon/30 shadow-neon-cyan">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-cyan-neon" />
              <h3 className="text-sm font-bold text-white">Explainable AI (SHAP TreeExplainer)</h3>
            </div>

            <div className="p-3.5 rounded-xl bg-navy-950/80 border border-navy-700/80 mb-4">
              <p className="text-xs text-slate-200 leading-relaxed font-mono">
                "{shapExplanation?.natural_explanation || shapExplanation?.actionable_advice || 'Computing Shapley attributions from latest physical telemetry...'}"
              </p>
              <p className="text-[10px] text-slate-500 mt-2 italic">
                {shapExplanation?.disclaimer || 'SHAP measures mathematical model feature contributions, not medical causality.'}
              </p>
            </div>

            {/* Feature Attribution Bar Graph */}
            <h4 className="text-xs font-semibold text-slate-400 mb-2">Feature Risk Contributions</h4>
            <div className="space-y-2">
              {shapExplanation?.sorted_contributions?.map((c, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-300 capitalize">{c.feature.replace('_', ' ')}</span>
                    <span className={c.shap_attribution > 0 ? 'text-status-warning' : 'text-cyan-neon'}>
                      {c.shap_attribution > 0 ? `+${c.shap_attribution}` : c.shap_attribution}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-navy-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${c.shap_attribution > 0 ? 'bg-status-warning' : 'bg-cyan-neon'}`}
                      style={{ width: `${Math.min(100, Math.abs(c.shap_attribution) * 200)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Model Status Card */}
          <div className="glass-panel p-5 rounded-2xl border border-navy-700/80">
            <div className="flex items-center gap-2 mb-3">
              <BrainCircuit className="w-4 h-4 text-aquablue" />
              <h3 className="text-sm font-bold text-white">Production AI Architecture Status</h3>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between p-2 rounded-lg bg-navy-900/60 border border-navy-800">
                <span className="text-slate-300">YOLOv8 Shrimp Detector</span>
                <span className="text-status-normal font-bold">READY (v8n)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-navy-900/60 border border-navy-800">
                <span className="text-slate-300">XGBoost Water Risk Regressor</span>
                <span className="text-status-normal font-bold">READY (v1.4.0)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-navy-900/60 border border-navy-800">
                <span className="text-slate-300">SHAP Game-Theoretic Explainer</span>
                <span className="text-status-normal font-bold">READY (TreeExplainer)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-navy-900/60 border border-navy-800">
                <span className="text-slate-300">EWMA Anomaly Monitor</span>
                <span className="text-status-normal font-bold">READY (α=0.25)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-navy-900/60 border border-navy-800">
                <span className="text-slate-300">Disease-Specific Pathology Classifier</span>
                <span className="text-status-warning font-bold">IN DEVELOPMENT</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
