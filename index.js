const express = require("express");
const http = require("http");
const ejs = require("ejs");
const app = express();

const nunjucks = require("nunjucks");
const mailer = require("./email");

const db = require("./db");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
// Creating the parser for data application/x-www-form-urlencoded
const urlencodedParser = bodyParser.urlencoded({ extended: false });
app.use(express.static(__dirname + "/public"));
app.use(cookieParser());

const auth = require("./authentication");

nunjucks.configure("./views", {
  autoescape: true,
  express: app
});

// app.set("view engine", "ejs");

var server = app.listen(8080);
var io = require("socket.io").listen(server);

var ipServer = require("ip").address(); // Current server IP address in local network

console.log("Current IP: " + ipServer);
app.get("/", function(req, res) {
  db.query("SELECT * FROM deviceviews", (err, rows) => {
    auth.isAuthenticated(req, user => {
      res.render("index.html", { views: rows, user: user });
    });
  });
});
app.post("/orders", urlencodedParser, function(req, res) {
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
            io.sockets.in("repairers").emit("newOrder", {
              idOrder: data[0].lid,
              clientName: req.body.clientName,
              clientEmail: req.body.clientEmail,
              view: views[0].nameView,
              clientNumber: req.body.clientNumber,
              clientMessage: req.body.clientMessage
            });
          });
          res.sendFile(__dirname + "/public/successSendOrder.html");
        }
      );
    }
  );
});

app.get("/orders", function(req, res) {
  auth.isAuthenticated(req, repairer => {
    if (!repairer) {
      res.cookie("last_page", req.url);
      return res.redirect("/login");
    }
    db.query(
      "SELECT * FROM service.Orders o " +
        "INNER JOIN Repairers R on o.idRepairer = R.idRepairer " +
        "AND R.idRepairer = ? INNER JOIN StatusOrder sO ON o.idStatus = sO.idStatus " +
        "INNER JOIN deviceviews dv ON o.idView = dv.idView ORDER BY o.idStatus, o.clientName",
      [repairer.idRepairer],
      (err, orders) => {
        db.query(
          "SELECT * FROM service.Orders o INNER JOIN statusOrder sO ON o.idStatus = sO.idStatus " +
            "INNER JOIN deviceviews dv ON o.idView = dv.idView WHERE o.idRepairer IS NULL ORDER BY o.orderStartDate DESC",
          (err, news) => {
            db.query(
              "SELECT * FROM statusOrder ORDER BY idStatus",
              (err, statuses) => {
                io.sockets.on("connection", socket => {
                  socket.join("repairers");
                  socket.on("disconnect", () => {
                    console.log(socket.id + " disconnected");
                  });
                });
                res.render("orders.html", {
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
  // Уязвимость (!!!)
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
              console.log("Name status: " + orders[0].nameStatus);
              nunjucks.render(
                  "templates/orders/" +
                  orders[0].nameStatus +
                  ".html",
                { order: orders[0], repairer: reps[0], ipServer: ipServer },
                (err, template) => {
                  if (err) {
                    console.log(err);
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
                      return;
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

app.get("/login", (req, res) => {
  auth.isAuthenticated(req, user => {
    if (!user) {
      res.render("login.html");
      return;
    }
    const last_page = req.cookies["last_page"];
    console.log('last_page', last_page);
    if (last_page) {
      res.clearCookie("last_page");
      res.redirect(last_page);
      return;
    }
    res.redirect("/");
  });
});

app.post("/login", urlencodedParser, (req, res) => {
  const email = req.body.clientEmail;
  const password = req.body.clientPassword;
  auth.authenticate(email, password, ok => {
    console.log(ok);
    if (!ok) {
      
      return res.redirect("/login");
    }
    auth.login(email, res, user => {
      console.log("user", user);
      if (!user) {
        console.log("500 error");
        res.redirect("/login");
        return;
      }
      // res.render("successLogin.html", { repairer: user });
      const last_page = req.cookies["last_page"];
      res.clearCookie("last_page");
      res.redirect(last_page || '/orders');
    });
  });
});

app.get("/logout", (req, res) => {
  auth.logout(res);
});
