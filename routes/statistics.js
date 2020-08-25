var express = require('express');
var router = express.Router({mergeParams: true});
let pairs = require("../models/pairs");
let timeframes = require("../models/timeframes");
let categories = require("../models/categoriesPairs");
let middleware = require('../middleware');


// STATISTICS ROUTE
router.get("/", middleware.isLoggedIn, (req, res) => {
  // FIXME: change the file organisation
  res.render("user/statistics/statistics");
});

module.exports = router;
