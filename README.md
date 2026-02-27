# OpenClaw Dashboard

A mobile-friendly, read-only monitoring dashboard for OpenClaw AI agents. Built with Node.js, Express, and Tailwind CSS.

## Features

- **Real-time System Status**: OpenClaw version, gateway status, system uptime, OS info
- **Channel Monitoring**: Telegram, WhatsApp, and other channel connection status
- **Session Tracking**: Filtered view of today's sessions with token counts
- **Agent Management**: Collapsible list of configured agents
- **Cron Jobs**: View scheduled jobs with status and schedules
- **Usage Analytics**: 48-hour token and model usage graphs with simplified Y-axis (K/M)

## Screenshots

- System status panel
- Card-based UI for agents, sessions, and cron jobs
- Mobile-optimized layout with Tailwind CSS
- Dark mode support

## Installation

```bash
cd ~/openclaw-dashboard
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
| GET    | `/api/usage/model`      | Model usage (last 48h, hourly)                       |
| GET    | `/api/usage/token`      | Token usage (last 48h, hourly)                       |
| GET    | `/health`               | Gateway health check                                 |

## Data Sources

The dashboard fetches all data via the OpenClaw CLI:
- `openclaw gateway status --json`
- `openclaw channels status --json`
- `openclaw sessions --json`
- `openclaw agents list --json`
- `openclaw cron list --all --json`

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
WorkingDirectory=/home/eko/openclaw-dashboard
ExecStart=/usr/bin/node /home/eko/openclaw-dashboard/server.js
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

## Security

- **Read-only**: No modification capabilities
- **Local-only**: Binds to 127.0.0.1 by default
- **No secrets stored**: Uses existing OpenClaw CLI authentication
- **Token filtering**: Sessions filter to "today" only for privacy

## Requirements

- Node.js 18+
- OpenClaw CLI installed and configured
- Gateway running and accessible via CLI

## Tech Stack

- Backend: Node.js, Express
- Frontend: HTML5, Tailwind CSS, Vanilla JS, Chart.js
- Data: OpenClaw CLI (via child_process)
- Caching: node-cache (15s TTL)

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
