import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const PAYNOW_INTEGRATION_ID = Deno.env.get("PAYNOW_INTEGRATION_ID") ?? "23885"
const PAYNOW_INTEGRATION_KEY = Deno.env.get("PAYNOW_INTEGRATION_KEY") ?? "5cb7aa17-d23a-4b81-838b-2fa9b59d2aa6"
const PAYNOW_URL = "https://www.paynow.co.zw/interface/initiatetransaction"
const DEFAULT_RETURN_URL = Deno.env.get("PAYNOW_RETURN_URL") ?? "https://passit.app/dashboard"

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { subjectId, subjectTitle, userEmail, userId, phone, paymentMethod } = await req.json()

    // 1. Prepare Paynow Data (Explicit order for hashing)
    const amount = "10.00"
    const reference = `SUB-${subjectId}-${userId}-${Date.now()}`
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    if (!supabaseUrl) {
      throw new Error("Missing SUPABASE_URL in Edge Function env")
    }
    const resultUrl = `${supabaseUrl}/functions/v1/paynow-webhook`
    const returnUrl = DEFAULT_RETURN_URL

    // Fields must be hashed in the order they are sent
    const fields: Array<[string, string]> = [
      ["resulturl", resultUrl],
      ["returnurl", returnUrl],
      ["reference", reference],
      ["amount", amount],
      ["id", PAYNOW_INTEGRATION_ID],
      ["additionalinfo", `Subscription for ${subjectTitle}`],
      ["authemail", userEmail],
    ]

    // Mobile money fields (Paynow expects these only for express checkout)
    if (phone) fields.push(["phone", phone])
    if (phone && paymentMethod) fields.push(["method", paymentMethod]) // ecocash, onemoney, telecash

    fields.push(["status", "Message"])
    fields.push(["currency", "USD"]) // Explicitly USD

    // 2. Generate Hash
    const hashString = fields.map(([, v]) => v).join("") + PAYNOW_INTEGRATION_KEY
    
    const hashBuffer = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(hashString))
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase()

    // 3. Call Paynow
    const formData = new URLSearchParams()
    for (const [k, v] of fields) formData.append(k, v)
    formData.append("hash", hash)

    let response: Response | null = null
    let lastNetworkError: unknown = null

    // Paynow occasionally resets connections; retry briefly.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await fetch(PAYNOW_URL, {
          method: "POST",
          body: formData,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "text/plain, */*",
            "User-Agent": "PassIt-Supabase-EdgeFunction/1.0",
          },
        })
        break
      } catch (e) {
        lastNetworkError = e
        // 250ms, 750ms, 1750ms
        await sleep(250 + attempt * attempt * 500)
      }
    }

    if (!response) {
      const msg = lastNetworkError instanceof Error ? lastNetworkError.message : String(lastNetworkError)
      return new Response(
        JSON.stringify({
          error: `Paynow is temporarily unreachable. Please try again in a minute. (${msg})`,
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const resultText = await response.text()
    if (!response.ok) {
      throw new Error(`Paynow HTTP ${response.status}: ${resultText.slice(0, 500)}`)
    }
    const resultParams = new URLSearchParams(resultText)

    if (resultParams.get("status") !== "Ok") {
      const paynowError = resultParams.get("error") || resultParams.get("message") || resultText
      throw new Error(`Paynow initiation failed: ${paynowError}`)
    }

    return new Response(
      JSON.stringify({
        pollUrl: resultParams.get("pollurl"),
        instructions: resultParams.get("instructions"),
        status: "Ok"
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("initiate-payment error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
