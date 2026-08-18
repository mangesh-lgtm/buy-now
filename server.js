/**
 * BuyWise Backend — Node.js / Express
 * Proxies calls to Bright Data Amazon product scraper.
 * API Key is kept server-side only.
 */

const express  = require("express");
const https    = require("https");
const path     = require("path");
const cors     = require("cors");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Bright Data config ───────────────────────────────────────────────────────
const BD_API_KEY    = "4f6dc8aa-45ee-4cd2-9a2e-47c729ee3307";
const BD_DATASET_ID = "gd_l7q7dkf244hwjntr0";
const BD_HOST       = "api.brightdata.com";
const BD_PATH       = `/datasets/v3/scrape?dataset_id=${BD_DATASET_ID}&notify=false&include_errors=true`;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── Helper: call Bright Data ─────────────────────────────────────────────────
function brightDataScrape(inputs) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      input: inputs,
      limit_per_input: null,
    });

    const options = {
      hostname: BD_HOST,
      path:     BD_PATH,
      method:   "POST",
      headers: {
        Authorization:  `Bearer ${BD_API_KEY}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve(raw); // return raw if JSON parse fails
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/scrape
 * Body: { urls: ["https://amazon.com/..."], zipcode?: "12345", language?: "" }
 * Scrapes product data from given Amazon URLs via Bright Data.
 */
app.post("/api/scrape", async (req, res) => {
  try {
    const { urls = [], zipcode = "", language = "" } = req.body;

    if (!urls.length) {
      return res.status(400).json({ error: "No URLs provided." });
    }

    const inputs = urls.map((url) => ({ url, zipcode, language }));
    const data   = await brightDataScrape(inputs);

    // Normalize: Bright Data returns array of product objects
    const products = Array.isArray(data) ? data : [data];
    return res.json({ success: true, products });
  } catch (err) {
    console.error("[/api/scrape] error:", err.message);
    return res.status(500).json({ error: err.message || "Scrape failed." });
  }
});

/**
 * POST /api/compare
 * Body: { query: string, budget_min?: number, budget_max?: number }
 * For demo purposes returns enriched DEMO data when no real URLs are passed.
 * (Extend this later to wire a search-index or Bright Data SERP dataset.)
 */
app.post("/api/compare", async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "query is required." });

  // --- controlled demo data (no extra API call) ---
  const DEMO = require("./demo_data.json");
  return res.json({ success: true, source: "demo", products: DEMO.products });
});

/**
 * GET /api/history
 * Query: ?query=<product name>
 * Returns price history (demo dataset — extend with Bright Data history dataset).
 */
app.get("/api/history", (req, res) => {
  const DEMO = require("./demo_data.json");
  return res.json({ success: true, source: "demo", history: DEMO.history });
});

// ── Catch-all: serve SPA ─────────────────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  BuyWise server running →  http://localhost:${PORT}`);
});
