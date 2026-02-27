/**
 * OpenAPI Specification for MiniClaw-CC API
 */

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "MiniClaw-CC API",
    description: "VPS provisioning service with standby pool architecture",
    version: "1.0.0"
  },
  servers: [
    { url: "http://localhost:4000", description: "Local development" },
    { url: "https://api.miniclaw.xyz", description: "Production" }
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        tags: ["Health"],
        responses: {
          "200": { description: "Healthy" }
        }
      }
    },
    "/api/auth/signup": {
      post: {
        summary: "Sign up",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string" },
                  password: { type: "string" },
                  name: { type: "string" },
                  stack: { type: "string", enum: ["openclaw", "nanobot"] }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Success" }
        }
      }
    },
    "/api/auth/signin": {
      post: {
        summary: "Sign in",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string" },
                  password: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Success" }
        }
      }
    },
    "/api/pool": {
      get: {
        summary: "Get pool status",
        tags: ["Pool"],
        responses: {
          "200": { description: "Success" }
        }
      }
    },
    "/api/servers/provision": {
      post: {
        summary: "Provision server",
        tags: ["Servers"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["plan", "region"],
                properties: {
                  plan: { type: "string", enum: ["free", "pro", "enterprise"] },
                  region: { type: "string" },
                  stack: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Server provisioned" }
        }
      }
    },
    "/api/servers": {
      get: {
        summary: "List servers",
        tags: ["Servers"],
        responses: {
          "200": { description: "Success" }
        }
      }
    }
  }
};

export default openApiSpec;
