import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }
  return onRequestPost(context);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const { subjectId, subjectTitle, phone, paymentMethod } = await request.json();
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
    
    if (!token) return new Response(JSON.stringify({ error: "Missing Authorization" }), { status: 401 });

    // Paynow Setup
    const PAYNOW_INTEGRATION_ID = env.PAYNOW_INTEGRATION_ID;
    const PAYNOW_INTEGRATION_KEY = env.PAYNOW_INTEGRATION_KEY;
    const SUPABASE_URL = env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
    const RETURN_URL = env.PAYNOW_RETURN_URL || "https://passit.app/dashboard";

    if (!PAYNOW_INTEGRATION_ID || !PAYNOW_INTEGRATION_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("Missing env vars:", { 
        id: !!PAYNOW_INTEGRATION_ID, 
        key: !!PAYNOW_INTEGRATION_KEY, 
        url: !!SUPABASE_URL, 
        anon: !!SUPABASE_ANON_KEY 
      });
      return new Response(JSON.stringify({ error: "Server configuration missing" }), { status: 500 });
    }

    // Initialize Supabase to get user and subject price
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401 });
    }

    // Fetch Subject Price
    const { data: subject, error: subError } = await supabase
      .from('subjects')
      .select('price')
      .eq('id', subjectId)
      .single();
    
    const amount = (subject?.price || 10.00).toFixed(2);

    // Hash Helper (Web Crypto)
    const sha512 = async (str) => {
      const buf = new TextEncoder().encode(str);
      const hash = await crypto.subtle.digest("SHA-512", buf);
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    };

    // Calculate Hash
    // Reference format: SUB_subjectId_userId_timestamp
    const reference = `SUB_${subjectId}_${user.id}_${Date.now()}`;
    const resultUrl = env.PAYNOW_RESULT_URL || `${env.CF_PAGES_URL || 'https://passit.app'}/api/paynow-webhook`;

    const fields = [
      ["resulturl", resultUrl],
      ["returnurl", RETURN_URL],
      ["reference", reference],
      ["amount", amount],
      ["id", PAYNOW_INTEGRATION_ID],
      ["additionalinfo", `Payment for ${subjectTitle}`],
      ["authemail", user.email || "customer@passit.app"]
    ];

    if (phone) fields.push(["phone", String(phone)]);
    if (paymentMethod) fields.push(["method", String(paymentMethod)]);
    
    fields.push(["status", "Message"]);
    fields.push(["currency", "USD"]);

    let hashString = "";
    for (const [k, v] of fields) hashString += v;
    hashString += PAYNOW_INTEGRATION_KEY;
    const hash = await sha512(hashString);

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
      return new Response(JSON.stringify({ 
        error: params.get("error") || params.get("message") || "Paynow initiation failed" 
      }), { status: 400 });
    }

    return new Response(JSON.stringify({
      status: "Ok",
      pollUrl: params.get("pollurl"),
      browserUrl: params.get("browserurl"),
      instructions: params.get("instructions")
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Initiate error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
