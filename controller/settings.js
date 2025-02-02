// dependencies
const util    = require('util');
const multer  = require('multer');
const uuid    = require('uuid/v4')

const storage = multer.memoryStorage({
  destination: function(req, file, cb) {
    cb(null, '')
  }
})

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/jpeg' || file.mimetype == 'image/png') {
    cb(null, true)
  } else {
    // reject file if the type is not correct
    cb(null, false)
  }
}

const upload  = multer({
  storage: storage,
  lmits: {
    fileSize: 1024 * 1024 * 5
  },
  fileFilter: fileFilter
})

// global variables
let pairs             = require('../models/pairs');
let forexPairs        = require('../models/generateForex');
let cryptoPairs       = require('../models/generateCrypto');
let currencies        = require('../models/currencies');
let db                = require('../models/dbConfig');
let logger            = require('../models/winstonConfig');
let s3                = require('../models/s3Config');

// node native promisify
const query = util.promisify(db.query).bind(db);

// COMBAK: Set your secret key. Remember to switch to your live secret key in production!
// See your keys here: https://dashboard.stripe.com/account/apikeys
const stripe = require('stripe')('sk_test_51HTTZyFaIcvTY5RCCdt6kRcZcNMwtjq13cAVcs6jWWvowXuRqXQKvFCK6pYG7Q8NRSy9NQ8uCjHADKAHd36Mfosx006ajk0pov');

module.exports.multerHandle = upload.single('profileImage')

module.exports.newStrategy = (req, res) => {
  // creates an object with the new strategy
  var newStrategy = {
    strategy: req.body.strategy,
    user_id: req.user.id
  }
  // saves the strategy to the DB
  db.query('INSERT INTO strategies SET ?', newStrategy, (err, done) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        // COMBAK: log error
        return res.json(
          {
            response: 'error',
            message: res.__('Strategy names cannot have duplicate names.')
          }
        )
      } else {
        logger.error({
          message: 'SETTINGS (new strategy) could not add new strategy',
          endpoint: req.method + ': ' + req.originalUrl,
          programMsg: err
        })
        return res.json(
          {
            response: 'error',
            message: res.__('Something went wrong, please try again.')
          }
        )
      }
    }
    req.session.strategyNames.push(req.body.strategy);
    req.session.strategyIds.push(done.insertId)
    return res.json({response: 'success', id: done.insertId})
  })
}

module.exports.deleteStrategy = (req, res) => {
  var deleteStrategy = 'DELETE FROM strategies WHERE strategy = ? && user_id = ?'
  if (req.body.strategy == 'None') {
    return res.json(
      {
        response: 'error',
        message: res.__('The \'None\' strategy cannot be deleted.')
      }
    )
  }
  (async () => {
    var replace = req.session.strategyIds[0]
    var oldIndex = req.session.strategyNames.findIndex(strategy => strategy == req.body.strategy)
    var old = req.session.strategyIds[oldIndex]
    var data = [replace, old, req.user.id]
    try {
      // update entries
      var deleteEntries = await query('UPDATE entries SET strategy_id = ? WHERE strategy_id = ? && user_id = ?', data);
      // update technical analysis
      var deleteTAs = await query('UPDATE tanalysis r JOIN telementanalysis t ON (r.id = t.ta_id) SET t.strategy_id = ? WHERE t.strategy_id = ? && r.user_id = ?', data);
      // update backtest single strategy
      var deleteBTsingle = await query('UPDATE backtest SET strategy_id = ? WHERE strategy_id = ? && user_id = ?', data);
      // update backtest multiple strategies
      var deleteBTmultiple = await query('UPDATE backtest b JOIN backtest_data d ON (b.id = d.backtest_id) SET d.strategy_id = ? WHERE d.strategy_id = ? && b.user_id = ?', data);
      // delete strategy docs
      var deleteStratDocs = await query('DELETE FROM strategies_docs WHERE user_id = ? && strategy_id = ?', [req.user.id, old]);
      // delete strategy rules
      var deleteStratRules = await query('DELETE FROM strategies_rules WHERE user_id = ? && strategy_id = ?', [req.user.id, old]);
      // delete strategy exits
      var deleteStratExits = await query('DELETE FROM strategies_exits WHERE user_id = ? && strategy_id = ?', [req.user.id, old]);
      // delete strategy observations
      var deleteStratObservations = await query('DELETE FROM strategies_observations WHERE user_id = ? && strategy_id = ?', [req.user.id, old]);
    } catch (err) {
        console.log(err);
    } finally {
      // deletes the strategy from the DB
      await db.query(deleteStrategy, [req.body.strategy, req.user.id], (err, done) => {
        if (err) {
          console.log('here');
          logger.error({
            message: 'SETTINGS (delete strategy) could not delete strategy',
            endpoint: req.method + ': ' + req.originalUrl,
            programMsg: err
          })
          return res.json(
            {
              response: 'error',
              message: res.__('Something went wrong, please try again.')
            }
          )
        }
        req.session.strategyNames.splice(oldIndex, 1);
        req.session.strategyIds.splice(oldIndex, 1);
        return res.json({response: 'success'})
      })
    }
  })()
}

