const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require("mongodb");

app.use(cors());
app.use(express.json());

// this code from mongo db
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.brclz.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
async function run() {
  try {
    await client.connect();
    console.log("Database connected");

    const serviceCollection = client.db("doctor_portal").collection("services");
    const bookingCollection = client.db("doctor_portal").collection("bookings");

    // load services time data
    app.get("/service", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query);
      const services = await cursor.toArray();
      res.send(services);
    });

    // add a new booking
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);
// this is from mongodb

app.get("/", (req, res) => {
  res.send("Hello from doctor uncle!");
});

app.listen(port, () => {
  console.log(`Doctor app listening on port ${port}`);
});

/**
 * API naming convention
 * app.get('/booking') //get all booking in this collection or get more then one or by filter
 *
 * app.get('/booking/:id') //get a specific booking
 * app.post('/booking') //add a new booking
 * app.patch('/booking/:id) //update
 * app.delete('/booking/:id) //deleting
 */
