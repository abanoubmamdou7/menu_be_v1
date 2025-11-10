import { asyncHandler } from "../utils/errorHandling.js";
import { verifyToken } from "../utils/generateAndVerifyToken.js";

export const auth = () => {
  return asyncHandler(async (req, res, next) => {
    const token = req.headers.authorization;

    if (!token) {
      return next(new Error("Authorization token is required", { cause: 401 }));
    }

    let decoded;

    try {
      decoded = verifyToken({
        payload: token,
        signature: process.env.SIGNATURE,
      });
    } catch (error) {
      return next(new Error("Invalid or expired token", { cause: 401 }));
    }
    if (!decoded?.clientId) {
      return next(new Error("Invalid token payload", { cause: 401 }));
    }

    // Attach payload to req.user
    req.user = decoded;

    return next();
  });
};
