// server.js
const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const path = require('path');
const DBConnection = require('./src/config/DBconfig');
// const cron = require("node-cron");
// const mongoose = require("mongoose");
const indexRoute = require('./src/routers/index');
const authRoute = require("./src/routers/authRouter");
const vendorRoute = require("./src/routers/vendorRouter");
// const whatsappRoute = require("./src/routers/whatsappRouter");
// const { runFollowUpScheduler } = require("./cron/followUpScheduler");
const sessionMiddleware = require("./src/config/session");
const { recoverSessions } = require("./src/whatsapp/session");
require("dotenv").config({ quiet: true });

const app = express();
DBConnection();

app.use(sessionMiddleware);

app.use((req, res, next) => {
  res.locals.user = req.session.userId || null;
  next();
});

app.set("trust proxy", 1);

// ejs setup middleware
app.use(expressLayouts);
// app.set("layout", "./layouts/layout");
app.set('layout');
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
// cron.schedule("*/5 * * * *", () => {
//   console.log("Running follow-up scheduler...");
//   runFollowUpScheduler();
// });



// Routes placeholder
app.use('/', indexRoute);
app.use("/auth", authRoute);
app.use("/vendor", vendorRoute);
// app.use("/whatsapp", whatsappRoute);

// Start server
const PORT = process.env.PORT || 5100;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
