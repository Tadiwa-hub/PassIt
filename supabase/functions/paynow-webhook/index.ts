import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const PAYNOW_INTEGRATION_KEY = "5cb7aa17-d23a-4b81-838b-2fa9b59d2aa6"

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200 })
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const data = await req.formData()

    // 1. Verify Hash (Order: reference + amount + paynowreference + status + pollurl + key)
    const reference = data.get('reference')
    const amount = data.get('amount')
    const paynowRef = data.get('paynowreference')
    const status = data.get('status')
    const pollUrl = data.get('pollurl')
    const hash = data.get('hash')

    if (!reference || !status || !hash) {
      throw new Error('Invalid webhook data')
    }

    const hashString = reference + (amount || '') + (paynowRef || '') + status + (pollUrl || '') + PAYNOW_INTEGRATION_KEY
    
    const hashBuffer = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(hashString))
    const calculatedHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()

    if (calculatedHash !== hash) {
      console.error(`Hash mismatch. Expected ${calculatedHash}, got ${hash}`)
      throw new Error('Hash mismatch')
    }

    // 2. Process Success
    if (status === 'Paid' || status === 'Awaiting Delivery') {
      const parts = reference.split('-')
      const subjectId = parts[1]
      const userId = parts[2]

      // Upsert Subscription
      const { error: subError } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: userId,
          subject_id: subjectId,
          active: true,
          updated_at: new Date().toISOString()
        })
      
      if (subError) throw subError

      // Update Profile Premium Status
      await supabase
        .from('profiles')
        .update({ has_active_subscription: true })
        .eq('id', userId)

      console.log(`Successfully activated subscription for user ${userId} on subject ${subjectId}`)
    }

    return new Response('Ok', { status: 200 })

  } catch (error) {
    console.error('Webhook Error:', error.message)
    return new Response(error.message, { status: 400 })
  }
})
