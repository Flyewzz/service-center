const express = require("express");
const http = require("http");
// const ejs = require("ejs");
const app = express();

const nunjucks = require("nunjucks");
const mailer = require("./email");

const notification = require('./notification');
const db = require("./db");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
// Creating the parser for data application/x-www-form-urlencoded
const urlencodedParser = bodyParser.urlencoded({ extended: false });
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());
app.use(cookieParser());

const auth = require("./authentication");

nunjucks.configure("./views", {
  autoescape: true,
  express: app
});

var server = app.listen(8080);
var io = require("socket.io").listen(server);

var ipServer = require("ip").address(); // Current server IP address in local network

console.log("Current IP: " + ipServer);
app.get("/", function(req, res) {
  db.query("SELECT * FROM deviceviews", (err, rows) => {
    db.query("SELECT * FROM Cities", (err, cities) => {
      auth.isAuthenticated(req, user => {
        res.status(200).render("index.html", { 
          views: rows, 
          cities: cities,
          user: user });
      });
    });
  });
});
app.post("/orders", urlencodedParser, function(req, res) {
  db.query(
    "INSERT INTO Orders (clientName, email, idView, idRepairer, " +
    "idStatus, clientNumber, orderStartDate, idCity, clientMessage) " +
      "VALUES (?, ?, ?, NULL, 1, ?, CURDATE(), ?, ?) ",
    [
      req.body.clientName,
      req.body.clientEmail,
      req.body.device_view,
      req.body.clientNumber,
      req.body.city,
      req.body.clientMessage
    ],
    (err, rows) => {
      console.log("The order was added");
      db.query(
        "SELECT nameView FROM deviceviews WHERE idView = ? LIMIT 1",
        [req.body.device_view],
        (err, views) => {
          var idOrder = 0;
          db.query("SELECT MAX(idOrder) as lid FROM Orders LIMIT 1", (err, data) => {
            io.sockets.in("repairers_" + req.body.city).emit("newOrder", {
              idOrder: data[0].lid,
              clientName: req.body.clientName,
              clientEmail: req.body.clientEmail,
              
              view: views[0].nameView,
              clientNumber: req.body.clientNumber,
              clientMessage: req.body.clientMessage
            });
          });
          res.status(200).sendFile(__dirname + "/public/successSendOrder.html");
        }
      );
    }
  );
});

app.get("/orders", function(req, res) {
  auth.isAuthenticated(req, repairer => {
    if (!repairer) {
      res.cookie("last_page", req.url);
      return res.status(401).render("login.html");
    }
    db.query(
      "SELECT * FROM service.Orders o " +
        "INNER JOIN Repairers R ON o.idRepairer = R.idRepairer " +
        "AND R.idRepairer = ? INNER JOIN StatusOrder sO ON o.idStatus = sO.idStatus " +
        "INNER JOIN deviceviews dv ON o.idView = dv.idView ORDER BY o.idStatus, o.clientName ",
      [repairer.idRepairer],
      (err, orders) => {
        db.query(
          "SELECT * FROM service.Orders o INNER JOIN statusOrder sO ON o.idStatus = sO.idStatus " +
            "INNER JOIN deviceviews dv ON o.idView = dv.idView WHERE o.idRepairer IS NULL " +
            "AND o.idCity = ? ORDER BY o.orderStartDate DESC", [repairer.idCity],
          (err, news) => {
            db.query(
              "SELECT * FROM statusOrder ORDER BY idStatus",
              (err, statuses) => {
                io.sockets.on("connection", socket => {
                  socket.join("repairers_" + repairer.idCity);
                  socket.on("disconnect", () => {
                    console.log(socket.id + " disconnected");
                  });
                });
                res.status(200).render("orders.html", {
                  orders: orders,
                  unoccupied: news,
                  statuses: statuses,
                  idRepairer: req.query.idRepairer,
                  ipServer: process.env.IP_SERVER,
                  user: repairer
                });
              }
            );
          }
        );
      }
    );
  });
});

app.put("/status", urlencodedParser, function(req, res) {
  var idRepairer;
  var price;
  var guarantee;
  var orderEndDate = "";
  if (req.body.orderStatus == 1) {
    idRepairer = null;
  } else {
    idRepairer = req.body.idRepairer;
  }
  price = req.body.price;
  guarantee = req.body.guarantee;
  if (req.body.orderStatus == 3) {
    orderEndDate = ", orderEndDate = CURDATE()";
  }
  db.query(
    "UPDATE Orders SET idStatus = ?, idRepairer = ?" +
      orderEndDate +
      " WHERE idOrder = ?",
    [req.body.orderStatus, idRepairer, req.body.idOrder],
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
              console.log("Name status: " + orders[0].nameStatus);
              nunjucks.render(
                "templates/orders/" + orders[0].nameStatus + ".html",
                { order: orders[0], repairer: reps[0], ipServer: ipServer },
                (err, template) => {
                  if (err) {
                    console.log(err);
                    res.sendStatus(500);
                    return;
                  }
                  var mailOptions = {
                    from: process.env.MAIL_USER,
                    to: orders[0].email,
                    subject: "Изменение статуса заказа",
                    html: template
                  };
                  mailer.sendMail(mailOptions, (err, info) => {
                    if (err) {
                      console.log(err);
                      res.sendStatus(500);
                      return;
                    }
                    res.status(200).json({ answer: "OK" });
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

app.get("/login", (req, res) => {
  auth.isAuthenticated(req, user => {
    if (!user) {
      return res.status(200).render("login.html");
    }
    const last_page = req.cookies["last_page"];
    console.log("last_page", last_page);
    if (last_page) {
      res.clearCookie("last_page");
      return res.redirect(last_page);
    }
    res.redirect("/");
  });
});

app.post("/login", urlencodedParser, (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  auth.authenticate(email, password, ok => {
    console.log(ok);
    if (!ok) {
      return res.status(401).render("login.html");
    }
    auth.login(email, res, user => {
      console.log("user", user);
      if (!user) {
        // ?
        console.log("500 error");
        return res.status(500).render("login.html");
      }
      // res.render("successLogin.html", { repairer: user });
      const last_page = req.cookies["last_page"];
      res.clearCookie("last_page");
      res.redirect(last_page || "/orders");
    });
  });
});

app.get("/logout", (req, res) => {
  auth.logout(res);
});

app.get("/test", (req, res) => {
  res.sendStatus(200);
});

app.get('/azino777', (req, res) => {
  notification.send(message, function(err, response){
    if (err) {
        console.log("Something has gone wrong!");
    } else {
        console.log("Successfully sent with response: ", response);
    }
});
});
module.exports = app;
