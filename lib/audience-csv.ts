/** CSV/TSV parsing shared by the import preview and tests; no server dependencies. */
export function parseAudienceCsv(raw: string): string[][] {
  const source = raw.replace(/^\uFEFF/, "")
  const firstLine = source.split(/\r?\n/, 1)[0]
  const delimiter = firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ","
  const rows: string[][] = []
  let row: string[] = [], cell = "", quoted = false
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++ }
      else if (quoted || !cell) quoted = !quoted
      else throw new Error("Unexpected quote in CSV. Quote the entire field when it contains quotes.")
    } else if (char === delimiter && !quoted) { row.push(cell.trim()); cell = "" }
    else if ((char === "\n" || char === "\r") && !quoted) {
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row)
      row = []; cell = ""
      if (char === "\r" && source[i + 1] === "\n") i++
    } else cell += char
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted field.")
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row)
  if (rows.length > 5001) throw new Error("Import up to 5,000 contacts at a time.")
  return rows
}
export interface ImportedContact { email: string; name: string }
export interface ImportedPhoneContact { phone: string; name: string }
export function mapAudiencePhoneRows(rows: string[][], phoneColumn: number, nameColumn: number, lastNameColumn = -1, hasHeader = true) {
  const contacts: ImportedPhoneContact[] = [], invalid: number[] = []
  const seen = new Set<string>()
  let duplicates = 0
  rows.slice(hasHeader ? 1 : 0).forEach((row, i) => {
    const raw = (row[phoneColumn] || "").trim()
    if (!raw) return
    const digits = raw.replace(/[\s().-]/g, "")
    const phone = /^0\d{10}$/.test(digits) ? `+234${digits.slice(1)}` : /^234\d{10}$/.test(digits) ? `+${digits}` : digits
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) { invalid.push(i + (hasHeader ? 2 : 1)); return }
    if (seen.has(phone)) { duplicates++; return }
    seen.add(phone)
    contacts.push({ phone, name: [row[nameColumn], row[lastNameColumn]].filter(Boolean).join(" ").trim().slice(0, 250) })
  })
  return { contacts, invalid, duplicates }
}
export function mapAudienceRows(rows: string[][], emailColumn: number, nameColumn: number, lastNameColumn = -1, hasHeader = true) {
  const contacts: ImportedContact[] = [], invalid: number[] = []
  const seen = new Set<string>()
  let duplicates = 0
  rows.slice(hasHeader ? 1 : 0).forEach((row, i) => {
    const email = (row[emailColumn] || "").trim().toLowerCase()
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) { invalid.push(i + (hasHeader ? 2 : 1)); return }
    if (seen.has(email)) { duplicates++; return }
    seen.add(email)
    contacts.push({ email, name: [row[nameColumn], row[lastNameColumn]].filter(Boolean).join(" ").trim().slice(0, 250) })
  })
  return { contacts, invalid, duplicates }
}
