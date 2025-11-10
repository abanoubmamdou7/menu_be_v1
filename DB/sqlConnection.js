import sql from 'mssql';
import { decryptEnvVar, encryptEnvVar } from '../src/utils/decryptEnvVar.js';
// Base configuration that can be extended for different databases
const decryptedPassword = decryptEnvVar(
    process.env.SQLSERVER_PASSWORD_ENCRYPTED,
    process.env.ENCRYPTION_KEY
);

const baseDBConfig = {
    user: process.env.SQLSERVER_USER,
    password: decryptedPassword,
    server: process.env.SQLSERVER_HOST,
    port:parseInt(process.env.SQLSERVER_PORT || '1433'),
    options: {
        encrypt: false,
        trustServerCertificate: true,
    },
    pool: {
        max: 10,
        min: 0,
        acquireTimeoutMillis: 30000,
    },
};

// Master DB configuration
const masterDBConfig = {
    ...baseDBConfig,
    database: process.env.MASTER_DB_NAME,
}
const clientDBConfig = {
    ...baseDBConfig,
    database: 'ADAMSSE'}

// Master DB connection pool
export const SqlServerDB = new sql.ConnectionPool(clientDBConfig);

// Master DB connection pool
const masterDB = new sql.ConnectionPool(masterDBConfig);


// Connect to sql DB
const connectToSqlDB = async () => {
    try {
        await masterDB.connect();
        console.log(`✅ Connected to ${masterDB.config.database} DB`);
        return masterDB;
    } catch (error) {
        throw new Error("❌ Unable to connect to the Master Database: " + error.message);
    }
};


// Function to connect to any other database dynamically
const connectToDatabase = async (databaseName) => {
    const customDBConfig = { ...baseDBConfig, database: databaseName };
        // Sanity check for incorrect credentials
        if (customDBConfig.user.toLowerCase() === 'root') {
            throw new Error("❌ 'root' is not a valid user for SQL Server. Please check your environment variables.");
        }
    const dbConnection = new sql.ConnectionPool(customDBConfig);

    try {
        await dbConnection.connect();
        console.log(`✅ Connected to ${databaseName} DB`);
        return dbConnection;
    } catch (error) {
        throw new Error(`❌ Unable to connect to the ${databaseName} database: ${error.message}`);
    }
};

// Function to create a client-specific database connection
const createClientConnection = async (connInfo) => {
    const clientDBConfig = {
        user: connInfo.SQL_USER,
        password: connInfo.SQL_USR_PASS,
        server: connInfo.SQL_SRV_IP.trim(),
        database: connInfo.SQL_DB_NAME,
        options: {
            encrypt: false,
            trustServerCertificate: true
        }
    };

    const clientDB = new sql.ConnectionPool(clientDBConfig);

    try {
        await clientDB.connect();
        console.log(`✅ Connected to ${connInfo.SQL_DB_NAME} client DB`);
        return clientDB;
    } catch (error) {
        throw new Error(`❌ Unable to connect to the ${connInfo.SQL_DB_NAME} client database: ${error.message}`);
    }
};

// Export all the connection functions and pools
export {
    masterDB,
    connectToSqlDB,
    connectToDatabase,
    baseDBConfig,
    createClientConnection
};
