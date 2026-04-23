import crypto from 'crypto';

const PAYNOW_INTEGRATION_ID = process.env.PAYNOW_INTEGRATION_ID;
const PAYNOW_INTEGRATION_KEY = process.env.PAYNOW_INTEGRATION_KEY;
const PAYNOW_URL = "https://www.paynow.co.zw/interface/remotetransaction";

function sha512UpperHex(input) {
  return crypto.createHash("sha512").update(input, "utf8").digest("hex").toUpperCase();
}

async function testPaynow() {
  const fields = [
    ["resulturl", "https://passit.app/api/webhook"],
    ["returnurl", "https://passit.app/dashboard"],
    ["reference", `TEST_${Date.now()}`],
    ["amount", "10.00"],
    ["id", PAYNOW_INTEGRATION_ID],
    ["additionalinfo", "Test Payment"],
    ["authemail", "test@example.com"],
    ["status", "Message"]
  ];

  const hashString = fields.map(([, v]) => v).join("") + PAYNOW_INTEGRATION_KEY;
  const hash = sha512UpperHex(hashString);
  
  const formData = new URLSearchParams();
  for (const [k, v] of fields) formData.append(k, v);
  formData.append("hash", hash);

  const res = await fetch(PAYNOW_URL, {
    method: "POST",
    body: formData,
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });

  const text = await res.text();
  console.log(text);
}

testPaynow();
