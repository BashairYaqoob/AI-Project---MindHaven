import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTRACT_PROMPT = `You extract durable facts about the user from a chat transcript.
Return ONLY a JSON object merging prior memory with any NEW stable facts (name, age, gender, occupation, relationships, hobbies, recurring stressors, goals, preferences, important dates, emotional patterns).
Do not store transient feelings, one-off events, or anything sensitive that wasn't volunteered.
Keep keys snake_case. Keep values short. Drop anything uncertain.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { messages, memory } = await req.json();
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");

    const transcript = (messages ?? [])
      .slice(-20)
      .map((m: any) => `${m.role}: ${m.content}`)
      .join("\n");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: EXTRACT_PROMPT },
          {
            role: "user",
            content: `Existing memory:\n${JSON.stringify(memory ?? {}, null, 2)}\n\nTranscript:\n${transcript}\n\nReturn updated memory JSON only.`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("memory ai err", resp.status, t);
      return new Response(JSON.stringify({ memory: memory ?? {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { parsed = memory ?? {}; }
    return new Response(JSON.stringify({ memory: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});