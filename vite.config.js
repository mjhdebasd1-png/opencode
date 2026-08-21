import { defineConfig, loadEnv } from "vite"
import { apiMiddleware } from "./server/api.js"

const port = Number(process.env.PORT) || 5173

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  for (const [key, value] of Object.entries(env)) {
    if (!(key in process.env)) process.env[key] = value
  }

  return {
    server: {
      host: true,
      port,
    },
    preview: {
      host: true,
      port,
    },
    plugins: [
      {
        name: "opencode-api",
        configureServer(server) {
          server.middlewares.use(apiMiddleware)
        },
        configurePreviewServer(server) {
          server.middlewares.use(apiMiddleware)
        },
      },
    ],
  }
})
