import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const config = {
  api: { bodyParser: false },
  supportsResponseStreaming: true,
  maxDuration: 60,
};

const T_B = (process.env.T_D || "").replace(/\/$/, "");

const HEADER = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

export default async function handler(req, res) {
  if (!T_B) {
    res.statusCode = 500;
    return res.end("Misconfigured: T_D is not set");
  }

  try {
    const targetUrl = T_B + req.url;

    const headers = {};

    let cI = null;

    for (const key of Object.keys(req.headers)) {
      const k = key.toLowerCase();

      const v = req.headers[key];

      if (HEADER.has(k)) {
        continue;
      }

      if (k.startsWith("x-vercel-")) {
        continue;
      }

      if (k === "x-real-ip") {
        cI = v; continue;
      }

      if (k === "x-forwarded-for") { 
        if (!cI) cI = v; continue; 
      }

      headers[k] = Array.isArray(v) ? v.join(", ") : v;
    }

    if (cI) {
      headers["x-forwarded-for"] = cI
    };

    const method = req.method;
    const hasBody = method !== "GET" && method !== "HEAD";

    const fO = { method, headers, redirect: "manual" };

    if (hasBody) {
      fO.body = Readable.toWeb(req);
      fO.duplex = "half";
    }

    const uS = await fetch(targetUrl, fO);

    res.statusCode = uS.status;

    for (const [k, v] of uS.headers) {
      if (k.toLowerCase() === "transfer-encoding") { 
        continue;
      }

      try {
        res.setHeader(k, v);
      } catch {}
    }

    if (uS.body) {
      await pipeline(Readable.fromWeb(uS.body), res);
    } else {
      res.end();
    }
  } catch (err) {
    console.error("rel error:", err);
    
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end("Bad Gateway: Tun Failed");
    }
  }
}
