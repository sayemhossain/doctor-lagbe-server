const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require("mongodb");
const jwt = require("jsonwebtoken");

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
    const userCollection = client.db("doctor_portal").collection("users");

    // load services time data
    app.get("/service", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query);
      const services = await cursor.toArray();
      res.send(services);
    });

    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);

      // emplementing jwt
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });

    //Warning: this is not the best way to query multiple colllection. We somedays I will convert it into best way :::Start
    app.get("/available", async (req, res) => {
      const date = req.query.date || "May 16, 2022";

      // step:1 get all the service
      const services = await serviceCollection.find().toArray();

      // step:2 get the booking of that day
      const query = { date: date };
      const booking = await bookingCollection.find(query).toArray();

      // step:3 for each service, find booking for that service
      services.forEach((service) => {
        // step:4 find booking for that service
        const serviceBooking = booking.filter(
          (b) => b.treatment == service.name
        );

        //step:5 select slot for the service booking
        const bookedSlots = serviceBooking.map((s) => s.slot);

        //setp:6 select those slots that are not in booked slot
        const available = service.slots.filter((s) => !bookedSlots.includes(s));
        service.slots = available;
      });
      res.send(services);
    });
    //Warning: this is not the best way to query multiple colllection. We somedays I will convert it into best way :::End

    //get all data useing email=patinet query
    app.get("/booking", async (req, res) => {
      const patient = req.query.patient;

      console.log("auth header: ", authorization);
      const query = { patient: patient };
      const booking = await bookingCollection.find(query).toArray();
      res.send(booking);
    });
    // add a new booking
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        treatment: booking.treatment,
        date: booking.date,
        patient: booking.patient,
      };
      const exixts = await bookingCollection.findOne(query);
      if (exixts) {
        return res.send({ success: false, booking: exixts });
      }
      const result = await bookingCollection.insertOne(booking);
      return res.send({ success: true, result });
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
 * app.put('/booking/:id) //like upsert=> update(if user exists) or insert (if doesn't exists)
 * app.delete('/booking/:id) //deleting
 */
