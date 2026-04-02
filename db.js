import { db, storage } from "./firebase.js";
import {
  collection, addDoc, getDocs, getDoc, doc, updateDoc,
  deleteDoc, query, where, orderBy, limit,
  serverTimestamp, onSnapshot, writeBatch, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const EXPIRY_DAYS = 30;
const FOUND_COL   = "found_items";
const LOST_COL    = "lost_items";
const MATCH_COL   = "matches";

export async function uploadImage(file, folder = "items") {
  const ext      = file.name.split(".").pop() || "jpg";
  const filename = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const r        = ref(storage, filename);
  const snap     = await uploadBytes(r, file);
  return { url: await getDownloadURL(snap.ref), path: filename };
}
export async function submitFoundItem(data) {
  const { imageFile, category, location, contactEmail, aiAnalysis } = data;

  let imageUrl = null, imagePath = null;
  if (imageFile) {
    const upload = await uploadImage(imageFile, "found");
    imageUrl  = upload.url;
    imagePath = upload.path;
  }

  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 864e5);

  const docRef = await addDoc(collection(db, FOUND_COL), {
    type:         "found",
    category:     category || "other",
    location:     location || "Campus",
    contactEmail: contactEmail || null,
    imageUrl,
    imagePath,
    aiAnalysis:   aiAnalysis || null,
    status:       "active",     
    matchedWith:  null,
    matchScore:   null,
    submittedAt:  serverTimestamp(),
    expiresAt:    Timestamp.fromDate(expiresAt),
    viewCount:    0
  });

  return docRef.id;
}

export async function submitLostItem(data) {
  const { imageFile, category, description, location, contactEmail, contactPhone, aiAnalysis } = data;

  let imageUrl = null, imagePath = null;
  if (imageFile) {
    const upload = await uploadImage(imageFile, "lost");
    imageUrl  = upload.url;
    imagePath = upload.path;
  }

  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 864e5);

  const docRef = await addDoc(collection(db, LOST_COL), {
    type:         "lost",
    category:     category || "other",
    description:  description || null,
    location:     location || "Campus",
    contactEmail: contactEmail || null,
    contactPhone: contactPhone || null,
    imageUrl,
    imagePath,
    aiAnalysis:   aiAnalysis || null,
    status:       "active",
    matchedWith:  null,
    matchScore:   null,
    submittedAt:  serverTimestamp(),
    expiresAt:    Timestamp.fromDate(expiresAt)
  });

  return docRef.id;
}

export async function getFoundItems(n = 100) {
  const q    = query(collection(db, FOUND_COL), where("status","==","active"), orderBy("submittedAt","desc"), limit(n));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getLostItems(n = 100) {
  const q    = query(collection(db, LOST_COL), where("status","==","active"), orderBy("submittedAt","desc"), limit(n));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getAllForAdmin() {
  const [fs, ls] = await Promise.all([
    getDocs(query(collection(db, FOUND_COL), orderBy("submittedAt","desc"))),
    getDocs(query(collection(db, LOST_COL),  orderBy("submittedAt","desc")))
  ]);
  const found = fs.docs.map(d => ({ id: d.id, _col: FOUND_COL, ...d.data() }));
  const lost  = ls.docs.map(d => ({ id: d.id, _col: LOST_COL,  ...d.data() }));
  return [...found, ...lost].sort((a,b) => (b.submittedAt?.seconds||0)-(a.submittedAt?.seconds||0));
}

export async function recordMatch(lostId, foundId, score, recommendation) {
  await Promise.all([
    updateDoc(doc(db, LOST_COL,  lostId),  { status:"matched", matchedWith:foundId, matchScore:Math.round(score) }),
    updateDoc(doc(db, FOUND_COL, foundId), { status:"matched", matchedWith:lostId,  matchScore:Math.round(score) }),
    addDoc(collection(db, MATCH_COL), {
      lostId, foundId,
      score:          Math.round(score),
      recommendation: recommendation || null,
      notified:       false,
      createdAt:      serverTimestamp()
    })
  ]);
}
export async function getAnalytics() {
  const [fs, ls, ms] = await Promise.all([
    getDocs(collection(db, FOUND_COL)),
    getDocs(collection(db, LOST_COL)),
    getDocs(collection(db, MATCH_COL))
  ]);

  const found   = fs.docs.map(d => d.data());
  const lost    = ls.docs.map(d => d.data());
  const matches = ms.docs.length;

  const totalLost    = lost.length;
  const totalFound   = found.length;
  const recoveryRate = totalLost > 0 ? Math.round((matches / totalLost) * 100) : 0;

  const catCount = {};
  [...found, ...lost].forEach(i => { catCount[i.category] = (catCount[i.category]||0)+1; });
  const topCat = Object.entries(catCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || "—";

  const activeFound   = found.filter(i=>i.status==="active").length;
  const activeLost    = lost.filter(i=>i.status==="active").length;

  return { totalFound, totalLost, matches, recoveryRate, topCat, catCount, activeFound, activeLost };
}

export async function archiveExpired() {
  const now = Timestamp.now();
  for (const col of [FOUND_COL, LOST_COL]) {
    const q    = query(collection(db, col), where("status","==","active"));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => {
      if (d.data().expiresAt?.seconds < now.seconds) {
        batch.update(d.ref, { status:"expired" });
      }
    });
    await batch.commit();
  }
}

export async function deleteItem(colName, id, imagePath) {
  await deleteDoc(doc(db, colName, id));
  if (imagePath) {
    try { await deleteObject(ref(storage, imagePath)); } catch {}
  }
}

export function listenFeed(callback) {
  const qF = query(collection(db, FOUND_COL), orderBy("submittedAt","desc"), limit(30));
  const qL = query(collection(db, LOST_COL),  orderBy("submittedAt","desc"), limit(30));

  let F = [], L = [];
  const merge = () => {
    const all = [...F, ...L].sort((a,b)=>(b.submittedAt?.seconds||0)-(a.submittedAt?.seconds||0));
    callback(all);
  };

  const u1 = onSnapshot(qF, s => { F = s.docs.map(d=>({id:d.id,...d.data()})); merge(); });
  const u2 = onSnapshot(qL, s => { L = s.docs.map(d=>({id:d.id,...d.data()})); merge(); });

  return () => { u1(); u2(); }; 
}
