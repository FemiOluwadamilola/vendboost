const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ quiet: true });   

// let mongoURI;

// if(process.env.NODE_ENV === 'development'){
//     mongoURI = process.env.MAGFARM_DB_URL; 
// }else{
//     mongoURI = process.env.MAGFARM_DB_URL_REMOTE; 
// }

async function dbConnection() {
    try {
    	const mongoURI = process.env.MONGODB_URL
        await mongoose.connect(mongoURI); 
        // log.info('MongoDB connected successfully!');
        console.log('MongoDB connected successfully!');
    } catch (error) {
        // log.error('Error connecting to MongoDB:', error);
        // await alertAdmin(`Error connecting to MongoDB: ${error.message}`);
        console.log(error)
        // throw error;
    }
}


module.exports = dbConnection;
