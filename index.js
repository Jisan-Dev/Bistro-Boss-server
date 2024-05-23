const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
const app = express();
require('dotenv').config();
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

    // to get all users data
    app.get('/users', async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    // to save a user data
    app.post('/users', async (req, res) => {
      const user = req.body;
      // insert email if user already doesn't exist
      // we can do this in many ways (1. email unique, 2. upsert , 3. simple checking)
      const isExist = await userCollection.findOne({ email: user.email });
      console.log(isExist);
      if (isExist) {
        return res.send({ message: 'user already exists', insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // to get all the menu data
    app.get('/menu', async (req, res) => {
      const menus = await menuCollection.find().toArray();
      res.send(menus);
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
