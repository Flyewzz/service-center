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

app.get("/orders", function(req, res) {
  db.query(
    "SELECT * FROM service.Orders o INNER JOIN Repairers R on o.idRepairer = R.idRepairer " +
      "AND R.idRepairer = ? INNER JOIN StatusOrder sO ON o.idStatus = sO.idStatus " +
      "INNER JOIN deviceviews dv ON o.idView = dv.idView ORDER BY o.idStatus, o.clientName",
    [req.query.idRepairer],
    (err, orders) => {
      db.query(
        "SELECT * FROM service.Orders o INNER JOIN statusOrder sO ON o.idStatus = sO.idStatus " +
        "INNER JOIN deviceviews dv ON o.idView = dv.idView WHERE o.idRepairer IS NULL ORDER BY o.orderStartDate DESC",
        (err, news) => {
      db.query("SELECT * FROM statusOrder ORDER BY idStatus", (err, statuses) => {
        res.render("orders", { 
          orders: orders,
          unoccupied: news,
          statuses: statuses,
          idRepairer: req.query.idRepairer,
         });
      });
    });
    });
});

app.post("/changeStatus", urlencodedParser, function(req, res) {
  var change_request = "UPDATE Orders SET idStatus = ?, idRepairer = " + req.body.idRepairer + " WHERE idOrder = ?";
  if (req.body.orderStatus == 1) {
    change_request = "UPDATE Orders SET idStatus = ?, idRepairer = NULL WHERE idOrder = ?"
  }
  db.query(
    change_request,
    [
      req.body.orderStatus,
      req.body.idOrder,
    ],
    (err, rows) => {
      if (err) {
        console.log("Error " + err);
        throw err;
      }
      console.log('Status #' + req.body.idOrder + ' was successfully changed!');
      res.json({answer: 'OK',})
    }
  );
});

app.get(function(req, res) {
  res.sendFile(__dirname + "/public/404.html");
});
app.listen(3000);
