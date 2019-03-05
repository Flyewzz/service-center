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
const db = require("./db");
const bodyParser = require("body-parser");

// Creating the parser for data application/x-www-form-urlencoded
const urlencodedParser = bodyParser.urlencoded({ extended: false });
app.use(express.static(__dirname + "/public"));
app.set("view engine", "ejs");

app.get("/", function(req, res) {
  // res.sendFile(__dirname + "/public/index.html");
  db.query("SELECT * FROM deviceviews", (err, rows) => {
    res.render("index", { views: rows });
  });
});

app.post("/createOrder", urlencodedParser, function(req, res) {
  db.query(
    "INSERT INTO Orders (idOrder, clientName, email, idView, idRepairer, idStatus, clientNumber, orderStartDate, clientMessage) " +
      "VALUES (LAST_INSERT_ID(), ?, ?, ?, NULL, 1, ?, CURDATE(), ?) ",
    [
      req.body.clientName,
      req.body.clientEmail,
      req.body.device_view,
      req.body.clientNumber,
      req.body.clientMessage,
    ],
    (err, rows) => {
      if (err) {
        console.log("Error " + err);
        throw err;
      }
      console.log("The order was added");
      console.log(rows);
      res.sendFile(__dirname + "/public/successSendOrder.html");
    }
  );
});

app.get("/repairers", function(req, res) {
  db.query(
    "SELECT * FROM service.Orders o INNER JOIN Repairers R on o.idRepairer = R.idRepairer " +
      "AND R.idRepairer = ? INNER JOIN StatusOrder sO ON o.idStatus = sO.idStatus " +
      "INNER JOIN deviceviews dv ON o.idView = dv.idView ORDER BY o.idStatus",
    [req.query.idRepairer],
    (err, orders) => {
      if (err) {
        console.log("Error " + err);
        throw err;
      }

      db.query("SELECT * FROM statusOrder ORDER BY idStatus", (err, statuses) => {
        if (err) {
          console.log("Error " + err);
          throw err;
        }
        res.render("orders", { 
          orders: orders, 
          statuses: statuses,
         });
      });
      
    }
  );
});

app.get(function(req, res) {
  res.sendFile(__dirname + "/public/404.html");
});
app.listen(3000);
