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

  starter: {
    name: "Starter",
    price: 2000,
    duration: 30,
    limits: {
      leads: 100,
      broadcastsPerDay: 30,
      whatsappSessions: 1,
      automatedReplies: true,
      statusPosting: true,
      followUpAutomation: true,
    },
    features: [
      "100 leads limit",
      "30 broadcasts per day",
      "1 WhatsApp session",
      "Automated follow-ups",
      "WhatsApp Status posting",
    ],
  },

  pro: {
    name: "Pro",
    price: 5000,
    duration: 30,
    limits: {
      leads: 1000,
      broadcastsPerDay: 500,
      whatsappSessions: 1,
      automatedReplies: true,
      statusPosting: true,
      followUpAutomation: true,
    },
    features: [
      "1,000 leads limit",
      "500 broadcasts per day",
      "1 WhatsApp session",
      "Automated follow-ups",
      "WhatsApp Status posting",
      "Priority support",
    ],
  },
};