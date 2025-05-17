const mongoose = require("mongoose");
require("dotenv").config();
const bcrypt = require("bcrypt");
const User = require("./models/User");

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const createUsers = async () => {
  
  const users = [
      {  name: "Admin", username: "admin", email: "admin@example.com", password: "mfadmin", location: "Delhi", role: "admin" },
      {  name: "Neha", username: "neha", email: "neha@example.com", password: "mfneha", location: "Delhi", role: "user" },
      {  name: "Sarita", username: "sarita", email: "sarita@example.com", password: "mfsarita", location: "Delhi", role: "user" },
      { name: "Anju", username: "anju", email: "anju@example.com", password: "mfanju", location: "Delhi", role: "user" },
      { name: "Afroz", username: "afroz", email: "afroz@example.com", password: "mfafroz", location: "Delhi", role: "user" }
    ];
  

  try {
    await User.deleteMany({}); 
    console.log("Cleared existing data.");

  
  for (let user of users) {
    user.password = await bcrypt.hash(user.password, 10); 
    await User.create(user);
  }

  console.log("Users inserted successfully");
  mongoose.connection.close();
  } catch (error) {
    console.error("Error inserting users:", error);
  }
};

createUsers();
