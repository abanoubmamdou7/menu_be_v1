import { asyncHandler } from "../../../utils/errorHandling.js";
import {
  findClientIdByEmail,
  findConnectionInfoByClientId,
} from "../../../../DB/quires.js";
import { generateToken } from "../../../utils/generateAndVerifyToken.js";
import {
  connectToDatabase,
  connectToSqlDB,
} from "../../../../DB/sqlConnection.js";

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // 1. Validate input
  if (!email || !password) {
    res.status(400);
    throw new Error("Email and password are required");
  }

  // 2. Connect to master database
  await connectToSqlDB();

  // 3. Find client ID using email/password
  const clientId = await findClientIdByEmail(email, password);
  if (!clientId) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  // 4. Get connection info for the client
  const connInfo = await findConnectionInfoByClientId(clientId);
  if (!connInfo || !connInfo.SQL_DB_NAME) {
    res.status(404);
    throw new Error("Client connection info not found");
  }

  const databaseName = connInfo.SQL_DB_NAME;

  // 5. Generate JWT token
  const token = generateToken({
    payload: {
      clientId,
      email,
      databaseName,
    },
  });

  const isDev = process.env.NODE_ENV === "development";

  // 6. Set cookie
  res.cookie("jwt", token, {
    httpOnly: true,
    sameSite: isDev ? "Lax" : "None",
    secure: !isDev,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  // 7. Optionally test client DB connection (if needed)
  await connectToDatabase(databaseName);

  // 8. Respond
  res.status(200).json({
    message: "success",
    databaseName,
    CLIENT_ID: clientId,
    activeUsers: connInfo.ACTIVE_USERS,
    token,
  });
});

export const connectClient = asyncHandler(async (req, res) => {
  const clientId = req.user?.clientId; // <-- From JWT

  if (!clientId) {
    res.status(401);
    throw new Error("Unauthorized: Client ID not found in token");
  }

  // Connect to master DB
  await connectToSqlDB();

  // Get client DB connection info
  const connInfo = await findConnectionInfoByClientId(clientId);

  if (!connInfo || !connInfo.SQL_DB_NAME) {
    res.status(404);
    throw new Error("Client database not found");
  }

  const databaseName = connInfo.SQL_DB_NAME;

  // Connect to the client database
  const clientConnection = await connectToDatabase(databaseName);

  // Query branches
  const branchesResult = await clientConnection.request().query(`
SELECT 
  BRANCH_CODE,
  BRANCH_NAME,
  COMPANY
FROM SYS_COMPANY_BRANCHES
WHERE Active = 1
ORDER BY BRANCH_NAME;
  `);

  // Close client connection
  await clientConnection.close();

  res.status(200).json({
    success: true,
    message: `✅ Connected to ${databaseName} and fetched branches`,
    databaseName,
    CLIENT_ID: clientId,
    activeUsers: connInfo.ACTIVE_USERS,
    branches: branchesResult.recordset,
  });
});
