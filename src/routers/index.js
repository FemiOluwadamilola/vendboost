const express = require('express');
const router = express.Router();

router.get("/", async (req,res) => {
	try{
		res.status(200).render('index',{
			title:"welcome to Vendboost",
		})
	}catch(err){
		return res.status(500).json({
	      message: "Server error: something went wrong, please try again later",
	      error: err,
	     });
	}
})


module.exports = router;
