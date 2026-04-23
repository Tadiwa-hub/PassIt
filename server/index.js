import cors from "cors";
import express from "express";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* global process */

const PORT = Number(process.env.PORT || 8787);

const PAYNOW_URL = "https://www.paynow.co.zw/interface/remotetransaction";
const PAYNOW_INTEGRATION_ID = process.env.PAYNOW_INTEGRATION_ID;
const PAYNOW_INTEGRATION_KEY = process.env.PAYNOW_INTEGRATION_KEY;
const PAYNOW_RETURN_URL = process.env.PAYNOW_RETURN_URL || "https://passit.app/dashboard";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing env var: ${name}`);
}

function sha512UpperHex(input) {
  return crypto.createHash("sha512").update(input, "utf8").digest("hex").toUpperCase();
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url, init, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      lastErr = e;
      await sleep(250 + i * i * 500);
    }
  }
  throw lastErr;
}

const app = express();
app.use(cors());
app.use(express.json());

// Paynow will POST x-www-form-urlencoded to the webhook.
app.use(express.urlencoded({ extended: false }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/initiate-payment", async (req, res) => {
  try {
    requireEnv("PAYNOW_INTEGRATION_ID", PAYNOW_INTEGRATION_ID);
    requireEnv("PAYNOW_INTEGRATION_KEY", PAYNOW_INTEGRATION_KEY);
    requireEnv("SUPABASE_URL", SUPABASE_URL);
    requireEnv("SUPABASE_ANON_KEY", SUPABASE_ANON_KEY);

    const { subjectId, subjectTitle, phone, paymentMethod } = req.body || {};

    const authHeader = req.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Missing Authorization bearer token" });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return res.status(401).json({ error: userErr.message });
    const user = userData?.user;
    if (!user) return res.status(401).json({ error: "Invalid session" });

    if (!subjectId || !subjectTitle) {
      return res.status(400).json({ error: "Missing subjectId/subjectTitle" });
    }

    const { data: subjectData, error: subjectErr } = await supabase
      .from('subjects')
      .select('price, title')
      .eq('id', subjectId)
      .single();

    if (subjectErr || !subjectData) {
      return res.status(404).json({ error: "Subject not found or price not set" });
    }

    const amount = (subjectData.price || 10.00).toFixed(2);
    const reference = `SUB_${subjectId}_${user.id}_${Date.now()}`;
    const resultUrl = process.env.PAYNOW_RESULT_URL || `${SUPABASE_URL}/functions/v1/paynow-webhook`;
    const returnUrl = PAYNOW_RETURN_URL;

    // Fields must be hashed in the order they are sent.
    const fields = [
      ["resulturl", resultUrl],
      ["returnurl", returnUrl],
      ["reference", reference],
      ["amount", amount],
      ["id", PAYNOW_INTEGRATION_ID],
      ["additionalinfo", `Subscription for ${subjectTitle}`],
      ["authemail", user.email || ""],
    ];

    if (phone) fields.push(["phone", String(phone)]);
    if (paymentMethod) fields.push(["method", String(paymentMethod)]);
    // Note: for web-redirect methods (zimswitch, paygo etc.) phone is omitted

    fields.push(["status", "Message"]);
    fields.push(["currency", "USD"]);

    const hashString = fields.map(([, v]) => v).join("") + PAYNOW_INTEGRATION_KEY;
    const hash = sha512UpperHex(hashString);

    const formData = new URLSearchParams();
    for (const [k, v] of fields) formData.append(k, v);
    formData.append("hash", hash);

    const response = await fetchWithRetry(PAYNOW_URL, {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/plain, */*",
        "User-Agent": "PassIt-Backend/1.0",
      },
    });

    const resultText = await response.text();
    if (!response.ok) {
      return res.status(502).json({ error: `Paynow HTTP ${response.status}: ${resultText.slice(0, 500)}` });
    }

    const params = new URLSearchParams(resultText);
    if (params.get("status") !== "Ok") {
      return res.status(400).json({
        error: `Paynow initiation failed: ${params.get("error") || params.get("message") || resultText}`,
      });
    }

    return res.json({
      status: "Ok",
      pollUrl: params.get("pollurl"),
      browserUrl: params.get("browserurl"),
      instructions: params.get("instructions"),
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.post("/api/check-payment", async (req, res) => {
  try {
    const { pollUrl } = req.body || {};
    if (!pollUrl) return res.status(400).json({ error: "Missing pollUrl" });

    const response = await fetchWithRetry(pollUrl, {
      headers: {
        "User-Agent": "PassIt-Backend/1.0",
      },
    });
    const text = await response.text();
    if (!response.ok) {
      return res.status(502).json({ error: `Paynow HTTP ${response.status}: ${text.slice(0, 200)}` });
    }

    const params = new URLSearchParams(text);
    const status = params.get("status");
    
    if (status === "Paid" || status === "Awaiting Delivery") {
      const reference = params.get("reference");
      if (reference) {
        requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
        const parts = String(reference).split("_");
        const subjectId = parts[1];
        const userId = parts[2];

        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { error: subError } = await admin
          .from("user_subscriptions")
          .upsert({ user_id: userId, subject_id: subjectId, active: true }, { onConflict: 'user_id, subject_id' });
        if (subError) throw new Error(JSON.stringify(subError));

        await admin.from("profiles").update({ has_active_subscription: true }).eq("id", userId);
      }
    }

    return res.send(text);
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : JSON.stringify(e) });
  }
});

app.post("/api/paynow-webhook", async (req, res) => {
  try {
    requireEnv("PAYNOW_INTEGRATION_KEY", PAYNOW_INTEGRATION_KEY);
    requireEnv("SUPABASE_URL", SUPABASE_URL);
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);

    const reference = req.body?.reference;
    const amount = req.body?.amount || "";
    const paynowRef = req.body?.paynowreference || "";
    const status = req.body?.status;
    const pollUrl = req.body?.pollurl || "";
    const hash = req.body?.hash;

    if (!reference || !status || !hash) return res.status(400).send("Invalid webhook data");

    const hashString = String(reference) + String(amount) + String(paynowRef) + String(status) + String(pollUrl) + PAYNOW_INTEGRATION_KEY;
    const calculatedHash = sha512UpperHex(hashString);
    if (calculatedHash !== String(hash).toUpperCase()) return res.status(400).send("Hash mismatch");

    if (status === "Paid" || status === "Awaiting Delivery") {
      const parts = String(reference).split("_");
      const subjectId = parts[1];
      const userId = parts[2];

      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { error: subError } = await admin
        .from("user_subscriptions")
        .upsert({ user_id: userId, subject_id: subjectId, active: true }, { onConflict: 'user_id, subject_id' });
      if (subError) throw new Error(JSON.stringify(subError));

      await admin.from("profiles").update({ has_active_subscription: true }).eq("id", userId);
    }

    return res.status(200).send("Ok");
  } catch (e) {
    return res.status(400).send(e instanceof Error ? e.message : JSON.stringify(e));
  }
});

// Serve static files from the React app in production
const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));

// Handle React routing, return all requests to React app
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "API route not found" });
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`PassIt production server running on port ${PORT}`);
});

