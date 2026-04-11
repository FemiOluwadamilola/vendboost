const { Client, LocalAuth } = require("whatsapp-web.js");
const QRCode = require("qrcode");
const MessageMedia = require("whatsapp-web.js").MessageMedia;
const WhatsAppSession = require("../models/WhatsappSession");
const Template = require("../models/Template");
const getDefaultTemplate = require("../utils/defaultTemplate");
const path = require("path");
const fs = require("fs");

process.on('uncaughtException', (err) => {
  console.error(`[WORKER ${process.argv[2]}] Uncaught Exception:`, err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`[WORKER ${process.argv[2]}] Unhandled Rejection at:`, promise, 'reason:', reason);
  process.exit(1);
});

const vendorId = process.argv[2];
const vendorIdStr = vendorId.toString();

console.log(`[WORKER ${vendorIdStr}] Starting vendor worker process...`);

let client = null;
let mongodbConnected = false;

async function connectToMongoDB() {
  const mongoose = require("mongoose");
  try {
    // Get MongoDB URL from environment or use default
    const mongoURI = process.env.MONGODB_URL || "mongodb://localhost:27017/vendboost";
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 15000,
      bufferCommands: false,
    });
    mongodbConnected = true;
    console.log(`[WORKER ${vendorIdStr}] MongoDB connected`);
  } catch (err) {
    console.error(`[WORKER ${vendorIdStr}] MongoDB connection error:`, err.message);
    mongodbConnected = false;
    throw err;
  }
}

async function closeExistingBrowser() {
  const authDir = path.join(__dirname, "../../.wwebjs_auth", `session-${vendorIdStr}`);
  const lockFile = path.join(authDir, "SingletonLock");
  
  try {
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
      console.log(`[WORKER ${vendorIdStr}] Removed stale lock file`);
    }
  } catch (err) {
    console.warn(`[WORKER ${vendorIdStr}] Could not remove lock file:`, err.message);
  }
}

async function initialize() {
  try {
    // Connect to MongoDB first
    await connectToMongoDB();
    
    if (!mongodbConnected) {
      throw new Error("Failed to connect to MongoDB");
    }
    
    await closeExistingBrowser();

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
        process.send({ type: 'qr', vendorId: vendorIdStr, qr: qrImage });
      } catch (err) {
        console.error(`[WORKER ${vendorIdStr}] QR generation error:`, err.message);
      }
    });

    client.on("ready", async () => {
      console.log(`[WORKER ${vendorIdStr}] Client ready`);
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
        process.send({ type: 'ready', vendorId: vendorIdStr });
      } catch (err) {
        console.error(`[WORKER ${vendorIdStr}] Ready handler error:`, err.message);
      }
    });

    client.on("message", async (msg) => {
      try {
        if (msg.fromMe) return;
        
        const messageHandler = require("./messageHandler");
        await messageHandler.handleIncomingMessage(vendorId, client, msg);
      } catch (err) {
        console.error(`[WORKER ${vendorIdStr}] Message handler error:`, err.message);
      }
    });

    client.on("disconnected", async (reason) => {
      console.log(`[WORKER ${vendorIdStr}] Client disconnected: ${reason}`);
      try {
        await WhatsAppSession.findOneAndUpdate(
          { vendor: vendorId },
          { status: "disconnected", lastSeen: new Date() }
        );
        process.send({ type: 'disconnected', vendorId: vendorIdStr, reason });
      } catch (err) {
        console.error(`[WORKER ${vendorIdStr}] Disconnect handler error:`, err.message);
      }
    });

    client.on("error", async (err) => {
      console.error(`[WORKER ${vendorIdStr}] Client error:`, err.message);
      try {
        await WhatsAppSession.findOneAndUpdate(
          { vendor: vendorId },
          { status: "error", lastSeen: new Date() }
        );
        process.send({ type: 'error', vendorId: vendorIdStr, error: err.message });
      } catch (dbErr) {
        console.error(`[WORKER ${vendorIdStr}] DB error:`, dbErr.message);
      }
    });

    client.on("auth_failure", async (msg) => {
      console.error(`[WORKER ${vendorIdStr}] Auth failure:`, msg);
      try {
        await WhatsAppSession.findOneAndUpdate(
          { vendor: vendorId },
          { status: "auth_failed", lastSeen: new Date() }
        );
        process.send({ type: 'auth_failure', vendorId: vendorIdStr, message: msg });
      } catch (err) {
        console.error(`[WORKER ${vendorIdStr}] Auth failure handler error:`, err.message);
      }
    });

    await client.initialize();
    console.log(`[WORKER ${vendorIdStr}] Client initialized successfully`);
    
  } catch (err) {
    console.error(`[WORKER ${vendorIdStr}] Initialization failed:`, err.message);
    console.error(err.stack);
    
    if (err.message && err.message.includes("browser is already running")) {
      await closeExistingBrowser();
    }
    
    process.send({ type: 'init_error', vendorId: vendorIdStr, error: err.message });
    process.exit(1);
  }
}

process.on('message', async (msg) => {
  console.log(`[WORKER ${vendorIdStr}] Received message:`, msg.type);
  
  if (msg.type === 'ping') {
    process.send({ type: 'pong', vendorId: vendorIdStr });
  }
  else if (msg.type === 'get_status') {
    try {
      const session = await WhatsAppSession.findOne({ vendor: vendorId });
      process.send({ type: 'status', vendorId: vendorIdStr, status: session?.status || 'unknown' });
    } catch (err) {
      process.send({ type: 'status', vendorId: vendorIdStr, status: 'error' });
    }
  }
  else if (msg.type === 'sendMessage') {
    try {
      if (client) {
        await client.sendMessage(msg.chatId, msg.content, msg.options);
        process.send({ type: 'message_sent', requestId: msg.requestId, vendorId: vendorIdStr, chatId: msg.chatId, messageId: Date.now().toString() });
      }
    } catch (err) {
      console.error(`[WORKER ${vendorIdStr}] Send message error:`, err.message);
      process.send({ type: 'message_error', requestId: msg.requestId, vendorId: vendorIdStr, error: err.message });
    }
  }
  else if (msg.type === 'sendMessageWithMedia') {
    try {
      if (client && msg.media) {
        const media = MessageMedia.fromDataURL(msg.media);
        await client.sendMessage(msg.chatId, media, { caption: msg.caption });
        process.send({ type: 'media_sent', requestId: msg.requestId, vendorId: vendorIdStr, chatId: msg.chatId, messageId: Date.now().toString() });
      }
    } catch (err) {
      console.error(`[WORKER ${vendorIdStr}] Send media error:`, err.message);
      process.send({ type: 'message_error', requestId: msg.requestId, vendorId: vendorIdStr, error: err.message });
    }
  }
  else if (msg.type === 'sendStatus') {
    try {
      if (client) {
        if (msg.media) {
          const media = MessageMedia.fromDataURL(msg.media);
          await client.sendMessage("status@broadcast", media, { caption: msg.content });
        } else {
          await client.sendMessage("status@broadcast", msg.content);
        }
        process.send({ type: 'status_sent', requestId: msg.requestId, vendorId: vendorIdStr });
      }
    } catch (err) {
      console.error(`[WORKER ${vendorIdStr}] Send status error:`, err.message);
      process.send({ type: 'message_error', requestId: msg.requestId, vendorId: vendorIdStr, error: err.message });
    }
  }
});

process.on('exit', (code) => {
  console.log(`[WORKER ${vendorIdStr}] Process exiting with code:`, code);
});

initialize();