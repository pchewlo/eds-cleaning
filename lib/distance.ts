export interface DistanceResult {
  drivingMinutes: number | null;
  transitMinutes: number | null;
  drivingText: string;
  transitText: string;
}

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

// Cache to avoid repeated lookups for same origin/destination
const cache = new Map<string, DistanceResult>();

export async function getDistance(
  originPostcode: string,
  destinationPostcode: string
): Promise<DistanceResult> {
  if (!GOOGLE_MAPS_API_KEY) {
    return estimateFromPostcodes(originPostcode, destinationPostcode);
  }

  const key = `${originPostcode.toUpperCase()}->${destinationPostcode.toUpperCase()}`;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const [driving, transit] = await Promise.all([
      fetchDistanceMatrix(originPostcode, destinationPostcode, "driving"),
      fetchDistanceMatrix(originPostcode, destinationPostcode, "transit"),
    ]);

    const result: DistanceResult = {
      drivingMinutes: driving.minutes,
      transitMinutes: transit.minutes,
      drivingText: driving.text || "Unknown",
      transitText: transit.text || "No transit route",
    };

    cache.set(key, result);
    return result;
  } catch (e) {
    console.error("Google Maps API error:", e);
    return estimateFromPostcodes(originPostcode, destinationPostcode);
  }
}

async function fetchDistanceMatrix(
  origin: string,
  destination: string,
  mode: "driving" | "transit"
): Promise<{ minutes: number | null; text: string | null }> {
  const params = new URLSearchParams({
    origins: `${origin}, UK`,
    destinations: `${destination}, UK`,
    mode,
    key: GOOGLE_MAPS_API_KEY,
    units: "imperial",
  });

  // For transit, set arrival time to 16:00 on next weekday
  if (mode === "transit") {
    const now = new Date();
    const next = new Date(now);
    next.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7)); // next Monday
    next.setHours(16, 0, 0, 0);
    params.set("arrival_time", Math.floor(next.getTime() / 1000).toString());
  }

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`;
  const res = await fetch(url);
  const data = await res.json();

  if (
    data.status === "OK" &&
    data.rows?.[0]?.elements?.[0]?.status === "OK"
  ) {
    const element = data.rows[0].elements[0];
    return {
      minutes: Math.round(element.duration.value / 60),
      text: element.duration.text,
    };
  }

  return { minutes: null, text: null };
}

// Batch lookup for multiple candidates going to same destination
export async function getDistancesBatch(
  origins: string[],
  destinationPostcode: string
): Promise<DistanceResult[]> {
  if (!GOOGLE_MAPS_API_KEY) {
    return origins.map((o) => estimateFromPostcodes(o, destinationPostcode));
  }

  // Google allows up to 25 origins per request
  const results: DistanceResult[] = [];
  const BATCH_SIZE = 25;

  for (let i = 0; i < origins.length; i += BATCH_SIZE) {
    const batch = origins.slice(i, i + BATCH_SIZE);
    const batchResults = await fetchBatch(batch, destinationPostcode);
    results.push(...batchResults);
  }

  return results;
}

async function fetchBatch(
  origins: string[],
  destination: string
): Promise<DistanceResult[]> {
  const originsStr = origins.map((o) => `${o}, UK`).join("|");

  const [drivingRes, transitRes] = await Promise.all([
    fetchBatchMode(originsStr, destination, "driving"),
    fetchBatchMode(originsStr, destination, "transit"),
  ]);

  return origins.map((_, i) => ({
    drivingMinutes: drivingRes[i]?.minutes ?? null,
    transitMinutes: transitRes[i]?.minutes ?? null,
    drivingText: drivingRes[i]?.text || "Unknown",
    transitText: transitRes[i]?.text || "No transit route",
  }));
}

async function fetchBatchMode(
  originsStr: string,
  destination: string,
  mode: "driving" | "transit"
): Promise<Array<{ minutes: number | null; text: string | null }>> {
  const params = new URLSearchParams({
    origins: originsStr,
    destinations: `${destination}, UK`,
    mode,
    key: GOOGLE_MAPS_API_KEY,
    units: "imperial",
  });

  if (mode === "transit") {
    const now = new Date();
    const next = new Date(now);
    next.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
    next.setHours(16, 0, 0, 0);
    params.set("arrival_time", Math.floor(next.getTime() / 1000).toString());
  }

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK") return new Array(originsStr.split("|").length).fill({ minutes: null, text: null });

    return data.rows.map((row: { elements: Array<{ status: string; duration: { value: number; text: string } }> }) => {
      const el = row.elements[0];
      if (el.status === "OK") {
        return { minutes: Math.round(el.duration.value / 60), text: el.duration.text };
      }
      return { minutes: null, text: null };
    });
  } catch {
    return new Array(originsStr.split("|").length).fill({ minutes: null, text: null });
  }
}

// Fallback: estimate from UK postcodes without Google Maps
function estimateFromPostcodes(origin: string, destination: string): DistanceResult {
  const originOut = origin.trim().split(/\s/)[0].toUpperCase().replace(/\d[A-Z]{2}$/, "");
  const destOut = destination.trim().split(/\s/)[0].toUpperCase().replace(/\d[A-Z]{2}$/, "");

  const originPrefix = originOut.replace(/\d+$/, "");
  const destPrefix = destOut.replace(/\d+$/, "");

  let drivingMinutes: number;

  if (originOut === destOut) {
    drivingMinutes = 8;
  } else if (originPrefix === destPrefix) {
    const originNum = parseInt(originOut.replace(/^[A-Z]+/, "")) || 0;
    const destNum = parseInt(destOut.replace(/^[A-Z]+/, "")) || 0;
    drivingMinutes = 10 + Math.abs(originNum - destNum) * 4;
  } else {
    // Cross-city estimates for South Yorkshire area
    const cityDistances: Record<string, Record<string, number>> = {
      S: { DN: 25, NG: 35, WF: 30, HD: 35, DE: 30, B: 60 },
      DN: { S: 25, NG: 30, WF: 25, HD: 40 },
      NG: { S: 35, DN: 30, DE: 15, LE: 25 },
      WF: { S: 30, DN: 25, HD: 20, LS: 15 },
    };
    drivingMinutes = cityDistances[originPrefix]?.[destPrefix] || cityDistances[destPrefix]?.[originPrefix] || 45;
  }

  // Transit is typically 1.5-2x driving in this area
  const transitMinutes = Math.round(drivingMinutes * 1.7);

  return {
    drivingMinutes,
    transitMinutes,
    drivingText: `~${drivingMinutes} min (estimated)`,
    transitText: `~${transitMinutes} min (estimated)`,
  };
}
