import cookieParser from "cookie-parser";
import glopalErrHandling from "../utils/errorHandling.js";
import { AppError } from "../utils/appError.js";
import queryRouter from "./query/query.router.js";
import menuRouter from "./menu/menu.router.js";
import healthRouter from "./health/health.router.js";
import authRouter from "./auth/auth.router.js";
import imageRouter from "./image/image.router.js";
import itemsRouter from './menu/item.router.js'
const initApp = (app, express) => {
  // Built-in Middleware
  app.use(express.json());
  // Routes
  app.use("/api/auth", authRouter);
  app.use("/api/transfer", menuRouter); // Mount the menu router at /api/transfer
  app.use("/api/query", queryRouter);
  app.use("/api/health", healthRouter);
  app.use("/api/image", imageRouter);
  app.use("/api/items", itemsRouter);


  // Catch-all for undefined routes
  app.use((req, res, next) => {
    next(
      new AppError("Not Found", 404, {
        method: req.method,
        url: req.originalUrl,
      })
    );
  });

  // Global Error Handler
  app.use(glopalErrHandling);
};

export default initApp;
