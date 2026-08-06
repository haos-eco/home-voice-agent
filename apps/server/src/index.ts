import "dotenv/config";

import cors from "@fastify/cors";
import Fastify from "fastify";

import { config } from "./config.js";
import {
  createRealtimeClientSecret,
  OpenAIConfigurationError,
  OpenAIRealtimeError,
} from "./realtime.js";

const app = Fastify({
  logger: {
    level: config.NODE_ENV === "development" ? "debug" : "info",
  },
  bodyLimit: 32 * 1024,
});

await app.register(cors, {
  methods: ["GET", "POST", "OPTIONS"],

  origin(origin, callback) {
    // Allow curl, server-to-server calls and similar non-browser requests.
    if (!origin) {
      callback(null, true);
      return;
    }

    if (config.FRONTEND_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin not allowed: ${origin}`), false);
  },
});

app.get("/health", async () => ({
  status: "ok",
  service: "home-voice-agent-server",
  openaiConfigured: Boolean(config.OPENAI_API_KEY),
  model: config.REALTIME_MODEL,
  timestamp: new Date().toISOString(),
}));

app.post("/api/realtime/token", async (_request, reply) => {
  reply.header("Cache-Control", "no-store, private");

  try {
    const clientSecret = await createRealtimeClientSecret();
    return reply.status(201).send(clientSecret);
  } catch (error) {
    if (error instanceof OpenAIConfigurationError) {
      return reply.status(503).send({
        error: "openai_not_configured",
        message: "The OpenAI API key is not configured.",
      });
    }

    if (error instanceof OpenAIRealtimeError) {
      app.log.error(
        {
          statusCode: error.statusCode,
          error: error.message,
        },
        "Failed to create OpenAI Realtime client secret",
      );

      return reply.status(502).send({
        error: "realtime_client_secret_failed",
        message: "Could not create a Realtime client secret.",
      });
    }

    throw error;
  }
});

app.setNotFoundHandler(async (_request, reply) =>
  reply.status(404).send({
    error: "not_found",
  }),
);

app.setErrorHandler(async (error, _request, reply) => {
  app.log.error(error);

  return reply.status(500).send({
    error: "internal_server_error",
    message: "The voice-agent server encountered an unexpected error.",
  });
});

async function stop(signal: string): Promise<void> {
  app.log.info({ signal }, "Stopping voice-agent server");

  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

process.once("SIGINT", () => void stop("SIGINT"));
process.once("SIGTERM", () => void stop("SIGTERM"));

try {
  await app.listen({
    host: config.HOST,
    port: config.PORT,
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
