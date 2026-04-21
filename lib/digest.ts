import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type DigestCandidate = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  score: number;
  reasoning: string;
  flags: string[];
};

export async function sendDigestEmail(params: {
  to: string;
  jobTitle: string;
  jobLocation: string | null;
  jobId: string;
  newCount: number;
  duplicateCount: number;
  candidates: DigestCandidate[];
  appUrl: string;
}): Promise<void> {
  const { to, jobTitle, jobLocation, jobId, newCount, duplicateCount, candidates, appUrl } = params;

  const SCORE_THRESHOLD = 7.5; // Only email candidates scoring 7.5+/10
  const qualified = candidates
    .filter((c) => c.score >= SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (qualified.length === 0) return; // Don't send email if nobody qualifies

  const location = jobLocation ? ` (${jobLocation})` : "";

  const candidateRows = qualified
    .map(
      (c, i) => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 12px 0; vertical-align: top;">
          <div style="font-weight: 600; color: #1e293b; font-size: 14px;">
            ${i + 1}. ${c.name || "Unknown"}
            <span style="font-weight: 500; color: #64748b; margin-left: 8px;">${c.score}/10</span>
          </div>
          ${c.phone ? `<div style="color: #475569; font-size: 13px; margin-top: 4px;">📞 ${c.phone}</div>` : ""}
          ${c.email ? `<div style="color: #475569; font-size: 13px;">✉️ ${c.email}</div>` : ""}
          <div style="color: #64748b; font-size: 13px; margin-top: 6px;">${c.reasoning}</div>
          ${
            c.flags.length > 0
              ? `<div style="margin-top: 4px;">${c.flags
                  .map(
                    (f) =>
                      `<span style="display: inline-block; background: #fef2f2; color: #dc2626; font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-right: 4px;">${f}</span>`
                  )
                  .join("")}</div>`
              : ""
          }
        </td>
      </tr>`
    )
    .join("");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
      <h2 style="color: #1e293b; font-size: 18px; margin-bottom: 4px;">
        ${jobTitle}${location}
      </h2>
      <p style="color: #64748b; font-size: 13px; margin-bottom: 24px;">
        ${newCount} new candidate${newCount !== 1 ? "s" : ""} reviewed${
    duplicateCount > 0 ? `, ${duplicateCount} duplicate${duplicateCount !== 1 ? "s" : ""} skipped` : ""
  }
      </p>

      <h3 style="color: #1e293b; font-size: 14px; font-weight: 600; margin-bottom: 12px;">
        ${qualified.length} candidate${qualified.length !== 1 ? "s" : ""} scored ${SCORE_THRESHOLD}+ — call today
      </h3>

      <table style="width: 100%; border-collapse: collapse;">
        ${candidateRows}
      </table>

      <div style="margin-top: 24px;">
        <a href="${appUrl}/jobs/${jobId}" style="display: inline-block; background: #1e293b; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 500;">
          View all candidates
        </a>
      </div>

      <p style="color: #94a3b8; font-size: 11px; margin-top: 32px;">
        — CV Triage
      </p>
    </div>
  `;

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
    to,
    subject: `Daily hiring digest — ${jobTitle} — ${newCount} new candidate${newCount !== 1 ? "s" : ""}`,
    html,
  });
}
