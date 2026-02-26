module.exports = function detectIntent(text) {
  text = text.toLowerCase();
  if (
    text.includes("price") ||
    text.includes("how much") ||
    text.includes("last price")
  )
    return "price";
  if (
    text.includes("available") ||
    text.includes("size") ||
    text.includes("stock")
  )
    return "availability";
  if (
    text.includes("send account") ||
    text.includes("pay") ||
    text.includes("transfer")
  )
    return "ready-to-pay";
  return "silent";
};
