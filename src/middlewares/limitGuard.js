module.exports = (feature) => {
  return async (req, res, next) => {
    const vendorId = req.user.id;
    const plan = req.plan;

    if (feature === "broadcast") {
      const { checkBroadcastLimit } = require("../services/limitService");

      const result = await checkBroadcastLimit(vendorId, plan);

      if (!result.allowed) {
        return res.status(403).json({
          message: result.message,
        });
      }
    }

    await require("../services/usageService").incrementUsage(vendorId, feature);
    next();
  };
};
