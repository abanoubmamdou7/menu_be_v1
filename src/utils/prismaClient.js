import { PrismaClient } from "@prisma/client";
import logger from "./logger.js";

function buildPrismaUrl() {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    logger.warn(
      "DATABASE_URL is not defined. Prisma will use the default datasource configuration."
    );
    return undefined;
  }

  try {
    const parsed = new URL(rawUrl);

    if (!parsed.searchParams.has("pgbouncer")) {
      parsed.searchParams.set("pgbouncer", "true");
    }

    if (!parsed.searchParams.has("connection_limit")) {
      // Increase connection limit to support parallel operations
      // Default to 20 connections for better performance during sync operations
      const connectionLimit = process.env.PRISMA_CONNECTION_LIMIT || "20";
      parsed.searchParams.set("connection_limit", connectionLimit);
    }

    return parsed.toString();
  } catch (error) {
    logger.warn(
      "Failed to parse DATABASE_URL. Falling back to raw value.",
      error
    );
    return rawUrl;
  }
}

const datasourceUrl = buildPrismaUrl();

const prisma = new PrismaClient(
  datasourceUrl
    ? {
        datasources: {
          db: {
            url: datasourceUrl,
          },
        },
      }
    : undefined
);

export { prisma };

