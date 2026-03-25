const session = require("express-session");
const MongoStore = require("connect-mongo").default;

const sessionMiddleware = session({
  name: "vendboost.sid",

  secret: process.env.SESSION_SECRET || "dev-secret",

  resave: false,
  saveUninitialized: false,

  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URL,
    collectionName: "sessions",
    ttl: 60 * 60 * 24,
    autoRemove: "native",
    touchAfter: 24 * 3600
  }),

  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24
  }
});

module.exports = sessionMiddleware;