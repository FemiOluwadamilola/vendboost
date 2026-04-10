// config/plans.js
module.exports = {
  trial: {
    name: "14-Day Trial",
    price: 0,
    duration: 14,
    isTrial: true,
    limits: {
      leads: 50,
      broadcastsPerDay: 20,
      whatsappSessions: 1,
      automatedReplies: true,
      statusPosting: true,
      followUpAutomation: true,
    },
    features: [
      "All Pro features included",
      "50 leads limit",
      "20 broadcasts per day",
      "1 WhatsApp session",
      "Automated follow-ups",
      "WhatsApp Status posting",
    ],
  },

  free: {
    name: "Free",
    price: 0,
    limits: {
      leads: 20,
      broadcastsPerDay: 0,
      whatsappSessions: 1,
      automatedReplies: true,
      statusPosting: false,
      followUpAutomation: false,
    },
    features: [
      "WhatsApp Connection",
      "Auto-reply to customers",
      "20 leads capture",
      "Basic intent detection",
      "No broadcasts",
      "No status posting",
      "No automated follow-ups",
    ],
  },

  starter: {
    name: "Starter",
    price: 5000,
    duration: 30,
    limits: {
      leads: 200,
      broadcastsPerDay: 50,
      whatsappSessions: 1,
      automatedReplies: true,
      statusPosting: false,
      followUpAutomation: true,
    },
    features: [
      "200 leads limit",
      "50 broadcasts per day",
      "1 WhatsApp session",
      "Automated follow-ups",
      "No status posting",
    ],
  },

  pro: {
    name: "Pro",
    price: 15000,
    duration: 30,
    limits: {
      leads: 1000,
      broadcastsPerDay: 500,
      whatsappSessions: 3,
      automatedReplies: true,
      statusPosting: true,
      followUpAutomation: true,
    },
    features: [
      "1,000 leads limit",
      "500 broadcasts per day",
      "3 WhatsApp sessions",
      "Automated follow-ups",
      "WhatsApp Status posting",
      "Priority support",
    ],
  },
};
