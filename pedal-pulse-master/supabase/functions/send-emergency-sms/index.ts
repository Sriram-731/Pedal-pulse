import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER")!;

serve(async (req) => {
    try {
        const { to, body } = await req.json();

        if (!to || !body) {
            return new Response(JSON.stringify({ error: "Missing 'to' or 'body'" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Send SMS via Twilio REST API
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
        const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

        const formData = new URLSearchParams({
            To: to,
            From: TWILIO_PHONE_NUMBER,
            Body: body,
        });

        const response = await fetch(twilioUrl, {
            method: "POST",
            headers: {
                Authorization: `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: formData.toString(),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error("Twilio error:", result);
            return new Response(JSON.stringify({ error: result.message }), {
                status: response.status,
                headers: { "Content-Type": "application/json" },
            });
        }

        return new Response(
            JSON.stringify({ success: true, sid: result.sid }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("Edge function error:", err);
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});
