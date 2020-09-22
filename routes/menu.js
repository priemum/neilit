let express = require('express');
let router = express.Router({mergeParams: true});
let pairs = require('../models/pairs');
let currencies = require('../models/currencies');
let timeframes = require('../models/timeframes');
let categories = require('../models/categoriesPairs');
let middleware = require('../middleware');
let connection = require('../models/connectDB');

// SETTINGS ROUTE
router.get("/settings", middleware.isLoggedIn, (req, res) => {
  var selectGoals = 'SELECT goal FROM goals WHERE user_id = ?';
  var selectRole = 'SELECT role FROM roles WHERE id = ?';
  var goals = []
  connection.query(selectGoals, req.user.id, (err, getGoals) => {
    getGoals.forEach((result) => {
      goals.push(result.goal)
    });
    connection.query(selectRole, req.user.role_id, (err, getRole) => {
      if (err) throw err;
      var role = getRole[0].role;
      res.render("user/settings",
        {
          strategies: userStrategies,
          currencies: currencies,
          goals: goals,
          role: role
        }
      );
    })
  })
})

// DASHBOARD USER ROUTE
router.get("", middleware.isLoggedIn, (req, res) => {
  var selectUserBase  = 'SELECT currency FROM currencies WHERE id = ?;'
  var selectEntries   = 'SELECT pair_id, profits, fees, result, MONTHNAME(exit_dt) AS month FROM entries WHERE status = 1 AND user_id = ?;'
  var selectOpenOps   = 'SELECT pair_id, size, direction, DATE_FORMAT(entry_dt, "%d/%m/%y") AS date, entry_price FROM entries WHERE status = 0 AND user_id = ?;'
  var selectMonth     = 'SELECT profits, fees FROM entries WHERE YEAR(entry_dt) = YEAR(CURDATE()) AND MONTH(entry_dt) = MONTH(CURDATE()) AND status = 1 AND user_id = ?;'
  var selectWeek      = 'SELECT profits, fees FROM entries WHERE YEARWEEK(DATE(entry_dt), 1) = YEARWEEK(CURDATE(), 1) AND status = 1 AND user_id = ?;'
  connection.query(selectUserBase, req.user.currency_id, (err, getBase) => {
    if (err) throw err;
    // object with dashboad data CURRENT BALANCE, BIGGEST TRADE & TOTAL ENTRIES
    var dashboardData = {
      base: getBase[0].currency,
      currentAmount: req.user.balance,
      currentPercent: 0,
      biggestPair: 'N/A',
      biggestPercent: 0,
      total: 0,
      rate: 0
    }
    // creates an object for monthly OUTCOME data
    var outcomeMonth = {
      January:    { outcome: 0, total: 0 },
      February:   { outcome: 0, total: 0 },
      March:      { outcome: 0, total: 0 },
      April:      { outcome: 0, total: 0 },
      May:        { outcome: 0, total: 0 },
      June:       { outcome: 0, total: 0 },
      July:       { outcome: 0, total: 0 },
      August:     { outcome: 0, total: 0 },
      September:  { outcome: 0, total: 0 },
      October:    { outcome: 0, total: 0 },
      November:   { outcome: 0, total: 0 },
      December:   { outcome: 0, total: 0 }
    }
    connection.query(selectEntries, req.user.id, (err, getEntries) => {
      if (err) throw err;
      getEntries.forEach((entry) => {
        // counts the entry to the corresponding metric
        dashboardData.total += 1;
        outcomeMonth[entry.month].total += 1;
        // counts the entry if result is WIN
        if (entry.result == 'win') { dashboardData.rate += 1 }
        // adds the entry ouctcome as amount and percent
        var entryPercent = Math.round((((entry.profits - entry.fees) / req.user.balance) * 100 + Number.EPSILON) * 100) / 100;
        dashboardData.currentAmount += (entry.profits - entry.fees);
        // compares the entry percents to get the biggest trade
        if (entryPercent >= dashboardData.biggestPercent) {
          dashboardData.biggestPercent = entryPercent;
          dashboardData.biggestPair = pairs[entry.pair_id - 1];
        }
        outcomeMonth[entry.month].outcome += (entry.profits - entry.fees);
      });
      dashboardData.currentPercent = (dashboardData.currentAmount / req.user.balance - 1) * 100
      dashboardData.currentAmount = dashboardData.currentAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
      dashboardData.rate = (dashboardData.rate/dashboardData.total * 100).toFixed(2);
      // divides the data in 'outcomeMonth' in two separate arrays
      var outcomeMonthAmount = [];
      var outcomeMonthTotal = [];
      for (const month in outcomeMonth) {
        outcomeMonthAmount.push(outcomeMonth[month].outcome)
        outcomeMonthTotal.push(outcomeMonth[month].total)
      }
      connection.query(selectOpenOps, req.user.id, (err, getOps) => {
        if (err) throw err;
        // creates an object for open operations
        var dashboardOps = { }
        getOps.forEach((operation, i) => {
          dashboardOps[i] = { }
          dashboardOps[i].pair = pairs[operation.pair_id - 1];
          dashboardOps[i].lot = operation.size;
          dashboardOps[i].direction = operation.direction;
          dashboardOps[i].date = operation.date;
          dashboardOps[i].entry = operation.entry_price;
        });
        connection.query(selectMonth, req.user.id, (err, getMonth) => {
          if (err) throw err;
          var monthTwenty = 0;
          getMonth.forEach((entry) => {
            var entryPercent = Math.round((((entry.profits - entry.fees) / req.user.balance) * 100 + Number.EPSILON) * 100) / 100;
            monthTwenty += entryPercent
          });
          connection.query(selectWeek, req.user.id, (err, getWeek) => {
            if (err) throw err;
            var weekFive = 0;
            getWeek.forEach((entry) => {
              var entryPercent = Math.round((((entry.profits - entry.fees) / req.user.balance) * 100 + Number.EPSILON) * 100) / 100;
              weekFive += entryPercent
            });
            res.render("user/user",
              {
                notification:notification,
                dashboardData:dashboardData,
                outcomeMonthAmount:outcomeMonthAmount,
                outcomeMonthTotal:outcomeMonthTotal,
                dashboardOps:dashboardOps,
                monthTwenty:monthTwenty,
                weekFive:weekFive,
              }
            );
          })
        })
      })
    })
  })
})

