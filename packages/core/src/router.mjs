export function pickLLMAndAgent({ userDemand, planOnly, tools, preferFast = false }) {
  const wantsJSON = /JSON|스키마|schema|structured/i.test(userDemand);
  const long = userDemand.length > 1500 && !preferFast;
  const llm = wantsJSON ? "gemini" : "openai";
  const model = wantsJSON
    ? (long ? tools.gemini.heavy : tools.gemini.default)
    : (long ? tools.openai.heavy : tools.openai.default);
  let agent = "claude";
  if (wantsJSON) agent = "cursor";
  if (planOnly) agent = "none";
  return { llm, model, agent };
}
