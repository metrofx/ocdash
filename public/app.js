const API = {
  system: '/api/system',
  cron: '/api/cron',
  sessions: '/api/sessions',
  agents: '/api/agents',
  modelUsage: '/api/usage/model',
  tokenUsage: '/api/usage/token',
};

let charts = {};

function toggleSection(section) {
  const cards = document.getElementById(`${section}-cards`);
  const toggle = document.getElementById(`${section}-toggle`);
  if (cards.classList.contains('hidden')) {
    cards.classList.remove('hidden');
    toggle.style.transform = 'rotate(0deg)';
  } else {
    cards.classList.add('hidden');
    toggle.style.transform = 'rotate(-90deg)';
  }
}

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString();
}

function showStatus(msg, isError = false) {
  const el = document.getElementById('status-msg');
  el.textContent = msg;
  el.className = `text-sm ${isError ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function isToday(timestamp) {
  if (!timestamp) return false;
  const date = new Date(timestamp);
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

function truncateId(id, maxLength = 30) {
  if (!id || id.length <= maxLength) return id;
  return id.substring(0, maxLength) + '...';
}

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(0) + 'K';
  }
  return num.toString();
}

function renderSystemStatus(data) {
  document.getElementById('openclaw-version').textContent = data.openclawVersion || '-';

  const gwStatus = document.getElementById('gateway-status');
  gwStatus.textContent = data.gatewayStatus || '-';
  gwStatus.className = `font-medium ${data.gatewayStatus === 'running' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`;

  document.getElementById('system-uptime').textContent = data.systemUptime || '-';
  document.getElementById('system-os').textContent = data.systemOS || '-';
  document.getElementById('active-sessions').textContent = `${data.activeSessions || 0} / ${data.totalSessions || 0}`;
  document.getElementById('total-agents').textContent = data.totalAgents || '-';

  // Render channels status
  const channelsContainer = document.getElementById('channels-status');
  const channels = data.channels || {};

  if (Object.keys(channels).length === 0) {
    channelsContainer.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm">No channels configured</p>';
    return;
  }

  const channelNames = {
    telegram: 'Telegram',
    whatsapp: 'WhatsApp',
    discord: 'Discord',
    slack: 'Slack',
    signal: 'Signal',
    imessage: 'iMessage',
  };

  channelsContainer.innerHTML = Object.entries(channels).map(([channel, status]) => {
    const name = channelNames[channel] || channel;
    const isOnline = status && (status.status === 'connected' || status.connected);
    const statusClass = isOnline ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    const statusText = isOnline ? 'Connected' : 'Disconnected';
    const lastStatus = status && status.lastStatusAt ? `Last: ${new Date(status.lastStatusAt).toLocaleTimeString()}` : '';

    return `
      <div class="flex justify-between items-center">
        <span class="text-gray-900 dark:text-white text-sm">${name}</span>
        <div class="text-right">
          <span class="${statusClass} text-xs font-medium">${statusText}</span>
          ${lastStatus ? `<span class="text-gray-500 dark:text-gray-400 text-xs ml-2">${lastStatus}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderAgentsCards(data) {
  const container = document.getElementById('agents-cards');
  const countEl = document.getElementById('agents-count');
  const agents = Array.isArray(data) ? data : (data.agents || []);

  countEl.textContent = `(${agents.length})`;

  container.innerHTML = agents.map(a => `
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h3 class="font-semibold text-gray-900 dark:text-white">${a.name || a.id || '-'}</h3>
      <div class="mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-1">
        <p><span class="font-medium">Model:</span> ${a.model || '-'}</p>
        <p><span class="font-medium">Workspace:</span> ${a.workspace || '-'}</p>
      </div>
    </div>
  `).join('');
}

function renderSessionsCards(data) {
  const container = document.getElementById('sessions-cards');
  const countEl = document.getElementById('sessions-count');

  const todaySessions = (data.sessions || []).filter(s => {
    let created = null;
    if (s.updatedAt && s.ageMs) {
      created = s.updatedAt - s.ageMs;
    } else if (s.updatedAt) {
      created = s.updatedAt;
    }
    return isToday(created);
  });

  countEl.textContent = `(${todaySessions.length})`;

  if (todaySessions.length === 0) {
    container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm">No sessions today</p>';
    return;
  }

  container.innerHTML = todaySessions.map(s => {
    const tokens = (s.inputTokens || 0) + (s.outputTokens || 0);
    const displayId = truncateId(s.key, 35);
    return `
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 class="font-semibold text-gray-900 dark:text-white text-sm truncate" title="${s.key || ''}">${displayId}</h3>
        <div class="mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <p><span class="font-medium">Agent:</span> ${s.agentId || '-'}</p>
          <p><span class="font-medium">Model:</span> ${s.model || '-'}</p>
          <p><span class="font-medium">Tokens:</span> ${tokens.toLocaleString()}</p>
        </div>
      </div>
    `;
  }).join('');
}

function renderCronCards(data) {
  const container = document.getElementById('cron-cards');
  const countEl = document.getElementById('cron-count');

  countEl.textContent = `(${(data.jobs || []).length})`;

  container.innerHTML = (data.jobs || []).map(job => {
    const next = job.state?.nextRunAtMs ? new Date(Number(job.state.nextRunAtMs)).toLocaleString() : '-';
    const last = job.state?.lastRunAtMs ? new Date(Number(job.state.lastRunAtMs)).toLocaleString() : '-';
    const statusClass = job.enabled ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    const statusText = job.enabled ? 'enabled' : 'disabled';

    return `
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div class="flex justify-between items-start">
          <h3 class="font-semibold text-gray-900 dark:text-white">${job.name || '-'}</h3>
          <span class="px-2 py-1 text-xs rounded-full ${statusClass}">${statusText}</span>
        </div>
        <div class="mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <p><span class="font-medium">Schedule:</span> ${job.schedule?.expr || job.schedule?.every || '-'}</p>
          <p><span class="font-medium">Next:</span> ${next}</p>
          <p><span class="font-medium">Last:</span> ${last}</p>
        </div>
      </div>
    `;
  }).join('');
}

function formatHourLabel(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:00`;
}

function renderTokenUsageChart(data) {
  const ctx = document.getElementById('token-chart').getContext('2d');
  if (charts['token-chart']) charts['token-chart'].destroy();

  const times = [...new Set(data.map(d => d.time))].sort();

  const inputDataset = {
    label: 'Input Tokens',
    data: times.map(time => {
      const point = data.find(d => d.time === time);
      return point ? point.in : 0;
    }),
    borderColor: '#10b981',
    backgroundColor: '#10b981',
    fill: false,
    tension: 0.1,
    pointRadius: 0,
  };

  const outputDataset = {
    label: 'Output Tokens',
    data: times.map(time => {
      const point = data.find(d => d.time === time);
      return point ? point.out : 0;
    }),
    borderColor: '#ef4444',
    backgroundColor: '#ef4444',
    fill: false,
    tension: 0.1,
    pointRadius: 0,
  };

  charts['token-chart'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: times.map(formatHourLabel),
      datasets: [inputDataset, outputDataset],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { maxRotation: 45, minRotation: 45 } },
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return formatNumber(value);
            }
          }
        },
      },
      plugins: {
        legend: { position: 'bottom', labels: { color: '#6b7280' } },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function (context) {
              const dataset = context.dataset;
              const value = context.parsed.y;
              return `${dataset.label}: ${value.toLocaleString()} (${formatNumber(value)})`;
            }
          }
        },
      },
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
    },
  });
}

