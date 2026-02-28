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
// const { runFollowUpScheduler } = require("./cron/followUpScheduler");
require("dotenv").config({ quiet: true });

const app = express();
DBConnection();

// app.use(cors("*"));

// ejs setup middleware
app.use(expressLayouts);
// app.set("layout", "./layouts/layout");
app.set('layout');
app.set("view engine", "ejs");

// express connection middlewares
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "./public")));
app.use(express.json());


// Every 5 minutes
// cron.schedule("*/5 * * * *", () => {
//   console.log("Running follow-up scheduler...");
//   runFollowUpScheduler();
// });

// Routes placeholder
app.use('/', indexRoute);
app.use("/auth", authRoute);
app.use("/vendor", vendorRoute);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
