# OpenClaw Mobile Monitoring Dashboard – Tech Specification

## 1. Overview & Goals
A lightweight, mobile-optimized web dashboard to monitor an OpenClaw gateway.  
**Must-have metrics:**
- System status: OpenClaw version, gateway status, system uptime, OS info
- Channel monitoring: Telegram, WhatsApp, and other channel connection status
- Cron job list (status, next/last run)
- Session list (today only, with token counts)
- Agent list (configured agents)
- Model usage graph (last 48h, combined input+output per model)
- Token usage graph (last 48h, simplified Y-axis: K/M)

Read-only; no modification actions.

## 2. Functional Requirements
- **FR1** Display cron jobs: name, schedule, next run, last run, status.
- **FR2** Display sessions created today: label, agent, model, tokens.
- **FR3** Display agents: name, model, workspace.
- **FR4** Show system status: OpenClaw version, gateway status, system uptime, OS, active sessions, total agents.
- **FR5** Show channel status: connection status for each configured channel.
- **FR6** Show model usage time-series (last 48h): total tokens (input+output) per model, hourly buckets.
- **FR7** Show total token usage time-series (last 48h): tokens in/out, hourly buckets, simplified Y-axis (K/M).
- **FR8** Responsive design for mobile browsers (no horizontal scrolling, card UI).
- **FR9** Manual refresh button (no auto-refresh).
- **FR10** Scroll-to-top button (appears when scrolling).
- **FR11** Collapsible agents section (default collapsed).
- **FR12** Clear error states when gateway/CLI unavailable.

## 3. Non-Functional Requirements
- **NFR1** Minimal Node.js dependencies (<5 npm packages).
- **NFR2** Zero frontend build step – plain HTML/CSS/JS with Tailwind CSS via CDN.
- **NFR3** Standalone service, separate directory (`~/openclaw-dashboard`).
- **NFR4** Data sourced via existing `openclaw` CLI (no direct DB or protocol access).
- **NFR5** Backend binds to `127.0.0.1` by default (user may proxy for remote access).
- **NFR6** Mobile-first card UI with Tailwind CSS, dark mode support.

## 4. Architecture
```
Browser (mobile) → Express Backend (Node) → openclaw CLI → Gateway
                     │
                     └── Serves static files (Chart.js & Tailwind via CDN)
```
- **Backend**: Express server with cached CLI execution (15s TTL).
  - Endpoints return JSON.
  - Health check endpoint for gateway reachability.
- **Frontend**: Single-page layout with cards, no tabs.
  - System status panel (always visible).
  - Cards for agents, sessions, cron jobs (vertical scroll, no horizontal).
  - Chart.js for usage graphs.
  - Manual refresh button at top-right.
  - Scroll-to-top button (appears when scrolling).

## 5. Tech Stack
- **Backend**: Node.js ≥18, Express, node-cache.
- **Frontend**: HTML5, Tailwind CSS (CDN), Vanilla JS, Chart.js 4.x (CDN).
- **Deployment**: npm start script; optional systemd user service.

## 6. API Endpoints
| Method | Endpoint               | Description                                          |
|--------|------------------------|------------------------------------------------------|
| GET    | `/api/system`           | System status, channels, sessions, agents counts     |
| GET    | `/api/cron`            | List cron jobs (from `openclaw cron list --all --json`). |
| GET    | `/api/sessions`        | List sessions (from `openclaw sessions --json`).    |
| GET    | `/api/agents`          | List agents (from `openclaw agents list --json`).   |
| GET    | `/api/usage/model`     | Time-series: `[{time, model, total}, ...]` (last 48h) |
| GET    | `/api/usage/token`     | Time-series: `[{time, in, out}, ...]` (last 48h)     |
| GET    | `/health`               | Gateway health check                                 |

Usage endpoints process sessions, filter `updatedAt` ≥ now – 48h, bucket by hour and model. Sessions display is filtered to `createdAt` within today.

## 7. Backend Implementation
- **CLI Runner**: `exec('openclaw <cmd> --json', { maxBuffer: 1024*1024 })`.
- **Cache**: node-cache with 15s TTL per endpoint key.
- **Error handling**: Return `500` with JSON `{ error: message }` if CLI fails.
- **Security**: Bind to localhost. Use reverse proxy with auth for external access.
- **System status**: Compute system uptime, OS info, aggregate counts, channel connection status from CLI output.

## 8. Frontend Implementation
- **Layout**: Single page with sections stacked vertically (no tabs).
- **System Status Panel**: Always visible, shows OpenClaw version, gateway status (green/red), system uptime, OS, active sessions/total, total agents, channel status.
- **Card UI**: Each item (agent, session, cron) is a card with vertical layout.
- **Agents Section**: Collapsible, default collapsed, shows cards with name, model, workspace.
- **Sessions Section**: Shows only sessions created today, cards with truncated ID, agent, model, tokens.
- **Cron Jobs Section**: Cards with name, schedule, next/last run, status badge.
- **Charts**: 
  - Token usage: line chart with input/output lines, Y-axis with K/M format.
  - Model usage: one line per model (input+output combined), Y-axis with K/M format.
- **Refresh**: Single button at top-right, fetches all data in parallel on click.
- **Scroll-to-top**: Fixed button at bottom-right, appears when scrollY > 300px, smooth scroll animation.
- **Styling**: Tailwind CSS via CDN, dark mode support, mobile-first, responsive.
- **Chart.js**: Category scale (no date adapter needed), simplified Y-axis callback.

## 9. Development Plan (Implementation Status)
All sprints completed during 2026-02-27 session.

- **Sprint 1 – Backend Core** ✅
  - Express server, CLI runner, caching implemented.
  - `/api/cron`, `/api/sessions`, `/api/agents`, `/api/system` endpoints.

- **Sprint 2 – Frontend Skeleton** ✅
  - Tailwind CSS integration, single-page layout.
  - Card UI for agents, sessions, cron jobs.

- **Sprint 3 – Usage Graphs** ✅
  - `/api/usage/model` and `/api/usage/token` endpoints.
  - Chart.js integration with simplified Y-axis (K/M).

- **Sprint 4 – UI Polish** ✅
  - System status panel, channel monitoring.
  - Manual refresh button, scroll-to-top button.
  - Collapsible agents section, sessions filtered to today.

- **Sprint 5 – Deployment & GitHub** ✅
  - README with deployment options, systemd service example.
  - .gitignore, Git repository created, pushed to GitHub (metrofx/ocdash).

## 10. Risks & Mitigations
- **CLI performance** – Sessions filter to today reduces data; CLI caching (15s) reduces overhead.
- **Gateway down** – Health check fails; system status shows "stopped" with red indicator.
- **Channel disconnection** – Channel status shows real connection status from CLI.
- **Security** – Only localhost; external access via reverse proxy with auth recommended.
- **Y-axis complexity** – Simplified to K/M format for readability.

## 11. Open Questions (Resolved)
- Auto-refresh? → Changed to manual refresh only (user requested).
- Tabs vs single page? → Single page with stacked sections (user requested).
- Card UI vs tables? → Card UI for mobile (user requested).
- Horizontal scrolling? → Eliminated, vertical card layout instead.
