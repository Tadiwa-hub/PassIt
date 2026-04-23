export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const formData = await request.formData();
    const reference = formData.get("reference");
    const status = formData.get("status");
    const hash = formData.get("hash");

    if (!reference || !status || !hash) return new Response("Invalid data", { status: 400 });

    // In a real scenario, you would verify the hash here using Web Crypto
    // and then update Supabase using the service role key.
    
    return new Response("Ok", { status: 200 });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}
