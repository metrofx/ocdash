# OpenClaw Mobile Monitoring Dashboard – Tech Specification

## 1. Overview & Goals
A lightweight, mobile-optimized web dashboard to monitor an OpenClaw gateway.  
**Must-have metrics:**
- Cron job list (status, next/last run)
- Session list (active conversations)
- Agent list (configured agents)
- Model usage graph (last 48h)
- Token usage graph (last 48h)

Read-only; no modification actions.

## 2. Functional Requirements
- **FR1** Display cron jobs: ID, name, schedule, next run, last run, status.
- **FR2** Display sessions: ID, label, agent, model, tokens in/out, created/last activity.
- **FR3** Display agents: ID, name, model, workspace, status.
- **FR4** Show model usage time-series (last 48h): tokens per model (in/out) aggregated hourly.
- **FR5** Show total token usage time-series (last 48h): tokens in/out aggregated hourly.
- **FR6** Responsive design for mobile browsers (touch-friendly, readable without zoom).
- **FR7** Auto-refresh visible data every 60 seconds (configurable).
- **FR8** Clear error states when gateway/CLI unavailable.

## 3. Non-Functional Requirements
- **NFR1** Minimal Node.js dependencies (target <5 npm packages).
- **NFR2** Zero frontend build step – plain HTML/CSS/JS.
- **NFR3** Standalone service, separate directory (e.g., `~/openclaw-dashboard`).
- **NFR4** Data sourced via existing `openclaw` CLI (no direct DB or protocol access).
- **NFR5** Backend binds to `127.0.0.1` by default (user may proxy for remote access).

## 4. Architecture
```
Browser (mobile) → Express Backend (Node) → openclaw CLI → Gateway
                     │
                     └── Serves static index.html (Chart.js via CDN)
```
- **Backend**: Express server with cached CLI execution.
  - Endpoints return JSON.
  - Cache TTL 10–15 seconds to reduce CLI overhead.
- **Frontend**: Single-page app with tab navigation.
  - Tabs: Cron, Sessions, Agents, Model Usage, Token Usage.
  - Responsive tables for lists; Chart.js for graphs.

## 5. Tech Stack
- **Backend**: Node.js ≥18, Express, node-cache (or simple in-memory).
- **Frontend**: HTML5, CSS3, Vanilla JS, [Chart.js 4.x](https://cdn.jsdelivr.net/npm/chart.js) (CDN).
- **Deployment**: npm start script; optional systemd unit.

## 6. API Endpoints
| Method | Endpoint               | Description                                          |
|--------|------------------------|------------------------------------------------------|
| GET    | `/api/cron`            | List cron jobs (from `openclaw cron list --json`).  |
| GET    | `/api/sessions`        | List sessions (from `openclaw sessions --json`).    |
| GET    | `/api/agents`          | List agents (from `openclaw agents list --json`).   |
| GET    | `/api/usage/model`     | Time-series array: `[{time, model, in, out}, ...]` (last 48h) |
| GET    | `/api/usage/token`     | Time-series array: `[{time, in, out}, ...]` (last 48h) |

Usage endpoints process sessions, filter `createdAt` ≥ now – 48h, bucketing by hour and model.

## 7. Backend Implementation
- **CLI Runner**: `exec('openclaw <cmd> --json', { maxBuffer: 1024*1024 })`.
- **Cache**: Store `{ data, timestamp }` per endpoint key; refresh if stale.
- **Error handling**: Return `500` with JSON `{ error: message }` if CLI fails.
- **Security**: Bind to localhost. If external access needed, use reverse proxy with auth.

## 8. Frontend Implementation
- **Structure**:
  ```html
  <nav tabs>…</nav>
  <section id="cron"> <table>…</table> </section>
  <section id="sessions"> <table>…</table> </section>
  <section id="agents"> <table>…</table> </section>
  <section id="model-usage"> <canvas> chart </section>
  <section id="token-usage"> <canvas> chart </section>
  ```
- **Styling**: Mobile-first; tables horizontally scrollable; tap targets ≥44px; system fonts.
- **JS**:
  - Tab switching hides/shows sections.
  - On tab focus, `fetch()` corresponding endpoint.
  - Render tables with `Array.forEach`; format timestamps to local.
  - For charts, create `new Chart(ctx, { type: 'line', data: … })` with hourly time axis.
  - `setInterval` (60s) to refresh visible data.
- **Chart.js config**: 48 data points (hourly). Load from CDN.

## 9. Development Plan (Sprints)
Total estimated 8 days (part-time).

- **Sprint 1 (2d) – Backend Core**
  - `npm init`, install `express`, `cors` (if needed).
  - Implement CLI runner and caching.
  - Implement `/api/cron`, `/api/sessions`, `/api/agents`.
  - Test manually with `curl`.

- **Sprint 2 (2d) – Frontend Skeleton**
  - Create `index.html` with tabs and table containers.
  - basic responsive CSS.
  - Fetch and render cron/sessions/agents tables.
  - Wire tab navigation.

- **Sprint 3 (2d) – Usage Graphs**
  - Implement `/api/usage/model` and `/api/usage/token`.
  - Add `<canvas>` elements; integrate Chart.js.
  - Render hourly line charts; handle legend and tooltips.

- **Sprint 4 (1d) – Polish & Resilience**
  - Loading spinners / skeleton UI.
  - Empty states, error messages.
  - Auto-refresh toggle; manual refresh button.
  - Improve mobile UX (font sizes, contrast).

- **Sprint 5 (1d) – Packaging & Documentation**
  - Add `systemd` unit file or init script.
  - `README.md`: prerequisites, install steps, run/stop commands.
  - Health check (`GET /health` returning 200 if gateway reachable? optional).
  - Final mobile testing.

## 10. Risks & Mitigations
- **CLI performance** – Large session list could be slow. Mitigation: limit to 1000 recent sessions? CLI likely handles it; if not, add `--limit` later.
- **Gateway down** – Backend returns errors; frontend shows message.
- **No history** – We derive 48h from sessions' timestamps; if sessions older than 48h are purged, graphs become sparse. Acceptable.
- **Security** – Only localhost; user exposes at their own risk. Optional basic auth could be added later.

## 11. Open Questions
- Should the sessions table include full conversation snippets? No – just summary.
- Graph granularity: hourly buckets adequate? Yes.
- Agent status: `agents list` already includes state; use it.
- Cron list: should we show the command/payload? Not required; show name/schedule/status.
