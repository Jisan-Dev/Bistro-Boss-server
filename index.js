const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 5000;
const app = express();
const stripe = require("stripe")("sk_test_51PL3tFCkMElpXPySRd553MHA7IdXTXCwIlyTDYBb8GESWcNFL9TU8uQriDdePdwknEPXR1KGmbiC7TU01FZNknpT00TDMDKHkD");
require("dotenv").config();
var jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.chn7ebi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const shortid = require("shortid");

app.use(cors());
app.use(express.json());

const runFn = require("./geminiApi");

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const userCollection = client.db("BistroDB").collection("users");
    const menuCollection = client.db("BistroDB").collection("menu");
    const reviewCollection = client.db("BistroDB").collection("reviews");
    const cartCollection = client.db("BistroDB").collection("cart");
    const paymentCollection = client.db("BistroDB").collection("payments");

    // to create jwt access token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "2h" });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) return res.status(401).send({ message: "unauthorized access" });
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).send({ message: "unauthorized access" });
        req.decodedUser = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decodedUser.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "Admin";
      if (!isAdmin) return res.status(403).send("forbidden access");
      next();
    };

    // GEMINI AI content generation based on given prompt
    app.post("/api/prompt-post", async (req, res) => {
      try {
        const { prompt } = req.body;
        const result = await runFn(prompt);
        res.send(result);
      } catch (error) {
        console.log(error);
        res.send(error);
      }
    });

    // to get all users data
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    // to save a user data
    app.post("/users", async (req, res) => {
      const user = req.body;
      // insert email if user already doesn't exist
      // we can do this in many ways (1. email unique, 2. upsert , 3. simple checking)
      const isExist = await userCollection.findOne({ email: user.email });
      if (isExist) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // to delete a user
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await userCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // to check if requested user is admin or not
    app.get("/users/isAdmin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decodedUser.email) return res.status(403).send({ message: "forbidden access" });

      const user = await userCollection.findOne({ email: email });
      let isAdmin = false;
      if (user) {
        isAdmin = user?.role === "Admin";
      }
      res.send({ isAdmin });
      // const isAdmin = user?.role === 'admin';
      // res.send({ isAdmin });
    });

    // to give a specific user role of admin
    app.patch("/users/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: { role: "Admin" } };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // to get all the menu data
    app.get("/menu", async (req, res) => {
      const menus = await menuCollection.find().toArray();
      res.send(menus);
    });

    // to get a single menu data by _id
    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const menuItem = await menuCollection.findOne(query);
      res.send(menuItem);
    });

    // to update a single menu data by _id
    app.patch("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: req.body };
      const result = await menuCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // to insert a data in menu collection
    app.post("/menu", verifyToken, verifyAdmin, async (req, res) => {
      const menu = req.body;
      const result = await menuCollection.insertOne(menu);
      res.send(result);
    });

    // to delete a data from menu collection by _id
    app.delete("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await menuCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // to get all the reviews data
    app.get("/reviews", async (req, res) => {
      const reviews = await reviewCollection.find().toArray();
      res.send(reviews);
    });

    // to get all the cart data by a specific user email
    app.get("/cart", async (req, res) => {
      const email = req.query?.email;
      const carts = await cartCollection.find({ email: email }).toArray();
      res.send(carts);
    });

    // to save a cart data
    app.post("/cart", async (req, res) => {
      const cart = req.body;
      const result = await cartCollection.insertOne(cart);
      res.json(result);
    });

    // to delete a specific cart by id
    app.delete("/cart/:id", async (req, res) => {
      const id = req.params.id;
      const result = await cartCollection.deleteOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      if (!price || amount < 1) return;

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // to save payment info in db by creating a new collection for payments
    app.post("/payment", async (req, res) => {
      const payment = req.body;
      // payment.foodIds = payment.foodIds.map((id) => new ObjectId(id));
      const paymentResult = await paymentCollection.insertOne(payment);

      // carefully delete each item from the cart
      const query = { _id: { $in: payment.cartIds.map((id) => new ObjectId(id)) } };
      const deleteResult = await cartCollection.deleteMany(query);
      res.send({ paymentResult, deleteResult });
    });

    // to get payment histories for a specific user by email
    app.get("/payments/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decodedUser.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const payments = await paymentCollection.find({ email: email }).toArray();
      res.send(payments);
    });

    // to get stats or analytics for admin dashboard
    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const menuItems = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      // this is not the best way to get total revenue
      // const payments = await paymentCollection.find().toArray();
      // const revenue = payments.reduce((total, payment) => total + payment.price, 0);

      const result = await paymentCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: "$price" },
            },
          },
        ])
        .toArray();

      console.log(result);

      const revenue = result.length > 0 ? result[0].totalRevenue : 0;
      console.log(revenue);

      res.send({ users, menuItems, orders, revenue });
    });

    // order status
    /**
     * ----------------------------
     *    NON-Efficient Way
     * ------------------------------
     * 1. load all the payments
     * 2. for every menuItemIds (which is an array), go find the item from menu collection
     * 3. for every item in the menu collection that you found from a payment entry (document)
     */

    // order status using aggregate pipeline
    app.get("/order-stats", async (req, res) => {
      const result = await paymentCollection
        .aggregate([
          {
            $unwind: "$foodIds",
          },
          {
            $addFields: {
              foodIdObject: { $toObjectId: "$foodIds" },
            },
          },
          {
            $lookup: {
              from: "menu",
              localField: "foodIdObject",
              foreignField: "_id",
              as: "menuItem",
            },
          },
          {
            $unwind: "$menuItem",
          },
          {
            $group: {
              _id: "$menuItem.category",
              quantity: { $sum: 1 },
              revenue: { $sum: "$menuItem.price" },
            },
          },
          {
            $project: {
              _id: 0,
              category: "$_id",
              quantity: "$quantity",
              revenue: "$revenue",
            },
          },
        ])
        .toArray();
      res.send(result);
    });

    // ssl commerze example ----start------
    app.post("/create-payment", async (req, res) => {
      const paymentInfo = req.body;

      const initiatePayment = {
        store_id: "jisan667d8ad021bc2",
        store_passwd: "jisan667d8ad021bc2@ssl",
        total_amount: paymentInfo.amount,
        currency: "BDT",
        tran_id: shortid.generate(),
        success_url: "http://yoursite.com/success.php",
        fail_url: "http://yoursite.com/fail.php",
        cancel_url: " http://yoursite.com/cancel.php",
        cus_name: "Customer Name",
        cus_email: "cust@yahoo.com",
        cus_add1: "Dhaka",
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: 1000,
        cus_country: "Bangladesh",
        cus_phone: "01711111111",
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
        multi_card_name: "mastercard,visacard,amexcard",
        value_a: "ref001_A",
        value_b: "ref002_B",
        value_c: "ref003_C",
        value_d: "ref004_D",
      };

      res.send("result");
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World, Boss is ruling!");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
