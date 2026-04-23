import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const PAYNOW_INTEGRATION_ID = Deno.env.get("PAYNOW_INTEGRATION_ID") ?? "23885"
const PAYNOW_INTEGRATION_KEY = Deno.env.get("PAYNOW_INTEGRATION_KEY") ?? "5cb7aa17-d23a-4b81-838b-2fa9b59d2aa6"
const PAYNOW_URL = "https://www.paynow.co.zw/interface/remotetransaction"
const DEFAULT_RETURN_URL = Deno.env.get("PAYNOW_RETURN_URL") ?? "https://passit.app/dashboard"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log("Received request body:", JSON.stringify(body))

    const { subjectId, subjectTitle, userEmail, userId, phone, paymentMethod } = body

    if (!subjectId || !subjectTitle || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: subjectId, subjectTitle, userId" }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Prepare Paynow Data
    const amount = "10.00"
    const reference = `SUB-${subjectId}-${userId}-${Date.now()}`
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "https://swpzxpsisasfequdawjh.supabase.co"
    const resultUrl = `${supabaseUrl}/functions/v1/paynow-webhook`
    const returnUrl = DEFAULT_RETURN_URL

    console.log("Config:", { PAYNOW_INTEGRATION_ID, PAYNOW_URL, resultUrl, returnUrl })

    // Fields must be hashed in the order they are sent
    const fields: Array<[string, string]> = [
      ["resulturl", resultUrl],
      ["returnurl", returnUrl],
      ["reference", reference],
      ["amount", amount],
      ["id", PAYNOW_INTEGRATION_ID],
      ["additionalinfo", `Subscription for ${subjectTitle}`],
      ["authemail", userEmail || "customer@passit.app"],
    ]

    // Mobile money fields
    if (phone) fields.push(["phone", phone])
    if (phone && paymentMethod) fields.push(["method", paymentMethod])

    fields.push(["status", "Message"])

    // Generate Hash
    const hashString = fields.map(([, v]) => v).join("") + PAYNOW_INTEGRATION_KEY
    const hashBuffer = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(hashString))
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase()

    // Build form data
    const formData = new URLSearchParams()
    for (const [k, v] of fields) formData.append(k, v)
    formData.append("hash", hash)

    console.log("Calling Paynow at:", PAYNOW_URL)
    console.log("Form fields:", Object.fromEntries(formData))

    // Call Paynow - single attempt with longer timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

    try {
      const response = await fetch(PAYNOW_URL, {
        method: "POST",
        body: formData.toString(),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      const resultText = await response.text()
      console.log("Paynow response status:", response.status)
      console.log("Paynow response body:", resultText)

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: `Paynow HTTP ${response.status}: ${resultText.slice(0, 300)}` }),
          { status: 502, headers: corsHeaders }
        )
      }

      const resultParams = new URLSearchParams(resultText)

      if (resultParams.get("status") !== "Ok") {
        const paynowError = resultParams.get("error") || resultParams.get("message") || resultText
        return new Response(
          JSON.stringify({ error: `Paynow error: ${paynowError}` }),
          { status: 400, headers: corsHeaders }
        )
      }

      return new Response(
        JSON.stringify({
          pollUrl: resultParams.get("pollurl"),
          instructions: resultParams.get("instructions"),
          browserUrl: resultParams.get("browserurl"),
          status: "Ok"
        }),
        { status: 200, headers: corsHeaders }
      )

    } catch (fetchError) {
      clearTimeout(timeoutId)
      const msg = fetchError instanceof Error ? fetchError.message : String(fetchError)
      console.error("Paynow fetch failed:", msg)
      return new Response(
        JSON.stringify({ error: `Cannot reach Paynow: ${msg}` }),
        { status: 502, headers: corsHeaders }
      )
    }

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("initiate-payment error:", msg)
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: corsHeaders }
    )
  }
})
