import { scoreMatch }            from "./gemini.js";
import { getFoundItems, getLostItems, recordMatch } from "./db.js";

const NOTIFY_THRESHOLD = 65; 

export async function runLostMatch(lostItem) {
  const foundItems = await getFoundItems(100);
  return runMatch(lostItem, foundItems, "found");
}

export async function runFoundMatch(foundItem) {
  const lostItems = await getLostItems(100);
  return runMatch(foundItem, lostItems, "lost");
}

async function runMatch(queryItem, candidates, candidateType) {
  if (!candidates.length) return [];

    (c.category === queryItem.category ||
     queryItem.category === "other" ||
     c.category === "other")
  );

  if (!filtered.length) return [];

  const prescored = filtered
    .map(c => ({ item: c, pre: localScore(queryItem, c) }))
    .sort((a,b) => b.pre - a.pre)
    .slice(0, 15); 

  const results = [];
  for (let i = 0; i < prescored.length; i += 5) {
    const batch = prescored.slice(i, i+5);
    const scored = await Promise.all(batch.map(async ({ item }) => {
      const lostItem  = candidateType === "lost" ? item : queryItem;
      const foundItem = candidateType === "found" ? item : queryItem;
      const match     = await scoreMatch(lostItem, foundItem).catch(() => ({ score:0, shouldNotify:false, reasons:[] }));
      return { item, ...match };
    }));
    results.push(...scored);
  }

  results.sort((a,b) => b.score - a.score);
  const top = results[0];

  if (top && top.score >= NOTIFY_THRESHOLD) {
    const lostId  = candidateType === "lost"  ? top.item.id : queryItem.id;
    const foundId = candidateType === "found" ? top.item.id : queryItem.id;
    await recordMatch(lostId, foundId, top.score, top.recommendation);
  }

  return results.slice(0, 6);
}

export function localScore(a, b) {
  let score = 0;

  if (a.category === b.category) score += 25;

  const aAI = a.aiAnalysis || {}, bAI = b.aiAnalysis || {};

  if (aAI.primaryColor && bAI.primaryColor) {
    const ac = aAI.primaryColor.toLowerCase(), bc = bAI.primaryColor.toLowerCase();
    if (ac === bc) score += 18;
    else if (ac.includes(bc)||bc.includes(ac)) score += 8;
  }
  
  if (aAI.textFound && bAI.textFound) {
    const at = aAI.textFound.toLowerCase(), bt = bAI.textFound.toLowerCase();
    if (at === bt) score += 45;
    else if (at.includes(bt)||bt.includes(at)) score += 28;
    else {
      const wa = new Set(at.split(/\s+/)), wb = bt.split(/\s+/);
      const overlap = wb.filter(w => w.length > 3 && wa.has(w)).length;
      score += Math.min(overlap * 8, 20);
    }
  }

  if (aAI.brand && bAI.brand && aAI.brand.toLowerCase() === bAI.brand.toLowerCase()) score += 8;

  if (aAI.objectType && bAI.objectType) {
    if (aAI.objectType.toLowerCase() === bAI.objectType.toLowerCase()) score += 4;
  }

  return Math.min(score, 100);
}
