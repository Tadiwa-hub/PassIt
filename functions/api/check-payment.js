import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    // If paid, update the database
    if (status === "Paid" || status === "Awaiting Delivery") {
      const reference = params.get("reference");
      if (reference && reference.startsWith("SUB_")) {
        const parts = reference.split("_");
        const subjectId = parts[1];
        const userId = parts[2];

        if (subjectId && userId) {
          const supabase = createClient(
            env.SUPABASE_URL,
            env.SUPABASE_SERVICE_ROLE_KEY
          );

          // Update Subscription
          const { error: subError } = await supabase
            .from('user_subscriptions')
            .upsert({ 
              user_id: userId, 
              subject_id: subjectId, 
              active: true,
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id, subject_id' });

          if (subError) console.error("Subscription update error:", subError);

          // Update Profile
          await supabase
            .from('profiles')
            .update({ has_active_subscription: true })
            .eq('id', userId);
        }
      }
    }
    
    return new Response(text, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