function renderModelUsageChart(data) {
  const ctx = document.getElementById('model-chart').getContext('2d');
  if (charts['model-chart']) charts['model-chart'].destroy();

  const models = [...new Set(data.map(d => d.model))].sort();
  const times = [...new Set(data.map(d => d.time))].sort();

  const colors = [
    '#4f46e5', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#a855f7'
  ];

  const datasets = [];
  models.forEach((model, idx) => {
    const color = colors[idx % colors.length];
    const combinedData = times.map(time => {
      const point = data.find(d => d.time === time && d.model === model);
      const total = point ? (point.in + point.out) : 0;
      return total;
    });

    datasets.push({
      label: model,
      data: combinedData,
      borderColor: color,
      backgroundColor: color,
      fill: false,
      tension: 0.1,
      pointRadius: 0,
    });
  });

  charts['model-chart'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: times.map(formatHourLabel),
      datasets: datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { maxRotation: 45, minRotation: 45 } },
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return formatNumber(value);
            }
          }
        },
      },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, color: '#6b7280' } },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function (context) {
              const value = context.parsed.y;
              return `${context.dataset.label}: ${value.toLocaleString()} (${formatNumber(value)})`;
            }
          }
        },
      },
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
    },
  });
}

// Scroll to top functionality
const scrollToTopBtn = document.getElementById('scroll-to-top');

