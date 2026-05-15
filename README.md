# Mermaid Studio

An interactive browser-based editor for creating and exporting [Mermaid](https://mermaid.js.org/) diagrams.

## Features

- **Live preview** — diagrams render as you type (400ms debounce)
- **Template library** — 6 built-in templates (flowchart, sequence, class, state, ER, Gantt)
- **Export** — download diagrams as SVG or PNG (2x)
- **Zoom & pan** — powered by react-zoom-pan-pinch
- **Dark mode** — toggle persisted to localStorage
- **Persistence** — editor content and theme survive page reloads

## Tech Stack

React 18, TypeScript, Vite 5, Tailwind CSS 3, Mermaid 11, Lucide Icons

## Quick Start

```bash
# Dev
npm install
npm run dev

# Build
npm run build

# Docker
docker compose up -d
```
