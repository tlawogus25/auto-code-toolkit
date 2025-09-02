import OpenAI from "openai";

export function makeOpenAI(apiKey) {
  if (!apiKey) throw new Error("OPENAI_API_KEY required");
  return new OpenAI({ apiKey });
}

// Return { text, usage }
export async function runOpenAI({ client, model, system, user, reasoning }) {
  const r = await client.responses.create({
    model,
    input: [{ role: "system", content: system }, { role: "user", content: user }],
    ...(reasoning ? { reasoning } : {})
  });
  const usage = r.usage || r.output?.[0]?.usage || null;
  const text = r.output_text || "";
  return { text, usage };
}
