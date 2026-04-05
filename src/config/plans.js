// config/plans.js
module.exports = {
  free: {
    name: "Free",
    price: 0,
    limits: {
      leads: 20,
      broadcastsPerDay: 0,
      whatsappSessions: 1,
    },
  },

  starter: {
    name: "Starter",
    price: 5000,
    limits: {
      leads: 200,
      broadcastsPerDay: 50,
      whatsappSessions: 1,
    },
  },

  pro: {
    name: "Pro",
    price: 15000,
    limits: {
      leads: 1000,
      broadcastsPerDay: 500,
      whatsappSessions: 3,
    },
  },
};
