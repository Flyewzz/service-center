const express = require("express");
const passport = require("passport");
const session = require("express-session");
const mailer = require("express-mailer");

// const RedisStore = require('connect-redis')(session)

const app = express();
// app.use(session({
//     store: new RedisStore({
//         url: config.redisStore.url
//     }),
//     secret: config.redisStore.secret,
//     resave: false,
//     saveUninitialized: false
// }))
// app.use(passport.initialize())
// app.use(passport.session())
const mysql = require("mysql");
const bodyParser = require("body-parser");

// Creating the parser for data application/x-www-form-urlencoded
const urlencodedParser = bodyParser.urlencoded({ extended: false });

app.use(express.static(__dirname + "/public"));
app.set("view engine", "ejs");
app.get("/", function(req, res) {
  res.sendFile(__dirname + "/public/index.html");
});

app.post("/createOrder", urlencodedParser, function(req, res) {});

app.get("/repairers", function(req, res) {
  const connection = mysql.createConnection({
    host: "127.0.0.1",
    user: "service",
    password: "135",
    database: "service"
  });
  connection.query(
    "SELECT * FROM service.Orders o INNER JOIN Repairers R on o.idRepairer = R.idRepairer " +
      "AND R.idRepairer = ? INNER JOIN StatusOrder sO ON o.idStatus = sO.idStatus " +
      "INNER JOIN deviceviews dv ON o.idView = dv.idView ORDER BY o.idStatus",
    [req.query.idRepairer],
    (err, rows) => {
      if (err) {
        console.log("Error " + err);
        throw err;
      }
      res.render("orders", { orders: rows });
    }
  );
});

app.get(function(req, res) {
  res.sendFile(__dirname + "/public/404.html");
});
app.listen(3000);