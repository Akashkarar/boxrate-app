import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EXTRACTION_PROMPT = `You are reading a handwritten or printed box measurement sheet from a packaging business. Each row on the sheet lists, in order: height, length, width (all in inches), number of boxes, whether it includes an acrylic/plastic sheet on top, a color, and sometimes a short description or note (e.g. what the box is for, like "silver glasses").

Return ONLY a raw JSON array (no markdown code fences, no explanation text before or after), where each element has exactly this shape:
{"height": number, "length": number, "width": number, "qty": number, "has_acrylic": boolean, "color": string|null, "description": string|null}

Number notation — read this carefully:
On these sheets, a double comma (,,) written directly after a number means "add half (0.5)" to that number. This is a shorthand the business uses instead of writing a decimal point. Examples:
- "5,," means 5.5
- "5.5,," means 6 (5.5 + 0.5)
- "7,," means 7.5
- A plain number with no ,, after it (e.g. "5") stays exactly as written — do not add anything.
Apply this to height, length, and width wherever ,, appears after a number. It normally will not appear after quantity.

Acrylic notation — read this carefully:
A single letter "P" written in or near a row (often in its own column, sometimes just marked next to the row) means that row includes an acrylic/plastic sheet on top — set has_acrylic to true for that row. The word "acrylic" or "plastic" spelled out, or a checkmark/tick in an acrylic column, also counts. If there's no "P", no acrylic/plastic word, and no mark in that column, has_acrylic is false. Do not confuse a "P" with other letters — only a clear P counts.

Description:
If a row has any handwritten note, label, or short phrase describing what the box is for (separate from the dimensions/qty/acrylic/color), put it in "description" exactly as written (cleaned up for spelling if clearly a typo). If there's no such note for a row, use null. Do not invent a description — only use one if something is actually written.

Other rules:
- height, length, width, qty must be numbers (qty defaults to 1 if not written).
- color should be one of "Blue", "Maroon", "Red" if you can tell, otherwise null.
- If a value is smudged or ambiguous, make your best reasonable guess rather than skipping the row — a human will verify every value afterward.
- Output every row you can find, top to bottom, left to right.
- Do not include any row that has no numeric dimensions at all (e.g. a header row).`;

// Google retires Gemini model versions periodically. If this ever starts failing again,
// check https://ai.google.dev/gemini-api/docs/models for the current recommended
// low-cost multimodal model and swap it in below.
const GEMINI_MODEL = "gemini-3.5-flash-lite";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestStart = Date.now();

  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageSizeKB = Math.round((imageBase64.length * 0.75) / 1024);
    console.log(`extract-boxes: incoming image ~${imageSizeKB}KB`);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "Server is missing GEMINI_API_KEY. Set it in Supabase Edge Function secrets.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const geminiStart = Date.now();
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: EXTRACTION_PROMPT },
                {
                  inline_data: {
                    mime_type: mimeType || "image/jpeg",
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.1 },
        }),
      },
    );
    const geminiMs = Date.now() - geminiStart;
    console.log(
      `extract-boxes: Gemini responded in ${geminiMs}ms (status ${geminiRes.status})`,
    );

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      const message = geminiData?.error?.message || "Gemini API error";
      return new Response(
        JSON.stringify({ error: message, details: geminiData }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let rows;
    try {
      rows = JSON.parse(cleaned);
    } catch (_e) {
      return new Response(
        JSON.stringify({
          error: "Could not parse extraction result",
          raw: text,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const totalMs = Date.now() - requestStart;
    console.log(
      `extract-boxes: done in ${totalMs}ms total (${rows.length} rows)`,
    );

    return new Response(JSON.stringify({ rows }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.log(
      `extract-boxes: failed after ${Date.now() - requestStart}ms — ${String(err)}`,
    );
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
