let _stack = null;
function getStack() {
  if (!_stack) {
    _stack = document.createElement("div");
    _stack.className = "toast-stack";
    document.body.appendChild(_stack);
  }
  return _stack;
}

export function toast(title, body = "", type = "t-success", duration = 4500) {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<div class="toast-title">${title}</div>${body ? `<div class="toast-body">${body}</div>` : ""}`;
  const stack = getStack();
  stack.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

export function setLoading(btn, on, text = "") {
  if (on) {
    btn._orig    = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="dots"><span></span><span></span><span></span></span>${text ? " "+text : ""}`;
  } else {
    btn.disabled  = false;
    btn.innerHTML = btn._orig || text;
  }
}

export function reltime(ts) {
  if (!ts) return "just now";
  const d    = ts.toDate ? ts.toDate() : new Date(ts);
  const secs = Math.floor((Date.now() - d) / 1000);
  if (secs < 60)   return "just now";
  if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
  if (secs < 86400)return `${Math.floor(secs/3600)}h ago`;
  return d.toLocaleDateString("en-IN", { day:"numeric", month:"short" });
}

export function catEmoji(cat) {
  return { ID_card:"🪪", wallet:"👛", electronics:"📱", keys:"🔑",
           notebook:"📓", bag:"🎒", clothing:"👕", accessories:"⌚", other:"📦" }[cat] || "📦";
}

export function scoreClass(n) {
  if (n >= 70) return "score-high";
  if (n >= 40) return "score-mid";
  return "score-low";
}

export function renderCard(item) {
  const isFound   = item.type === "found";
  const ai        = item.aiAnalysis || {};
  const title     = ai.objectType || item.category || "Item";
  const desc      = ai.description || item.description || "";
  const imgHtml   = item.imageUrl
    ? `<img src="${item.imageUrl}" alt="${title}" loading="lazy"/>`
    : `${catEmoji(item.category)}`;
  const typeBadge = isFound ? `<span class="card-img-badge badge-found">Found</span>` : `<span class="card-img-badge badge-lost">Lost</span>`;
  const matchBadge= item.status === "matched" ? `<span class="card-img-badge badge-matched" style="left:auto;right:10px">Matched</span>` : "";
  const matchBar  = item.matchScore
    ? `<div class="match-bar-wrap"><div class="match-bar"><div class="match-fill" style="width:${item.matchScore}%"></div></div><div class="match-pct">${item.matchScore}%</div></div>` : "";
  const textPill  = ai.textFound ? `<span class="card-pill amber" title="${ai.textFound}">📋 ${ai.textFound.slice(0,24)}${ai.textFound.length>24?"…":""}</span>` : "";
  const colorPill = ai.primaryColor ? `<span class="card-pill">🎨 ${ai.primaryColor}</span>` : "";

  return `
    <div class="item-card${item.status==="matched"?" is-matched":""}" data-id="${item.id}" data-type="${item.type||"found"}">
      <div class="card-img">
        ${typeBadge}${matchBadge}
        ${imgHtml}
      </div>
      <div class="card-body">
        <div class="card-title">${title}</div>
        ${desc ? `<div class="card-desc">${desc}</div>` : ""}
        <div class="card-meta">
          ${colorPill}${textPill}
          <span class="card-time">${reltime(item.submittedAt)}</span>
        </div>
        ${matchBar}
      </div>
    </div>`;
}

export function fillAIPanel(ai, panelId = "aiPanel") {
  const p = document.getElementById(panelId);
  if (!p) return;
  p.style.display = "block";
  const set = (id, val, highlight=false) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = val || "—";
    if (highlight) el.classList.add("highlight");
  };
  set("aiObjectType", ai.objectType);
  set("aiColor",      ai.primaryColor ? `${ai.primaryColor}${ai.secondaryColor?` + ${ai.secondaryColor}`:""}` : null);
  set("aiBrand",      ai.brand);
  set("aiMaterial",   ai.material);
  set("aiText",       ai.textFound, !!ai.textFound);
  set("aiFeatures",   ai.distinctiveFeatures?.join(", ") || null);
  set("aiDesc",       ai.description);
  set("aiCondition",  ai.condition);
}
