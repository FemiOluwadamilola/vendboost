const { fork } = require('child_process');
const path = require('path');
const WhatsAppSession = require('../models/WhatsappSession');
const log = require('../utils/logger');

const vendorProcesses = new Map();
const vendorCallbacks = new Map();
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;
const MAX_MEMORY_MB = 512;

const PROCESS_EVENTS = {
  QR: 'qr',
  READY: 'ready',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
  AUTH_FAILURE: 'auth_failure',
  INIT_ERROR: 'init_error',
  PONG: 'pong',
  STATUS: 'status'
};

function setupProcessListeners(vendorIdStr, child) {
  child.on('message', async (msg) => {
    log.info(`[ProcessManager] ${vendorIdStr} received: ${msg.type}`);
    
    switch (msg.type) {
      case PROCESS_EVENTS.QR:
        vendorCallbacks.get(vendorIdStr)?.('qr', msg.qr);
        break;
        
      case PROCESS_EVENTS.READY:
        vendorCallbacks.get(vendorIdStr)?.('ready');
        break;
        
      case PROCESS_EVENTS.DISCONNECTED:
        vendorCallbacks.get(vendorIdStr)?.('disconnected', msg.reason);
        handleProcessExit(vendorIdStr, 'disconnected');
        break;
        
      case PROCESS_EVENTS.ERROR:
        log.error(`[ProcessManager] ${vendorIdStr} error:`, msg.error);
        vendorCallbacks.get(vendorIdStr)?.('error', msg.error);
        break;
        
      case PROCESS_EVENTS.AUTH_FAILURE:
        log.error(`[ProcessManager] ${vendorIdStr} auth failure:`, msg.message);
        vendorCallbacks.get(vendorIdStr)?.('auth_failure', msg.message);
        handleProcessExit(vendorIdStr, 'auth_failed');
        break;
        
      case PROCESS_EVENTS.INIT_ERROR:
        log.error(`[ProcessManager] ${vendorIdStr} init error:`, msg.error);
        vendorCallbacks.get(vendorIdStr)?.('init_error', msg.error);
        handleProcessExit(vendorIdStr, 'error');
        break;
        
      case PROCESS_EVENTS.PONG:
        const retryCount = vendorProcesses.get(vendorIdStr)?.retryCount || 0;
        vendorProcesses.get(vendorIdStr).isHealthy = true;
        vendorProcesses.get(vendorIdStr).retryCount = 0;
        break;
        
      case PROCESS_EVENTS.STATUS:
        vendorCallbacks.get(vendorIdStr)?.('status', msg.status);
        break;
    }
  });

  child.on('error', (err) => {
    log.error(`[ProcessManager] ${vendorIdStr} process error:`, err.message);
    handleProcessExit(vendorIdStr, 'process_error');
  });

  child.on('exit', (code, signal) => {
    log.info(`[ProcessManager] ${vendorIdStr} process exited with code ${code}, signal ${signal}`);
    handleProcessExit(vendorIdStr, code === 0 ? 'normal' : 'crashed');
  });
}

async function handleProcessExit(vendorIdStr, reason) {
  const processInfo = vendorProcesses.get(vendorIdStr);
  if (!processInfo) return;

  const { child, retryCount = 0 } = processInfo;
  
  try {
    await WhatsAppSession.findOneAndUpdate(
      { vendor: vendorIdStr },
      { status: reason === 'normal' ? 'destroyed' : 'disconnected', lastSeen: new Date() }
    );
  } catch (err) {
    log.error(`[ProcessManager] Failed to update session status for ${vendorIdStr}:`, err.message);
  }

  vendorProcesses.delete(vendorIdStr);
  vendorCallbacks.delete(vendorIdStr);

  if (reason !== 'normal' && retryCount < MAX_RETRIES) {
    log.info(`[ProcessManager] Scheduling restart for ${vendorIdStr} (attempt ${retryCount + 1}/${MAX_RETRIES})`);
    
    setTimeout(() => {
      createSession(vendorIdStr, retryCount + 1);
    }, RETRY_DELAY);
  }
}

