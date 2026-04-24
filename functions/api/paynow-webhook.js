import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const formData = await request.formData();
    
    const reference = formData.get("reference");
    const amount = formData.get("amount") || "";
    const paynowReference = formData.get("paynowreference") || "";
    const status = formData.get("status");
    const pollUrl = formData.get("pollurl") || "";
    const hash = formData.get("hash");

    if (!reference || !status || !hash) {
      return new Response("Invalid data", { status: 400 });
    }

    // Verify Hash
    const PAYNOW_INTEGRATION_KEY = env.PAYNOW_INTEGRATION_KEY;
    const hashString = reference + amount + paynowReference + status + pollUrl + PAYNOW_INTEGRATION_KEY;
    
    const buf = new TextEncoder().encode(hashString);
    const hashBuf = await crypto.subtle.digest("SHA-512", buf);
    const calculatedHash = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    if (calculatedHash !== hash.toUpperCase()) {
      console.error(`Hash mismatch. Expected ${calculatedHash}, got ${hash}`);
      return new Response("Hash mismatch", { status: 400 });
    }

    // Process success
    if (status === "Paid" || status === "Awaiting Delivery") {
      if (reference.startsWith("SUB_")) {
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

          if (subError) console.error("Webhook subscription update error:", subError);

          // Update Profile
          await supabase
            .from('profiles')
            .update({ has_active_subscription: true })
            .eq('id', userId);
          
          console.log(`Payment confirmed via webhook for user ${userId}, subject ${subjectId}`);
        }
      }
    }
    
    return new Response("Ok", { status: 200 });
  } catch (err) {
    console.error("Webhook processing error:", err.message);
    return new Response(err.message, { status: 500 });
  }
}
