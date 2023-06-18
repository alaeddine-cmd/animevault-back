require('dotenv').config();
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const mongoString = process.env.DATABASE_URL;
const routes = require('./routes/routes');
const port = process.env.PORT || 8080;

mongoose.connect(mongoString);
const database = mongoose.connection;

database.on('error', (error) => {
  console.log(error);
});

database.once('connected', () => {
  console.log('Database Connected');
});

const app = express();

app.use(cors());
app.use(express.json()); 
app.use('/api', routes);
app.use('/uploads', express.static('uploads'));

app.listen(8080, () => {
  console.log('Server Started at 8080');
});
