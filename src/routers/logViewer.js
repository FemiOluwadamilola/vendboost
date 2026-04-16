const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const log = require("../utils/logger");

const LOGS_DIR = path.join(__dirname, "../../logs");

// Middleware to check if logs viewing is allowed
function isLogsAllowed(req) {
  // Only allow in development or if explicitly enabled
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_LOGS_VIEW === "true";
}

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
  try {
    const parsed = JSON.parse(log);
    const level = parsed.level || 'info';
    const timestamp = parsed.timestamp || '';
    const message = parsed.message || '';
    const stack = parsed.stack || '';
    const vendorId = parsed.vendorId || '';
    const service = parsed.service || '';

    return {
      level,
      timestamp,
      message,
      stack,
      vendorId,
      service,
      raw: log
    };
  } catch {
    return {
      level: 'info',
      timestamp: '',
      message: log,
      stack: '',
      vendorId: '',
      service: '',
      raw: log
    };
  }
}

function getLogFiles() {
  const files = [
    { name: 'combined', label: 'All Logs' },
    { name: 'error', label: 'Errors' },
    { name: 'http', label: 'HTTP' },
    { name: 'info', label: 'Info' },
    { name: 'debug', label: 'Debug' },
  ];
  return files;
}

router.get("/", async (req, res) => {
  if (!isLogsAllowed()) {
    log.warn(`Unauthorized logs access attempt from ${req.ip}`);
    return res.status(403).json({ error: "Logs viewer not available in production" });
  }

  const logType = req.query.type || 'combined';
  const limit = Math.min(parseInt(req.query.limit) || 100, 5000);
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;

  try {
    const filename = `${logType}.log`;
    const filepath = path.join(LOGS_DIR, filename);

    if (!fs.existsSync(filepath)) {
      log.warn(`Log file not found: ${filename}`);
      return res.status(404).json({ error: "Log file not found" });
    }

    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    const total = lines.length;
    const totalPages = Math.ceil(total / limit);

    // Get paginated logs (newest first)
    const paginatedLines = lines.slice(-limit - offset, -offset || undefined).reverse();

    const logs = paginatedLines.map(formatLogEntry);

    // Stats
    const stats = {
      total: total,
      error: lines.filter(l => JSON.parse(l)?.level === 'error').length,
      warn: lines.filter(l => JSON.parse(l)?.level === 'warn').length,
      info: lines.filter(l => JSON.parse(l)?.level === 'info').length,
      debug: lines.filter(l => JSON.parse(l)?.level === 'debug').length,
    };

    res.json({
      success: true,
      data: {
        logs,
        stats,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        currentType: logType,
        availableTypes: getLogFiles()
      }
    });

  } catch (err) {
    log.error(`Log viewer error: ${err.message}`, { error: err.stack });
    res.status(500).json({ error: "Failed to read logs" });
  }
});

router.get("/download", (req, res) => {
  if (!isLogsAllowed()) {
    return res.status(403).json({ error: "Logs download not available in production" });
  }

  const logType = req.query.type || 'combined';
  const filename = `${logType}.log`;
  const filepath = path.join(LOGS_DIR, filename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: "Log file not found" });
  }

  res.download(filepath, `vendboost-${logType}-${new Date().toISOString().split('T')[0]}.log`);
});

module.exports = router;
