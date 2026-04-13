const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const LOGS_DIR = path.join(__dirname, "../../logs");

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatLogEntry(log) {
  let level = 'info';
  let timestamp = '';
  let message = '';
  let stack = '';
  
  try {
    const parsed = JSON.parse(log);
    level = parsed.level || 'info';
    timestamp = parsed.timestamp || '';
    message = parsed.message || '';
    stack = parsed.stack || '';
  } catch {
    const levelMatch = log.match(/"level":"(\w+)"/);
    if (levelMatch) level = levelMatch[1];
    const timestampMatch = log.match(/"timestamp":"([^"]+)"/);
    if (timestampMatch) timestamp = timestampMatch[1];
    message = log;
  }
  
  let html = '<div class="log-entry ' + level + '">';
  if (timestamp) {
    html += '<span class="timestamp">' + timestamp + '</span> ';
  }
  html += '[' + level.toUpperCase() + '] ' + escapeHtml(message);
  if (stack) {
    html += '<br>' + escapeHtml(stack);
  }
  html += '</div>';
  
  return html;
}

router.get("/", async (req, res) => {
  const logType = req.query.type || 'combined';
  const limit = parseInt(req.query.limit) || 500;
  
  const logFiles = {
    combined: 'combined.log',
    error: 'error.log',
    info: 'info.log',
    warn: 'warn.log',
    fatal: 'Fatal.log',
  };
  
  const filename = logFiles[logType] || 'combined.log';
  const filepath = path.join(LOGS_DIR, filename);
  
  let logs = [];
  let errorMsg = null;
  
  try {
    if (fs.existsSync(filepath)) {
      const content = fs.readFileSync(filepath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      logs = lines.slice(-limit).reverse();
    } else {
      errorMsg = 'Log file not found: ' + filename;
    }
  } catch (err) {
    errorMsg = 'Error reading log file: ' + err.message;
  }
  
  let navHtml = '';
  const types = ['combined', 'error', 'warn', 'info', 'fatal'];
  const typeLabels = { combined: 'All', error: 'Errors', warn: 'Warnings', info: 'Info', fatal: 'Fatal' };
  
  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    const active = logType === t ? ' active' : '';
    navHtml += '<a href="/logs?type=' + t + '" class="' + active + '">' + typeLabels[t] + '</a>';
  }
  
  let optionsHtml = '';
  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    const selected = logType === t ? ' selected' : '';
    optionsHtml += '<option value="' + t + '"' + selected + '>' + typeLabels[t] + '</option>';
  }
  
  let logsHtml = '';
  if (errorMsg) {
    logsHtml = '<div class="error-message">' + errorMsg + '</div>';
  } else {
    logsHtml = '<div class="log-count">Showing ' + logs.length + ' entries</div>';
    logsHtml += '<div class="log-container">';
    for (let i = 0; i < logs.length; i++) {
      logsHtml += formatLogEntry(logs[i]);
    }
    logsHtml += '</div>';
  }
  
  const html = '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'  <meta charset="UTF-8">\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'  <title>System Logs - VendBoost</title>\n' +
'  <style>\n' +
'    * { margin: 0; padding: 0; box-sizing: border-box; }\n' +
'    body {\n' +
'      font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;\n' +
'      background: #0a0f0d;\n' +
'      color: #e5e5e5;\n' +
'      padding: 20px;\n' +
'      min-height: 100vh;\n' +
'    }\n' +
'    .header {\n' +
'      display: flex;\n' +
'      justify-content: space-between;\n' +
'      align-items: center;\n' +
'      margin-bottom: 20px;\n' +
'      padding-bottom: 20px;\n' +
'      border-bottom: 1px solid #333;\n' +
'    }\n' +
'    h1 { font-size: 24px; color: #10b981; }\n' +
'    .controls { display: flex; gap: 10px; align-items: center; }\n' +
'    select, button, input {\n' +
'      padding: 8px 12px;\n' +
'      background: #1a1a1a;\n' +
'      border: 1px solid #333;\n' +
'      border-radius: 6px;\n' +
'      color: #e5e5e5;\n' +
'      font-size: 14px;\n' +
'    }\n' +
'    button {\n' +
'      background: #10b981;\n' +
'      color: #000;\n' +
'      border: none;\n' +
'      cursor: pointer;\n' +
'      font-weight: 600;\n' +
'    }\n' +
'    button:hover { background: #34d399; }\n' +
'    .log-type-links {\n' +
'      display: flex;\n' +
'      gap: 8px;\n' +
'      flex-wrap: wrap;\n' +
'    }\n' +
'    .log-type-links a {\n' +
'      padding: 6px 12px;\n' +
'      background: #1a1a1a;\n' +
'      border: 1px solid #333;\n' +
'      border-radius: 6px;\n' +
'      color: #888;\n' +
'      text-decoration: none;\n' +
'      font-size: 13px;\n' +
'      transition: all 0.2s;\n' +
'    }\n' +
'    .log-type-links a:hover, .log-type-links a.active {\n' +
'      background: #10b981;\n' +
'      color: #000;\n' +
'      border-color: #10b981;\n' +
'    }\n' +
'    .log-container {\n' +
'      background: #111;\n' +
'      border: 1px solid #222;\n' +
'      border-radius: 8px;\n' +
'      overflow: hidden;\n' +
'    }\n' +
'    .log-entry {\n' +
'      padding: 12px 16px;\n' +
'      border-bottom: 1px solid #1a1a1a;\n' +
'      font-family: \'Monaco\', \'Menlo\', monospace;\n' +
'      font-size: 12px;\n' +
'      line-height: 1.6;\n' +
'      white-space: pre-wrap;\n' +
'      word-break: break-all;\n' +
'    }\n' +
'    .log-entry:last-child { border-bottom: none; }\n' +
'    .log-entry.error { color: #f87171; border-left: 3px solid #f87171; }\n' +
'    .log-entry.warn { color: #fbbf24; border-left: 3px solid #fbbf24; }\n' +
'    .log-entry.info { color: #34d399; border-left: 3px solid #34d399; }\n' +
'    .log-entry.debug { color: #60a5fa; border-left: 3px solid #60a5fa; }\n' +
'    .log-entry.fatal { color: #ef4444; border-left: 3px solid #ef4444; }\n' +
'    .timestamp { color: #666; }\n' +
'    .error-message {\n' +
'      padding: 20px;\n' +
'      background: #1a1515;\n' +
'      border: 1px solid #f87171;\n' +
'      border-radius: 8px;\n' +
'      color: #f87171;\n' +
'    }\n' +
'    .log-count {\n' +
'      color: #666;\n' +
'      font-size: 14px;\n' +
'      margin-bottom: 10px;\n' +
'    }\n' +
'  </style>\n' +
'</head>\n' +
'<body>\n' +
'  <div class="header">\n' +
'    <div>\n' +
'      <h1>System Logs</h1>\n' +
'      <div class="log-type-links" style="margin-top: 12px;">\n' +
        navHtml + '\n' +
'      </div>\n' +
'    </div>\n' +
'    <div class="controls">\n' +
'      <form method="get" style="display:flex;gap:10px;">\n' +
'        <select name="type">\n' +
          optionsHtml + '\n' +
'        </select>\n' +
'        <input type="number" name="limit" value="' + limit + '" min="10" max="5000" style="width:80px;" placeholder="Lines">\n' +
'        <button type="submit">Refresh</button>\n' +
'        <button type="button" onclick="location.reload()">Auto Refresh</button>\n' +
'      </form>\n' +
'    </div>\n' +
'  </div>\n' +
  logsHtml + '\n' +
'</body>\n' +
'</html>';
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

module.exports = router;