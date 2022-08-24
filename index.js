const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

// this code from mongo db
const uri =
  "mongodb+srv://doctor-lagbe:scD78dMqJi6wMYJF@cluster0.ya0akxm.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// this function for jwt
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  // verify a token symmetric
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    console.log("Database connected");

    const serviceCollection = client.db("doctor_portal").collection("services");
    const bookingCollection = client.db("doctor_portal").collection("bookings");
    const userCollection = client.db("doctor_portal").collection("users");
    const doctorCollection = client.db("doctor_portal").collection("doctors");
    const paymentCollection = client.db("doctor_portal").collection("payments");

    // this is for payment
    app.post("/create-payment-intent", async (req, res) => {
      const service = req.body;
      const price = service.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
    // load services time data
    app.get("/service", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query).project({ name: 1 });
      const services = await cursor.toArray();
      res.send(services);
    });

    //get all user
    app.get("/user", async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });
    // this is for user collection
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);

      res.send(result);
    });

    // this is make admin
    app.put("/user/admin/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //get specific user
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });
    // limit dashboard access
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user?.role === "admin";
      res.send({ admin: isAdmin });
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
      console.log(patient);

      const query = { patient: patient };
      const booking = await bookingCollection.find(query).toArray();
      return res.send(booking);
    });

    //this is for payment booking
    app.get("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const booking = await bookingCollection.findOne(query);
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
    app.patch("/booking/:id", async (req, res) => {
      const id = res.params;
      const payment = req.body;
      const query = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const result = await paymentCollection.insertOne(payment);
      const updatedBooking = await bookingCollection.updateOne(
        query,
        updateDoc
      );

      res.send(updateDoc);
    });

    // this is for find all doctor
    app.get("/doctor", async (req, res) => {
      const doctors = await doctorCollection.find().toArray();
      res.send(doctors);
    });

    //this create a doctor api
    app.post("/doctor", async (req, res) => {
      const doctor = req.body;
      const result = await doctorCollection.insertOne(doctor);
      res.send(result);
    });

    // this is for delete doctors
    app.delete("/doctor/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await doctorCollection.deleteOne(filter);
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
 * app.put('/booking/:id) //like upsert=> update(if user exists) or insert (if doesn't exists)
 * app.delete('/booking/:id) //deleting
 */