module.exports.newGoal = (req, res) => {
  // creates an object with the new goal
  var newGoal = {
    goal: req.body.goal,
    user_id: req.user.id
  }
  // saves the goal to the DB
  db.query('INSERT INTO goals SET ?', newGoal, (err, done) => {
    if (err) {
      logger.error({
        message: 'SETTINGS (new goal) could not add new goal',
        endpoint: req.method + ': ' + req.originalUrl,
        programMsg: err
      })
      req.flash('error', res.__('Something went wrong. Please, try again later.'))
      return res.redirect('/' + req.user.username);
    }
    res.end();
  })
}

module.exports.deleteGoal = (req, res) => {
  var deleteGoal = 'DELETE FROM goals WHERE goal = ?'
  // deletes the goal from the DB
  db.query(deleteGoal, req.body.goal, (err) => {
    if (err) {
      logger.error({
        message: 'SETTINGS (delete goal) could not delete goal',
        endpoint: req.method + ': ' + req.originalUrl,
        programMsg: err
      })
      req.flash('error', res.__('Something went wrong. Please, try again later.'))
      return res.redirect('/' + req.user.username);
    }
    res.end();
  })
}

module.exports.changeCurrency = (req, res) => {
  var updateCurrency = 'UPDATE users SET currency_id = ? WHERE id = ?'
  var currency = currencies.indexOf(req.body.currency) + 1;
  // updates the base currency from the DB
  db.query(updateCurrency, [currency, req.user.id], (err) => {
    if (err) {
      logger.error({
        message: 'SETTINGS (change currency) could not change currency',
        endpoint: req.method + ': ' + req.originalUrl,
        programMsg: err
      })
      req.flash('error', res.__('Something went wrong. Please, try again later.'))
      return res.redirect('/' + req.user.username);
    }
    res.end();
  })
}

module.exports.changeShowProfits = (req, res) => {
  var updateShowProfits = 'UPDATE users SET showProfits = ? WHERE id = ?'
  // updates the show profits in entries config. from the DB
  db.query(updateShowProfits, [req.body.showProfits, req.user.id], (err) => {
    if (err) {
      logger.error({
        message: 'SETTINGS (show profits) could not change show profits',
        endpoint: req.method + ': ' + req.originalUrl,
        programMsg: err
      })
      req.flash('error', res.__('Something went wrong. Please, try again later.'))
      return res.redirect('/' + req.user.username);
    }
    res.end();
  })
}

module.exports.changeMode = (req, res) => {
  var updateMode = 'UPDATE users SET darkMode = ? WHERE id = ?'
  // updates the mode from the DB
  db.query(updateMode, [req.body.mode, req.user.id], (err) => {
    if (err) {
      logger.error({
        message: 'SETTINGS (mode) could not change mode',
        endpoint: req.method + ': ' + req.originalUrl,
        programMsg: err
      })
      req.flash('error', res.__('Something went wrong. Please, try again later.'))
      return res.redirect('/' + req.user.username);
    }
    res.end();
  })
}

module.exports.toggleAssets = (req, res) => {
  (async () => {
    try {
      switch (req.body.type) {
        case 'Forex':
          var toggleForex = await query(`UPDATE users SET has_forex = ? WHERE id = ?`, [req.body.mode, req.user.id])
          if (Number(req.body.mode)) {
            let insertForexDB = await forexPairs.getForexPairs(req.user.id)
            var addForex = await query(`INSERT INTO pairs(pair, category, has_rate, user_id, is_custom) VALUES ?`, [insertForexDB])
          } else {
            var removeForex = await query(`DELETE FROM pairs WHERE is_custom = 0 AND category = 'Forex' AND user_id = ?`, req.user.id)
          }
          break;
        case 'Crypto':
          var toggleCrypto = await query(`UPDATE users SET has_crypto = ? WHERE id = ?`, [req.body.mode, req.user.id])
          if (Number(req.body.mode)) {
            let insertCryptoDB = await cryptoPairs.getCryptoPairs(req.user.id)
            var addCrypto = await query(`INSERT INTO pairs(pair, category, has_rate, user_id, is_custom) VALUES ?`, [insertCryptoDB])
          } else {
            var removeCrypto = await query(`DELETE FROM pairs WHERE is_custom = 0 AND category = 'Crypto' AND user_id = ?`, req.user.id)
          }
          break;
      }
      let getUserAssets = await query("SELECT id, pair, category, has_rate FROM pairs WHERE user_id = ?", req.user.id)
      req.session.assets = { }
      getUserAssets.forEach((asset) => {
        req.session.assets[asset.pair] = {
          id: asset.id,
          category: asset.category,
          rate: asset.has_rate
        }
      })
    } catch (err) {
      logger.error({
        message: 'SETTINGS (premade assets) could not toggle premade assets',
        endpoint: req.method + ': ' + req.originalUrl,
        programMsg: err
      })
    } finally {
      res.end();
    }
  })()
}

