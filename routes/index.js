var express = require('express');
var router = express.Router();
var passport = require('passport');
// Global Program Variables
let strategies = require("../models/strategies")

// HOME ROUTE
router.get("/", (req, res) => {
  res.render("home");
});

// LOGIN ROUTE
router.get("/login", (req, res) => {
  // checks whether user data exists for direct login
  if (!req.user) {
    res.render("login");
  } else {
    if (req.isAuthenticated()) {
      res.redirect("/" + req.user.username)
    }
  }
});

// LOGIN LOGIC
router.post("/login", passport.authenticate('local-login', {
  failureRedirect: '/login'
}), (req, res) => {
  strategies(req.user.id);
  res.redirect("/" + req.user.username)
})

// SIGNUP ROUTE
router.get("/signup", (req, res) => {
  res.render("signup");
});

// SIGNUP LOGIC
router.post("/signup", passport.authenticate('local-signup', {
  failureRedirect: '/signup'
}), (req, res) => {
  res.redirect("/" + req.user.username);
})

// LOGOUT ROUTE
router.get("/logout", (req, res) => {
  req.logout();
  req.flash("success", "Successfully logged out!")
  res.redirect("/")
})

// WIKK ROUTE
router.get("/wiki", (req, res) => {
  res.send("You have reached the wiki route");
})

// AUTHENTICATION MIDDLEWARE
function isLoggedIn(req, res, next) {
  if(req.isAuthenticated()) {
    if (req.user.username === req.params.profile) {
      return next();
    } else {
      // FIXME: so it doesn't freeze and return to previous ROUTE
      return false;
    }
  } else {
    req.flash("error", "Please, login first!")
    res.redirect("/login");
  }
}

module.exports = router;
