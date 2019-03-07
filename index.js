const express = require("express");
const http = require("http");
const passport = require("passport");
const session = require("express-session");
const ejs = require("ejs");
const app = express();

const mailer = require("./email");

const db = require("./db");
const bodyParser = require("body-parser");
// Creating the parser for data application/x-www-form-urlencoded
const urlencodedParser = bodyParser.urlencoded({ extended: false });
app.use(express.static(__dirname + "/public"));
app.set("view engine", "ejs");

var server = app.listen(3000);
var io = require("socket.io").listen(server);

var ipServer = require("ip").address(); // Current server IP address in local network
var repairers = new Set();

app.get("/", function(req, res) {
  db.query("SELECT * FROM deviceviews", (err, rows) => {
    res.render("index", { views: rows });
  });
});
app.post("/createOrder", urlencodedParser, function(req, res) {
  db.query(
    "INSERT INTO Orders (clientName, email, idView, idRepairer, idStatus, clientNumber, orderStartDate, clientMessage) " +
      "VALUES (?, ?, ?, NULL, 1, ?, CURDATE(), ?) ",
    [
      req.body.clientName,
      req.body.clientEmail,
      req.body.device_view,
      req.body.clientNumber,
      req.body.clientMessage
    ],
    (err, rows) => {
      console.log("The order was added");
      db.query(
        "SELECT nameView FROM deviceviews WHERE idView = ?",
        [req.body.device_view],
        (err, views) => {
          var idOrder = 0;
          db.query("SELECT MAX(idOrder) as lid FROM Orders", (err, data) => {
            repairers.forEach(repairer => {
              repairer.emit("newOrder", {
                idOrder: data[0].lid,
                clientName: req.body.clientName,
                clientEmail: req.body.clientEmail,
                view: views[0].nameView,
                clientNumber: req.body.clientNumber,
                clientMessage: req.body.clientMessage
              });
            });
            res.sendFile(__dirname + "/public/successSendOrder.html");
          });
        }
      );
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
          db.query(
            "SELECT * FROM statusOrder ORDER BY idStatus",
            (err, statuses) => {
              io.sockets.on("connection", socket => {
                repairers.add(socket);
                io.sockets.on("disconnect", () => {
                  repairers.delete(socket);
                });
              });
              res.render("orders", {
                orders: orders,
                unoccupied: news,
                statuses: statuses,
                idRepairer: req.query.idRepairer,
                ipServer: ipServer
              });
            }
          );
        }
      );
    }
  );
});

app.post("/changeStatus", urlencodedParser, function(req, res) {
  var change_request =
    "UPDATE Orders SET idStatus = ?, idRepairer = " +
    req.body.idRepairer +
    " WHERE idOrder = ?";
  if (req.body.orderStatus == 1) {
    change_request =
      "UPDATE Orders SET idStatus = ?, idRepairer = NULL WHERE idOrder = ?";
  }
  db.query(
    change_request,
    [req.body.orderStatus, req.body.idOrder],
    (err, rows) => {
      console.log("Status #" + req.body.idOrder + " was successfully changed!");

      db.query(
        "SELECT * FROM Orders o INNER JOIN StatusOrder sO ON o.idStatus = sO.idStatus WHERE idOrder = ?",
        [req.body.idOrder],
        (err, orders) => {
          db.query(
            "SELECT * FROM Repairers WHERE idRepairer = ?",
            [req.body.idRepairer],
            (err, reps) => {
              console.log('Name status: ' + orders[0].nameStatus);
              ejs.renderFile(
                __dirname + "/templates/orders/" + orders[0].nameStatus + ".ejs",
                { order: orders[0], repairer: reps[0], ipServer: ipServer },
                (err, template) => {
                  if (err) {
                    throw err;
                  }
                  var mailOptions = {
                    from: process.env.MAIL_USER,
                    to: orders[0].email,
                    subject: "Изменение статуса заказа",
                    html: template
                  };
                  mailer.sendMail(mailOptions, (err, info) => {
                    if (err) {
                      throw err;
                    }
                    res.json({ answer: "OK" });
                  });
                  
                }
              );
            }
          );
        }
      );
    }
  );
});

app.get("/tt", (req, res) => {
  var mailOptions = {
    from: process.env.MAIL_USER,
    to: "dentalon599@gmail.com",
    subject: "Sending Email using Node.js",
    text: "That was easy!",
    html: "<b>Hello World!</b>"
  };
  mailer.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.log(err);
      return;
    }
    console.log("The letter was sent");
    res.send({ text: "Check your email address :)" });
  });
});

app.get(function(req, res) {
  res.sendFile(__dirname + "/public/404.html");
});

app.get("/mail-test", (req, res) => {
  ejs.renderFile(
    __dirname + "/templates/orders/changeOrderStatus.ejs",
    { idOrder: 12345 },
    (err, template) => {
      var mailOptions = {
        from: process.env.MAIL_USER,
        to: "dentalon599@gmail.com",
        subject: "Изменение статуса заказа",
        html: template
      };
      mailer.sendMail(mailOptions, (err, info) => {
        if (err) {
          throw err;
        }
        res.send("Status: " + info);
      });
    }
  );
});
