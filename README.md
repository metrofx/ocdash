# OpenClaw Dashboard

A mobile-friendly, read-only monitoring dashboard for OpenClaw AI agents. Built with Node.js, Express, and Tailwind CSS.

## Features

- **Real-time System Status**: OpenClaw version, gateway status, system uptime, OS info, active sessions/total, total agents
- **Channel Monitoring**: Telegram, WhatsApp, and other channel connection status with real-time indicators
- **Session Tracking**: Filtered view of today's sessions with token counts (truncated IDs, no horizontal scroll)
- **Agent Management**: Collapsible list of configured agents (default collapsed to reduce clutter)
- **Cron Jobs**: View scheduled jobs with status badges, next/last run times
- **Usage Analytics**: 48-hour token and model usage graphs with simplified Y-axis (K/M format)
- **Mobile-First UI**: Card-based layout, no horizontal scrolling, Tailwind CSS styling
- **Dark Mode Support**: Automatic dark mode based on system preference
- **Manual Refresh**: Single refresh button fetches all data in parallel
- **Scroll-to-Top**: Floating button appears when scrolling down

## Screenshots

- System status panel with gateway and channel indicators
- Card-based UI for agents, sessions, and cron jobs
- Mobile-optimized vertical layout
- Simplified chart Y-axis (200K, 1.5M, etc.)

## Installation

```bash
cd openclaw-dashboard
npm install
```

## Running

```bash
npm start
```

The dashboard will be available at http://127.0.0.1:3000

## API Endpoints

| Method | Endpoint               | Description                                          |
|--------|------------------------|------------------------------------------------------|
| GET    | `/api/system`           | System status, channels, sessions, agents counts     |
| GET    | `/api/cron`             | Cron jobs list                                      |
| GET    | `/api/sessions`         | Sessions list                                       |
| GET    | `/api/agents`           | Agents list                                          |
| GET    | `/api/usage/model`      | Model usage (last 48h, hourly, combined input+output)|
| GET    | `/api/usage/token`      | Token usage (last 48h, hourly)                       |
| GET    | `/health`               | Gateway health check                                 |

## Data Sources

The dashboard fetches all data via the OpenClaw CLI:
- `openclaw --version` (version detection)
- `openclaw gateway status --json` (gateway status)
- `openclaw channels status --json` (channel connections)
- `openclaw sessions --json` (sessions, filtered to today)
- `openclaw agents list --json` (agents list)
- `openclaw cron list --all --json` (cron jobs)

## Deployment Options

### Manual
```bash
npm start
```

### systemd (user service)

Create `~/.config/systemd/user/openclaw-dashboard.service`:

```ini
[Unit]
Description=OpenClaw Dashboard
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/openclaw-dashboard
ExecStart=%h/openclaw-dashboard/node_modules/.bin/node %h/openclaw-dashboard/server.js
Restart=on-failure
Environment=PORT=3000

[Install]
WantedBy=default.target
```

Then:
```bash
systemctl --user enable --now openclaw-dashboard
```

### Reverse Proxy (for external access)

Use nginx or Traefik with basic auth to expose the dashboard securely.

### Expose via ngrok (for testing)

```bash
ngrok http 3000
```

## Security

- **Read-only**: No modification capabilities
- **Local-only**: Binds to 127.0.0.1 by default
- **No secrets stored**: Uses existing OpenClaw CLI authentication
- **Token filtering**: Sessions filter to "today" only for privacy
- **Channel authentication**: Uses OpenClaw's configured tokens via CLI

## Requirements

- Node.js 18+
- OpenClaw CLI installed and configured
- Gateway running and accessible via CLI

## Tech Stack

- **Backend**: Node.js, Express, node-cache
- **Frontend**: HTML5, Tailwind CSS (CDN), Vanilla JS, Chart.js 4.x (CDN)
- **Data**: OpenClaw CLI (via child_process)
- **Caching**: node-cache (15s TTL)

## Project Structure

```
openclaw-dashboard/
├── server.js              # Express backend with API endpoints
├── package.json           # Dependencies
├── README.md              # This file
├── SPEC.md                # Technical specification
├── .gitignore             # Git ignore rules
└── public/
    ├── index.html         # Single-page HTML
    ├── app.js            # Frontend JavaScript
    └── styles.css        # Custom CSS overrides
```

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Credits

Built for monitoring OpenClaw AI agents in a mobile-friendly, read-only interface.
