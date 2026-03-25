exports.requireAuth = (req, res, next) => {
  const user = req.session.user;

  if (!user || !user.id) {
    return res.redirect("/signin");
  }

  req.user = user; 

  next();
};