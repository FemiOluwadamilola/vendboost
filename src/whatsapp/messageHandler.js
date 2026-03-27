const Lead = require("../models/Lead");
const Vendor = require("../models/Vendor");
const Product = require("../models/Product");
const Template = require("../models/Template");
const renderTemplate = require("../utils/templateRenderer");

const intentDetector = require("../utils/intentDetector");
const paymentDetector = require("../utils/paymentDetector");

async function handleIncomingMessage(vendorId, client, msg) {
  const vendor = await Vendor.findById(vendorId);
  const templateData = await Template.findOne({ vendor: vendorId });

  if (!vendor) return;

  const customerNumber = msg.from.replace("@c.us", "");
  const customerName = msg._data.notifyName || "Customer";
  const text = msg.body ? msg.body.trim().toLowerCase() : "";

  // let contextInfo = "";

  //  if (msg.hasQuotedMsg) {
  //   try {
  //     const quoted = await msg.getQuotedMessage();
  //     contextInfo = ` (quoting: "${quoted.body.substring(0, 30)}...")`;
  //   } catch (err) {
  //     console.error("Quoted message error:", err.message);
  //   }
  // }

  const intent = intentDetector(text);
  const isPayment = paymentDetector(text);

  /* =========================
     1. DETECT STATUS REPLY
  ========================= */
  let isStatusReply = false;
  let matchedProduct = null;

  if (msg.hasQuotedMsg) {
    try {
      const quoted = await msg.getQuotedMessage();

      if (quoted.from === "status@broadcast") {
        isStatusReply = true;

        // Try to match product from status caption
        const caption = quoted.body || "";

        matchedProduct = await Product.findOne({
          vendor: vendorId,
          name: { $regex: caption, $options: "i" },
        });

       const checkIntent = intentDetector(caption);
        if (checkIntent === "price" && matchedProduct) {
          await client.sendMessage(msg.from, renderTemplate(templateData.templates.price, {
            productName: matchedProduct.name,
            productPrice: matchedProduct.price
          }));

          return;
        }

        if (checkIntent === "negotiation" && matchedProduct) {

          // simple smart discount (optional logic)
          const discountPrice = Math.round(matchedProduct.price * matchedProduct.discount);

          await client.sendMessage(msg.from, renderTemplate(templateData.templates.negotiation, {
            discountPrice
          }));

          return;
        }
        console.log("🔥 Status reply detected");
      }

    } catch (err) {
      console.error("Status detection error:", err.message);
    }
  }




if (intent === "ready-to-pay") {
  const accountDetails = vendor.bankDetails || "Please contact us for payment details.";

  await client.sendMessage(msg.from, `
Great choice 🙌

You can make payment using:
${accountDetails}

Send your delivery details after payment ✅
  `);

  return; // STOP further processing
}

if (intent === "price" && matchedProduct) {
  await client.sendMessage(msg.from, renderTemplate(templateData.templates.price, {
            productName: matchedProduct.name,
            productPrice: matchedProduct.price
          }));
  return;
}

if (intent === "price" && !matchedProduct) {
  await client.sendMessage(msg.from, 
    "Which product are you asking about? 😊"
  );
  return;
}

if (intent === "negotiation" && matchedProduct) {

  // simple smart discount (optional logic)
  const discountPrice = Math.round(matchedProduct.price * matchedProduct.discount);

  await client.sendMessage(msg.from, renderTemplate(templateData.templates.negotiation, {
    discountPrice
  }));

  return;
}

  /* =========================
     3. FIND / CREATE LEAD
  ========================= */
  let lead = await Lead.findOne({ vendor: vendorId, customerNumber });

  if (!lead) {
    lead = new Lead({
      vendor: vendorId,
      customerName,
      customerNumber,
      lastMessage: text,
      intentType: intent,
      source: isStatusReply ? "status" : "chat",
      product: matchedProduct?._id || null,
    });

    await lead.save();

  } else {
    lead.lastMessage = text;
    lead.intentType = intent;
    lead.status = "responded";
    lead.followUpsSent = 0;

    // Update source if status
    if (isStatusReply) {
      lead.source = "status";
      if (matchedProduct) {
        lead.product = matchedProduct._id;
      }
    }

    await lead.save();
  }

  /* =========================
     4. REAL-TIME DASHBOARD PUSH
  ========================= */
  if (global.io) {
    global.io.to(vendorId.toString()).emit("new-lead", {
      phone: customerNumber,
      message: text,
      source: isStatusReply ? "status" : "chat",
      product: matchedProduct?.name || null,
    });
  }

  /* =========================
     5. OPTIONAL AUTO-REPLY (SMART)
  ========================= */
  if (isStatusReply && matchedProduct) {
    const reply = `Hi 👋 ${customerName},

Yes, ${matchedProduct.name} is available for ₦${matchedProduct.price}.

Would you like to place an order?`;

    await client.sendMessage(msg.from, reply);
  }

  /* =========================
     6. LOGGING
  ========================= */
  console.log(
    `Message from ${customerNumber} | intent: ${intent} ${
      isPayment ? "💰 payment" : ""
    } ${isStatusReply ? "🔥 STATUS LEAD" : ""}`
  );
}

module.exports = { handleIncomingMessage };