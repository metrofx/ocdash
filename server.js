const express = require('express');
const { exec } = require('child_process');
const NodeCache = require('node-cache');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const cache = new NodeCache({ stdTTL: 15, checkperiod: 5 });
const OPENCLAW_CLI = 'openclaw';

app.get('/health', async (req, res) => {
  try {
    await new Promise((resolve, reject) => {
      exec(`${OPENCLAW_CLI} gateway status --json`, { maxBuffer: 1024*1024 }, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout);
      });
    });
    res.json({ status: 'ok', gateway: 'reachable' });
  } catch (e) {
    res.status(503).json({ status: 'unavailable', error: e.message });
  }
});

function runCli(command) {
  return new Promise((resolve, reject) => {
    exec(`${OPENCLAW_CLI} ${command} --json`, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      try {
        const json = JSON.parse(stdout);
        resolve(json);
      } catch (e) {
        reject(new Error(`Failed to parse JSON: ${e.message}`));
      }
    });
  });
}

async function cached(key, fetcher) {
  const cachedVal = cache.get(key);
  if (cachedVal) return cachedVal;
  try {
    const data = await fetcher();
    cache.set(key, data);
    return data;
  } catch (e) {
    cache.set(key, { error: e.message }, 5);
    throw e;
  }
}

// Get OpenClaw version via CLI
async function getOpenClawVersion() {
  try {
    const version = await new Promise((resolve, reject) => {
      exec(`${OPENCLAW_CLI} --version`, { maxBuffer: 1024 }, (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout.trim());
      });
    });
    // Also get git commit
    try {
      const commit = await new Promise((resolve, reject) => {
        exec(`${OPENCLAW_CLI} --version`, { maxBuffer: 1024 }, (error, stdout) => {
          if (error) reject(error);
          else resolve(stdout.trim());
        });
      });
      return commit;
    } catch (e) {
      return version;
    }
  } catch (e) {
    return 'unknown';
  }
}

// Get system uptime in human-readable format
function getSystemUptime() {
  const uptime = os.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Get system OS
function getSystemOS() {
  try {
    const platform = os.platform();
    const arch = os.arch();
    const release = os.release();
    const cpus = os.cpus().length;
    return `${platform} ${release} (${arch}), ${cpus} cores`;
  } catch (e) {
    return 'unknown';
  }
}

app.get('/api/system', async (req, res) => {
  try {
    // Get gateway status
    let gatewayStatus = 'stopped';
    let gatewayUptime = null;
    try {
      const gwStatus = await cached('gateway-status', () => runCli('gateway status --json'));
      if (gwStatus && gwStatus.service && gwStatus.service.runtime && gwStatus.service.runtime.status === 'running') {
        gatewayStatus = 'running';
      }
    } catch (e) {
      gatewayStatus = 'stopped';
    }

    // Get channels status
    let channelsStatus = {};
    try {
      const channels = await cached('channels-status', () => runCli('channels status --json'));
      if (channels && channels.channels) {
        // Flatten channelAccounts for easier access
        channelsStatus = {};
        Object.keys(channels.channels).forEach(channel => {
          const channelData = channels.channels[channel];
          const accounts = channels.channelAccounts && channels.channelAccounts[channel];
          
          // Check if any account is connected/running
          let isConnected = false;
          let lastStatusAt = null;
          
          if (channelData.connected) {
            isConnected = true;
            lastStatusAt = channelData.lastEventAt;
          } else if (channelData.running) {
            isConnected = true;
            lastStatusAt = channelData.lastStartAt;
          } else if (accounts && accounts.length > 0) {
            // Check accounts for connection status
            accounts.forEach(acc => {
              if (acc.connected || acc.running) {
                isConnected = true;
                lastStatusAt = acc.lastEventAt || acc.lastStartAt;
              }
            });
          }
          
          channelsStatus[channel] = {
            configured: channelData.configured,
            connected: isConnected,
            running: channelData.running,
            lastStatusAt: lastStatusAt
          };
        });
      }
    } catch (e) {
      channelsStatus = {};
    }

    // Get sessions and agents counts
    const sessions = await cached('sessions', () => runCli('sessions --json'));
    const agents = await cached('agents', () => runCli('agents list --json'));

    const activeSessions = sessions.sessions ? sessions.sessions.filter(s => {
      const now = Date.now();
      const lastActivity = s.updatedAt || (s.updatedAt && s.ageMs ? (s.updatedAt - s.ageMs) : null);
      return lastActivity && (now - lastActivity < 3600000);
    }).length : 0;

    const totalSessions = sessions.count || 0;
    const totalAgents = Array.isArray(agents) ? agents.length : (agents.agents ? agents.agents.length : 0);

    res.json({
      openclawVersion: await getOpenClawVersion(),
      gatewayStatus: gatewayStatus,
      gatewayUptime: gatewayUptime,
      systemUptime: getSystemUptime(),
      systemOS: getSystemOS(),
      activeSessions: activeSessions,
      totalSessions: totalSessions,
      totalAgents: totalAgents,
      channels: channelsStatus,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/cron', async (req, res) => {
  try {
    const data = await cached('cron', () => runCli('cron list --all --json'));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/sessions', async (req, res) => {
  try {
    const data = await cached('sessions', () => runCli('sessions --json'));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/agents', async (req, res) => {
  try {
    const data = await cached('agents', () => runCli('agents list --json'));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/usage/model', async (req, res) => {
  try {
    const sessions = await cached('sessions', () => runCli('sessions --json'));
    const now = Date.now();
    const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;
    const buckets = {};

    for (const s of sessions.sessions || []) {
      const updatedAt = s.updatedAt;
      if (!updatedAt || updatedAt < fortyEightHoursAgo) continue;
      const hourKey = new Date(updatedAt - (updatedAt % (60 * 60 * 1000))).toISOString();
      const model = s.model || 'unknown';
      if (!buckets[hourKey]) buckets[hourKey] = {};
      if (!buckets[hourKey][model]) buckets[hourKey][model] = { in: 0, out: 0 };
      buckets[hourKey][model].in += s.inputTokens || 0;
      buckets[hourKey][model].out += s.outputTokens || 0;
    }

    const result = [];
    for (const [time, models] of Object.entries(buckets)) {
      for (const [model, tokens] of Object.entries(models)) {
        result.push({ time, model, in: tokens.in, out: tokens.out });
      }
    }

    res.json(result.sort((a, b) => a.time.localeCompare(b.time) || a.model.localeCompare(b.model)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/usage/token', async (req, res) => {
  try {
    const sessions = await cached('sessions', () => runCli('sessions --json'));
    const now = Date.now();
    const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;
    const buckets = {};

    for (const s of sessions.sessions || []) {
      const updatedAt = s.updatedAt;
      if (!updatedAt || updatedAt < fortyEightHoursAgo) continue;
      const hourKey = new Date(updatedAt - (updatedAt % (60 * 60 * 1000))).toISOString();
      if (!buckets[hourKey]) buckets[hourKey] = { in: 0, out: 0 };
      buckets[hourKey].in += s.inputTokens || 0;
      buckets[hourKey].out += s.outputTokens || 0;
    }

    const result = Object.entries(buckets).map(([time, tokens]) => ({
      time,
      in: tokens.in,
      out: tokens.out,
    })).sort((a, b) => a.time.localeCompare(b.time));

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`OpenClaw Dashboard listening on http://127.0.0.1:${PORT}`);
});
