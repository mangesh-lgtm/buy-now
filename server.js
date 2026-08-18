/**
 * BuyWise Backend — Node.js / Express
 */

const express = require("express");
const https   = require("https");
const path    = require("path");
const cors    = require("cors");
const fs      = require("fs");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Load demo data once at startup ───────────────────────────────────────────
const DEMO = JSON.parse(fs.readFileSync(path.join(__dirname, "demo_data.json"), "utf8"));

// ── Bright Data config ────────────────────────────────────────────────────────
const BD_API_KEY    = "4f6dc8aa-45ee-4cd2-9a2e-47c729ee3307";
const BD_DATASET_ID = "gd_l7q7dkf244hwjntr0";
const BD_HOST       = "api.brightdata.com";
const BD_PATH       = `/datasets/v3/scrape?dataset_id=${BD_DATASET_ID}&notify=false&include_errors=true`;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── Bright Data helper ────────────────────────────────────────────────────────
function brightDataScrape(inputs) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ input: inputs, limit_per_input: null });
    const options = {
      hostname: BD_HOST,
      path:     BD_PATH,
      method:   "POST",
      headers: {
        Authorization:    `Bearer ${BD_API_KEY}`,
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try { resolve(JSON.parse(raw)); }
        catch { resolve({ raw }); }
      });
    });
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Bright Data timeout")); });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Live Amazon scrape
app.post("/api/scrape", async (req, res) => {
  try {
    const { urls = [], zipcode = "", language = "" } = req.body;
    if (!urls.length) return res.status(400).json({ error: "No URLs provided." });
    const inputs   = urls.map((url) => ({ url, zipcode, language }));
    const data     = await brightDataScrape(inputs);
    const products = Array.isArray(data) ? data : [data];
    return res.json({ success: true, products });
  } catch (err) {
    console.error("[/api/scrape]", err.message);
    return res.status(500).json({ error: err.message || "Scrape failed." });
  }
});

// Demo compare (no extra API call)
app.post("/api/compare", (req, res) => {
  return res.json({ success: true, source: "demo", products: DEMO.products });
});

// Demo history (no extra API call)
app.get("/api/history", (req, res) => {
  return res.json({ success: true, source: "demo", history: DEMO.history });
});

// SPA catch-all
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n✅  BuyWise server running →  http://localhost:${PORT}\n`);
});
