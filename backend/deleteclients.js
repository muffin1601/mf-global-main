const mongoose = require('mongoose');
require("dotenv").config();


// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Define the schema and model

const ClientData = require('./models/ClientData'); // Adjust the path as necessary

// Delete all data from the collection
async function deleteAllClients() {
    try {
        const result = await ClientData.deleteMany({});
        console.log(`Deleted ${result.deletedCount} documents from ClientData collection.`);
    } catch (error) {
        console.error('Error deleting documents:', error);
    } finally {
        mongoose.connection.close();
    }
}

deleteAllClients();