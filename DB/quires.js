import sql from 'mssql';
import { masterDB } from './sqlConnection.js';

const findClientIdByEmail = async (email,password) => {
    const request = masterDB.request();
    request.input('email', sql.NVarChar, email);
    request.input('password', sql.NVarChar, password);

    const result = await request.query(`
        SELECT CLIENT_ID
        FROM USERS
        WHERE (Email = @email OR UserName = @email)
          AND Password = CONVERT(
            VARCHAR(64),
            HASHBYTES('SHA2_256', CONVERT(VARCHAR(100), @password)),
            2
          )
    `);

    if (result.recordset.length === 0) throw new Error('Invalid credentials');

    return result.recordset[0].CLIENT_ID;
};

const findConnectionInfoByClientId = async (clientId) => {
    const request = masterDB.request();
    request.input('clientId', sql.NVarChar, clientId);

    const result = await request.query(`
        SELECT SQL_USER, SQL_USR_PASS, SQL_DB_NAME, SQL_SRV_IP
        FROM CLIENT_LICENSE_DATA
        WHERE CLIENT_ID = @clientId
    `);
    if (result.recordset.length === 0) throw new Error('Client info not found.');
    return result.recordset[0];
};

export {
    findClientIdByEmail,
    findConnectionInfoByClientId
};