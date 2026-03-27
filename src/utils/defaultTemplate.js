module.exports = function getDefaultTemplates(vendorBusinessName) {
  return {
    greeting: `Hi 👋, welcome to ${vendorBusinessName}! How can I help you today?`,

    price: "📦 {productName} is available for ₦{price}.\nWould you like to place an order? 😊",

    negotiation: "For you 😉, I can do ₦{discountPrice}.\nLet me know if we should proceed.",

    readyToPay: "Great choice 🙌\n\nYou can pay here:\n{accountDetails}\n\nSend delivery details after payment ✅",

    fallback: "Please tell me what you're interested in 😊"
  };
};