function createSession(vendorId, retryCount = 0) {
  return new Promise((resolve, reject) => {
    const vendorIdStr = vendorId.toString();

    if (vendorProcesses.has(vendorIdStr)) {
      const existing = vendorProcesses.get(vendorIdStr);
      if (existing.child && !existing.child.killed) {
        log.info(`[ProcessManager] Process already exists for ${vendorIdStr}`);
        return resolve(vendorIdStr);
      }
    }

    log.info(`[ProcessManager] Starting process for vendor ${vendorIdStr} (attempt ${retryCount + 1})`);

    const child = fork(path.join(__dirname, 'vendorWorker.js'), [vendorIdStr], {
      execArgv: [`--max-old-space-size=${MAX_MEMORY_MB}`],
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    const processInfo = {
      child,
      startTime: Date.now(),
      retryCount,
      isHealthy: false,
      callbacks: {}
    };

    vendorProcesses.set(vendorIdStr, processInfo);
    
    const callbackProxy = {
      qr: (cb) => { processInfo.callbacks.qr = cb; },
      ready: (cb) => { processInfo.callbacks.ready = cb; },
      disconnected: (cb) => { processInfo.callbacks.disconnected = cb; },
      error: (cb) => { processInfo.callbacks.error = cb; },
      auth_failure: (cb) => { processInfo.callbacks.auth_failure = cb; },
      init_error: (cb) => { processInfo.callbacks.init_error = cb; },
      status: (cb) => { processInfo.callbacks.status = cb; },
      trigger: (event, ...args) => {
        const cb = processInfo.callbacks[event];
        if (cb) cb(...args);
      }
    };
    
    vendorCallbacks.set(vendorIdStr, (event, ...args) => callbackProxy.trigger(event, ...args));

    setupProcessListeners(vendorIdStr, child);

    const timeout = setTimeout(() => {
      if (vendorProcesses.has(vendorIdStr) && !processInfo.isHealthy) {
        log.warn(`[ProcessManager] ${vendorIdStr} initialization timeout, killing process`);
        child.kill();
        if (retryCount < MAX_RETRIES) {
          setTimeout(() => createSession(vendorId, retryCount + 1), RETRY_DELAY);
        }
      }
    }, 60000);

    child.once('message', (msg) => {
      if (msg.type === 'ready' || msg.type === 'qr' || msg.type === 'init_error') {
        clearTimeout(timeout);
        if (msg.type === 'init_error') {
          if (retryCount < MAX_RETRIES) {
            setTimeout(() => createSession(vendorId, retryCount + 1), RETRY_DELAY);
          }
          reject(new Error(msg.error));
        } else {
          resolve(vendorIdStr);
        }
      }
    });
  });
}

async function destroySession(vendorId) {
  const vendorIdStr = vendorId.toString();
  const processInfo = vendorProcesses.get(vendorIdStr);
  
  if (processInfo?.child && !processInfo.child.killed) {
    log.info(`[ProcessManager] Destroying process for ${vendorIdStr}`);
    processInfo.child.kill();
  }
  
  vendorProcesses.delete(vendorIdStr);
  vendorCallbacks.delete(vendorIdStr);

  try {
    await WhatsAppSession.findOneAndUpdate(
      { vendor: vendorId },
      { status: "destroyed", lastSeen: new Date() }
    );
  } catch (err) {
    log.error(`[ProcessManager] Failed to update session status:`, err.message);
  }
}

function getClient(vendorId) {
  const vendorIdStr = vendorId.toString();
  return vendorProcesses.get(vendorIdStr)?.child || null;
}

function getAllClients() {
  const result = {};
  for (const [vendorId, info] of vendorProcesses) {
    result[vendorId] = {
      pid: info.child.pid,
      startTime: info.startTime,
      isHealthy: info.isHealthy
    };
  }
  return result;
}

async function getSession(vendorId) {
  return await WhatsAppSession.findOne({ vendor: vendorId });
}

async function recoverSessions() {
  try {
    const sessions = await WhatsAppSession.find({
      status: { $in: ["initializing", "qr", "disconnected"] },
    });

    log.info(`[ProcessManager] Found ${sessions.length} sessions to recover`);

    for (const session of sessions) {
      try {
        await createSession(session.vendor);
      } catch (err) {
        log.error(`[ProcessManager] Failed to recover session for ${session.vendor}:`, err.message);
      }
    }
  } catch (err) {
    log.error(`[ProcessManager] Session recovery error:`, err.message);
  }
}

function killAll() {
  log.info('[ProcessManager] Killing all vendor processes...');
  for (const [vendorId, info] of vendorProcesses) {
    if (info.child && !info.child.killed) {
      info.child.kill();
      log.info(`[ProcessManager] Killed ${vendorId}`);
    }
  }
  vendorProcesses.clear();
  vendorCallbacks.clear();
}

function onEvent(vendorId, event, callback) {
  const vendorIdStr = vendorId.toString();
  const processInfo = vendorProcesses.get(vendorIdStr);
  if (processInfo) {
    processInfo.callbacks[event] = callback;
  } else {
    vendorCallbacks.set(vendorIdStr, (evt, ...args) => {
      if (evt === event && callback) callback(...args);
    });
  }
}

async function sendMessage(vendorId, message) {
  const vendorIdStr = vendorId.toString();
  const processInfo = vendorProcesses.get(vendorIdStr);
  
  if (processInfo?.child && !processInfo.child.killed) {
    processInfo.child.send(message);
    return true;
  }
  return false;
}

setInterval(() => {
  for (const [vendorId, info] of vendorProcesses) {
    if (info.child && !info.child.killed) {
      info.child.send({ type: 'ping' });
      
      setTimeout(() => {
        const currentInfo = vendorProcesses.get(vendorId);
        if (currentInfo && !currentInfo.isHealthy) {
          log.warn(`[ProcessManager] ${vendorId} health check failed, restarting...`);
          handleProcessExit(vendorId, 'health_check_failed');
        }
      }, 5000);
    }
  }
}, 30000);

process.on('SIGTERM', killAll);
process.on('SIGINT', killAll);

module.exports = {
  createSession,
  destroySession,
  getSession,
  recoverSessions,
  getClient,
  getAllClients,
  killAll,
  onEvent,
  sendMessage
};