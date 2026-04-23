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

    if (!PAYNOW_INTEGRATION_ID || !PAYNOW_INTEGRATION_KEY) {
      return new Response(JSON.stringify({ error: "Server configuration missing" }), { status: 500 });
    }

    // Hash Helper (Web Crypto)
    const sha512 = async (str) => {
      const buf = new TextEncoder().encode(str);
      const hash = await crypto.subtle.digest("SHA-512", buf);
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    };

    // Calculate Hash
    const reference = `SUB_${subjectId}_CF_${Date.now()}`;
    const amount = "10.00"; // Fallback or fetch from DB
    const resultUrl = env.PAYNOW_RESULT_URL || `${env.CF_PAGES_URL || ''}/api/paynow-webhook`;

    const fields = [
      ["resulturl", resultUrl],
      ["returnurl", RETURN_URL],
      ["reference", reference],
      ["amount", amount],
      ["id", PAYNOW_INTEGRATION_ID],
      ["additionalinfo", `Payment for ${subjectTitle}`],
      ["authemail", "customer@passit.app"],
      ["status", "Message"]
    ];

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
      return new Response(JSON.stringify({ error: params.get("error") || "Paynow error" }), { status: 400 });
    }

    return new Response(JSON.stringify({
      status: "Ok",
      pollUrl: params.get("pollurl"),
      browserUrl: params.get("browserurl")
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
