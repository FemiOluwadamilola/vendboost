const router = require("express").Router();

router.get("/", (req, res) => {
  return res.status(200).json("Auth route running...");
});

module.exports = router();