// STATISTICS ROUTE
router.get("/statistics", middleware.isLoggedIn, (req, res) => {
  var selectUserBase = 'SELECT currency FROM currencies WHERE id = ?;'
  var selectEntries = 'SELECT pair_id, strategy_id, timeframe_id, direction, result, profits, fees, MONTH(entry_dt) as month, DATE_FORMAT(entry_dt, "%W") AS date FROM entries WHERE status = 1 AND user_id = ?;';
  connection.query(selectUserBase, req.user.currency_id, (err, getBase) => {
    if (err) throw err;
    var userBase = getBase[0].currency;
    // creates an object to store the asset stats
    var assetStats = {
      quantity: Array(pairs.length).fill(0),
      win:      Array(pairs.length).fill(0),
      loss:     Array(pairs.length).fill(0),
      be:       Array(pairs.length).fill(0),
      amount:   Array(pairs.length).fill(0),
      percent:  Array(pairs.length).fill(0)
    }
    // creates an object to store the timeframe stats
    var timeframeStats = {
      quantity: Array(timeframes.length).fill(0),
      win:      Array(timeframes.length).fill(0),
      loss:     Array(timeframes.length).fill(0),
      be:       Array(timeframes.length).fill(0),
      amount:   Array(timeframes.length).fill(0),
      percent:  Array(timeframes.length).fill(0)
    }
    connection.query(selectEntries, req.user.id, (err, getEntries) => {
      if (err) throw err;
      // object with the statiscits from PROFITS, ENTRIES and DIRECTION
      var statistics = {
        profits: {
          amount: 0,
          percent: 0
        },
        entries: {
          win: 0,
          loss: 0,
          be: 0
        },
        direction: {
          long: 0,
          short: 0
        },
        directionPer: {
          long: Array(12).fill(0),
          short: Array(12).fill(0)
        }
      }
      // creates an object to store the strategy stats
      var strategyStats = { }
      userIdStrategies.forEach((id, i) => {
        strategyStats[Number(id, i)] = {
          name: userStrategies[i],
          quantity: 0,
          win: 0,
          loss: 0,
          be: 0,
          percent: 0
        }
      });
      // creates an object to store the day of the week stats
      var dayWeekStats = {
        Monday:     { name:'Monday',    quantity:0, win:0, loss:0, be:0, percent:0 },
        Tuesday:    { name:'Tuesday',   quantity:0, win:0, loss:0, be:0, percent:0 },
        Wednesday:  { name:'Wednesday', quantity:0, win:0, loss:0, be:0, percent:0 },
        Thursday:   { name:'Thursday',  quantity:0, win:0, loss:0, be:0, percent:0 },
        Friday:     { name:'Friday',    quantity:0, win:0, loss:0, be:0, percent:0 },
        Saturday:   { name:'Saturday',  quantity:0, win:0, loss:0, be:0, percent:0 },
        Sunday:     { name:'Sunday',    quantity:0, win:0, loss:0, be:0, percent:0 }
      }
      getEntries.forEach((entry) => {
        var entryPercent = Math.round((((entry.profits - entry.fees) / req.user.balance) * 100 + Number.EPSILON) * 100) / 100;
        // counts the entry to the corresponding metric
        assetStats.quantity[Number(entry.pair_id) - 1]++;
        timeframeStats.quantity[Number(entry.timeframe_id) - 1]++;
        strategyStats[entry.strategy_id].quantity++;
        dayWeekStats[entry.date].quantity++;
        // counts the entry result to the corresponding metric
        if (entry.result == 'win') {
          statistics.entries.win++
          assetStats.win[Number(entry.pair_id) - 1]++;
          timeframeStats.win[Number(entry.timeframe_id) - 1]++;
          strategyStats[entry.strategy_id].win++;
          dayWeekStats[entry.date].win++;
        } else if (entry.result == 'loss') {
          statistics.entries.loss++
          assetStats.loss[Number(entry.pair_id) - 1]++;
          timeframeStats.loss[Number(entry.timeframe_id) - 1]++;
          strategyStats[entry.strategy_id].loss++;
          dayWeekStats[entry.date].loss++;
        } else {
          statistics.entries.be++
          assetStats.be[Number(entry.pair_id) - 1]++;
          timeframeStats.be[Number(entry.timeframe_id) - 1]++;
          strategyStats[entry.strategy_id].be++;
          dayWeekStats[entry.date].be++;
        }
        // counts entry direction & calculates the entry profit
        if (entry.direction == 'long') {
          statistics.direction.long++
          statistics.directionPer.long[entry.month - 1]+= entryPercent
        } else {
          statistics.direction.short++
          statistics.directionPer.short[entry.month - 1]+= entryPercent
        }
        statistics.profits.amount+=                               (entry.profits - entry.fees);
        // adds the entry ouctcome for its corresponding asset
        assetStats.amount[Number(entry.pair_id) - 1]+=            (entry.profits - entry.fees);
        assetStats.percent[Number(entry.pair_id) - 1]+=           entryPercent;
        // adds the entry ouctcome for its corresponding timeframe
        timeframeStats.amount[Number(entry.timeframe_id) - 1]+=   (entry.profits - entry.fees);
        timeframeStats.percent[Number(entry.timeframe_id) - 1]+=  entryPercent;
        // adds the entry ouctcome for its corresponding strategy
        strategyStats[entry.strategy_id].percent +=               entryPercent;
        // adds the entry outcome for tis corresponding weekday
        dayWeekStats[entry.date].percent +=                       entryPercent;
      });
      // sorts the entry quantity to preview the statistics showcase
      function getMax7(ar) {
        if (ar.length < 7) return ar;
        var max = [[ar[0],0],[ar[1],1],[ar[2],2],[ar[3],3],[ar[4],4],[ar[5],5],[ar[6],6]],
            i,j;
        for (i = 7;i<ar.length;i++){
            for (j = 0;j<max.length;j++){
                if (ar[i] > max[j][0]){
                    max[j] = [ar[i],i];
                    if (j<2){
                        max.sort(function(a,b) { return a[0]-b[0]; });
                    }
                   break;
                }
            }
        }
        return max;
      }
      assetStats.showcase     = getMax7(assetStats.quantity);
      timeframeStats.showcase = getMax7(timeframeStats.quantity);
      // converts the profits from amount to %
      statistics.profits.percent = Math.round(((statistics.profits.amount / req.user.balance) * 100 + Number.EPSILON) * 100) / 100
      res.render("user/statistics",
        {
          pairs:pairs,
          timeframes:timeframes,
          userBase:userBase,
          statistics:statistics,
          assetStats:assetStats,
          timeframeStats:timeframeStats,
          strategyStats:strategyStats,
          dayWeekStats:dayWeekStats
        }
      );
    })
  })
});