window.addEventListener('scroll', () => {
  if (window.scrollY > 300) {
    scrollToTopBtn.classList.remove('opacity-0', 'pointer-events-none');
    scrollToTopBtn.classList.add('opacity-100', 'pointer-events-auto');
  } else {
    scrollToTopBtn.classList.add('opacity-0', 'pointer-events-none');
    scrollToTopBtn.classList.remove('opacity-100', 'pointer-events-auto');
  }
});

scrollToTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

function showLoading() {
  const skeletonText = '<div class="h-4 bg-gray-300 dark:bg-gray-700 rounded w-16 animate-pulse"></div>';
  const skeletonCard = `
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 animate-pulse">
      <div class="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
      <div class="mt-2 space-y-2">
        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
      </div>
    </div>
  `;
  const skeletonChannels = '<div class="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full animate-pulse my-2"></div>'.repeat(3);

  document.getElementById('openclaw-version').innerHTML = skeletonText;
  document.getElementById('gateway-status').innerHTML = skeletonText;
  document.getElementById('gateway-status').className = 'font-medium';
  document.getElementById('system-uptime').innerHTML = skeletonText;
  document.getElementById('system-os').innerHTML = skeletonText;
  document.getElementById('active-sessions').innerHTML = skeletonText;
  document.getElementById('total-agents').innerHTML = skeletonText;
  document.getElementById('channels-status').innerHTML = skeletonChannels;

  document.getElementById('agents-count').textContent = '';
  document.getElementById('agents-cards').innerHTML = skeletonCard.repeat(2);

  document.getElementById('sessions-count').textContent = '';
  document.getElementById('sessions-cards').innerHTML = skeletonCard.repeat(3);

  document.getElementById('cron-count').textContent = '';
  document.getElementById('cron-cards').innerHTML = skeletonCard.repeat(2);

  ['token-chart', 'model-chart'].forEach(id => {
    let canvas = document.getElementById(id);
    if (canvas) {
      let parent = canvas.parentNode;
      let existingSkeleton = parent.querySelector('.chart-skeleton');
      if (!existingSkeleton) {
        let el = document.createElement('div');
        el.className = 'chart-skeleton w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse rounded absolute inset-0 z-10';
        parent.appendChild(el);
      } else {
        existingSkeleton.style.display = 'block';
      }
    }
  });

  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.disabled = true;
    const w = refreshBtn.offsetWidth;
    refreshBtn.style.width = w ? `${w}px` : 'auto';
    refreshBtn.innerHTML = '<svg class="animate-spin h-5 w-5 mx-auto text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
    refreshBtn.classList.add('opacity-75', 'cursor-wait');
  }
}

function hideLoading() {
  ['token-chart', 'model-chart'].forEach(id => {
    let canvas = document.getElementById(id);
    if (canvas) {
      let parent = canvas.parentNode;
      let existingSkeleton = parent.querySelector('.chart-skeleton');
      if (existingSkeleton) {
        existingSkeleton.style.display = 'none';
      }
    }
  });

  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.disabled = false;
    refreshBtn.style.width = 'auto';
    refreshBtn.textContent = 'Refresh';
    refreshBtn.classList.remove('opacity-75', 'cursor-wait');
  }
}

async function loadAllData() {
  try {
    showStatus('Fetching latest data...');
    showLoading();

    // We could optimize further by showing individual sections as they finish,
    // but Promise.all guarantees consistency for the latest "snapshot".
    const [system, cron, sessions, agents, modelUsage, tokenUsage] = await Promise.all([
      fetchJSON(API.system),
      fetchJSON(API.cron),
      fetchJSON(API.sessions),
      fetchJSON(API.agents),
      fetchJSON(API.modelUsage),
      fetchJSON(API.tokenUsage),
    ]);

    renderSystemStatus(system);
    renderAgentsCards(agents);
    renderSessionsCards(sessions);
    renderCronCards(cron);
    renderTokenUsageChart(tokenUsage);
    renderModelUsageChart(modelUsage);

    showStatus('Last updated: ' + new Date().toLocaleTimeString());
  } catch (e) {
    showStatus(`Error: ${e.message}`, true);
    console.error(e);
  } finally {
    hideLoading();
  }
}

document.getElementById('refresh-btn').addEventListener('click', loadAllData);

// Initial load
loadAllData();
