"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ScoringConfig } from "@/lib/scoring-config";

export default function SettingsPage() {
  const [config, setConfig] = useState<ScoringConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  return (
    <main className="w-full max-w-3xl mx-auto px-6 py-10">
      <Link href="/jobs" className="text-sm text-slate-500 hover:text-slate-700 mb-4 inline-block">
        ← Back to jobs
      </Link>
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Scoring settings</h1>
      <p className="text-[13px] text-slate-400 mb-8">
        These settings control how candidates are ranked. Changes apply to new uploads only — existing scores are not recalculated.
      </p>

      <div className="space-y-10">
        {/* Weights */}
        <Section
          title="Score weights"
          description="Each candidate gets a score out of 10. This is calculated by weighting four factors. Adjust the percentages to change what matters most. They must add up to 100%."
        >
          <div className="grid grid-cols-2 gap-4">
            <NumberField label="Commute" hint="How close they live to the job site" value={config.weights.commute * 100} onChange={(v) => setConfig({ ...config, weights: { ...config.weights, commute: v / 100 } })} suffix="%" />
            <NumberField label="Experience" hint="Years and relevance of their work history" value={config.weights.experience * 100} onChange={(v) => setConfig({ ...config, weights: { ...config.weights, experience: v / 100 } })} suffix="%" />
            <NumberField label="Tenure" hint="How long they stay in jobs (loyalty)" value={config.weights.tenure * 100} onChange={(v) => setConfig({ ...config, weights: { ...config.weights, tenure: v / 100 } })} suffix="%" />
            <NumberField label="Requirements" hint="Whether they meet must-have criteria" value={config.weights.requirements * 100} onChange={(v) => setConfig({ ...config, weights: { ...config.weights, requirements: v / 100 } })} suffix="%" />
          </div>
          {Math.abs((config.weights.commute + config.weights.experience + config.weights.tenure + config.weights.requirements) - 1) > 0.01 && (
            <p className="text-xs text-red-500 mt-2">
              Weights add up to {((config.weights.commute + config.weights.experience + config.weights.tenure + config.weights.requirements) * 100).toFixed(0)}% — they should be 100%.
            </p>
          )}
        </Section>

        {/* Commute */}
        <Section
          title="Commute thresholds"
          description="How commute time (in minutes) maps to scores. We use Google Maps to calculate actual drive or public transport time. Candidates within the 'Excellent' threshold get the highest commute score."
        >
          <div className="grid grid-cols-2 gap-4">
            <NumberField label="Excellent" hint="Top score — very close to site" value={config.commute.excellent} onChange={(v) => setConfig({ ...config, commute: { ...config.commute, excellent: v } })} suffix="min" />
            <NumberField label="Good" hint="Reasonable daily commute" value={config.commute.good} onChange={(v) => setConfig({ ...config, commute: { ...config.commute, good: v } })} suffix="min" />
            <NumberField label="Acceptable" hint="Manageable but not ideal" value={config.commute.acceptable} onChange={(v) => setConfig({ ...config, commute: { ...config.commute, acceptable: v } })} suffix="min" />
            <NumberField label="Marginal" hint="Borderline — may affect reliability" value={config.commute.marginal} onChange={(v) => setConfig({ ...config, commute: { ...config.commute, marginal: v } })} suffix="min" />
            <NumberField label="Driving licence bonus" hint="Extra points for candidates who can drive" value={config.commute.licenceBonus} onChange={(v) => setConfig({ ...config, commute: { ...config.commute, licenceBonus: v } })} suffix="pts" />
          </div>
        </Section>

        {/* Experience roles */}
        <Section
          title="Role categories"
          description="Keywords that determine whether a candidate's previous job titles count as strong experience, relevant experience, or neither. These are matched against job titles on their CV. For example, if 'care worker' is in the relevant list, anyone who had that title gets a relevance bonus."
        >
          <TagField
            label="Strong roles"
            hint="Direct cleaning experience — highest bonus. Add keywords that appear in cleaning job titles."
            values={config.experience.strongRoles}
            onChange={(v) => setConfig({ ...config, experience: { ...config.experience, strongRoles: v } })}
          />
          <TagField
            label="Relevant roles"
            hint="Transferable experience — smaller bonus. Jobs like care work, hospitality, warehouse that show relevant skills."
            values={config.experience.relevantRoles}
            onChange={(v) => setConfig({ ...config, experience: { ...config.experience, relevantRoles: v } })}
          />
          <div className="grid grid-cols-2 gap-4 mt-3">
            <NumberField label="Strong role bonus" hint="Extra points per strong role found" value={config.experience.strongRoleBonus} onChange={(v) => setConfig({ ...config, experience: { ...config.experience, strongRoleBonus: v } })} suffix="pts" />
            <NumberField label="Relevant role bonus" hint="Extra points per relevant role found" value={config.experience.relevantRoleBonus} onChange={(v) => setConfig({ ...config, experience: { ...config.experience, relevantRoleBonus: v } })} suffix="pts" />
          </div>
        </Section>

        {/* Tenure */}
        <Section
          title="Job stability"
          description="Minster values candidates who stay in jobs long-term. These settings reward loyalty and penalise frequent job changes."
        >
          <div className="grid grid-cols-2 gap-4">
            <NumberField label="Long tenure threshold" hint="Years in one job to earn a bonus" value={config.tenure.longTenureYears} onChange={(v) => setConfig({ ...config, tenure: { ...config.tenure, longTenureYears: v } })} suffix="yrs" />
            <NumberField label="Long tenure bonus" hint="Extra points for staying 5+ years" value={config.tenure.longTenureBonus} onChange={(v) => setConfig({ ...config, tenure: { ...config.tenure, longTenureBonus: v } })} suffix="pts" />
            <NumberField label="Job hopper threshold" hint="Avg years per role below this = penalty" value={config.tenure.jobHopperThreshold} onChange={(v) => setConfig({ ...config, tenure: { ...config.tenure, jobHopperThreshold: v } })} suffix="yrs" />
            <NumberField label="Job hopper penalty" hint="Points deducted for frequent changes" value={config.tenure.jobHopperPenalty} onChange={(v) => setConfig({ ...config, tenure: { ...config.tenure, jobHopperPenalty: v } })} suffix="pts" />
          </div>
        </Section>

        {/* Digest */}
        <Section
          title="Email digest"
          description="After ranking, an email is automatically sent with top candidates. Only candidates scoring above the threshold are included. If nobody qualifies, no email is sent."
        >
          <div className="grid grid-cols-2 gap-4">
            <NumberField label="Minimum score to email" hint="Candidates below this won't be emailed" value={config.digest.scoreThreshold} onChange={(v) => setConfig({ ...config, digest: { ...config.digest, scoreThreshold: v } })} suffix="/10" />
            <div>
              <label className="block text-[12px] font-medium text-slate-600 mb-0.5">Recipient email</label>
              <p className="text-[11px] text-slate-400 mb-1.5">Who receives the candidate digest</p>
              <input
                value={config.digest.recipientEmail}
                onChange={(e) => setConfig({ ...config, digest: { ...config.digest, recipientEmail: e.target.value } })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
          </div>
        </Section>

        {/* Extraction prompt */}
        <Section
          title="AI extraction instructions"
          description="This is the prompt sent to the AI when reading CVs. It controls what data gets extracted and how. You can edit this to change what the AI looks for — for example, adding new role types it should flag as relevant, or changing what counts as a red flag. Be specific and clear. The AI returns structured data (job titles, dates, employers) which is then scored by the rules above."
        >
          <textarea
            value={config.extractionPrompt}
            onChange={(e) => setConfig({ ...config, extractionPrompt: e.target.value })}
            rows={16}
            className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 resize-y bg-slate-50"
          />
          <p className="text-[11px] text-slate-400 mt-1.5">
            Tip: The AI must always return JSON with id, name, roles[], hasDriverLicence, postcode, and redFlags[]. Don&apos;t remove these fields — you can change the instructions around them.
          </p>
        </Section>
      </div>

      {/* Save */}
      <div className="mt-8 pt-6 border-t border-slate-200 flex items-center gap-3 sticky bottom-0 bg-white pb-6">
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-slate-800 transition-colors"
        >
          {saving ? "Saving..." : "Save settings"}
        </button>
        {saved && <span className="text-sm text-emerald-600">✓ Saved — changes apply to next upload</span>}
      </div>
    </main>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[14px] font-semibold text-slate-900 mb-0.5">{title}</h2>
      <p className="text-[12px] text-slate-500 mb-4 leading-relaxed max-w-xl">{description}</p>
      {children}
    </div>
  );
}

function NumberField({ label, hint, value, onChange, suffix }: { label: string; hint: string; value: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-slate-600 mb-0.5">{label}</label>
      <p className="text-[11px] text-slate-400 mb-1.5">{hint}</p>
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

function TagField({ label, hint, values, onChange }: { label: string; hint: string; values: string[]; onChange: (v: string[]) => void }) {
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
      <label className="block text-[12px] font-medium text-slate-600 mb-0.5">{label}</label>
      <p className="text-[11px] text-slate-400 mb-1.5">{hint}</p>
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
          placeholder="Type a keyword and press Enter..."
          className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        <button onClick={add} className="px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          Add
        </button>
      </div>
    </div>
  );
}
