// ================================================================
//  js/modules/gemini.js
//  All Gemini Vision API calls + prompt engineering
//
//  GET YOUR KEY: https://aistudio.google.com/app/apikey
//  For production → move key to Cloud Function (never expose client-side)
//  For hackathon demo → client-side is fine
// ================================================================

const GEMINI_KEY = "YOUR_GEMINI_API_KEY"; // ← replace this
const BASE_URL   = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL      = "gemini-1.5-flash";    // fast + free tier available

// ── Helper: file → base64 ─────────────────────────────────────
async function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ── Helper: call Gemini ───────────────────────────────────────
async function callGemini(parts, maxTokens = 512, temp = 0.1) {
  const endpoint = `${BASE_URL}/${MODEL}:generateContent?key=${GEMINI_KEY}`;
  const body = {
    contents: [{ parts }],
    generationConfig: { temperature: temp, maxOutputTokens: maxTokens }
  };
  const res  = await fetch(endpoint, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Gemini error ${res.status}`);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ── Helper: parse JSON from Gemini response ───────────────────
function parseJSON(text, fallback = {}) {
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    // try extracting first {...} block
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    return fallback;
  }
}

// ================================================================
//  PROMPT 1 — Image Understanding
//  Extracts structured object metadata from a photo
// ================================================================
export async function analyzeImage(imageFile) {
  const b64  = await toBase64(imageFile);
  const mime = imageFile.type || "image/jpeg";

  const prompt = `You are an AI assistant for a university Lost & Found system.

Analyze the uploaded photo of a lost/found item carefully.

Return ONLY a valid JSON object — no markdown, no explanation, no backticks.

Fields (use null if not visible or not applicable):
{
  "objectType": "concise item name (e.g. 'leather wallet', 'black AirPods case', 'student ID card')",
  "category": "EXACTLY one of: ID_card | wallet | electronics | keys | notebook | bag | clothing | accessories | other",
  "primaryColor": "dominant color (e.g. 'black', 'navy blue', 'beige')",
  "secondaryColor": "secondary color or null",
  "brand": "visible brand/manufacturer or null",
  "material": "material if obvious (e.g. 'leather', 'plastic', 'fabric') or null",
  "textFound": "ALL readable text — names, roll numbers, ID numbers, phone numbers, labels — exactly as written, or null",
  "distinctiveFeatures": ["array of 2-5 unique identifiers, e.g. 'gold zipper', 'has sticker', 'cracked corner', 'keychain attached'"],
  "condition": "new | good | worn | damaged",
  "description": "One clear sentence for a public listing (e.g. 'Black leather wallet with student ID inside showing name Arjun Sharma, MUJ Roll No. 2021BCE0124')",
  "analysisConfidence": "high | medium | low",
  "estimatedValue": "low | medium | high | very_high"
}`;

  const raw = await callGemini([
    { text: prompt },
    { inline_data: { mime_type: mime, data: b64 } }
  ], 600, 0.1);

  return parseJSON(raw, {
    objectType: "Unknown item",
    category: "other",
    description: "Item uploaded — details could not be extracted.",
    analysisConfidence: "low"
  });
}

// ================================================================
//  PROMPT 2 — Semantic Matching
//  Scores how likely two items are the same object
// ================================================================
export async function scoreMatch(lostItem, foundItem) {
  const prompt = `You are a matching engine for a university Lost & Found system.

Compare these two item reports and determine how likely they describe THE SAME physical object.

LOST ITEM REPORT:
Category: ${lostItem.category}
Description: ${lostItem.description || "No description"}
AI Analysis: ${JSON.stringify(lostItem.aiAnalysis || {}, null, 2)}

FOUND ITEM REPORT:
Category: ${foundItem.category}
Location found: ${foundItem.location || "unknown"}
AI Analysis: ${JSON.stringify(foundItem.aiAnalysis || {}, null, 2)}
Date found: ${foundItem.submittedAt || "unknown"}

Scoring criteria:
1. Object type & category match (weight: 25%)
2. Color match — primary + secondary (weight: 20%)
3. Text overlap — names, IDs, numbers (weight: 35% — highest weight, most reliable)
4. Brand/material match (weight: 10%)
5. Distinctive features overlap (weight: 10%)

Return ONLY valid JSON:
{
  "score": <integer 0-100>,
  "confidence": "high | medium | low",
  "matchedFields": ["list of fields that matched"],
  "reasons": ["2-3 bullet points explaining the score"],
  "recommendation": "One sentence advising what to do (e.g. 'High probability match — notify owner immediately')",
  "shouldNotify": <true if score >= 65>
}`;

  const raw = await callGemini([{ text: prompt }], 300, 0.1);
  return parseJSON(raw, { score: 0, confidence: "low", shouldNotify: false, reasons: [], recommendation: "Unable to score." });
}

// ================================================================
//  PROMPT 3 — Duplicate Detection
//  Checks if a new submission is a repost of an existing listing
// ================================================================
export async function detectDuplicate(newItem, existingItems) {
  if (!existingItems.length) return { isDuplicate: false };

  const candidates = existingItems.slice(0, 40).map(i => ({
    id: i.id,
    category: i.category,
    objectType: i.aiAnalysis?.objectType,
    color: i.aiAnalysis?.primaryColor,
    textFound: i.aiAnalysis?.textFound,
    description: i.aiAnalysis?.description,
    submittedAt: i.submittedAt
  }));

  const prompt = `You are a duplicate detection AI for a Lost & Found system.

A NEW item is being submitted. Compare it against EXISTING active listings and determine if it's a duplicate repost.

NEW ITEM:
${JSON.stringify({
  category: newItem.category,
  objectType: newItem.aiAnalysis?.objectType,
  color: newItem.aiAnalysis?.primaryColor,
  textFound: newItem.aiAnalysis?.textFound,
  description: newItem.aiAnalysis?.description
}, null, 2)}

EXISTING LISTINGS:
${JSON.stringify(candidates, null, 2)}

Return ONLY valid JSON:
{
  "isDuplicate": <true | false>,
  "duplicateId": "<id of the matching existing listing, or null>",
  "similarity": <0-100>,
  "reason": "Brief explanation"
}`;

  const raw = await callGemini([{ text: prompt }], 150, 0);
  return parseJSON(raw, { isDuplicate: false });
}
