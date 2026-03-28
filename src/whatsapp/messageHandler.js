const Lead = require("../models/Lead");
const Vendor = require("../models/Vendor");
const Product = require("../models/Product");
const Template = require("../models/Template");
const renderMessageTemplate = require("../utils/messageTemplateRenderer");

const intentDetector = require("../utils/intentDetector");
const paymentDetector = require("../utils/paymentDetector");

// ============================
// 1️⃣ Define business intents
// ============================
const BUSINESS_INTENTS = ["price", "negotiation", "ready-to-pay", "order", "inquiry"];

function isBusinessIntent(intent) {
  return BUSINESS_INTENTS.includes(intent);
}

function getLeadScore(intent) {
  switch(intent) {
    case "ready-to-pay": return 100;
    case "negotiation": return 80;
    case "price": return 60;
    case "inquiry": return 40;
    default: return 0;
  }
}

// ============================
// 2️⃣ Handle incoming message
// ============================
async function handleIncomingMessage(vendorId, client, msg) {
  const vendor = await Vendor.findById(vendorId);
  const templateData = await Template.findOne({ vendor: vendorId });
  if (!vendor) return;

  const customerNumber = msg.from.replace("@c.us", "");
  const customerName = msg._data.notifyName || "Customer";
  const text = msg.body?.trim() || "";

  const intent = intentDetector(text);
  const isPayment = paymentDetector(text);

  // ============================
  // 3️⃣ Status reply detection
  // ============================
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
      console.error("Quoted message error:", err.message);
    }
  }

  // ============================
  // 4️⃣ Product extraction for normal chat
  // ============================
  if (!matchedProduct) {
    matchedProduct = await Product.findOne({
      vendor: vendorId,
      name: { $regex: text, $options: "i" },
    });
  }

  // ============================
  // 5️⃣ Skip non-business messages
  // ============================
  if (!isBusinessIntent(intent) && !isStatusReply) {
    console.log("❌ Ignored casual chat:", text);
    return;
  }

  // ============================
  // 6️⃣ Auto-reply for ready-to-pay
  // ============================
  if (intent === "ready-to-pay") {
    const accountDetails = vendor.bankDetails || "Please contact us for payment details.";
    await client.sendMessage(msg.from, `
Great choice 🙌
You can make payment using:
${accountDetails}
Send your delivery details after payment ✅
    `);
    return;
  }

  // ============================
  // 7️⃣ Price & negotiation replies
  // ============================
  if (intent === "price" && matchedProduct) {
    await client.sendMessage(msg.from, renderMessageTemplate(templateData.templates.price, {
      productName: matchedProduct.name,
      productPrice: matchedProduct.price
    }));
  } else if (intent === "price") {
    await client.sendMessage(msg.from, "Which product are you asking about? 😊");
  }

  if (intent === "negotiation" && matchedProduct) {
    const discountPrice = Math.round(matchedProduct.price * matchedProduct.discount);
    await client.sendMessage(msg.from, renderMessageTemplate(templateData.templates.negotiation, {
      discountPrice
    }));
  }

  // ============================
  // 8️⃣ Create or update lead
  // ============================
  let lead = await Lead.findOne({ vendor: vendorId, customerNumber });
  const newScore = getLeadScore(intent);

  if (!lead) {
    lead = new Lead({
      vendor: vendorId,
      customerName,
      customerNumber,
      lastMessage: text,
      intentType: intent,
      source: isStatusReply ? "status" : "chat",
      product: matchedProduct?._id || null,
      score: newScore,
      followUpsSent: 0
    });
    await lead.save();
  } else {
    // Only update if new score >= existing
    if (newScore >= getLeadScore(lead.intentType)) {
      lead.intentType = intent;
      lead.score = newScore;
    }

    lead.lastMessage = text;
    lead.status = "responded";

    if (isStatusReply) {
      lead.source = "status";
      if (matchedProduct) lead.product = matchedProduct._id;
    }

    await lead.save();
  }

  // ============================
  // 9️⃣ Push to real-time dashboard
  // ============================
  if (global.io) {
    global.io.to(vendorId.toString()).emit("new-lead", {
      phone: customerNumber,
      message: text,
      source: isStatusReply ? "status" : "chat",
      product: matchedProduct?.name || null,
      intent: intent,
      score: newScore
    });
  }

  // ============================
  // 🔁 Optional auto-reply for status
  // ============================
  if (isStatusReply && matchedProduct) {
    const reply = `Hi 👋 ${customerName},
Yes, ${matchedProduct.name} is available for ₦${matchedProduct.price}.
Would you like to place an order?`;
    await client.sendMessage(msg.from, reply);
  }

  // ============================
  // 10️⃣ Logging
  // ============================
  console.log(
    `Message from ${customerNumber} | intent: ${intent} ${isPayment ? "💰 payment" : ""} ${isStatusReply ? "🔥 STATUS LEAD" : ""}`
  );
}

module.exports = { handleIncomingMessage };