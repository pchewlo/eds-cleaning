export function parseExclusionList(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

export function isExcluded(
  candidateName: string,
  candidateEmail: string | null,
  exclusions: string[]
): boolean {
  if (exclusions.length === 0) return false;

  const nameLower = candidateName.toLowerCase();
  const emailLower = candidateEmail?.toLowerCase() || "";

  return exclusions.some(
    (exc) =>
      nameLower.includes(exc) ||
      exc.includes(nameLower) ||
      (emailLower && emailLower.includes(exc)) ||
      (emailLower && exc.includes(emailLower))
  );
}
