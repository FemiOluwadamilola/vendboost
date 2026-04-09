const { Client, LocalAuth } = require("whatsapp-web.js");
const QRCode = require("qrcode");
const WhatsAppSession = require("../models/WhatsappSession");
const Template = require("../models/Template");
const getDefaultTemplate = require("../utils/defaultTemplate");
const { checkSubscription, checkWhatsAppSessionsLimit } = require("../middlewares/checkSubscription");
const messageHandler = require("./messageHandler");
const log = require("../utils/logger");
const path = require("path");
const fs = require("fs");

const clients = {};
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

async function closeExistingBrowser(vendorIdStr) {
  const authDir = path.join(__dirname, "../../.wwebjs_auth", `session-${vendorIdStr}`);
  const lockFile = path.join(authDir, "SingletonLock");
  
  try {
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
      log.info(`Removed stale lock file for vendor ${vendorIdStr}`);
    }
  } catch (err) {
    log.warn(`Could not remove lock file for ${vendorIdStr}:`, err.message);
  }
}

async function createSession(vendorId, retryCount = 0) {
  if (!vendorId) {
    throw new Error("vendorId is required");
  }

  const vendorIdStr = vendorId.toString();

  if (clients[vendorIdStr]) {
    const session = await WhatsAppSession.findOne({ vendor: vendorId });
    if (session?.status === "connected") {
      log.info(`Active session exists for vendor ${vendorIdStr}`);
      return clients[vendorIdStr];
    }
    try {
      await clients[vendorIdStr].destroy();
    } catch (err) {
      log.warn(`Error destroying stale client for ${vendorIdStr}:`, err.message);
    }
    delete clients[vendorIdStr];
  }

  await closeExistingBrowser(vendorIdStr);

  const sessionLimitCheck = await checkWhatsAppSessionsLimit(vendorId);
  if (!sessionLimitCheck.allowed) {
    throw new Error(sessionLimitCheck.reason);
  }

  await WhatsAppSession.findOneAndUpdate(
    { vendor: vendorId },
    { status: "initializing", qr: null, lastSeen: new Date() },
    { upsert: true, setDefaultsOnInsert: true }
  );

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: vendorIdStr }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu",
      ],
    },
  });

  client.on("qr", async (qr) => {
    try {
      const qrImage = await QRCode.toDataURL(qr);
      await WhatsAppSession.findOneAndUpdate(
        { vendor: vendorId },
        { qr: qrImage, status: "qr", lastSeen: new Date() }
      );
      log.info(`QR generated for vendor ${vendorIdStr}`);
    } catch (err) {
      log.error(`QR generation error for ${vendorIdStr}:`, err.message || err.toString() || JSON.stringify(err));
    }
  });

  client.on("ready", async () => {
    log.info(`WhatsApp client ready for vendor ${vendorIdStr}`);
    try {
      await WhatsAppSession.findOneAndUpdate(
        { vendor: vendorId },
        { status: "connected", qr: null, lastSeen: new Date() }
      );

      const existingTemplate = await Template.findOne({ vendor: vendorId });
      if (!existingTemplate) {
        await Template.create({
          vendor: vendorId,
          templates: getDefaultTemplate({ vendorBusinessName: "" }),
        });
      }
    } catch (err) {
      log.error(`Ready handler error for ${vendorIdStr}:`, err.message);
    }
  });

  client.on("message", async (msg) => {
    try {
      if (msg.fromMe) return;
      await messageHandler.handleIncomingMessage(vendorId, client, msg);
    } catch (err) {
      log.error(`Message handler error for ${vendorIdStr}:`, err.message || err.toString() || JSON.stringify(err));
    }
  });

  client.on("error", async (err) => {
    log.error(`WhatsApp client error for ${vendorIdStr}:`, err.message);
    try {
      await WhatsAppSession.findOneAndUpdate(
        { vendor: vendorId },
        { status: "error", lastSeen: new Date() }
      );
    } catch (dbErr) {
      log.error(`Failed to update session status:`, dbErr.message);
    }
  });

  client.on("disconnected", async (reason) => {
    log.info(`WhatsApp client disconnected for ${vendorIdStr}: ${reason}`);
    try {
      await WhatsAppSession.findOneAndUpdate(
        { vendor: vendorId },
        { status: "disconnected", lastSeen: new Date() }
      );
      delete clients[vendorIdStr];
    } catch (err) {
      log.error(`Disconnection handler error for ${vendorIdStr}:`, err.message);
    }
  });

  client.on("auth_failure", async (msg) => {
    log.error(`Auth failure for ${vendorIdStr}:`, msg);
    try {
      await WhatsAppSession.findOneAndUpdate(
        { vendor: vendorId },
        { status: "auth_failed", lastSeen: new Date() }
      );
    } catch (err) {
      log.error(`Auth failure handler error:`, err.message);
    }
  });

  client.on("failure", async (err) => {
    log.error(`Client failure for ${vendorIdStr}:`, err.message || err.toString() || JSON.stringify(err));
    if (retryCount < MAX_RETRIES) {
      log.info(`Retrying session creation for ${vendorIdStr} (attempt ${retryCount + 1})`);
      setTimeout(() => createSession(vendorId, retryCount + 1), RETRY_DELAY);
    }
  });

  try {
    await client.initialize();
    clients[vendorIdStr] = client;
    log.info(`WhatsApp session initialized for vendor ${vendorIdStr}`);
    return client;
  } catch (err) {
    log.error(`Initialization failed for ${vendorIdStr}:`, err.message || err.toString() || JSON.stringify(err));
    log.error(`Error stack:`, err.stack);
    
    if (err.message && err.message.includes("browser is already running")) {
      await closeExistingBrowser(vendorIdStr);
    }
    
    if (retryCount < MAX_RETRIES) {
      log.info(`Retrying initialization for ${vendorIdStr}`);
      setTimeout(() => createSession(vendorId, retryCount + 1), RETRY_DELAY);
    }
    throw err;
  }
}

async function destroySession(vendorId) {
  const vendorIdStr = vendorId.toString();
  const client = clients[vendorIdStr];
  if (client) {
    try {
      await client.destroy();
      delete clients[vendorIdStr];
      await WhatsAppSession.findOneAndUpdate(
        { vendor: vendorId },
        { status: "destroyed", lastSeen: new Date() }
      );
      log.info(`Session destroyed for vendor ${vendorIdStr}`);
    } catch (err) {
      log.error(`Error destroying session for ${vendorIdStr}:`, err.message);
    }
  }
}

async function recoverSessions() {
  try {
    const sessions = await WhatsAppSession.find({
      status: { $in: ["initializing", "qr", "disconnected"] },
    });

    log.info(`Found ${sessions.length} sessions to recover`);

    for (const session of sessions) {
      try {
        await createSession(session.vendor);
      } catch (err) {
        log.error(`Failed to recover session for ${session.vendor}:`, err.message);
      }
    }
  } catch (err) {
    log.error(`Session recovery error:`, err.message);
  }
}

async function getSession(vendorId) {
  return await WhatsAppSession.findOne({ vendor: vendorId });
}

function getClient(vendorId) {
  return clients[vendorId.toString()];
}

function getAllClients() {
  return clients;
}

module.exports = { 
  createSession, 
  destroySession,
  getSession, 
  recoverSessions, 
  getClient,
  getAllClients
};