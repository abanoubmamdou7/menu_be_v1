// ./DB/connection.js

import mysql from 'mysql2/promise'; // Use promise-based API

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Create the pool
export const mysqlDB = mysql.createPool(dbConfig);

// Function to test and ensure DB connection
export const connectToMasterDB = async () => {
  try {
    const connection = await mysqlDB.getConnection();
   const db=connection.connection.config.database
   
    console.log(`✅ Connected to MySQL database ${db} successfully!`);
    connection.release();
  } catch (error) {
    console.error('❌ Failed to connect to the database:', error);
    throw error;
  }
};
