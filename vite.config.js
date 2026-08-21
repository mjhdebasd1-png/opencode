import { defineConfig } from "vite"
import { apiMiddleware } from "./server/api.js"

const port = Number(process.env.PORT) || 5173

export default defineConfig({
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
})
