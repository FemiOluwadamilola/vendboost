const { Client, LocalAuth } = require("whatsapp-web.js");
const messageHandler = require("./messageHandler");
const qrcode = require("qrcode-terminal");
const clients = {};

function createSession(vendorId) {
  if (clients[vendorId]) return clients[vendorId]; // prevent duplicate

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: vendorId }),
    puppeteer: { headless: true },
  });

  client.on("ready", () => {
    console.log(`WhatsApp client for vendor ${vendorId} ready`);
  });

  client.on("qr", (qr) => {
    console.log(`QR for ${vendorId}:`);
     qrcode.generate(qr, {small: true});
  });

  client.on("message", async (msg) => {
    await messageHandler.handleIncomingMessage(vendorId, client, msg);
  });

  client.initialize();

  clients[vendorId] = client;

  return client;
}

function getSession(vendorId) {
  return clients[vendorId];
}

module.exports = { createSession, getSession };