/** Internal evidence belongs in staff review, not visitor chat responses. */
export function visitorChatRecord<T extends Record<string, unknown>>(record: T): Omit<T, "metadata" | "knowledge_refs" | "sources"> {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => !["metadata", "knowledge_refs", "sources"].includes(key)),
  ) as Omit<T, "metadata" | "knowledge_refs" | "sources">
}

export const AZERA_CUSTOMER_REPLY_STYLE = "Answer the customer's question directly. Do not narrate thinking, searching, checking guides, reading documents, processing, or consulting a knowledge base. Do not add source lists, internal article titles, reference IDs, numbered evidence citations, or 'Based on' footers. These references are internal evidence, not customer-facing content. Include a useful customer-facing link only when it helps the customer take action. If you cannot confirm a fact, explain that briefly in plain language without mentioning approved knowledge, missing references, or internal tools."
