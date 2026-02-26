module.exports = function detectPayment(text) {
  text = text.toLowerCase();
  return (
    text.includes("account") ||
    text.includes("paystack") ||
    text.includes("flutterwave") ||
    text.includes("transfer")
  );
};
