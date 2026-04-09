// server.js
const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const path = require("path");
const DBConnection = require("./src/config/DBconfig");
const cron = require("node-cron");
// const mongoose = require("mongoose");
const flash = require("connect-flash");
const indexRoute = require("./src/routers/index");
const authRoute = require("./src/routers/authRouter");
const dashboardRoute = require("./src/routers/dashboardRouter");
const productRoute = require("./src/routers/productRouter");
const whatsappRoute = require("./src/routers/whatsappRouter");
const webhookRoute = require("./src/routers/webhook");
const billingRoute = require("./src/routers/billing");
const subscriptionRoute = require("./src/routers/subscriptionRouter");
const { runFollowUpScheduler } = require("./src/crons/followUpScheduler");
const sessionMiddleware = require("./src/config/session");
const { recoverSessions } = require("./src/whatsapp/session");
require("dotenv").config({ quiet: true });
const log = require("./src/utils/logger");

const app = express();
DBConnection();

app.use(sessionMiddleware);

app.use(flash());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.user = req.session.userId || null;
  next();
});

app.set("trust proxy", 1);

// ejs setup middleware
app.use(expressLayouts);
app.set("layout", "./layouts/layout");
app.set("view engine", "ejs");

// express connection middlewares
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "./public")));
app.use(express.json());

// Recover WhatsApp sessions on server start
(async () => {
  await recoverSessions();
})();

// Every 5 minutes
cron.schedule("*/5 * * * *", () => {
  log.info("Running follow-up scheduler...");
  runFollowUpScheduler();
});

// Routes placeholder
app.use("/", indexRoute);
app.use("/auth", authRoute);
app.use("/dashboard", dashboardRoute);
app.use("/products", productRoute);
app.use("/whatsapp", whatsappRoute);
app.use("/billing", billingRoute);
app.use("/subscription", subscriptionRoute);
app.use("/webhook/paystack", express.raw({ type: "application/json" }));

// Start server
const PORT = process.env.PORT || 5100;
app.listen(PORT, () => log.info(`Server running on port ${PORT}`));
