// dependencies
const util = require('util');

// global variables
let pairs       = require('../models/pairs');
let currencies  = require('../models/currencies');
let db          = require('../models/dbConfig');
let logger      = require('../models/winstonConfig')

// node native promisify
const query = util.promisify(db.query).bind(db);

module.exports.biggestTrade = (req, res) => {
  var percent = 0;
  var pair = 'N/A';
  (async () => {
    try {
      switch (req.params.period) {
        case 'today':
          var getEntries = await query('SELECT pair_id, profits, fees FROM entries WHERE entry_dt > CURDATE() AND status = 1 AND user_id = ?;', req.user.id);
          break;
        case 'cweek':
          var getEntries = await query('SELECT pair_id, profits, fees FROM entries WHERE YEARWEEK(DATE(entry_dt), 1) = YEARWEEK(CURDATE(), 1) AND status = 1 AND user_id = ?;', req.user.id);
          break;
        case 'lweek':
          var getEntries = await query('SELECT pair_id, profits, fees FROM entries WHERE YEARWEEK(DATE(entry_dt), 1) = YEARWEEK(CURDATE() - INTERVAL 1 WEEK, 1) AND status = 1  AND user_id = ?;', req.user.id);
          break;
        case 'cmonth':
          var getEntries = await query('SELECT pair_id, profits, fees FROM entries WHERE YEAR(entry_dt) = YEAR(CURDATE()) AND MONTH(entry_dt) = MONTH(CURDATE()) AND status = 1  AND user_id = ?;', req.user.id);
          break;
        case 'lmonth':
          var getEntries = await query('SELECT pair_id, profits, fees FROM entries WHERE YEAR(entry_dt) = YEAR(CURDATE() - INTERVAL 1 MONTH) AND MONTH(entry_dt) = MONTH(CURDATE() - INTERVAL 1 MONTH) AND status = 1  AND user_id = ?;', req.user.id);
          break;
        case 'cquarter':
          var getEntries = await query('SELECT pair_id, profits, fees FROM entries WHERE YEAR(entry_dt) = YEAR(CURDATE()) AND QUARTER(entry_dt) = QUARTER(CURDATE()) AND status = 1 AND user_id = ?;', req.user.id);
          break;
        case 'lquarter':
          var getEntries = await query('SELECT pair_id, profits, fees FROM entries WHERE YEAR(entry_dt) = YEAR(CURDATE() - INTERVAL 1 QUARTER) AND QUARTER(entry_dt) = QUARTER(CURDATE() - INTERVAL 1 QUARTER) AND status = 1 AND user_id = ?;', req.user.id);
          break;
        case 'all':
          var getEntries = await query('SELECT pair_id, profits, fees FROM entries WHERE status = 1 AND user_id = ?;', req.user.id);
          break;
      }
      getEntries.forEach((entry) => {
        var entryPercent = ((entry.profits - entry.fees) / req.user.balance) * 100;
        if (entryPercent > percent) {
          percent = entryPercent;
          pair = pairs[entry.pair_id - 1];
        }
      });
    } catch (err) {
      logger.error({
        message: 'DASHBOARD (biggest trade) something went wrong',
        endpoint: req.method + ': ' + req.originalUrl,
        programMsg: err
      })
      req.flash('error', res.__('Something went wrong. Please, try again later.'))
      return res.redirect('/' + req.user.username);
    } finally {
      res.json({
        percent: percent,
        pair: pair
      })
    }
  })()
}

module.exports.customBiggestTrade = (req, res) => {
  var biggestPercent = 0;
  var biggestPair = 'N/A';
  (async () => {
    try {
      var getEntries = await query('SELECT pair_id, profits, fees FROM entries WHERE status = 1 AND user_id = ? AND entry_dt > ? AND entry_dt < ?;', [req.user.id, req.params.from, req.params.to]);
      getEntries.forEach((entry) => {
        var entryPercent = ((entry.profits - entry.fees) / req.user.balance) * 100;
        if (entryPercent >= biggestPercent) {
          biggestPercent = entryPercent;
          biggestPair = pairs[entry.pair_id - 1];
        }
      })
    } catch (err) {
      logger.error({
        message: 'DASHBOARD (custom biggest trade) something went wrong',
        endpoint: req.method + ': ' + req.originalUrl,
        programMsg: err
      })
      req.flash('error', res.__('Something went wrong. Please, try again later.'))
      return res.redirect('/' + req.user.username);
    } finally {
      res.json({
        percent: biggestPercent,
        pair: biggestPair
      })
    }
  })()
}

