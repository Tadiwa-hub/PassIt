export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const { pollUrl } = await request.json();
    if (!pollUrl) return new Response(JSON.stringify({ error: "Missing pollUrl" }), { status: 400 });

    const response = await fetch(pollUrl);
    const text = await response.text();
    
    if (!response.ok) return new Response(JSON.stringify({ error: "Paynow check failed" }), { status: 502 });

    const params = new URLSearchParams(text);
    const status = params.get("status");

    // Note: In Cloudflare Functions, we can't easily perform background DB updates 
    // without a separate library like @supabase/supabase-js, but we'll include it.
    
    return new Response(text, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
