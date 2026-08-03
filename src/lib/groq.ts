import Groq from "groq-sdk"

export function getGroqClient(apiKey: string | null | undefined): Groq {
  if (!apiKey) {
    throw new Error("Groq API Key is missing. Please add it in Settings.")
  }

  return new Groq({ apiKey })
}

export async function classifyPost(
  groq: Groq,
  keyword: string,
  postContent: string,
  systemPrompt: string
): Promise<boolean> {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: systemPrompt || "You are a lead classifier. Determine if this Facebook post is genuinely looking for the service related to the provided keywords. Respond ONLY with valid JSON: {\"relevant\": true/false}",
        },
        {
          role: "user",
          content: `Keyword: ${keyword}\n\nPost: ${postContent}`,
        },
      ],
      temperature: 0,
      max_tokens: 100,
      response_format: { type: "json_object" },
    })

    const result = JSON.parse(completion.choices[0]?.message?.content || "{}")
    return !!result.relevant
  } catch (error) {
    console.error("Groq classification failed:", error)
    return false
  }
}
