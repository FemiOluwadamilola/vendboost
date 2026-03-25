const { Client, LocalAuth } = require("whatsapp-web.js");
const QRCode = require("qrcode");
const WhatsAppSession = require("../models/WhatsappSession");
const messageHandler = require("./messageHandler");

const clients = {}; // in-memory store for active clients

// 🔹 Create or recover session
async function createSession(vendorId) {
  // Prevent duplicate client in memory
  if (clients[vendorId]) {
    console.log(`Session already exists for ${vendorId}`);
    return clients[vendorId];
  }

  // Ensure session record exists in MongoDB
  await WhatsAppSession.findOneAndUpdate(
    { vendorId },
    { status: "initializing", qr: null, lastSeen: new Date() },
    { upsert: true }
  );

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: vendorId }),
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
        "--disable-gpu"
      ]
    }
  });

  // 🔹 QR EVENT
  client.on("qr", async (qr) => {
    console.log(`QR generated for ${vendorId}`);

    // Convert to Data URI for frontend
    const qrImage = await QRCode.toDataURL(qr);

    await WhatsAppSession.findOneAndUpdate(
      { vendorId },
      { qr: qrImage, status: "qr", lastSeen: new Date() },
      { upsert: true }
    );
  });

  // 🔹 READY
  client.on("ready", async () => {
    console.log(`WhatsApp client ready for ${vendorId}`);

    await WhatsAppSession.findOneAndUpdate(
      { vendorId },
      { status: "connected", qr: null, lastSeen: new Date() }
    );
  });

  // 🔹 MESSAGE HANDLER
  client.on("message", async (msg) => {
    await messageHandler.handleIncomingMessage(vendorId, client, msg);
  });

  // 🔹 ERROR
  client.on("error", async (err) => {
    console.error(`WhatsApp client error (${vendorId}):`, err.message);
    await WhatsAppSession.findOneAndUpdate(
      { vendorId },
      { status: "error", lastSeen: new Date() }
    );
  });

  // 🔹 DISCONNECTED
  client.on("disconnected", async (reason) => {
    console.log(`WhatsApp client disconnected (${vendorId}):`, reason);

    await WhatsAppSession.findOneAndUpdate(
      { vendorId },
      { status: "disconnected", lastSeen: new Date() }
    );

    delete clients[vendorId];
  });

  // 🔹 AUTH FAILURE
  client.on("auth_failure", async (msg) => {
    console.error(`Auth failure (${vendorId}):`, msg);

    await WhatsAppSession.findOneAndUpdate(
      { vendorId },
      { status: "auth_failed", lastSeen: new Date() }
    );
  });

  // 🔹 Initialize safely with retry
  safeInitialize(client, vendorId);

  // Store client in memory
  clients[vendorId] = client;

  return client;
}

// 🔹 Safe initialize with retry if puppeteer fails
async function safeInitialize(client, vendorId) {
  try {
    await client.initialize();
  } catch (err) {
    console.error(`Initialization failed for ${vendorId}, retrying...`);
    setTimeout(() => safeInitialize(client, vendorId), 5000);
  }
}

// 🔹 Recover session on server restart
async function recoverSessions() {
  const sessions = await WhatsAppSession.find({ status: { $in: ["initializing", "qr"] } });

  for (const session of sessions) {
    console.log(`Recovering session for vendor ${session.vendorId}`);
    await createSession(session.vendorId);
  }
}

// 🔹 Get session from MongoDB
async function getSession(vendorId) {
  return await WhatsAppSession.findOne({ vendorId });
}

// 🔹 Get client from memory
function getClient(vendorId) {
  return clients[vendorId];
}

module.exports = { createSession, getSession, recoverSessions, getClient };