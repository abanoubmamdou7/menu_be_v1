import "./config/loadEnv.js";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";

// Other initializations...
import "./src/modules/menu/itemSyncScheduler.js";

import initApp from "./src/modules/app.router.js";
import { bootstrapPrisma } from "./prisma/bootstrapPrisma.js";
import {
  connectToSqlDB,
  masterDB,
} from "./DB/sqlConnection.js";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "modules", "files")));

const defaultAllowedOrigins = [
  "https://menu-fe-eta.vercel.app",
  "https://adams-lounge.com",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:3000",
];

const envAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...envAllowedOrigins, ...defaultAllowedOrigins])];

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
};
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// ✅ Parse cookies before routes
app.use(cookieParser());

// ✅ JSON & URL-encoded parsing (with increased limit)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/", (req, res) => {
  res.send("✅ Hello! Server is up and running.");
});

async function startServer() {
  try {
    // Initialize Prisma (Supabase connection)
    await bootstrapPrisma();
    
    // Connect to SQL Server (ERP source database)
    await connectToSqlDB();

    // Make MSSQL connection available to app (for ERP queries)
    app.locals.mssql = masterDB;

    initApp(app, express);

    const PORT = process.env.PORT;
    const HOST = process.env.HOST || "localhost";

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on http://${HOST}:${PORT}`);
      console.log(`📊 Using Supabase (PostgreSQL) for menu storage`);
      console.log(`🔄 Syncing data from MSSQL ERP database`);
    });
  } catch (err) {
    console.error("❌ Failed to start the app:", err.stack || err.message);
    process.exit(1);
  }
}

startServer();
