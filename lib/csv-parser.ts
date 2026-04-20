export interface CsvCandidate {
  name: string;
  email: string;
  phone: string;
  status: string;
  location: string;
  relevantExperience: string;
  education: string;
  jobTitle: string;
  jobLocation: string;
  date: string;
  source: string;
  qualifications: Array<{
    question: string;
    answer: string;
    match: string;
  }>;
}

export function parseCsvCandidates(csvText: string): CsvCandidate[] {
  const lines = csvText.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const candidates: CsvCandidate[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 5) continue;

    const get = (col: string) => {
      const idx = headers.findIndex(
        (h) => h.toLowerCase().trim() === col.toLowerCase()
      );
      return idx >= 0 ? values[idx]?.trim() || "" : "";
    };

    // Parse qualification columns
    const qualifications: CsvCandidate["qualifications"] = [];
    for (let q = 1; q <= 15; q++) {
      const question = get(`Qualification ${q}`);
      const answer = get(`Qualification ${q} Answer`);
      const match = get(`Qualification ${q} Match`);
      if (question) {
        qualifications.push({ question, answer, match });
      }
    }

    candidates.push({
      name: get("name"),
      email: get("email"),
      phone: get("phone"),
      status: get("status"),
      location: get("candidate location"),
      relevantExperience: get("relevant experience"),
      education: get("education"),
      jobTitle: get("job title"),
      jobLocation: get("job location"),
      date: get("date"),
      source: get("source"),
      qualifications,
    });
  }

  return candidates;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function candidateToText(c: CsvCandidate): string {
  let text = `Name: ${c.name}\n`;
  text += `Location: ${c.location}\n`;
  if (c.phone) text += `Phone: ${c.phone}\n`;
  if (c.email) text += `Email: ${c.email}\n`;
  if (c.relevantExperience) text += `Recent role: ${c.relevantExperience}\n`;
  if (c.education) text += `Education: ${c.education}\n`;
  text += `\nQualification answers:\n`;
  for (const q of c.qualifications) {
    text += `- ${q.question}: ${q.answer}\n`;
  }
  return text;
}
