const mysql = require('mysql');
const dotenv = require('dotenv').config();

var connection = mysql.createConnection({
    host: process.env.HOST_NAME,
    user: process.env.USER_NAME,
    password: process.env.SERVICE_PASS,
    database: process.env.DATABASE_NAME,
  });

connection.connect(function(err) {
    if (err) throw err;
});

module.exports = connection;