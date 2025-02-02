// load necessary requirements and connenctions
const LocalStrategy = require('passport-local').Strategy;
const bcrypt        = require('bcrypt');
const currencies    = require(__dirname + '/currencies.js')
const saltRounds     = 10;

// dependencies
let db = require('./dbConfig')
let logger = require('./winstonConfig')

// Start AUTHENTICATION
module.exports = function(passport) {

  // Passport Session Setup
  // Serialize the user for the session
  passport.serializeUser(function(user, done) {
    done(null, user.id);
  });

  // Deserialize the user for the session
  passport.deserializeUser(function(id, done) {
    db.query('SELECT * FROM users_deserialize WHERE id = ?', id, (err, rows) => {
      if (err)  {
        logger.error({
          message: 'PASSPORT CONFIG could not connect deserialize user',
          endpoint: 'N/A',
          programMsg: err
        })
        throw err
      }
      done(err, rows[0]);
    });
  });

  // Local SIGNUP
  passport.use('local-signup', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true // allows us to pass back the entire request to the callback
  },
  function(req, email, password, done) {
    db.query('SELECT * FROM users WHERE email = ?', email, function(err, rows) {
      if (err) return done(err);
      if (rows.length > 0) {
        return done(null, false, req.flash("error", "An account with this email already exists."));
      } else {
        if (req.body.password != req.body.confirmPassword) {
          return done(null, false, req.flash("error", "Passwords don't match."));
        }
        // create user if no user with that email exists
        var newUserMysql = new Object();
        newUserMysql.username = req.body.username;
        newUserMysql.email = email;
        newUserMysql.name = req.body.name;
        newUserMysql.surname = req.body.surname;
        newUserMysql.role_id = 1;
        // sets account's base currency and initial balance
        var currencyId = currencies.indexOf(req.body.base);
        if (currencyId < 0) {
          return done(null, false, req.flash("error", "The selected base currency is not valid."));
        } else {
          newUserMysql.currency_id = currencyId + 1;
        }
        if (req.body.balance > 0) {
          newUserMysql.balance = req.body.balance;
        } else {
          return done(null, false, req.flash("error", "Your account must be worth something."));
        }
        // Hash password
        var hashingPassword = new Promise (function(resolve, reject) {
          setTimeout(function() {
            bcrypt.hash(password, saltRounds, function(err, hash) {
              resolve(hash);
            });
          }, 2000);
        });
        hashingPassword.then(function(hash) {
          newUserMysql.password = hash;
          db.query("INSERT INTO users SET ?", newUserMysql, (err, rows) => {
            if (err) return done(null, false, req.flash("error", "Something went wrong, please try again."));
            newUserMysql.id = rows.insertId;
            var userId = rows.insertId;
            newUserMysql.password = null;
            let noneStrategy = {
              strategy: 'None',
              user_id: userId
            }
            let defaultAsset = {
              pair: 'US500',
              category: 'Index',
              has_rate: 0,
              user_id: userId,
              is_custom: 1
            }
            db.query("INSERT INTO strategies SET ?", noneStrategy, (err, result) => {
              if (err) return done(null, false, req.flash("error", "Something went wrong, please try again."));
              db.query("INSERT INTO pairs SET ?", defaultAsset, (err, result) => {
                if (err) return done(null, false, req.flash("error", "Something went wrong, please try again."));
              })
            })
            return done(null, newUserMysql)
          });
        }).catch(function(data) {
          // failed to hash
        })
      }
    });
  }));
  // Local LOGIN
  passport.use('local-login', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true // allows us to pass back the entire request to the callback
  },
  function(req, email, password, done) {
    db.query("SELECT * FROM users WHERE email = ?", email, (err, rows) => {
      if (err) return done(err);
      if (!rows.length) {
      // User not found
        return done (null,false, req.flash("error", "User not found."));
      }
      bcrypt.compare(password, rows[0].password, function(err, result) {
        // User found but wrong password
        if (!result) {
          return done(null, false, req.flash("error", "Oops! Wrong password."))
        }
        // Successful login
        else {
          rows[0].password = null;
          return done(null, rows[0]);
        }
      });
    });
  }));
};