module.exports.totalEntries = (req, res) => {
  var total = 0;
  var wins = 0;
  var rate;
  (async () => {
    try {
      switch (req.params.period) {
        case 'today':
          var getEntries = await query('SELECT result FROM entries WHERE entry_dt > CURDATE() AND status = 1 AND user_id = ?;', req.user.id);
          break;
        case 'cweek':
          var getEntries = await query('SELECT result FROM entries WHERE YEARWEEK(DATE(entry_dt), 1) = YEARWEEK(CURDATE(), 1) AND status = 1 AND user_id = ?;', req.user.id);
          break;
        case 'lweek':
          var getEntries = await query('SELECT result FROM entries WHERE YEARWEEK(DATE(entry_dt), 1) = YEARWEEK(CURDATE() - INTERVAL 1 WEEK, 1) AND status = 1  AND user_id = ?;', req.user.id);
          break;
        case 'cmonth':
          var getEntries = await query('SELECT result FROM entries WHERE YEAR(entry_dt) = YEAR(CURDATE()) AND MONTH(entry_dt) = MONTH(CURDATE()) AND status = 1  AND user_id = ?;', req.user.id);
          break;
        case 'lmonth':
          var getEntries = await query('SELECT result FROM entries WHERE YEAR(entry_dt) = YEAR(CURDATE() - INTERVAL 1 MONTH) AND MONTH(entry_dt) = MONTH(CURDATE() - INTERVAL 1 MONTH) AND status = 1  AND user_id = ?;', req.user.id);
          break;
        case 'cquarter':
          var getEntries = await query('SELECT result FROM entries WHERE YEAR(entry_dt) = YEAR(CURDATE()) AND QUARTER(entry_dt) = QUARTER(CURDATE()) AND status = 1 AND user_id = ?;', req.user.id);
          break;
        case 'lquarter':
          var getEntries = await query('SELECT result FROM entries WHERE YEAR(entry_dt) = YEAR(CURDATE() - INTERVAL 1 QUARTER) AND QUARTER(entry_dt) = QUARTER(CURDATE() - INTERVAL 1 QUARTER) AND status = 1 AND user_id = ?;', req.user.id);
          break;
        case 'all':
          var getEntries = await query('SELECT result FROM entries WHERE status = 1 AND user_id = ?;', req.user.id);
          break;
      }
      getEntries.forEach((entry) => {
        total++;
        if (entry.result == 'win') {
          wins++;
        }
      });
      if (total == 0) {
        rate = 0;
      } else {
        rate = wins/total * 100;
      }
    } catch (err) {
      logger.error({
        message: 'DASHBOARD (total entries) something went wrong',
        endpoint: req.method + ': ' + req.originalUrl,
        programMsg: err
      })
      req.flash('error', res.__('Something went wrong. Please, try again later.'))
      return res.redirect('/' + req.user.username);
    } finally {
      res.json({
        total: total,
        rate: rate
      })
    }
  })()
}

module.exports.customTotalEntries = (req, res) => {
  var total = 0;
  var wins = 0;
  var rate;
  (async () => {
    try {
      var getEntries = await query('SELECT result FROM entries WHERE status = 1 AND user_id = ? AND entry_dt > ? AND entry_dt < ?;', [req.user.id, req.params.from, req.params.to]);
      getEntries.forEach((entry) => {
        total++;
        if (entry.result == 'win') {
          wins++;
        }
      })
      if (total == 0) {
        rate = 0;
      } else {
        rate = wins/total * 100
      }
    } catch (err) {
      logger.error({
        message: 'DASHBOARD (custom total entries) something went wrong',
        endpoint: req.method + ': ' + req.originalUrl,
        programMsg: err
      })
      req.flash('error', res.__('Something went wrong. Please, try again later.'))
      return res.redirect('/' + req.user.username);
    } finally {
      res.json({
        total: total,
        rate: rate
      })
    }
  })()
}

