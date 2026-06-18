// Pass-through proxy for ligas.io. It ONLY ever forwards to https://ligas.io/api/*
// (never an arbitrary host), so it cannot be abused as an open proxy. Adds CORS
// headers so the static GitHub Pages site can read the responses.
const LIGAS = "https://ligas.io/api"
const ALLOWED_ORIGINS = new Set([
  "https://itsurkan.github.io",
  "http://localhost:3000",
])

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://itsurkan.github.io"
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "accept, content-type",
    vary: "Origin",
  }
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") ?? ""

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }
    if (request.method !== "GET") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders(origin),
      })
    }

    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/+/, "") // strip leading slash(es)
    const target = `${LIGAS}/${path}${url.search}`

    const upstream = await fetch(target, {
      headers: { accept: "application/json" },
    })
    const body = await upstream.text()

    return new Response(body, {
      status: upstream.status,
      headers: {
        ...corsHeaders(origin),
        "content-type": upstream.headers.get("content-type") ?? "application/json",
      },
    })
  },
}
