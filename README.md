<p align="center">
  <img src="https://img.shields.io/badge/STATUS-ONLINE-00ff88?style=for-the-badge&labelColor=0A0A0A" alt="Status" />
  <img src="https://img.shields.io/badge/REACT-19-61DAFB?style=for-the-badge&logo=react&labelColor=0A0A0A" alt="React" />
  <img src="https://img.shields.io/badge/VITE-8-646CFF?style=for-the-badge&logo=vite&labelColor=0A0A0A" alt="Vite" />
  <img src="https://img.shields.io/badge/TAILWIND-4-06B6D4?style=for-the-badge&logo=tailwindcss&labelColor=0A0A0A" alt="Tailwind" />
  <img src="https://img.shields.io/badge/LICENSE-MIT-FFD700?style=for-the-badge&labelColor=0A0A0A" alt="License" />
</p>

<h1 align="center">⬡ SENTINEL ENGINE</h1>
<p align="center"><strong>Autonomous Market Intelligence for Global Logistics</strong></p>
<p align="center"><em>Middleware-free intelligence pipeline powered by post-quantum secure edge infrastructure.</em></p>

---

## Overview

Sentinel Engine replaces static data silos with a **real-time intelligence pipeline** that aggregates, sanitizes, and serves global logistics market data — all without external middleware dependencies.

The system ingests live feeds from **Freightos**, **Xeneta**, and **MarineTraffic**, pipes them through an Apps Script sanitizer into a centralized Source Alpha (Google Doc), and delivers queryable intelligence through NotebookLM's 60-minute refresh cycle.

### Key Capabilities

| Feature | Description |
|---|---|
| **Live Feed Ticker** | Real-time freight rates, port congestion, and maritime intelligence |
| **Query Terminal** | Interactive CLI to query logistics data with simulated AI responses |
| **Sync Tracker** | Visual pipeline monitor showing Source Alpha → NotebookLM → Engine sync status |
| **Post-Quantum Security** | CRYSTALS-Kyber encryption simulation with PQ-TLS handshake UI |
| **Bilingual (EN/ES)** | Full internationalization with one-click language toggle |
| **System Architecture View** | Six-layer pipeline visualization from data sources to client interface |

## Tech Stack

- **React 19** — UI framework with hooks-based architecture
- **Vite 8** — Lightning-fast dev server and build tool
- **Tailwind CSS 4** — Utility-first styling with custom design tokens
- **Lucide React** — Icon system
- **JetBrains Mono + Inter** — Typography stack

## Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x

### Installation

```bash
# Clone the repository
git clone https://github.com/Hypgnosis/Sentinel-Engine.git
cd Sentinel-Engine

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build for Production

```bash
npm run build
npm run preview
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Data Sources (Freightos · Xeneta · MarineTraffic) │
└──────────────────────┬──────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  Apps Script Sanitizer — Autonomous cleansing    │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  Source Alpha — Centralized Google Doc (Markdown) │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  NotebookLM Ingestion — 60-min refresh cycle     │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  Sentinel Engine — Edge-compute intelligence     │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  Client Interface — React PWA + Post-Quantum TLS │
└──────────────────────────────────────────────────┘
```

## Project Structure

```
sentinel-engine/
├── public/              # Static assets, favicon, manifest
├── src/
│   ├── App.jsx          # Main application (all components)
│   ├── App.css          # Component-specific styles
│   ├── index.css        # Global styles, design tokens, animations
│   ├── main.jsx         # React entry point
│   └── assets/          # Images and media
├── index.html           # HTML entry with SEO meta tags
├── vite.config.js       # Vite configuration
├── eslint.config.js     # ESLint configuration
└── package.json         # Dependencies and scripts
```

## Design System

The UI follows a **cyberpunk-industrial** aesthetic with a custom token system:

| Token | Value | Usage |
|---|---|---|
| `--obsidian` | `#0A0A0A` | Primary background |
| `--cyber-purple` | `#BC13FE` | Accent color, interactive elements |
| `--amber-gold` | `#FFD700` | Secondary accent, data highlights |
| `--text-primary` | `#E8E8E8` | Primary text |

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>High Archytech Solutions</strong><br/>
  <em>We don't build websites. We build autonomous systems.</em><br/>
  <a href="https://high-archy.tech">high-archy.tech</a>
</p>
