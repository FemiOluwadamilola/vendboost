// server.js
require("dotenv").config();
const express = require("express");
const cron = require("node-cron");
const mongoose = require("mongoose");
const authRoute = require("./src/routers/authRouter");
const vendorRoute = require("./src/routers/vendorRouter");
const { runFollowUpScheduler } = require("./cron/followUpScheduler");

const app = express();
app.use(express.json());

// Connect MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

// Every 5 minutes
cron.schedule("*/5 * * * *", () => {
  console.log("Running follow-up scheduler...");
  runFollowUpScheduler();
});

// Routes placeholder
app.use("/api/auth", authRoute);
app.use("/api/vendor", vendorRoute);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