module.exports.monthlyOutcome = (req, res) => {
  // creates object arrays for outcome x month data
  var outcomeMonthAmount = Array(12).fill(0);
  var outcomeMonthTotal  = Array(12).fill(0);
  (async () => {
    try {
      switch (req.params.period) {
        case 'today':
          var getEntries = await query('SELECT profits, fees, MONTH(exit_dt) AS month FROM entries WHERE entry_dt > CURDATE() AND status = 1 AND user_id = ?;', req.user.id);
          break;
        case 'cweek':
          var getEntries = await query('SELECT profits, fees, MONTH(exit_dt) AS month FROM entries WHERE YEARWEEK(DATE(entry_dt), 1) = YEARWEEK(CURDATE(), 1) AND status = 1 AND user_id = ?;', req.user.id);
          break;
        case 'lweek':
          var getEntries = await query('SELECT profits, fees, MONTH(exit_dt) AS month FROM entries WHERE YEARWEEK(DATE(entry_dt), 1) = YEARWEEK(CURDATE() - INTERVAL 1 WEEK, 1) AND status = 1  AND user_id = ?;', req.user.id);
          break;
        case 'cmonth':
          var getEntries = await query('SELECT profits, fees, MONTH(exit_dt) AS month FROM entries WHERE YEAR(entry_dt) = YEAR(CURDATE()) AND MONTH(entry_dt) = MONTH(CURDATE()) AND status = 1  AND user_id = ?;', req.user.id);
          break;
        case 'lmonth':
          var getEntries = await query('SELECT profits, fees, MONTH(exit_dt) AS month FROM entries WHERE YEAR(entry_dt) = YEAR(CURDATE() - INTERVAL 1 MONTH) AND MONTH(entry_dt) = MONTH(CURDATE() - INTERVAL 1 MONTH) AND status = 1  AND user_id = ?;', req.user.id);
          break;
        case 'cquarter':
          var getEntries = await query('SELECT profits, fees, MONTH(exit_dt) AS month FROM entries WHERE YEAR(entry_dt) = YEAR(CURDATE()) AND QUARTER(entry_dt) = QUARTER(CURDATE()) AND status = 1 AND user_id = ?;', req.user.id);
          break;
        case 'lquarter':
          var getEntries = await query('SELECT profits, fees, MONTH(exit_dt) AS month FROM entries WHERE YEAR(entry_dt) = YEAR(CURDATE() - INTERVAL 1 QUARTER) AND QUARTER(entry_dt) = QUARTER(CURDATE() - INTERVAL 1 QUARTER) AND status = 1 AND user_id = ?;', req.user.id);
          break;
        case 'all':
          var getEntries = await query('SELECT profits, fees, MONTH(exit_dt) AS month FROM entries WHERE status = 1 AND user_id = ?;', req.user.id);
          break;
      }
      getEntries.forEach((entry) => {
        outcomeMonthAmount[entry.month - 1] += (entry.profits - entry.fees);
        outcomeMonthTotal[entry.month - 1] += 1;
      });
    } catch (err) {
      logger.error({
        message: 'DASHBOARD (monthly outcome) something went wrong',
        endpoint: req.method + ': ' + req.originalUrl,
        programMsg: err
      })
      req.flash('error', res.__('Something went wrong. Please, try again later.'))
      return res.redirect('/' + req.user.username);
    } finally {
      res.json({
        outcomeMonthAmount: outcomeMonthAmount,
        outcomeMonthTotal: outcomeMonthTotal
      })
    }
  })()
}

module.exports.customMonthlyOutcome = (req, res) => {
  // creates object arrays for outcome x month data
  var outcomeMonthAmount = Array(12).fill(0);
  var outcomeMonthTotal  = Array(12).fill(0);
  (async () => {
    try {
      var getEntries = await query('SELECT profits, fees, MONTH(exit_dt) AS month FROM entries WHERE status = 1 AND user_id = ? AND entry_dt > ? AND entry_dt < ?;', [req.user.id, req.params.from, req.params.to]);
      getEntries.forEach((entry) => {
        outcomeMonthAmount[entry.month - 1] += (entry.profits - entry.fees);
        outcomeMonthTotal[entry.month - 1] += 1;
      })
    } catch (err) {
      logger.error({
        message: 'DASHBOARD (custom monthly outcome) something went wrong',
        endpoint: req.method + ': ' + req.originalUrl,
        programMsg: err
      })
      req.flash('error', res.__('Something went wrong. Please, try again later.'))
      return res.redirect('/' + req.user.username);
    } finally {
      res.json({
        outcomeMonthAmount: outcomeMonthAmount,
        outcomeMonthTotal: outcomeMonthTotal
      })
    }
  })()
}

module.exports.removeNotification = (req, res) => {
  req.session.notification = false;
  res.send({})
}
