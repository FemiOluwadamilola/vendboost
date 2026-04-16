const { createLogger, format, transports } = require("winston");
const { combine, timestamp, json, errors } = format;
const path = require("path");
const fs = require("fs");

// Ensure logs directory exists
const logsDir = path.join(__dirname, "../../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Environment
const NODE_ENV = process.env.NODE_ENV || "development";

// Log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Detect worker process
const isWorker = process.argv[1]?.includes("vendorWorker");
const workerVendorId = isWorker ? process.argv[2] : null;

// Custom format for file (JSON)
const fileFormat = combine(
  errors({ stack: true }),
  timestamp(),
  json()
);

// File transport helper
const createFileTransport = (filename, level = "info") => {
  return new transports.File({
    filename: path.join(logsDir, filename),
    level,
    format: fileFormat,
    maxsize: 20 * 1024 * 1024,
    maxFiles: 14,
    tailable: true,
  });
};

// Create logger
const logger = createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || (NODE_ENV === "production" ? "info" : "debug"),
  format: fileFormat,
  defaultMeta: {
    service: "vendboost",
    environment: NODE_ENV,
    ...(workerVendorId && { vendorId: workerVendorId }),
  },
  transports: [
    createFileTransport("combined.log"),
    createFileTransport("error.log", "error"),
    createFileTransport("http.log", "http"),
  ],
  exitOnError: false,
});

logger.on("error", (err) => {
  console.error("Logger error:", err);
});

const createChild = (context) => logger.child(context);

// HTTP access logger
const accessLogger = createLogger({
  levels: { info: 3 },
  format: combine(timestamp(), json()),
  transports: [createFileTransport("access.log")],
});

module.exports = logger;
module.exports.createChild = createChild;
module.exports.accessLogger = accessLogger;
module.exports.stream = {
  write: (message) => accessLogger.info(message.trim()),
};
