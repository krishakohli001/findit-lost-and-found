// ================================================================
//  functions/index.js  —  Firebase Cloud Functions
//
//  Triggers:
//  1. onMatchCreated  → sends email to item owner when match is recorded
//  2. autoArchive     → daily job to expire old listings
//
//  Deploy: firebase deploy --only functions
//  Set secrets: firebase functions:secrets:set MAIL_USER
//               firebase functions:secrets:set MAIL_PASS
// ================================================================

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule }        = require("firebase-functions/v2/scheduler");
const { defineSecret }      = require("firebase-functions/params");
const { initializeApp }     = require("firebase-admin/app");
const { getFirestore, Timestamp, writeBatch } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");

initializeApp();
const db = getFirestore();

const MAIL_USER = defineSecret("MAIL_USER");
const MAIL_PASS = defineSecret("MAIL_PASS");

// ── 1. Email notification on match ───────────────────────────
exports.onMatchCreated = onDocumentCreated(
  { document: "matches/{matchId}", secrets: [MAIL_USER, MAIL_PASS] },
  async (event) => {
    const match = event.data.data();
    const { lostId, foundId, score, recommendation } = match;

    try {
      const [lostDoc, foundDoc] = await Promise.all([
        db.collection("lost_items").doc(lostId).get(),
        db.collection("found_items").doc(foundId).get()
      ]);

      if (!lostDoc.exists || !foundDoc.exists) return;

      const lost  = lostDoc.data();
      const found = foundDoc.data();
      const ownerEmail  = lost?.contactEmail;
      const finderEmail = found?.contactEmail;

      if (!ownerEmail) { console.log("No owner email — skip notification"); return; }

      const transport = nodemailer.createTransport({
        service: "gmail",
        auth: { user: MAIL_USER.value(), pass: MAIL_PASS.value() }
      });

      await transport.sendMail({
        from:    `"FindIt Campus" <${MAIL_USER.value()}>`,
        to:      ownerEmail,
        subject: `🎯 ${Math.round(score)}% match found for your lost ${lost?.aiAnalysis?.objectType || lost?.category}`,
        html: `
          <!DOCTYPE html>
          <html><body style="font-family:sans-serif;background:#080810;color:#f0eff8;padding:0;margin:0">
          <div style="max-width:520px;margin:0 auto;padding:40px 20px">
            <div style="text-align:center;margin-bottom:32px">
              <span style="font-size:2.5rem">🎯</span>
              <h1 style="font-size:1.6rem;font-weight:800;margin:12px 0 4px;letter-spacing:-0.03em">We found a match!</h1>
              <p style="color:#a09ec0;font-size:0.9rem">AI confidence: <strong style="color:#f59e0b">${Math.round(score)}%</strong></p>
            </div>

            <div style="background:#14141f;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:20px;margin-bottom:20px">
              <div style="font-size:0.72rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#a09ec0;margin-bottom:8px">Your lost item</div>
              <div style="font-weight:600">${lost?.aiAnalysis?.objectType || lost?.category || "Item"}</div>
              <div style="font-size:0.85rem;color:#a09ec0;margin-top:4px">${lost?.aiAnalysis?.description || lost?.description || ""}</div>
            </div>

            <div style="background:#14141f;border:1px solid rgba(245,158,11,0.3);border-radius:14px;padding:20px;margin-bottom:20px">
              <div style="font-size:0.72rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#f59e0b;margin-bottom:8px">Found item match</div>
              <div style="font-weight:600">${found?.aiAnalysis?.objectType || found?.category || "Item"}</div>
              <div style="font-size:0.85rem;color:#a09ec0;margin-top:4px">${found?.aiAnalysis?.description || ""}</div>
              <div style="font-size:0.85rem;margin-top:8px">📍 Found at: <strong>${found?.location || "Campus"}</strong></div>
              ${finderEmail ? `<div style="font-size:0.85rem;margin-top:4px">📧 Finder: <a href="mailto:${finderEmail}" style="color:#f59e0b">${finderEmail}</a></div>` : ""}
            </div>

            ${recommendation ? `<div style="font-size:0.85rem;color:#a09ec0;margin-bottom:20px;padding:12px;background:#1c1c2a;border-radius:8px"><strong style="color:#f0eff8">AI says:</strong> ${recommendation}</div>` : ""}

            <div style="text-align:center">
              <a href="https://YOUR-PROJECT.web.app"
                 style="display:inline-block;background:#f59e0b;color:#080810;font-weight:700;font-size:0.9rem;
                        padding:12px 28px;border-radius:10px;text-decoration:none">
                View on FindIt →
              </a>
            </div>

            <p style="text-align:center;font-size:0.75rem;color:#5a5870;margin-top:32px">
              FindIt — AI Lost & Found &nbsp;·&nbsp; This is an automated notification.<br/>
              Your contact details are shared only with confirmed matches.
            </p>
          </div>
          </body></html>`
      });

      await db.collection("matches").doc(event.params.matchId).update({ notified: true, notifiedAt: Timestamp.now() });
      console.log(`✅ Match email sent to ${ownerEmail} (score: ${score}%)`);

    } catch (err) {
      console.error("Email notification failed:", err.message);
    }
  }
);

// ── 2. Daily auto-archive ─────────────────────────────────────
exports.autoArchive = onSchedule("every 24 hours", async () => {
  const now     = Timestamp.now();
  const cutoff  = Timestamp.fromMillis(now.toMillis() - 30 * 24 * 3600 * 1000);
  let   archived = 0;

  for (const col of ["found_items", "lost_items"]) {
    const snap  = await db.collection(col).where("status","==","active").where("submittedAt","<",cutoff).get();
    const batch = writeBatch(db);
    snap.docs.forEach(d => { batch.update(d.ref, { status:"expired" }); archived++; });
    await batch.commit();
  }

  console.log(`✅ Auto-archived ${archived} expired items`);
});
