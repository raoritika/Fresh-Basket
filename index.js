//import modules
const express = require("express");
const path = require("path");
const ejs = require("ejs");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const session = require("express-session");

const app = express();
const port = 9000;

// Express.js application setup with middleware for JSON parsing,
// serving static files, URL-encoded request bodies, and EJS as the view engine.
app.use(bodyParser.json());
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "static")));
// app.use('/', require(path.join(__dirname, 'routes/allRoutes'))).

// Set up the session middleware
app.use(
  session({
    secret: "secret",
    resave: true,
    saveUninitialized: true,
  })
);

//create connection
const conn = mysql.createConnection({
  host: "localhost",
  user: "root" /* MySQL User */,
  password: "" /* MySQL Password */,
  database: "freshBasket" /* MySQL Database */,
});

conn.connect((err) => {
  if (err) throw err;
  console.log("Mysql is now connected with my website");
});

function generateUniqueId(username) {
  const timestamp = new Date().getTime();
  const randomString = Math.random().toString(36).substring(2, 15);
  const uniqueId = `${username}${timestamp}${randomString}`;
  return uniqueId;
}
// const generateUniqueId = require('generate-unique-id');

app.get("/", (req, res) => {
  res.render("home"); //open this
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.post("/signup", (req, res) => {
  const { name, email, username, password, usertype } = req.body;

  const sql = `INSERT INTO users (name,username, email, password, usertype) VALUES ( ?, ?, ?, ?,?)`;
  const values = [name, username, email, password, usertype];
  console.log(usertype);
  conn.query(sql, values, (err, result) => {
    if (err) throw err;
    console.log(result);
    //   res.send('User created successfully');
    res.render("login");
  });
});

app.get("/login", (req, res) => {
  res.render("login");
});

//user authorization set up
app.post("/auth", (req, res) => {
  let username = req.body.username;
  let password = req.body.password;
  let usertype = req.body.usertype;

  if (username && password) {
    conn.query(
      "SELECT * FROM users WHERE username = ? AND password = ? AND usertype = ?",
      [username, password, usertype],
      function (error, results) {
        if (error) throw error;
        if (results.length > 0) {
          req.session.loggedin = true;
          req.session.username = username;
          req.session.usertype = usertype;
          // 1 => admin and 0 => users
          if (req.session.loggedin) {
            if (req.session.usertype == 1) {
              res.redirect("dashboard"); //adds in url
            } else {
              res.redirect("products");
            }
          }
        } else {
          res.send("Incorrect Username and/or Password!");
        }
        res.end();
      }
    );
  } else {
    res.send("Please enter Username and Password!");
    res.end();
  }
});

app.get("/products", (req, res) => {
  let sqlQuery =
    "SELECT categories.category,products.id,products.prodname,products.description,products.price,products.saleprice FROM `categories` INNER JOIN products ON products.category = categories.id";
  let query = conn.query(sqlQuery, (err, results) => {
    if (err) throw err;
    else {
      res.render("shop/products", { results });
    }
  });
});

app.get("/dashboard", (req, res) => {
  console.log(req.session.loggedin);
  if (req.session.loggedin) {
    res.render("admin/dashboard");
  } else {
    res.render("error");
  }
});

app.get("/addproducts", function (req, res) {
  let sqlQuery = "SELECT * FROM categories";
  let query = conn.query(sqlQuery, (err, results) => {
    if (err) throw err;
    res.render("admin/addProduct", { results });
  });
});

app.post("/addproducts", function (req, res) {
  let data = {
    prodname: req.body.prodname,
    description: req.body.description,
    price: req.body.price,
    saleprice: req.body.saleprice,
    category: req.body.category,
  };
  // image path : not configed

  let sqlQuery = "INSERT INTO products SET ?";
  let query = conn.query(sqlQuery, data, (err, results) => {
    if (err) throw err;
    else {
      res.redirect("/products");
    }
  });
});

app.get("/buy/:id", (req, res) => {
  if (req.session.loggedin) {
    let Myid = req.params.id;
    console.log(Myid);
    let sqlQuery = "SELECT * FROM products WHERE id = ?";

    let query = conn.query(sqlQuery, [Myid], (err, results) => {
      if (err) throw err;
      console.log("/buy/:id");
      console.log(results);

      res.render("shop/buy", { results });
    });
  } else {
    res.render("error");
  }
});

app.get("/checkout"),
  (req, res) => {
    if (req.session.loggedin) {
      res.render("/shop/checkout");
    } else {
      res.render("/error");
    }
  };

app.post("/checkout", (req, res) => {
  if (req.session.loggedin) {
    const uniqueId = generateUniqueId(req.session.username);
    let data = {
      p_id: req.body.p_id,
      buyer: req.session.username,
      o_id: uniqueId,
      address: req.body.address,
      tracking: 0,
      tracking_id: "Not Available",
      quantity: req.body.quantity,
      mode: req.body.paymentype,
    };

    console.log("/checkout");
    console.log(data);

    let sqlQuery = "INSERT INTO orders SET ?";
    let query = conn.query(sqlQuery, data, (err, results) => {
      if (err) throw err;
      else {
        res.render("shop/ordered");
      }
    });
  } else {
    res.render("/error");
  }
});

app.get("/view_order", function (req, res) {
  if (req.session.loggedin) {
    let sqlQuery =
      "SELECT orders.id,orders.p_id,orders.buyer,orders.o_id,orders.address,orders.tracking ,orders.tracking_id,products.prodname,orders.mode FROM orders INNER JOIN products ON products.id = orders.p_id WHERE orders.buyer='" +
      req.session.username +
      "'";

    let query = conn.query(sqlQuery, (err, results) => {
      if (err) throw err;
      res.render("shop/view_order_user", { results });
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/view_order_admin", function (req, res) {
  if (req.session.loggedin && req.session.usertype) {
    let sqlQuery =
      "SELECT orders.id,orders.p_id,orders.buyer,orders.o_id,orders.address,orders.tracking ,orders.tracking_id,products.prodname, orders.mode FROM orders JOIN products ON products.id = orders.p_id";

    let query = conn.query(sqlQuery, (err, results) => {
      if (err) throw err;
      res.render("admin/view_order_admin", { results });
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/changestaAccept/:id", function (req, res) {
  var id = req.params.id;
  let sqlQuery = "UPDATE orders SET tracking=1 WHERE id=" + id;

  let query = conn.query(sqlQuery, (err, results) => {
    if (err) throw err;
    res.redirect("/view_order_admin");
  });
});

app.get("/changestaDecline/:id", function (req, res) {
  var id = req.params.id;
  let sqlQuery = "UPDATE orders SET tracking=4 WHERE id=" + id;

  let query = conn.query(sqlQuery, (err, results) => {
    if (err) throw err;
    res.redirect("/view_order_admin");
  });
});

app.get("/changestaDelivered/:id", function (req, res) {
  var id = req.params.id;
  let sqlQuery = "UPDATE orders SET tracking=3 WHERE id=" + id;

  let query = conn.query(sqlQuery, (err, results) => {
    if (err) throw err;
    res.redirect("/view_order_admin");
  });
});

app.post("/addTrack_id", function (req, res) {
  var id = req.body.oid;
  let sqlQuery =
    "UPDATE orders SET tracking=2,tracking_id='" +
    req.body.tid +
    "' WHERE id=" +
    id;

  let query = conn.query(sqlQuery, (err, results) => {
    if (err) throw err;
    res.redirect("/view_order_admin");
  });
});

app.get("/addtocart/:id", (req, res) => {
  if (req.session.loggedin) {
    var pid = req.params.id;
    let data = { p_id: pid, username: req.session.username, quantity: 1 };
    let sqlQuery = "INSERT INTO cart SET ?";
    let query = conn.query(sqlQuery, data, (err, results) => {
      if (err) throw err;
      else {
        console.log("/addtocart");
        console.log(results);
        // res.redirect("/login");
        // res.render("addtocart", results);
        res.redirect("/viewcart");
      }
    });
  } else {
    // res.send({ message: "Please login" });
    res.redirect("/login");
  }
});

app.get("/viewcart", (req, res) => {
  if (req.session.loggedin) {
    let sqlQuery =
      "SELECT cart.quantity, cart.id,cart.p_id,cart.username,products.prodname ,products.saleprice FROM cart INNER JOIN products ON products.id = cart.p_id WHERE cart.username='" +
      req.session.username +
      "'";

    let query = conn.query(sqlQuery, (err, results) => {
      if (err) throw err;
      console.log("/viewcart");
      console.log(results);
      res.render("shop/cart", { results });
    });
  } else {
    res.redirect("/login");
  }
});

app.post("/api/updatecartProduct/:id", (req, res) => {
  const productId = req.params.id;
  const newQuantity = req.body.quantity;

  if (newQuantity > 10) {
    // If quantity is greater than 10, send out of stock alert
    res.status(400).send("Out of stock. Please reduce quantity.");
  } else if (newQuantity < 1) {
    res.status(400).send("Not allowed. Please increase quantity.");
  } else {
    let sqlQuery = `UPDATE cart SET quantity = ${newQuantity} WHERE id = ${productId}`;
    let query = conn.query(sqlQuery, (err, results) => {
      if (err) throw err;
      else res.redirect("/viewcart");
    });
  }
});

app.get("/api/deletecartProduct/:id", (req, res) => {
  let sqlQuery = "DELETE FROM cart where id = " + req.params.id;
  let query = conn.query(sqlQuery, (err, results) => {
    if (err) throw err;
    else res.redirect("/viewcart");
  });
});

app.get("/checkout/allcart", (req, res) => {
  let sqlQuery = "SELECT * from cart";
  let query = conn.query(sqlQuery, (err, results) => {
    if (err) throw err;
    else {
      console.log("allCart");
      console.log(results);
      results.forEach((product) => {
        let data = { p_id: product.p_id, buyer: product.username };
        let sq = "INSERT INTO orders SET ?";
        let q = conn.query(sq, data, (er, rs) => {
          if (er) throw er;
        });
      });

      let sq = "DELETE from cart";
      let q = conn.query(sq, (err, resultt) => {
        if (err) throw err;
        console.log("delete");
        console.log(resultt);
      });

      res.redirect("/view_order");
    }
  });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
