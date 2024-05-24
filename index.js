const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
const app = express();
require('dotenv').config();
var jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.chn7ebi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

app.use(cors());
app.use(express.json());

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
    const userCollection = client.db('BistroDB').collection('users');
    const menuCollection = client.db('BistroDB').collection('menu');
    const reviewCollection = client.db('BistroDB').collection('reviews');
    const cartCollection = client.db('BistroDB').collection('cart');

    // to create jwt access token
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '2h' });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) return res.status(401).send({ message: 'unauthorized access' });
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).send({ message: 'unauthorized access' });
        req.decodedUser = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decodedUser.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === 'Admin';
      if (!isAdmin) return res.status(403).send('forbidden access');
      next();
    };

    // to get all users data
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    // to save a user data
    app.post('/users', async (req, res) => {
      const user = req.body;
      // insert email if user already doesn't exist
      // we can do this in many ways (1. email unique, 2. upsert , 3. simple checking)
      const isExist = await userCollection.findOne({ email: user.email });
      if (isExist) {
        return res.send({ message: 'user already exists', insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // to delete a user
    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await userCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // to check if requested user is admin or not
    app.get('/users/isAdmin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decodedUser.email) return res.status(403).send({ message: 'forbidden access' });

      const user = await userCollection.findOne({ email: email });
      let isAdmin = false;
      if (user) {
        isAdmin = user?.role === 'Admin';
      }
      res.send({ isAdmin });
      // const isAdmin = user?.role === 'admin';
      // res.send({ isAdmin });
    });

    // to give a specific user role of admin
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: { role: 'Admin' } };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // to get all the menu data
    app.get('/menu', async (req, res) => {
      const menus = await menuCollection.find().toArray();
      res.send(menus);
    });

    // to get a single menu data by _id
    app.get('/menu/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const menuItem = await menuCollection.findOne(query);
      res.send(menuItem);
    });

    // to update a single menu data by _id
    app.patch('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: id };
      const updateDoc = { $set: req.body };
      const result = await menuCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // to insert a data in menu collection
    app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
      const menu = req.body;
      const result = await menuCollection.insertOne(menu);
      res.send(result);
    });

    // to delete a data from menu collection by _id
    app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await menuCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // to get all the reviews data
    app.get('/reviews', async (req, res) => {
      const reviews = await reviewCollection.find().toArray();
      res.send(reviews);
    });

    // to get all the cart data by a specific user email
    app.get('/cart', async (req, res) => {
      const email = req.query?.email;
      const carts = await cartCollection.find({ email: email }).toArray();
      res.send(carts);
    });

    // to save a cart data
    app.post('/cart', async (req, res) => {
      const cart = req.body;
      const result = await cartCollection.insertOne(cart);
      res.json(result);
    });

    // to delete a specific cart by id
    app.delete('/cart/:id', async (req, res) => {
      const id = req.params.id;
      const result = await cartCollection.deleteOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log('Pinged your deployment. You successfully connected to MongoDB!');
  } finally {
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World, Boss is ruling!');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
