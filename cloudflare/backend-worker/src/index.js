import { Container, getContainer } from "@cloudflare/containers";
import { env } from "cloudflare:workers";

export class AlgetBackendContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "5m";
  pingEndpoint = "healthz";
  envVars = {
    OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
    OPENROUTER_MODEL: env.OPENROUTER_MODEL || "google/gemini-3.1-flash-lite",
    OPENROUTER_EMBEDDING_MODEL: env.OPENROUTER_EMBEDDING_MODEL || "google/gemini-embedding-001",
    OPENROUTER_IMAGE_MODEL: env.OPENROUTER_IMAGE_MODEL || "google/gemini-2.5-flash-image",
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    ENGINEERING_ACCESS_CODE: env.ENGINEERING_ACCESS_CODE,
    EDUCATION_ACCESS_CODE: env.EDUCATION_ACCESS_CODE,
    RESEARCHER_ACCESS_CODE: env.RESEARCHER_ACCESS_CODE,
  };
}

export default {
  fetch(request, workerEnv) {
    const container = getContainer(workerEnv.ALGET_BACKEND, "alget-production");
    return container.fetch(request);
  },
};
