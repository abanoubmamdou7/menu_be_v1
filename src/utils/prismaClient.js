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
      parsed.searchParams.set("connection_limit", "1");
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

