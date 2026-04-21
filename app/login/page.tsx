"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("email", {
        email,
        redirect: false,
        callbackUrl: "/jobs",
      });

      if (result?.error) {
        setError("Access denied. Contact your administrator.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-full max-w-sm mx-auto px-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
            <div className="text-3xl mb-4">✉️</div>
            <h1 className="text-lg font-semibold text-slate-900 mb-2">
              Check your email
            </h1>
            <p className="text-sm text-slate-500">
              We sent a sign-in link to <strong>{email}</strong>
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <h1 className="text-lg font-semibold text-slate-900 mb-1">
            CV Triage
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            Sign in with your email to continue.
          </p>

          <form onSubmit={handleSubmit}>
            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400"
            />

            {error && (
              <p className="text-sm text-red-600 mt-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full mt-4 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-slate-800 transition-colors"
            >
              {loading ? "Sending..." : "Send sign-in link"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
