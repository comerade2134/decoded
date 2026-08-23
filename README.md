# DECODED — Dating Intelligence OS

[![Next.js 14](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Groq Cloud](https://img.shields.io/badge/Groq-Cloud_LLM-f55036?style=flat-square)](https://groq.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-13-ff0055?style=flat-square&logo=framer)](https://www.framer.com/motion/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald?style=flat-square)](LICENSE)

> An elite behavioral psychology & texting subtext analyzer engineered with radical honesty, non-neediness principles, and ultra-fast inference.

---

## ⚡ Core Systems

### 1. Voice Calibration Engine (Anti-Impostor Voiceprint)
- Calibrate your natural texting cadence with toggles for **All-Lowercase**, **Dry / Deadpan**, **Fast & Punchy (< 7 words)**, and **Zero Emoji**.
- Pass custom texting samples to mathematically constrain all suggested replies to sound unmistakably like you.

### 2. Contact Dossiers & Trajectory Tracking
- Switch between active contact profiles (`Sarah (Hinge)`, `Alex (Bumble)`, `Quick Scan`).
- Record multi-session conversation history and track momentum across scans:
  - 📈 **Accelerating Interest** (Frame holding / high engagement)
  - ⚖️ **Stable / Plateau** (Balanced frame)
  - 📉 **Decelerating / Frame Loss** (Fading / chasing dynamic)

### 3. The "Walk-Away" Dignity Diagnostic
- Automatically detects severe effort mismatch, dry responses, or fading dynamics.
- Delivers a dedicated **Walk-Away Play** with explicit dignity rules and re-engagement triggers.

### 4. High-EQ Behavioral Psychology Engine
- Built on radical honesty, non-neediness, and outcome independence (*"Fuck Yes or No"*).
- Enforces authentic human syntax: strictly 5–12 words, zero emojis, and zero pickup artist clichés.

---

## 🏗️ Architecture & Tech Stack

```
decoded/
├── app/
│   ├── api/analyze/route.ts   # Edge runtime LLM reasoning engine
│   ├── globals.css            # Dark frosted-glass design tokens & animations
│   ├── layout.tsx             # Standalone PWA shell & typography
│   └── page.tsx               # Reactive dashboard, modals & spring physics
├── lib/
│   ├── types.ts               # Data models & schemas
│   └── utils.ts               # Helper utilities
└── public/
    ├── icon-192.png           # PWA standalone application icon
    ├── icon-512.png           # High-resolution splash icon
    ├── apple-touch-icon.png   # iOS home screen icon
    └── manifest.webmanifest   # PWA manifest
```

---

## 🔐 Environment Variables

Configure the following variables in your `.env.local` or hosting provider:

| Variable | Recommended Value | Description |
| :--- | :--- | :--- |
| `LLM_API_KEY` | `gsk_...` | Groq Cloud API Key |
| `LLM_BASE_URL` | `https://api.groq.com/openai/v1` | OpenAI-compatible endpoint |
| `LLM_MODEL` | `llama-3.3-70b-versatile` | Ultra-fast high-capacity model |

> **Note:** If no API key is provided, the application runs seamlessly using its built-in rule heuristics engine.

---

## 💻 Local Setup

```bash
# Clone the repository
git clone https://github.com/comerade2134/decoded.git
cd decoded

# Install dependencies
npm install

# Run local development server
npm run dev

# Run production build validation
npm run build
```

---

## 🚀 1-Click Deployment (Vercel)

1. Push this repository to GitHub.
2. Import into **[Vercel](https://vercel.com/new)**.
3. Add your `LLM_API_KEY`, `LLM_BASE_URL`, and `LLM_MODEL` under **Environment Variables**.
4. Click **Deploy**.

---

## 🛡️ Privacy & Local Storage Guarantee

- **Zero Database Persistence**: All contact dossiers, scan histories, and voice profiles are stored exclusively in your browser's `localStorage`.
- **Zero Tracking**: Your personal conversations are never logged, stored on external servers, or used for model training.

---

## 📄 License

Distributed under the [MIT License](LICENSE).
