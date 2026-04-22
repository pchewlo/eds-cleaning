"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ScoringConfig } from "@/lib/scoring-config";

export default function SettingsPage() {
  const [config, setConfig] = useState<ScoringConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setConfig);
  }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setSaved(false);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (!config) {
    return (
      <main className="w-full max-w-3xl mx-auto px-6 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/3" />
          <div className="h-40 bg-slate-200 rounded" />
        </div>
      </main>
    );
  }

  const updateWeight = (key: keyof ScoringConfig["weights"], val: number) => {
    setConfig({ ...config, weights: { ...config.weights, [key]: val } });
  };

  return (
    <main className="w-full max-w-3xl mx-auto px-6 py-10">
      <Link href="/jobs" className="text-sm text-slate-500 hover:text-slate-700 mb-4 inline-block">
        ← Back to jobs
      </Link>
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Scoring settings</h1>
      <p className="text-[13px] text-slate-400 mb-8">
        Configure how candidates are scored. Changes apply to new uploads only.
      </p>

      <div className="space-y-8">
        {/* Weights */}
        <Section title="Score weights" description="How much each factor contributes to the overall score. Must add up to 100%.">
          <div className="grid grid-cols-2 gap-4">
            <NumberField label="Commute" value={config.weights.commute * 100} onChange={(v) => updateWeight("commute", v / 100)} suffix="%" />
            <NumberField label="Experience" value={config.weights.experience * 100} onChange={(v) => updateWeight("experience", v / 100)} suffix="%" />
            <NumberField label="Tenure" value={config.weights.tenure * 100} onChange={(v) => updateWeight("tenure", v / 100)} suffix="%" />
            <NumberField label="Requirements" value={config.weights.requirements * 100} onChange={(v) => updateWeight("requirements", v / 100)} suffix="%" />
          </div>
        </Section>

        {/* Commute */}
        <Section title="Commute thresholds" description="Maximum commute times for each score band (in minutes).">
          <div className="grid grid-cols-2 gap-4">
            <NumberField label="Excellent (score 95)" value={config.commute.excellent} onChange={(v) => setConfig({ ...config, commute: { ...config.commute, excellent: v } })} suffix="min" />
            <NumberField label="Good (score 85)" value={config.commute.good} onChange={(v) => setConfig({ ...config, commute: { ...config.commute, good: v } })} suffix="min" />
            <NumberField label="Acceptable (score 70)" value={config.commute.acceptable} onChange={(v) => setConfig({ ...config, commute: { ...config.commute, acceptable: v } })} suffix="min" />
            <NumberField label="Marginal (score 45)" value={config.commute.marginal} onChange={(v) => setConfig({ ...config, commute: { ...config.commute, marginal: v } })} suffix="min" />
            <NumberField label="Licence bonus" value={config.commute.licenceBonus} onChange={(v) => setConfig({ ...config, commute: { ...config.commute, licenceBonus: v } })} suffix="pts" />
          </div>
        </Section>

        {/* Experience roles */}
        <Section title="Role categories" description="Which job titles count as strong, relevant, or weak experience.">
          <TagField
            label="Strong roles (direct cleaning)"
            values={config.experience.strongRoles}
            onChange={(v) => setConfig({ ...config, experience: { ...config.experience, strongRoles: v } })}
          />
          <TagField
            label="Relevant roles (transferable)"
            values={config.experience.relevantRoles}
            onChange={(v) => setConfig({ ...config, experience: { ...config.experience, relevantRoles: v } })}
          />
        </Section>

        {/* Tenure */}
        <Section title="Tenure" description="How job stability is scored.">
          <div className="grid grid-cols-2 gap-4">
            <NumberField label="Long tenure threshold" value={config.tenure.longTenureYears} onChange={(v) => setConfig({ ...config, tenure: { ...config.tenure, longTenureYears: v } })} suffix="yrs" />
            <NumberField label="Long tenure bonus" value={config.tenure.longTenureBonus} onChange={(v) => setConfig({ ...config, tenure: { ...config.tenure, longTenureBonus: v } })} suffix="pts" />
            <NumberField label="Job hopper threshold" value={config.tenure.jobHopperThreshold} onChange={(v) => setConfig({ ...config, tenure: { ...config.tenure, jobHopperThreshold: v } })} suffix="yrs avg" />
            <NumberField label="Job hopper penalty" value={config.tenure.jobHopperPenalty} onChange={(v) => setConfig({ ...config, tenure: { ...config.tenure, jobHopperPenalty: v } })} suffix="pts" />
          </div>
        </Section>

        {/* Digest */}
        <Section title="Email digest" description="When and who to email about new candidates.">
          <div className="grid grid-cols-2 gap-4">
            <NumberField label="Minimum score to email" value={config.digest.scoreThreshold} onChange={(v) => setConfig({ ...config, digest: { ...config.digest, scoreThreshold: v } })} suffix="/10" />
            <div>
              <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Recipient email</label>
              <input
                value={config.digest.recipientEmail}
                onChange={(e) => setConfig({ ...config, digest: { ...config.digest, recipientEmail: e.target.value } })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
          </div>
        </Section>
      </div>

      {/* Save */}
      <div className="mt-8 pt-6 border-t border-slate-200 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-slate-800 transition-colors"
        >
          {saving ? "Saving..." : "Save settings"}
        </button>
        {saved && <span className="text-sm text-emerald-600">✓ Saved</span>}
      </div>
    </main>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[14px] font-semibold text-slate-900 mb-0.5">{title}</h2>
      <p className="text-[12px] text-slate-400 mb-3">{description}</p>
      {children}
    </div>
  );
}

function NumberField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-slate-600 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="any"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 tabular-nums"
        />
        <span className="text-xs text-slate-400 flex-shrink-0">{suffix}</span>
      </div>
    </div>
  );
}

function TagField({ label, values, onChange }: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState("");

  const add = () => {
    const val = input.trim().toLowerCase();
    if (val && !values.includes(val)) {
      onChange([...values, val]);
    }
    setInput("");
  };

  return (
    <div className="mb-3">
      <label className="block text-[12px] font-medium text-slate-600 mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((v, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-[12px] text-slate-700">
            {v}
            <button onClick={() => onChange(values.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">
              &times;
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="Add role keyword..."
          className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        <button onClick={add} className="px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          Add
        </button>
      </div>
    </div>
  );
}
