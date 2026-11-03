import { ImageResponse } from "next/og"

export const alt = "MartPoint for Oil & Gas — from the forecourt to the finance office"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: "64px 72px", background: "#EBF1FF", color: "#0A0F1C", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 25, fontWeight: 700 }}><span>MartPoint</span><span style={{ color: "#0057FF" }}>OIL & GAS OPERATIONS</span></div>
      <div style={{ display: "flex", flexDirection: "column" }}><div style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.1, letterSpacing: -2 }}>From the forecourt to the finance office.</div><div style={{ marginTop: 24, fontSize: 28, color: "#475569" }}>One clearer view of your operations.</div></div>
      <div style={{ display: "flex", gap: 16, fontSize: 20 }}><span style={{ padding: "14px 20px", background: "#0057FF", color: "white", borderRadius: 10 }}>Filling stations</span><span style={{ padding: "14px 20px", background: "white", borderRadius: 10 }}>LPG & CNG</span><span style={{ padding: "14px 20px", background: "white", borderRadius: 10 }}>Bulk trading & distribution</span></div>
    </div>,
    { ...size },
  )
}
