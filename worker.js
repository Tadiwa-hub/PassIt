import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS Headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle OPTIONS
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Route: /api/initiate-payment
    if (url.pathname === "/api/initiate-payment" && request.method === "POST") {
      return handleInitiatePayment(request, env, corsHeaders);
    }

    // Route: /api/check-payment
    if (url.pathname === "/api/check-payment" && request.method === "POST") {
      return handleCheckPayment(request, env, corsHeaders);
    }

    // Route: /api/paynow-webhook
    if (url.pathname === "/api/paynow-webhook" && request.method === "POST") {
      return handlePaynowWebhook(request, env);
    }

    // Fallback: If not an API route, let Cloudflare serve the static assets
    // In "Worker with Assets", if you return nothing or a special response, 
    // it falls back to assets, but here we'll just return a 404 for unknown API
    if (url.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Not Found" }), { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // For everything else, let the assets handle it
    return env.ASSETS.fetch(request);
  }
};

async function handleInitiatePayment(request, env, corsHeaders) {
  try {
    const { subjectId, subjectTitle, phone, paymentMethod } = await request.json();
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
    
    if (!token) return new Response(JSON.stringify({ error: "Missing Authorization" }), { status: 401, headers: corsHeaders });

    const { PAYNOW_INTEGRATION_ID, PAYNOW_INTEGRATION_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, PAYNOW_RETURN_URL } = env;
    const RETURN_URL = PAYNOW_RETURN_URL || "https://passit.app/dashboard";

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: corsHeaders });

    const { data: subject } = await supabase.from('subjects').select('price').eq('id', subjectId).single();
    const amount = (subject?.price || 10.00).toFixed(2);

    const reference = `SUB_${subjectId}_${user.id}_${Date.now()}`;
    const resultUrl = env.PAYNOW_RESULT_URL || `${url.origin}/api/paynow-webhook`;

    const fields = [
      ["resulturl", resultUrl],
      ["returnurl", RETURN_URL],
      ["reference", reference],
      ["amount", amount],
      ["id", PAYNOW_INTEGRATION_ID],
      ["additionalinfo", `Payment for ${subjectTitle}`],
      ["authemail", user.email || ""],
    ];

    if (phone) fields.push(["phone", String(phone)]);
    if (paymentMethod) fields.push(["method", String(paymentMethod)]);
    fields.push(["status", "Message"]);
    fields.push(["currency", "USD"]);

    const hashString = fields.map(([, v]) => v).join("") + PAYNOW_INTEGRATION_KEY;
    const hashBuffer = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(hashString));
    const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    const formData = new URLSearchParams();
    for (const [k, v] of fields) formData.append(k, v);
    formData.append("hash", hash);

    const paynowRes = await fetch("https://www.paynow.co.zw/interface/remotetransaction", {
      method: "POST",
      body: formData,
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });

    const resultText = await paynowRes.text();
    const params = new URLSearchParams(resultText);

    if (params.get("status") !== "Ok") {
      return new Response(JSON.stringify({ error: params.get("error") || "Paynow error" }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      status: "Ok",
      pollUrl: params.get("pollurl"),
      browserUrl: params.get("browserurl"),
      instructions: params.get("instructions")
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}

async function handleCheckPayment(request, env, corsHeaders) {
  try {
    const { pollUrl } = await request.json();
    const response = await fetch(pollUrl);
    const text = await response.text();
    const params = new URLSearchParams(text);
    const status = params.get("status");

    if (status === "Paid" || status === "Awaiting Delivery") {
      const reference = params.get("reference");
      if (reference?.startsWith("SUB_")) {
        const parts = reference.split("_");
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
        await supabase.from('user_subscriptions').upsert({ user_id: parts[2], subject_id: parts[1], active: true });
        await supabase.from('profiles').update({ has_active_subscription: true }).eq('id', parts[2]);
      }
    }
    return new Response(text, { headers: { ...corsHeaders, "Content-Type": "application/x-www-form-urlencoded" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}

async function handlePaynowWebhook(request, env) {
  try {
    const formData = await request.formData();
    const reference = formData.get("reference");
    const status = formData.get("status");
    const hash = formData.get("hash");

    const hashString = reference + (formData.get("amount") || "") + (formData.get("paynowreference") || "") + status + (formData.get("pollurl") || "") + env.PAYNOW_INTEGRATION_KEY;
    const hashBuffer = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(hashString));
    const calculatedHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    if (calculatedHash === hash?.toUpperCase() && (status === "Paid" || status === "Awaiting Delivery")) {
      const parts = reference.split("_");
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
      await supabase.from('user_subscriptions').upsert({ user_id: parts[2], subject_id: parts[1], active: true });
      await supabase.from('profiles').update({ has_active_subscription: true }).eq('id', parts[2]);
    }
    return new Response("Ok", { status: 200 });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}