module.exports.addAsset = (req, res) => {
  var newAsset = {
    pair: req.body.pair,
    category: req.body.category,
    has_rate: 0,
    user_id: req.user.id,
    is_custom: 1
  }
  db.query('INSERT INTO pairs SET ?', newAsset, (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.json(
          {
            response: 'error',
            message: res.__('You cannot add an asset twice.')
          }
        )
      } else {
        logger.error({
          message: 'SETTINGS (new asset) could not add new asset',
          endpoint: req.method + ': ' + req.originalUrl,
          programMsg: err
        })
      }
    }
    req.session.assets[req.body.pair] = {
      id: result.insertId,
      category: req.body.category,
      rate: 0
    }
    return res.json({ response: 'success' })
  })
}

module.exports.deleteAsset = (req, res) => {
  db.query('DELETE FROM pairs WHERE pair = ? AND user_id = ?', [req.body.asset, req.user.id], (err) => {
    if (err) {
      logger.error({
        message: 'SETTINGS (delete asset) could not delete asset',
        endpoint: req.method + ': ' + req.originalUrl,
        programMsg: err
      })
    }
    delete req.session.assets[req.body.asset]
    res.end()
  })
}

module.exports.addTimeframe = (req, res) => {
  var newTimeframe = {
    timeframe: req.body.timeframe,
    user_id: req.user.id
  }
  db.query('INSERT INTO timeframes SET ?', newTimeframe, (err, result) => {
    if (err) {
      logger.error({
        message: 'SETTINGS (new timeframe) could not add new timeframe',
        endpoint: req.method + ': ' + req.originalUrl,
        programMsg: err
      })
      return res.json({ response: 'fail' })
    } else {
      req.session.timeframes = {[req.body.timeframe]: { id: result.insertId }, ...req.session.timeframes}
      return res.json(
        {
          response: 'success',
          timeframe: req.body.timeframe,
          timeframeID: result.insertId
        }
      )
    }
  })
}

module.exports.changeLanguage = (req, res) => {
  var updateLanguage = 'UPDATE users SET language = ? WHERE id = ?'
  db.query(updateLanguage, [req.body.lang, req.user.id], (err) => {
    if (err) {
      logger.error({
        message: 'SETTINGS (language) could not change language',
        endpoint: req.method + ': ' + req.originalUrl,
        programMsg: err
      })
      req.flash('error', res.__('Something went wrong. Please, try again later.'))
      return res.redirect('/' + req.user.username);
    }
    res.cookie('lang', req.body.lang)
    res.end();
  })
}

module.exports.uploadProfileImage = (req, res) => {
  if (req.file === undefined) {
    req.flash('error', res.__('Please, ensure the image is a one of the followings: PNG, JPG or JPEG'))
    return res.redirect('/' + req.user.username + '/settings')
  }
  var fileName = req.file.originalname.split('.')
  var fileType = fileName[fileName.length - 1]
  var params = {
    Bucket: process.env.S3_BUCKET,
    Key: `${req.user.id}/profile/${uuid()}.${fileType}`,
    Body: req.file.buffer
  }
  s3.upload(params, (err, data) => {
    if (err) {
      logger.error({
        message: 'SETTINGS (profile picture) could not upload to s3',
        endpoint: req.method + ': ' + req.originalUrl,
        programMsg: err
      })
      req.flash('error', res.__('Something went wrong. Please, try again later.'))
      return res.redirect('/' + req.user.username);
    }
    var updateProfilePicture = 'UPDATE users SET profile_picture = ? WHERE id = ?'
    db.query(updateProfilePicture, [data.Location, req.user.id], (err) => {
      if (err) {
        logger.error({
          message: 'SETTINGS (profile picture) could not set profile picture',
          endpoint: req.method + ': ' + req.originalUrl,
          programMsg: err
        })
      }
      return res.redirect('/' + req.user.username + '/settings')
    })
  })
}

module.exports.renderChangePlan = (req, res) => {
  res.render('user/change', {username: req.user.username})
}

module.exports.cancelSubscription = async (req, res) => {
  // delete the subscription
  const deletedSubscription = await stripe.subscriptions.del(
    req.user.stripeSubscriptionId
  );
  var cancelSubscription = await query('UPDATE users SET expiration = NULL, role_id = 1, stripeSubscriptionId = NULL WHERE id = ?;', req.user.id);
  res.send(deletedSubscription);
}

module.exports.renderUpdatePayment = (req, res) => {
  res.render('checkout',
    {
      customerId: req.user.stripeCustomerId,
      priceId: 'price_1HTUBMFaIcvTY5RCKZixDYVk'
    }
  )
}
