const { Client, LocalAuth } = require("wweb.js");
const messageHandler = require("./messageHandler");

const clients = {}; // multi-session store

function createSession(vendorId) {
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: vendorId }),
    puppeteer: { headless: true },
  });

  client.on("ready", () =>
    console.log(`WhatsApp client for vendor ${vendorId} ready`),
  );

  client.on("message", async (msg) => {
    await messageHandler.handleIncomingMessage(vendorId, client, msg);
  });

  client.initialize();

  clients[vendorId] = client;
  return client;
}

function getClient(vendorId) {
  return clients[vendorId];
}

module.exports = { createSession, getClient };
