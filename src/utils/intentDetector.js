module.exports = function detectIntent(text) {
  if (!text) return "silent";

  text = text.toLowerCase();

  /* =========================
     PRICE INTENT
  ========================= */
  if (
    /price|how much|last price|how far|cost|amount|₦|\d+k/.test(text)
  ) {
    return "price";
  }

  /* =========================
     AVAILABILITY INTENT
  ========================= */
  if (
    /available|still dey|in stock|size|color|variant|get am/.test(text)
  ) {
    return "availability";
  }

  /* =========================
     NEGOTIATION INTENT
  ========================= */
  if (
    /last|best price|can you do|reduce|discount|nego|something for me/.test(text)
  ) {
    return "negotiation";
  }

  /* =========================
     PAYMENT INTENT (HOT LEAD)
  ========================= */
  if (
    /send account|account number|pay|payment|transfer|i'll take it|i want it|i go buy/.test(text)
  ) {
    return "ready-to-pay";
  }

  /* =========================
     DELIVERY / LOCATION
  ========================= */
  if (
    /where|location|deliver|delivery|ship|waybill/.test(text)
  ) {
    return "logistics";
  }

  /* =========================
     GREETING (LOW VALUE)
  ========================= */
  if (
    /hello|hi|hey|good morning|good afternoon|good evening/.test(text)
  ) {
    return "greeting";
  }

  /* =========================
     DEFAULT
  ========================= */
  return "silent";
};