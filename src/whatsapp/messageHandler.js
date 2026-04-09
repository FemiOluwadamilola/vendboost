const Lead = require("../models/Lead");
const Vendor = require("../models/Vendor");
const Product = require("../models/Product");
const Template = require("../models/Template");
const Subscription = require("../models/Subscription");
const Usage = require("../models/Usage");
const renderMessageTemplate = require("../utils/messageTemplateRenderer");
const log = require("../utils/logger");
const intentDetector = require("../utils/intentDetector");
const paymentDetector = require("../utils/paymentDetector");
const plans = require("../config/plans");

const BUSINESS_INTENTS = [
  "price",
  "negotiation",
  "ready-to-pay",
  "order",
  "inquiry",
];

const INTENT_SCORES = {
  "ready-to-pay": 100,
  "order": 90,
  "negotiation": 80,
  "price": 60,
  "inquiry": 40,
  "silent": 20,
};

function isBusinessIntent(intent) {
  return BUSINESS_INTENTS.includes(intent);
}

function getLeadScore(intent) {
  return INTENT_SCORES[intent] || 0;
}

async function checkLeadLimit(vendorId) {
  const sub = await Subscription.findOne({ vendor: vendorId }).sort({
    createdAt: -1,
  });

  if (!sub || sub.status !== "active") {
    return { allowed: false, reason: "No active subscription" };
  }

  const limits = plans[sub.plan]?.limits;
  const maxLeads = limits?.leads || 20;

  const leadCount = await Lead.countDocuments({ vendor: vendorId });

  if (leadCount >= maxLeads) {
    return {
      allowed: false,
      reason: `Lead limit (${maxLeads}) reached for ${sub.plan} plan`,
    };
  }

  return { allowed: true };
}

async function handleIncomingMessage(vendorId, client, msg) {
  try {
    const vendor = await Vendor.findById(vendorId);
    const templateData = await Template.findOne({ vendor: vendorId });
    if (!vendor) {
      log.warn(`Vendor not found for ID: ${vendorId}`);
      return;
    }

    const customerNumber = msg.from.replace("@c.us", "");
    const customerName = msg._data?.notifyName || "Customer";
    const text = msg.body?.trim() || "";

    if (!text) return;

    const intent = intentDetector(text);
    const isPayment = paymentDetector(text);

    let isStatusReply = false;
    let matchedProduct = null;

    if (msg.hasQuotedMsg) {
      try {
        const quoted = await msg.getQuotedMessage();
        if (quoted.from === "status@broadcast") {
          isStatusReply = true;
          const caption = quoted.body || "";
          matchedProduct = await Product.findOne({
            vendor: vendorId,
            name: { $regex: caption, $options: "i" },
          });
        }
      } catch (err) {
        log.error("Quoted message error:", err.message);
      }
    }

    if (!matchedProduct) {
      matchedProduct = await Product.findOne({
        vendor: vendorId,
        name: { $regex: text, $options: "i" },
      });
    }

    if (!isBusinessIntent(intent) && !isStatusReply) {
      return;
    }

    if (intent === "ready-to-pay") {
      const accountDetails = vendor.accountDetails || "Please contact us for payment details.";
      const accountInfo = accountDetails.bankName
        ? `Bank: ${accountDetails.bankName}\nAccount: ${accountDetails.accountNumber}\nName: ${accountDetails.accountName}`
        : "Please contact us for payment details.";

      await client.sendMessage(
        msg.from,
        `Great choice 🙌\nYou can make payment using:\n${accountInfo}\n\nSend your delivery details after payment ✅`
      );
    }

    if (intent === "price" && matchedProduct) {
      await client.sendMessage(
        msg.from,
        renderMessageTemplate(templateData?.templates?.price, {
          productName: matchedProduct.name,
          productPrice: matchedProduct.price,
        }) || `The price for ${matchedProduct.name} is ₦${matchedProduct.price}`
      );
    } else if (intent === "price") {
      await client.sendMessage(
        msg.from,
        "Which product are you asking about? 😊"
      );
    }

    if (intent === "negotiation" && matchedProduct) {
      const discountPrice = Math.round(
        matchedProduct.price * (matchedProduct.discount || 0.9)
      );
      await client.sendMessage(
        msg.from,
        renderMessageTemplate(templateData?.templates?.negotiation, {
          discountPrice,
        }) || `Great news! We can offer you ${matchedProduct.name} for ₦${discountPrice}`
      );
    }

    const leadLimitCheck = await checkLeadLimit(vendorId);
    if (!leadLimitCheck.allowed) {
      log.warn(`Lead limit reached for vendor ${vendorId}: ${leadLimitCheck.reason}`);
      return;
    }

    let lead = await Lead.findOne({ vendor: vendorId, customerNumber });
    const newScore = getLeadScore(intent);

    if (!lead) {
      lead = new Lead({
        vendor: vendorId,
        customerName,
        customerNumber,
        lastMessage: text,
        intentType: intent,
        source: isStatusReply ? "whatsapp" : "whatsapp",
        product: matchedProduct?._id || null,
        score: newScore,
        status: "new",
      });
      await lead.save();
      log.info(`New lead created: ${customerNumber} (intent: ${intent})`);
    } else {
      if (newScore > lead.score) {
        lead.score = newScore;
        lead.intentType = intent;
      }

      lead.lastMessage = text;
      lead.status = "contacted";
      lead.lastContactAt = new Date();

      if (isStatusReply && matchedProduct) {
        lead.source = "whatsapp";
        lead.product = matchedProduct._id;
      }

      await lead.save();
      log.info(`Lead updated: ${customerNumber} (status: ${lead.status})`);
    }

    if (global.io) {
      global.io.to(vendorId.toString()).emit("new-lead", {
        phone: customerNumber,
        name: customerName,
        message: text,
        source: isStatusReply ? "status" : "chat",
        product: matchedProduct?.name || null,
        intent: intent,
        score: newScore,
        leadId: lead._id,
      });
    }

    if (isStatusReply && matchedProduct) {
      const reply = `Hi 👋 ${customerName},\nYes, ${matchedProduct.name} is available for ₦${matchedProduct.price}.\nWould you like to place an order?`;
      await client.sendMessage(msg.from, reply);
    }

    log.info(
      `Message processed: ${customerNumber} | intent: ${intent} ${isPayment ? "[PAYMENT]" : ""} ${isStatusReply ? "[STATUS]" : ""}`
    );
  } catch (err) {
    log.error(`Message handler error for ${vendorId}:`, err.message);
  }
}

module.exports = { handleIncomingMessage, checkLeadLimit };