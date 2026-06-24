import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import OpenAI from "openai"
import fs from "fs"
import path from "path"

function getOpenAiKey(): string | undefined {
  try {
    const settingsPath = path.join(process.cwd(), "data", "settings.json")
    if (fs.existsSync(settingsPath)) {
      const data = JSON.parse(fs.readFileSync(settingsPath, "utf-8"))
      if (data.openai?.apiKey) return data.openai.apiKey
    }
  } catch {
    // ignore
  }
  return process.env.OPENAI_API_KEY
}

export async function POST(request: Request) {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const apiKey = getOpenAiKey()
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key not configured. Add it in Settings > OpenAI or via OPENAI_API_KEY env variable." }, { status: 500 })
  }

  const openai = new OpenAI({ apiKey })

  try {
    const body = await request.json()
    const { type, topic, content } = body

    let prompt = ""
    let systemPrompt = "You are an expert SEO, AEO (Answer Engine Optimization), and GEO (Generative Engine Optimization) content strategist for a Nigerian retail software company called MartPoint. You write compelling, authoritative blog content."

    switch (type) {
      case "full_post":
        prompt = `Write a comprehensive, SEO-optimized blog post about: "${topic || "retail management software for Nigerian businesses"}".

Requirements:
- Write 800-1200 words of high-quality, engaging content
- Use H2 and H3 headings with proper hierarchy
- Include bullet points and numbered lists where relevant
- Naturally weave in keywords: POS software Nigeria, inventory management, retail software, supermarket POS, pharmacy POS, stock control, MartPoint
- Include a compelling introduction that hooks the reader
- End with a strong call-to-action encouraging readers to try MartPoint
- Make it informative, practical, and actionable
- Target Nigerian business owners and retail managers
- Return ONLY the HTML body content (no <html>, <head>, or <body> tags, just the content elements like <h2>, <p>, <ul>, etc.)`
        break

      case "excerpt":
        prompt = `Create a compelling 2-3 sentence excerpt/summary for this blog post content:

"""${content || topic}"""

The excerpt should:
- Hook the reader and make them want to read more
- Be between 120-160 characters
- Include relevant keywords naturally
- Focus on the value proposition for the reader`
        systemPrompt = "You are a copywriting expert. Return only the excerpt text, no formatting."
        break

      case "seo":
        prompt = `Based on this blog post content/topic:
"""${content || topic}"""

Generate:
1. A meta description (150-160 characters) optimized for Google search results
2. A comma-separated list of 10-15 SEO keywords targeting Nigerian retail business owners

Return in this exact format:
META_DESCRIPTION: [description]
KEYWORDS: [keyword1, keyword2, ...]`
        systemPrompt = "You are an SEO expert. Follow the exact output format."
        break

      case "aeo":
        prompt = `Optimize the following blog content for Answer Engine Optimization (AEO). AEO targets featured snippets, voice search, and direct answers in Google.

Original content:
"""${content || topic}"""

Requirements:
- Add FAQ sections with clear Q&A format
- Use "People Also Ask" style questions and concise answers
- Add structured lists and tables where relevant
- Include direct, authoritative answers to common questions
- Use definition-style paragraphs for key concepts
- Keep answers concise (40-60 words for snippet optimization)
- Return ONLY the optimized HTML content (no wrapper tags)`
        break

      case "geo":
        prompt = `Optimize the following blog content for Generative Engine Optimization (GEO). GEO targets AI search engines like ChatGPT, Perplexity, and Gemini.

Original content:
"""${content || topic}"""

Requirements:
- Strengthen authority signals with clear expertise statements
- Add structured data-like formatting (clear sections, summaries)
- Include "Key Takeaways" summary box at the top
- Add citations/references where appropriate
- Use clear, factual language that AI can easily extract
- Include "According to..." statements for credibility
- Structure with clear problem-solution frameworks
- Return ONLY the optimized HTML content (no wrapper tags)`
        break

      default:
        return NextResponse.json({ error: "Invalid generation type" }, { status: 400 })
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2500,
    })

    const result = completion.choices[0]?.message?.content?.trim() || ""

    let response: Record<string, string> = {}

    switch (type) {
      case "full_post":
        response = { content: result }
        break
      case "excerpt":
        response = { excerpt: result }
        break
      case "seo": {
        const metaMatch = result.match(/META_DESCRIPTION:\s*([\s\S]+?)(?=\nKEYWORDS:|$)/)
        const keywordsMatch = result.match(/KEYWORDS:\s*([\s\S]+)/)
        response = {
          metaDescription: metaMatch?.[1]?.trim() || "",
          keywords: keywordsMatch?.[1]?.trim() || "",
        }
        break
      }
      case "aeo":
      case "geo":
        response = { content: result }
        break
    }

    return NextResponse.json({ success: true, result: response })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "OpenAI request failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
