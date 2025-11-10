import { asyncHandler } from "../../../utils/errorHandling.js";

export const health = asyncHandler(async (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});
