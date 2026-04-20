import * as cheerio from "cheerio";
import { Job } from "./types";

const BRANCH_URL =
  process.env.MINSTER_BRANCH_URL ||
  "https://jobs.minstercleaning.co.uk/south-yorkshire";

// Simple in-memory cache
let cachedJobs: Job[] | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function inferShiftType(
  shiftPattern: string
): Job["shiftType"] {
  const lower = shiftPattern.toLowerCase();
  if (lower.includes("mobile")) return "mobile";
  if (lower.includes("split")) return "split";

  // Try to parse start time
  const timeMatch = lower.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1]);
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    return "evening";
  }
  return "unknown";
}

function extractPostcode(text: string): string {
  const match = text.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
  return match ? match[0].toUpperCase() : "";
}

function extractHoursPerWeek(title: string): number {
  const match = title.match(/\((\d+)\s*hours?\s*per\s*week\)/i);
  return match ? parseInt(match[1]) : 0;
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "MinsterCVRanker/1.0 (internal tool)",
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

async function scrapeJobDetail(url: string): Promise<{
  fullDescription: string;
  requirements: string[];
  shiftPattern: string;
  hourlyRate: string;
}> {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  // Extract the main content area
  const content = $(".job-detail, .job-description, main, article")
    .first()
    .text();
  const fullText = content || $("body").text();

  // Try to find shift pattern
  let shiftPattern = "";
  const shiftMatch = fullText.match(
    /(?:shift|hours|pattern|schedule)[:\s]*([^\n]+)/i
  );
  if (shiftMatch) shiftPattern = shiftMatch[1].trim();

  // Look for day/time patterns like "Monday to Friday = 16:00 - 19:00"
  const dayTimeMatch = fullText.match(
    /((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[\s\S]*?\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})/i
  );
  if (dayTimeMatch) shiftPattern = dayTimeMatch[1].trim();

  // Extract hourly rate
  let hourlyRate = "";
  const rateMatch = fullText.match(/£[\d.]+\s*(?:per hour|p\/h|ph)/i);
  if (rateMatch) hourlyRate = rateMatch[0];

  // Extract requirements - lines starting with "Must"
  const requirements: string[] = [];
  const lines = fullText.split(/\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^must\s/i)) {
      requirements.push(trimmed);
    }
  }

  // Also look for bullet points with "must"
  $("li").each((_, el) => {
    const text = $(el).text().trim();
    if (text.match(/^must\s/i) && !requirements.includes(text)) {
      requirements.push(text);
    }
  });

  return { fullDescription: fullText.trim(), requirements, shiftPattern, hourlyRate };
}

async function scrapeJobs(): Promise<Job[]> {
  const html = await fetchPage(BRANCH_URL);
  const $ = cheerio.load(html);
  const jobs: Job[] = [];

  // Look for job listing links/cards
  const jobLinks: Array<{ title: string; url: string }> = [];

  // Try common patterns for job listing sites
  $("a[href*='/job/'], a[href*='/vacancy/'], a[href*='/position/']").each(
    (_, el) => {
      const href = $(el).attr("href");
      const title = $(el).text().trim();
      if (href && title && title.length > 5) {
        const fullUrl = href.startsWith("http")
          ? href
          : new URL(href, BRANCH_URL).toString();
        if (!jobLinks.find((j) => j.url === fullUrl)) {
          jobLinks.push({ title, url: fullUrl });
        }
      }
    }
  );

  // Also try looking for job cards with class patterns
  if (jobLinks.length === 0) {
    $("[class*='job'], [class*='vacancy'], [class*='listing']").each(
      (_, el) => {
        const link = $(el).find("a").first();
        const href = link.attr("href");
        const title = link.text().trim() || $(el).find("h2, h3, h4").text().trim();
        if (href && title) {
          const fullUrl = href.startsWith("http")
            ? href
            : new URL(href, BRANCH_URL).toString();
          if (!jobLinks.find((j) => j.url === fullUrl)) {
            jobLinks.push({ title, url: fullUrl });
          }
        }
      }
    );
  }

  // Fetch detail pages (limit concurrency)
  for (const { title, url } of jobLinks) {
    try {
      const detail = await scrapeJobDetail(url);
      const postcode = extractPostcode(title) || extractPostcode(detail.fullDescription);
      const location = title.replace(/\(.*\)/, "").replace(/cleaner,?\s*/i, "").trim();
      const idMatch = url.match(/\/(\d+)/);

      jobs.push({
        id: idMatch ? idMatch[1] : url,
        url,
        title,
        postcode,
        location,
        hourlyRate: detail.hourlyRate || "See description",
        hoursPerWeek: extractHoursPerWeek(title),
        shiftPattern: detail.shiftPattern || "See description",
        shiftType: inferShiftType(detail.shiftPattern || title),
        requirements: detail.requirements,
        fullDescription: detail.fullDescription,
      });
    } catch (e) {
      console.error(`Failed to scrape job detail: ${url}`, e);
    }
  }

  return jobs;
}

export async function getJobs(forceRefresh = false): Promise<Job[]> {
  const now = Date.now();
  if (!forceRefresh && cachedJobs && now - cacheTime < CACHE_TTL) {
    return cachedJobs;
  }

  const jobs = await scrapeJobs();
  cachedJobs = jobs;
  cacheTime = now;
  return jobs;
}

export function getJobById(jobs: Job[], id: string): Job | undefined {
  return jobs.find((j) => j.id === id);
}
