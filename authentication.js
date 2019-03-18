const bcrypt = require('bcrypt');
const jwt = require('jwt-simple');
const cookieParser = require('cookie-parser');
const db = require('./db');
const dotenv = require('dotenv').config();

module.exports = {

    isAuthenticated: function(req, callback) {
        
        if (!req.cookies['access_token']) {
            callback(null);
            return;
        }
        const token = req.cookies['access_token'];
        try {
            const data = jwt.decode(token, process.env.SECRET_KEY);
            console.log('data', data.nameRepairer, data.emailRepairer);
            db.query("SELECT idRepairer, nameRepairer, emailRepairer FROM Repairers WHERE emailRepairer = ? and nameRepairer = ?", 
            [data.emailRepairer, data.nameRepairer], (err, repairers) => {
                if (repairers[0]) {
                    callback(repairers[0]);
                    return;
                }
                callback(null);
            });
        }
        catch(err) {
            callback(null);
        }
    },
    authenticate: function(email, password, callback) {
        db.query("SELECT password FROM Repairers WHERE emailRepairer = ?", [email], (err, users) => {
            if (err) {
                console.log('500 error');
                callback(false);
                return;
            }
            if (!users[0]) {
                console.log('404 error');
                callback(false);
                return;
            }
            bcrypt.compare(password, users[0].password, (err, valid) => {
                console.log('valid', valid);
                if (valid) {
                    callback(true);
                    return;
                }
                callback(false);
            });
        });
    },

    login: function(email, res, callback) {
        db.query("SELECT nameRepairer, emailRepairer, number, salary " +
        "FROM Repairers WHERE emailRepairer = ?", [email], (err, users) => {
            if (err) {
                console.log('500 error');
                callback(null);
            }
            const token = jwt.encode(users[0], process.env.SECRET_KEY); // Sign token
            res.cookie('access_token', token, {
                expires: new Date(Date.now() +  5 * 60000), // 5 min expire time
              });
              callback(users[0]);
        });
    },

    logout: function(res) {
        res.clearCookie('access_token');
        res.redirect('/');
    }
}

