# FindIt — AI-Based Lost & Found System

 A smart lost-and-found platform that uses computer vision and AI to automatically match lost items with found reports eliminating the chaos of WhatsApp groups and manual coordination.

---

## 🔍 Problem Statement

Every day, people lose wallets, ID cards, keys, and electronics. The current "system" is posting in WhatsApp groups and hoping someone sees it. Items go unreturned not because nobody found them but because the right people never connected.

**FindIt removes that uncertainity.**

---

## 💡 What I Built

A full-stack web application with two core flows:

**Found an item →**
Upload a photo → AI reads it automatically → Submit → System scans all lost reports → Notifies owner if match found.

**Lost an item →**
Upload reference photo → AI extracts details → System instantly scans all found reports → Shows ranked matches with confidence scores.

---

## 🤖 How the AI Works

### Step 1 — Image Understanding (Gemini Vision)
When a photo is uploaded, I send it to the **Google Gemini 1.5 Flash** API with a carefully engineered prompt that extracts:
- Object type (wallet, ID card, earphones)
- Visible text — names, roll numbers, phone numbers
- Color, brand, material, condition
- Distinctive features (stickers, cracks, keychains)

Example output for a found wallet:
```
"Black leather wallet. Student ID inside: Arjun Sharma, MUJ Roll No. 2021BCE0124. Gold zipper."
```

### Step 2 — Confidence-Scored Matching
When a new item is submitted, my matching engine:
1. **Pre-filters** by category (cheap, instant)
2. Runs a **local scoring algorithm** on color, text, and brand overlap.
3. Sends top candidates to **Gemini** for semantic comparison.
4. Returns a **0–100% confidence score** with reasoning.

Matching weights I designed:

| Signal | Weight |
|---|---|
| Extracted text (names, IDs) | 35% |
| Category match | 25% |
| Color match | 20% |
| Brand/material | 10% |
| Distinctive features | 10% |

### Step 3 — Smart Notification
If confidence ≥ 65%, the owner is notified automatically via email. No public posts. No admin involvement. Contact details stay private until a match is confirmed.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| AI / Vision | Google Gemini 1.5 Flash API |
| Database | Firebase Firestore |
| Image Handling | Canvas API (client-side resize + base64) |
| Hosting | Firebase Hosting |
| Notifications | Firebase Cloud Functions + Nodemailer |
| Frontend | Vanilla HTML, CSS, JavaScript (ES Modules) |

---

## ✨ Features

- **Gemini Vision Analysis** — structured JSON extraction from any photo.
- **Duplicate Detection** — AI flags reposts before they go live.
- **Confidence Scoring** — every match gets a 0–100% score with reasons.
- **Privacy Mode** — contact details hidden until match confirmed.
- **Auto-Expiry** — listings auto archive after 30 days via Cloud Functions.
- **Admin Dashboard** — recovery rate, category breakdown, full listings table.
- **Real-time Feed** — live updates using Firestore onSnapshot listeners.
- **Drag & Drop Upload** — with instant client side preview.
- **Mobile Responsive** — works on any device.

---

## 🚀 Live Demo

**https://ai-findit.web.app**
---



## 👩‍💻 Developer

**Krisha Kohli**, 
B.Tech Computer Science, Manipal University Jaipur

---