// TRADING PLAN ROUTE
router.get("/plan", middleware.isLoggedIn, (req, res) => {
  // COMBAK: ensure that order is descending in terms of created_at
  var selectPlans = 'SELECT id, title, DATE_FORMAT(created_at, "%d/%m/%Y") AS date FROM plans WHERE user_id = ?';
  connection.query(selectPlans, req.user.id, (err, getPlans) => {
    if (err) throw err;
    // Object to store the Plans
    var plans = {
      id: [],
      title: [],
      date: []
    }
    getPlans.forEach((result) => {
      plans.id.push(result.id);
      plans.title.push(result.title);
      plans.date.push(result.date);
    });
    res.render("user/plan", {plans:plans});
  })
})

// RISK CALCULATOR ROUTE
router.get("/calculator", middleware.isLoggedIn, (req, res) => {
  connection.query('SELECT currency_id FROM users WHERE id = ?', req.user.id, (err, getCurrency) => {
    if (err) throw err;
    var currency = currencies[getCurrency[0].currency_id - 1]
    res.render("user/calculator",
      {
        currencies:pairs,
        currency:currency
      }
    );
  })
})

// JOURNAL ROUTE
// BUG: problem with so many connections - create a pool - run by JORDI
router.get("/journal", middleware.isLoggedIn, (req,res) => {
  // FIXME: table not optimized - JOIN pairs is unecessary
  var selectTAs = 'SELECT tanalysis.id AS identifier, pair, DATE_FORMAT(tanalysis.created_at, "%d de %M %Y") AS created_at FROM tanalysis JOIN pairs ON tanalysis.pair_id = pairs.id WHERE user_id = ? ORDER BY tanalysis.created_at DESC LIMIT 7';
  // FIXME: table not optimized - JOIN pairs is unecessary
  var selectEntrys = 'SELECT entries.id AS identifier, DATE_FORMAT(entry_dt, "%d de %M %Y") AS entry_dt, pair FROM entries JOIN pairs ON entries.pair_id = pairs.id WHERE user_id = ? ORDER BY entry_dt DESC LIMIT 7';
  var selectComments = 'SELECT id, DATE_FORMAT(created_at, "%d/%m/%y") AS title, comment FROM comments WHERE user_id = ? ORDER BY created_at DESC LIMIT 7';
  var selectBacktest = 'SELECT id, DATE_FORMAT(created_at, "%d de %M %Y") AS title, result FROM backtest WHERE user_id = ? ORDER BY created_at DESC LIMIT 7;'
  // Defines the max. # of characters allowed when displaying comments
  var commentsLength = 45
  connection.query(selectTAs, req.user.id, (err, getTas) => {
    if (err) throw err;
    // Object to store the TAs
    var tasLimited = {
      title: [],
      id: []
    }
    getTas.forEach((result) => {
      tasLimited.title.push(result.pair + ", " + result.created_at);
      tasLimited.id.push(result.identifier);
    });
    connection.query(selectEntrys, req.user.id, (err, getEntries) => {
      if (err) throw err;
      // Object to store the ENTRIES
      var entriesLimited = {
        title: [],
        id: []
      }
      getEntries.forEach((result) => {
        entriesLimited.title.push(result.pair + ", " + result.entry_dt);
        entriesLimited.id.push(result.identifier);
      })
      connection.query(selectComments, req.user.id, (err, getComments) => {
        if (err) throw err;
        // Object to store the COMMENTS
        var commentsLimited = {
          id: [],
          date: [],
          content: []
        }
        getComments.forEach((result) => {
          commentsLimited.id.push(result.id)
          commentsLimited.date.push(result.title)
          // FIXME: this function doesn't work
          if (result.comment.length > commentsLength) {
            var trimmedComment = result.comment.substring(0, (commentsLength - 4)) + " ...";
            commentsLimited.content.push(trimmedComment)

          } else {
            commentsLimited.content.push(result.comment)
          }
        })
        connection.query(selectBacktest, req.user.id, (err, getBacktest) => {
          if (err) throw err;
          // Object to store the BACKTESTS
          var backtestLimited = {
            title: [],
            id: []
          }
          getBacktest.forEach((result) => {
            backtestLimited.title.push(result.title + " [" + result.result + "]")
            backtestLimited.id.push(result.id)
          });
          res.render("user/journal",
            {
              entries:entriesLimited,
              tas:tasLimited,
              comments:commentsLimited,
              backtest:backtestLimited,
              pairs:pairs
            }
          );
        })
      })
    })
  })
})

module.exports = router;
