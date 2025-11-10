import sql from 'mssql';

export async function createDatabaseIfNotExists(databaseName) {
  const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '123@123qw',
    server: process.env.DB_HOST || '192.168.1.47',
    port: parseInt(process.env.DB_PORT || '1433', 10),
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    database: 'master', // connect to master to check/create new DB
  };

  try {
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .query(`IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = '${databaseName}') 
              BEGIN 
                CREATE DATABASE [${databaseName}]
              END`);
    console.log("result",result);
    console.log(`✅ Checked or created database: ${databaseName}`);
    return true;
  } catch (err) {
    console.error(`❌ Error creating database ${databaseName}:`, err);
    throw err;
  }
}
