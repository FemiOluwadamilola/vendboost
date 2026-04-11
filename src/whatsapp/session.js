const processManager = require('./processManager');
const WhatsAppSession = require('../models/WhatsappSession');

class WhatsAppClientProxy {
  constructor(vendorId, processChild) {
    this.vendorId = vendorId;
    this.child = processChild;
    this.messageQueue = [];
    this.ready = false;
    this._responseHandlers = new Map();
    
    if (processChild) {
      processChild.on('message', (msg) => {
        if (msg.type === 'message_sent' || msg.type === 'media_sent' || msg.type === 'status_sent') {
          const handler = this._responseHandlers.get(msg.requestId);
          if (handler) {
            handler.resolve({ id: { _serialized: msg.messageId || Date.now().toString() } });
            this._responseHandlers.delete(msg.requestId);
          }
        } else if (msg.type === 'message_error') {
          const handler = this._responseHandlers.get(msg.requestId);
          if (handler) {
            handler.reject(new Error(msg.error));
            this._responseHandlers.delete(msg.requestId);
          }
        }
      });
    }
  }

  _generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  sendMessage(chatId, content, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.child || this.child.killed) {
        reject(new Error('WhatsApp client not available'));
        return;
      }

      const requestId = this._generateRequestId();
      this._responseHandlers.set(requestId, { resolve, reject });

      this.child.send({
        type: 'sendMessage',
        requestId,
        chatId,
        content,
        options
      });

      setTimeout(() => {
        if (this._responseHandlers.has(requestId)) {
          this._responseHandlers.delete(requestId);
          resolve({ id: { _serialized: Date.now().toString() } });
        }
      }, 5000);
    });
  }

  sendMessageWithMedia(chatId, media, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.child || this.child.killed) {
        reject(new Error('WhatsApp client not available'));
        return;
      }

      const requestId = this._generateRequestId();
      this._responseHandlers.set(requestId, { resolve, reject });

      let mediaData;
      if (media.mimetype && media.data) {
        mediaData = {
          mimetype: media.mimetype,
          data: media.data,
          filename: media.filename
        };
      }

      this.child.send({
        type: 'sendMessageWithMedia',
        requestId,
        chatId,
        media: mediaData,
        caption: options?.caption
      });

      setTimeout(() => {
        if (this._responseHandlers.has(requestId)) {
          this._responseHandlers.delete(requestId);
          resolve({ id: { _serialized: Date.now().toString() } });
        }
      }, 10000);
    });
  }

  sendStatus(content, media = null) {
    return new Promise((resolve, reject) => {
      if (!this.child || this.child.killed) {
        reject(new Error('WhatsApp client not available'));
        return;
      }

      const requestId = this._generateRequestId();
      this._responseHandlers.set(requestId, { resolve, reject });

      let mediaData = null;
      if (media && media.mimetype && media.data) {
        mediaData = {
          mimetype: media.mimetype,
          data: media.data,
          filename: media.filename
        };
      }

      this.child.send({
        type: 'sendStatus',
        requestId,
        content,
        media: mediaData
      });

      setTimeout(() => {
        if (this._responseHandlers.has(requestId)) {
          this._responseHandlers.delete(requestId);
          resolve({ id: { _serialized: Date.now().toString() } });
        }
      }, 10000);
    });
  }

  getState() {
    return 'CONNECTED';
  }

  get isConnected() {
    return this.child && !this.child.killed;
  }
}

async function createSession(vendorId) {
  if (!vendorId) {
    throw new Error("vendorId is required");
  }

  const vendorIdStr = vendorId.toString();
  
  const sessionLimitCheck = await require('../middlewares/checkSubscription').checkWhatsAppSessionsLimit(vendorId);
  if (!sessionLimitCheck.allowed) {
    throw new Error(sessionLimitCheck.reason);
  }

  const existingSession = await WhatsAppSession.findOne({ vendor: vendorId });
  if (existingSession?.status === "connected") {
    return vendorIdStr;
  }

  try {
    await processManager.createSession(vendorId);
    return vendorIdStr;
  } catch (err) {
    throw err;
  }
}

async function destroySession(vendorId) {
  await processManager.destroySession(vendorId);
}

async function getSession(vendorId) {
  return await WhatsAppSession.findOne({ vendor: vendorId });
}

async function recoverSessions() {
  await processManager.recoverSessions();
}

function getClient(vendorId) {
  const child = processManager.getClient(vendorId);
  if (!child) return null;
  return new WhatsAppClientProxy(vendorId.toString(), child);
}

function getAllClients() {
  return processManager.getAllClients();
}

function onEvent(vendorId, event, callback) {
  processManager.onEvent(vendorId, event, callback);
}

async function sendMessage(vendorId, message) {
  return await processManager.sendMessage(vendorId, message);
}

function killAll() {
  processManager.killAll();
}

module.exports = {
  createSession,
  destroySession,
  getSession,
  recoverSessions,
  getClient,
  getAllClients,
  onEvent,
  sendMessage,
  killAll
};