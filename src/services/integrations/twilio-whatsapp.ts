export async function sendWhatsApp(to:string, body:string) {
  if (process.env.TWILIO_ENABLED !== "true") return { ok:false, status:"NOT_CONFIGURED" as const };
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) return { ok:false, status:"NOT_CONFIGURED" as const };
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method:"POST",
    headers:{ Authorization:`Basic ${auth}`, "Content-Type":"application/x-www-form-urlencoded" },
    body:new URLSearchParams({ From:`whatsapp:${from}`, To:`whatsapp:${to}`, Body:body })
  });
  return { ok:response.ok, status:response.ok ? "SENT" : "FAILED" };
}
