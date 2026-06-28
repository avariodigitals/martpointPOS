"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Save, Settings, Wand2, MousePointerClick } from "lucide-react"

interface GeneralSettings {
  contactEmail: string
  whatsappNumber: string
  companyName: string
}

interface OpenAISettings {
  apiKey: string
}

interface SocialSettings {
  facebook: string
  instagram: string
  twitter: string
  linkedin: string
}

interface SearchConsoleSettings {
  verificationCode: string
}

interface PopupSettings {
  enabled: boolean
  trigger: "mouseleave" | "timer" | "both"
  delaySeconds: number
  maxShowsPerSession: number
  title: string
  priceText: string
  priceSubtext: string
  ctaText: string
  ctaLink: string
}

interface HeaderSettings {
  logo: string
  favicon: string
  ctaText: string
  ctaLink: string
  secondaryCtaText: string
  secondaryCtaLink: string
}

interface FooterSettings {
  logo: string
  description: string
  copyrightText: string
  tagline: string
}

interface PricingPlan {
  name: string
  price: string
  period: string
  badge: string
  description: string
  features: string
  branchesIncluded: number
  usersIncluded: number
  branchAddonPrice: string
  supportRenewal?: string
  ctaText: string
  ctaLink: string
}

interface PricingSettings {
  cloud: PricingPlan
  offline: PricingPlan
  erp: PricingPlan[]
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<GeneralSettings>({
    contactEmail: "",
    whatsappNumber: "",
    companyName: "",
  })
  const [social, setSocial] = useState<SocialSettings>({
    facebook: "",
    instagram: "",
    twitter: "",
    linkedin: "",
  })
  const [searchConsole, setSearchConsole] = useState<SearchConsoleSettings>({
    verificationCode: "",
  })
  const [openai, setOpenai] = useState<OpenAISettings>({
    apiKey: "",
  })
  const [popup, setPopup] = useState<PopupSettings>({
    enabled: true,
    trigger: "mouseleave",
    delaySeconds: 0,
    maxShowsPerSession: 1,
    title: "Start With MartPoint Retail Cloud",
    priceText: "₦99,999 / Year",
    priceSubtext: "Everything you need to run a modern retail business.",
    ctaText: "Get Started on WhatsApp",
    ctaLink: "https://wa.me/+2348036028069",
  })
  const [header, setHeader] = useState<HeaderSettings>({
    logo: "/logo.webp",
    favicon: "/icon.webp",
    ctaText: "Book Demo",
    ctaLink: "https://wa.me/+2348036028069",
    secondaryCtaText: "Request Quote",
    secondaryCtaLink: "https://wa.me/+2348036028069",
  })
  const [footer, setFooter] = useState<FooterSettings>({
    logo: "/logo.webp",
    description: "MartPoint helps businesses track sales, manage inventory, monitor staff and make better decisions with real-time insights.",
    copyrightText: "MartPoint. All rights reserved.",
    tagline: "Built for African businesses.",
  })
  const [pricing, setPricing] = useState<PricingSettings>({
    cloud: {
      name: "MartPoint Retail Cloud",
      price: "₦99,999",
      period: "/ Year",
      badge: "Most Popular",
      description: "Everything you need to run a modern retail business.",
      features: "POS Sales & Checkout\nInventory & Stock Control\nOnline Store\nWhatsApp Ordering & Invoice\nQR Menu Ordering\nPayment Links\nPayPlan™ Installment Plans\nLoyalty & Rewards\nCustomer Verification\nCollections Tracking\nAttendance (Face Capture)\nDaily Report\nMartpoint Assist\nTraining & Onboarding\nMobile & Desktop Access",
      branchesIncluded: 1,
      usersIncluded: 5,
      branchAddonPrice: "₦49,999 / Year",
      ctaText: "Get Started",
      ctaLink: "https://wa.me/+2348036028069",
    },
    offline: {
      name: "MartPoint Retail Offline",
      price: "₦250,000",
      period: "One-Time Payment",
      badge: "One-Time",
      description: "Full software with offline capability installed locally. Maintenance and License Renewal. Works without internet.",
      features: "POS Sales & Checkout\nInventory & Stock Control\nReceipt Printing\nBarcode & SKU Management\nCustomer & Supplier Records\nStaff Attendance (Face Capture)\nDaily Sales Report\nMulti-Branch (LAN Connected)\nOffline-First Sync\nLocal Installation\nStaff Setup & Training\nNo Recurring Fees",
      branchesIncluded: 1,
      usersIncluded: 5,
      branchAddonPrice: "₦100,000 One-Time",
      supportRenewal: "₦50,000 / Year",
      ctaText: "Request Offline Setup",
      ctaLink: "https://wa.me/+2348036028069",
    },
    erp: [
      {
        name: "Growth",
        price: "₦85,000",
        period: "/ month",
        badge: "",
        description: "For SMEs ready to systematize operations",
        features: "Up to 20 employees\nAccounting module\nProcurement module\nBasic HR & CRM\nStandard reports\nEmail support",
        branchesIncluded: 1,
        usersIncluded: 5,
        branchAddonPrice: "",
        ctaText: "Get Started",
        ctaLink: "https://wa.me/+2348036028069",
      },
      {
        name: "Scale",
        price: "₦180,000",
        period: "/ month",
        badge: "Most Popular",
        description: "For multi-department businesses",
        features: "Up to 100 employees\nFull accounting suite\nAdvanced procurement\nManufacturing module\nHR, CRM & approvals\nCustom reports\nPriority support",
        branchesIncluded: 1,
        usersIncluded: 10,
        branchAddonPrice: "",
        ctaText: "Get Started",
        ctaLink: "https://wa.me/+2348036028069",
      },
      {
        name: "Corporate",
        price: "Custom",
        period: "",
        badge: "Enterprise",
        description: "For enterprises with complex needs",
        features: "Unlimited employees\nAll modules included\nCustom workflows\nAPI access\nWhite-label options\nDedicated support team",
        branchesIncluded: 0,
        usersIncluded: 0,
        branchAddonPrice: "",
        ctaText: "Request Quote",
        ctaLink: "/request-quote",
      },
    ],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [uploading, setUploading] = useState<{ header: boolean; footer: boolean }>({ header: false, footer: false })
  const [message, setMessage] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.general) setSettings(data.general)
        if (data.social) setSocial(data.social)
        if (data.searchConsole) setSearchConsole(data.searchConsole)
        if (data.openai) setOpenai(data.openai)
        if (data.popup) setPopup(data.popup)
        if (data.header) setHeader(data.header)
        if (data.footer) setFooter(data.footer)
        if (data.pricing) {
          setPricing((prev) => ({
            cloud: {
              ...prev.cloud,
              ...data.pricing.cloud,
              features: Array.isArray(data.pricing.cloud.features)
                ? data.pricing.cloud.features.join("\n")
                : data.pricing.cloud.features || prev.cloud.features,
            },
            offline: {
              ...prev.offline,
              ...data.pricing.offline,
              features: Array.isArray(data.pricing.offline.features)
                ? data.pricing.offline.features.join("\n")
                : data.pricing.offline.features || prev.offline.features,
            },
            erp: Array.isArray(data.pricing.erp)
              ? data.pricing.erp.map((plan: PricingPlan, i: number) => ({
                  ...(prev.erp[i] || plan),
                  ...plan,
                  features: Array.isArray(plan.features)
                    ? plan.features.join("\n")
                    : plan.features || (prev.erp[i]?.features ?? ""),
                }))
              : prev.erp,
          }))
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function doSave(section: string, body: Record<string, unknown>) {
    setSaving((prev) => ({ ...prev, [section]: true }))
    setMessage((prev) => ({ ...prev, [section]: "" }))

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      console.log("[doSave] Sending POST to /api/admin/settings", Object.keys(body))
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      let data: Record<string, unknown> = {}
      const text = await res.text()
      try {
        data = JSON.parse(text)
      } catch {
        console.error("Non-JSON response:", text.slice(0, 500))
        const errMsg = `Server error (${res.status}). Check console for details.`
        setMessage((prev) => ({ ...prev, [section]: errMsg }))
        window.alert(errMsg)
        setSaving((prev) => ({ ...prev, [section]: false }))
        return
      }

      if (res.ok && data.success) {
        setMessage((prev) => ({ ...prev, [section]: "Settings saved successfully." }))
      } else {
        const errorMsg = (data.error as string) || `Failed to save (${res.status}).`
        console.error("Save error:", errorMsg, data)
        setMessage((prev) => ({ ...prev, [section]: errorMsg }))
        window.alert(errorMsg)
      }
    } catch (err) {
      clearTimeout(timeoutId)
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error("Network or unexpected error:", err)
      const displayMsg = errMsg.includes("abort") || errMsg.includes("Abort")
        ? "Request timed out. The server took too long to respond."
        : "Network error. Check your connection and try again."
      setMessage((prev) => ({ ...prev, [section]: displayMsg }))
      window.alert(displayMsg)
    } finally {
      setSaving((prev) => ({ ...prev, [section]: false }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("[handleSubmit] Save All clicked")
    await doSave("all", {
      general: settings,
      social,
      searchConsole,
      openai,
      popup,
      header,
      footer,
      pricing: {
        cloud: { ...pricing.cloud, features: pricing.cloud.features.split("\n").map((f) => f.trim()).filter(Boolean) },
        offline: { ...pricing.offline, features: pricing.offline.features.split("\n").map((f) => f.trim()).filter(Boolean) },
        erp: pricing.erp.map((plan) => ({ ...plan, features: plan.features.split("\n").map((f) => f.trim()).filter(Boolean) })),
      },
    })
  }

  const uploadLogo = async (file: File, type: "header" | "footer", field: "logo" | "favicon" = "logo") => {
    if (!file) return
    setUploading((prev) => ({ ...prev, [type]: true }))
    setMessage((prev) => ({ ...prev, [type]: "" }))

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", "branding")

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()

      if (data.success) {
        if (type === "header") {
          setHeader((prev) => ({ ...prev, [field]: data.url }))
        } else {
          setFooter((prev) => ({ ...prev, logo: data.url }))
        }
        setMessage((prev) => ({ ...prev, [type]: `${field === "favicon" ? "Favicon" : "Logo"} uploaded successfully.` }))
      } else {
        setMessage((prev) => ({ ...prev, [type]: data.error || `Failed to upload ${field === "favicon" ? "favicon" : "logo"}.` }))
      }
    } catch {
      setMessage((prev) => ({ ...prev, [type]: `Failed to upload ${field === "favicon" ? "favicon" : "logo"}.` }))
    } finally {
      setUploading((prev) => ({ ...prev, [type]: false }))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5" />
          General Settings
        </h2>
        <p className="text-muted-foreground">Update contact details and site identity.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>Used across forms and CTAs on the site.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Company Name</label>
                <input
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="MartPoint"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Contact Email</label>
                <input
                  type="email"
                  value={settings.contactEmail}
                  onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="hello@martpoint.com.ng"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">WhatsApp Number</label>
                <input
                  type="text"
                  value={settings.whatsappNumber}
                  onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="+2348036028069"
                />
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex items-center justify-end gap-3 flex-wrap">
              {message.general && (
                <span className={`text-sm px-2 py-1 rounded ${message.general.includes("success") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                  {message.general}
                </span>
              )}
              <Button type="button" onClick={() => doSave("general", { general: settings })} disabled={saving["general"]}>
                {saving["general"] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Contact
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Social Media Links</CardTitle>
              <CardDescription>Links to your social media profiles displayed in the footer.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Facebook URL</label>
                <input
                  type="url"
                  value={social.facebook}
                  onChange={(e) => setSocial({ ...social, facebook: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="https://facebook.com/martpoint.ng"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Instagram URL</label>
                <input
                  type="url"
                  value={social.instagram}
                  onChange={(e) => setSocial({ ...social, instagram: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="https://instagram.com/martpoint.ng"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Twitter / X URL</label>
                <input
                  type="url"
                  value={social.twitter}
                  onChange={(e) => setSocial({ ...social, twitter: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="https://x.com/martpointng"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">LinkedIn URL</label>
                <input
                  type="url"
                  value={social.linkedin}
                  onChange={(e) => setSocial({ ...social, linkedin: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="https://linkedin.com/company/martpoint"
                />
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex items-center justify-end gap-3 flex-wrap">
              {message.social && (
                <span className={`text-sm px-2 py-1 rounded ${message.social.includes("success") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                  {message.social}
                </span>
              )}
              <Button type="button" onClick={() => doSave("social", { social })} disabled={saving["social"]}>
                {saving["social"] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Social
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Search Console</CardTitle>
              <CardDescription>Google Search Console site verification code.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Verification Code</label>
                <input
                  type="text"
                  value={searchConsole.verificationCode}
                  onChange={(e) => setSearchConsole({ verificationCode: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="google-site-verification=abc123..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Paste the full verification meta tag content from Google Search Console.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <a
                    href="https://search.google.com/search-console"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-retail hover:underline inline-flex items-center gap-1"
                  >
                    Open Google Search Console →
                  </a>
                  <p className="text-xs text-muted-foreground">
                    After saving, verify by visiting your homepage and checking the page source for the <code>google-site-verification</code> meta tag. Then click &quot;Verify&quot; in Search Console.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex items-center justify-end gap-3 flex-wrap">
              {message.searchConsole && (
                <span className={`text-sm px-2 py-1 rounded ${message.searchConsole.includes("success") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                  {message.searchConsole}
                </span>
              )}
              <Button type="button" onClick={() => doSave("searchConsole", { searchConsole })} disabled={saving["searchConsole"]}>
                {saving["searchConsole"] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Search Console
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-retail" />
                OpenAI Configuration
              </CardTitle>
              <CardDescription>API key for AI content generation in the blog editor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">OpenAI API Key</label>
                <input
                  type="password"
                  value={openai.apiKey}
                  onChange={(e) => setOpenai({ apiKey: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-retail underline">platform.openai.com</a>. Falls back to OPENAI_API_KEY env variable if empty.
                </p>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex items-center justify-end gap-3 flex-wrap">
              {message.openai && (
                <span className={`text-sm px-2 py-1 rounded ${message.openai.includes("success") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                  {message.openai}
                </span>
              )}
              <Button type="button" onClick={() => doSave("openai", { openai })} disabled={saving["openai"]}>
                {saving["openai"] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save OpenAI
              </Button>
            </CardFooter>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MousePointerClick className="w-5 h-5 text-retail" />
                Pop Up
              </CardTitle>
              <CardDescription>Control the exit-intent popup behaviour and content.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="popup-enabled"
                  checked={popup.enabled}
                  onChange={(e) => setPopup({ ...popup, enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                <label htmlFor="popup-enabled" className="text-sm font-medium">Enable Pop Up</label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Trigger</label>
                  <select
                    value={popup.trigger}
                    onChange={(e) => setPopup({ ...popup, trigger: e.target.value as PopupSettings["trigger"] })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="mouseleave">Mouse Leave</option>
                    <option value="timer">Timer</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Delay (seconds)</label>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    value={popup.delaySeconds}
                    onChange={(e) => setPopup({ ...popup, delaySeconds: Number(e.target.value) || 0 })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Delay before popup appears (0 = immediate).</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Max Shows Per Session</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={popup.maxShowsPerSession}
                  onChange={(e) => setPopup({ ...popup, maxShowsPerSession: Number(e.target.value) || 1 })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Pop Up Title</label>
                <input
                  type="text"
                  value={popup.title}
                  onChange={(e) => setPopup({ ...popup, title: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Price Text</label>
                  <input
                    type="text"
                    value={popup.priceText}
                    onChange={(e) => setPopup({ ...popup, priceText: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Price Subtext</label>
                  <input
                    type="text"
                    value={popup.priceSubtext}
                    onChange={(e) => setPopup({ ...popup, priceSubtext: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">CTA Button Text</label>
                  <input
                    type="text"
                    value={popup.ctaText}
                    onChange={(e) => setPopup({ ...popup, ctaText: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">CTA Link</label>
                  <input
                    type="url"
                    value={popup.ctaLink}
                    onChange={(e) => setPopup({ ...popup, ctaLink: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex items-center justify-end gap-3 flex-wrap">
              {message.popup && (
                <span className={`text-sm px-2 py-1 rounded ${message.popup.includes("success") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                  {message.popup}
                </span>
              )}
              <Button type="button" onClick={() => doSave("popup", { popup })} disabled={saving["popup"]}>
                {saving["popup"] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Pop Up
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Header Branding</CardTitle>
              <CardDescription>Logo and top navigation call-to-action buttons.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Logo</label>
                <div className="flex items-center gap-4">
                  {header.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={header.logo} alt="Header logo preview" className="h-12 w-auto rounded border border-border" />
                  )}
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background text-sm font-medium cursor-pointer hover:bg-muted transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) uploadLogo(file, "header")
                      }}
                    />
                    {uploading.header ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Upload Logo"
                    )}
                  </label>
                </div>
                <input
                  type="text"
                  value={header.logo}
                  onChange={(e) => setHeader({ ...header, logo: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
                  placeholder="/logo.webp"
                />
                <p className="text-xs text-muted-foreground mt-1">Path to logo image (e.g., /logo.webp or /uploads/logo.webp)</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Favicon</label>
                <div className="flex items-center gap-4">
                  {header.favicon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={header.favicon} alt="Favicon preview" className="w-8 h-8 rounded border border-border" />
                  )}
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background text-sm font-medium cursor-pointer hover:bg-muted transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) uploadLogo(file, "header", "favicon")
                      }}
                    />
                    {uploading.header ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Upload Favicon"
                    )}
                  </label>
                </div>
                <input
                  type="text"
                  value={header.favicon}
                  onChange={(e) => setHeader({ ...header, favicon: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
                  placeholder="/icon.webp"
                />
                <p className="text-xs text-muted-foreground mt-1">Path to favicon (e.g., /icon.webp or /uploads/favicon.webp)</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Primary CTA Text</label>
                  <input
                    type="text"
                    value={header.ctaText}
                    onChange={(e) => setHeader({ ...header, ctaText: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Book Demo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Primary CTA Link</label>
                  <input
                    type="url"
                    value={header.ctaLink}
                    onChange={(e) => setHeader({ ...header, ctaLink: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="https://wa.me/..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Secondary CTA Text</label>
                  <input
                    type="text"
                    value={header.secondaryCtaText}
                    onChange={(e) => setHeader({ ...header, secondaryCtaText: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Request Quote"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Secondary CTA Link</label>
                  <input
                    type="url"
                    value={header.secondaryCtaLink}
                    onChange={(e) => setHeader({ ...header, secondaryCtaLink: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="https://wa.me/..."
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex items-center justify-end gap-3 flex-wrap">
              {message.header && (
                <span className={`text-sm px-2 py-1 rounded ${message.header.includes("success") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                  {message.header}
                </span>
              )}
              <Button type="button" onClick={() => doSave("header", { header })} disabled={saving["header"]}>
                {saving["header"] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Header
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Footer Branding</CardTitle>
              <CardDescription>Logo, description, and bottom bar text shown in the site footer.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Footer Logo</label>
                <div className="flex items-center gap-4">
                  {footer.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={footer.logo} alt="Footer logo preview" className="h-12 w-auto rounded border border-border" />
                  )}
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background text-sm font-medium cursor-pointer hover:bg-muted transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) uploadLogo(file, "footer")
                      }}
                    />
                    {uploading.footer ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Upload Logo"
                    )}
                  </label>
                </div>
                <input
                  type="text"
                  value={footer.logo}
                  onChange={(e) => setFooter({ ...footer, logo: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
                  placeholder="/logo.webp"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={footer.description}
                  onChange={(e) => setFooter({ ...footer, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  placeholder="Short paragraph describing your business..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Copyright Text</label>
                  <input
                    type="text"
                    value={footer.copyrightText}
                    onChange={(e) => setFooter({ ...footer, copyrightText: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="MartPoint. All rights reserved."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tagline</label>
                  <input
                    type="text"
                    value={footer.tagline}
                    onChange={(e) => setFooter({ ...footer, tagline: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Built for African businesses."
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex items-center justify-end gap-3 flex-wrap">
              {message.footer && (
                <span className={`text-sm px-2 py-1 rounded ${message.footer.includes("success") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                  {message.footer}
                </span>
              )}
              <Button type="button" onClick={() => doSave("footer", { footer })} disabled={saving["footer"]}>
                {saving["footer"] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Footer
              </Button>
            </CardFooter>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Pricing Plans</CardTitle>
              <CardDescription>Edit Retail Cloud, Retail Offline, and ERP plan details shown across the site.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Cloud Plan */}
              <div className="border border-border rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Cloud Plan</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Plan Name</label>
                    <input
                      type="text"
                      value={pricing.cloud.name}
                      onChange={(e) => setPricing((prev) => ({ ...prev, cloud: { ...prev.cloud, name: e.target.value } }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Badge</label>
                    <input
                      type="text"
                      value={pricing.cloud.badge}
                      onChange={(e) => setPricing((prev) => ({ ...prev, cloud: { ...prev.cloud, badge: e.target.value } }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Price</label>
                    <input
                      type="text"
                      value={pricing.cloud.price}
                      onChange={(e) => setPricing((prev) => ({ ...prev, cloud: { ...prev.cloud, price: e.target.value } }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Period</label>
                    <input
                      type="text"
                      value={pricing.cloud.period}
                      onChange={(e) => setPricing((prev) => ({ ...prev, cloud: { ...prev.cloud, period: e.target.value } }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Branches Included</label>
                    <input
                      type="number"
                      value={pricing.cloud.branchesIncluded}
                      onChange={(e) => setPricing((prev) => ({ ...prev, cloud: { ...prev.cloud, branchesIncluded: Number(e.target.value) } }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Users Included</label>
                    <input
                      type="number"
                      value={pricing.cloud.usersIncluded}
                      onChange={(e) => setPricing((prev) => ({ ...prev, cloud: { ...prev.cloud, usersIncluded: Number(e.target.value) } }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Branch Addon Price</label>
                    <input
                      type="text"
                      value={pricing.cloud.branchAddonPrice}
                      onChange={(e) => setPricing((prev) => ({ ...prev, cloud: { ...prev.cloud, branchAddonPrice: e.target.value } }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">CTA Text</label>
                    <input
                      type="text"
                      value={pricing.cloud.ctaText}
                      onChange={(e) => setPricing((prev) => ({ ...prev, cloud: { ...prev.cloud, ctaText: e.target.value } }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <input
                    type="text"
                    value={pricing.cloud.description}
                    onChange={(e) => setPricing((prev) => ({ ...prev, cloud: { ...prev.cloud, description: e.target.value } }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Features (one per line)</label>
                  <textarea
                    value={pricing.cloud.features}
                    onChange={(e) => setPricing((prev) => ({ ...prev, cloud: { ...prev.cloud, features: e.target.value } }))}
                    rows={8}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">CTA Link</label>
                  <input
                    type="url"
                    value={pricing.cloud.ctaLink}
                    onChange={(e) => setPricing((prev) => ({ ...prev, cloud: { ...prev.cloud, ctaLink: e.target.value } }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Offline Plan */}
              <div className="border border-border rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Offline Plan</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Plan Name</label>
                    <input
                      type="text"
                      value={pricing.offline.name}
                      onChange={(e) => setPricing((prev) => ({ ...prev, offline: { ...prev.offline, name: e.target.value } }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Badge</label>
                    <input
                      type="text"
                      value={pricing.offline.badge}
                      onChange={(e) => setPricing((prev) => ({ ...prev, offline: { ...prev.offline, badge: e.target.value } }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Price</label>
                    <input
                      type="text"
                      value={pricing.offline.price}
                      onChange={(e) => setPricing((prev) => ({ ...prev, offline: { ...prev.offline, price: e.target.value } }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Period</label>
                    <input
                      type="text"
                      value={pricing.offline.period}
                      onChange={(e) => setPricing((prev) => ({ ...prev, offline: { ...prev.offline, period: e.target.value } }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Branch Addon Price</label>
                    <input
                      type="text"
                      value={pricing.offline.branchAddonPrice}
                      onChange={(e) => setPricing((prev) => ({ ...prev, offline: { ...prev.offline, branchAddonPrice: e.target.value } }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Support Renewal</label>
                    <input
                      type="text"
                      value={pricing.offline.supportRenewal || ""}
                      onChange={(e) => setPricing((prev) => ({ ...prev, offline: { ...prev.offline, supportRenewal: e.target.value } }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">CTA Text</label>
                    <input
                      type="text"
                      value={pricing.offline.ctaText}
                      onChange={(e) => setPricing((prev) => ({ ...prev, offline: { ...prev.offline, ctaText: e.target.value } }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <input
                    type="text"
                    value={pricing.offline.description}
                    onChange={(e) => setPricing((prev) => ({ ...prev, offline: { ...prev.offline, description: e.target.value } }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Features (one per line)</label>
                  <textarea
                    value={pricing.offline.features}
                    onChange={(e) => setPricing((prev) => ({ ...prev, offline: { ...prev.offline, features: e.target.value } }))}
                    rows={6}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">CTA Link</label>
                  <input
                    type="url"
                    value={pricing.offline.ctaLink}
                    onChange={(e) => setPricing((prev) => ({ ...prev, offline: { ...prev.offline, ctaLink: e.target.value } }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* ERP Plans */}
              {pricing.erp.map((plan, index) => (
                <div key={plan.name} className="border border-border rounded-lg p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">ERP Plan — {plan.name}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Plan Name</label>
                      <input
                        type="text"
                        value={plan.name}
                        onChange={(e) => setPricing((prev) => {
                          const next = [...prev.erp]
                          next[index] = { ...next[index], name: e.target.value }
                          return { ...prev, erp: next }
                        })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Badge</label>
                      <input
                        type="text"
                        value={plan.badge}
                        onChange={(e) => setPricing((prev) => {
                          const next = [...prev.erp]
                          next[index] = { ...next[index], badge: e.target.value }
                          return { ...prev, erp: next }
                        })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Price</label>
                      <input
                        type="text"
                        value={plan.price}
                        onChange={(e) => setPricing((prev) => {
                          const next = [...prev.erp]
                          next[index] = { ...next[index], price: e.target.value }
                          return { ...prev, erp: next }
                        })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Period</label>
                      <input
                        type="text"
                        value={plan.period}
                        onChange={(e) => setPricing((prev) => {
                          const next = [...prev.erp]
                          next[index] = { ...next[index], period: e.target.value }
                          return { ...prev, erp: next }
                        })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Branches Included</label>
                      <input
                        type="number"
                        value={plan.branchesIncluded}
                        onChange={(e) => setPricing((prev) => {
                          const next = [...prev.erp]
                          next[index] = { ...next[index], branchesIncluded: Number(e.target.value) }
                          return { ...prev, erp: next }
                        })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Users Included</label>
                      <input
                        type="number"
                        value={plan.usersIncluded}
                        onChange={(e) => setPricing((prev) => {
                          const next = [...prev.erp]
                          next[index] = { ...next[index], usersIncluded: Number(e.target.value) }
                          return { ...prev, erp: next }
                        })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">CTA Text</label>
                      <input
                        type="text"
                        value={plan.ctaText}
                        onChange={(e) => setPricing((prev) => {
                          const next = [...prev.erp]
                          next[index] = { ...next[index], ctaText: e.target.value }
                          return { ...prev, erp: next }
                        })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">CTA Link</label>
                      <input
                        type="text"
                        value={plan.ctaLink}
                        onChange={(e) => setPricing((prev) => {
                          const next = [...prev.erp]
                          next[index] = { ...next[index], ctaLink: e.target.value }
                          return { ...prev, erp: next }
                        })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <input
                      type="text"
                      value={plan.description}
                      onChange={(e) => setPricing((prev) => {
                        const next = [...prev.erp]
                        next[index] = { ...next[index], description: e.target.value }
                        return { ...prev, erp: next }
                      })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Features (one per line)</label>
                    <textarea
                      value={plan.features}
                      onChange={(e) => setPricing((prev) => {
                        const next = [...prev.erp]
                        next[index] = { ...next[index], features: e.target.value }
                        return { ...prev, erp: next }
                      })}
                      rows={5}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter className="border-t pt-4 flex items-center justify-end gap-3 flex-wrap">
              {message.pricing && (
                <span className={`text-sm px-2 py-1 rounded ${message.pricing.includes("success") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                  {message.pricing}
                </span>
              )}
              <Button type="button" onClick={() => doSave("pricing", {
                pricing: {
                  cloud: { ...pricing.cloud, features: pricing.cloud.features.split("\n").map((f) => f.trim()).filter(Boolean) },
                  offline: { ...pricing.offline, features: pricing.offline.features.split("\n").map((f) => f.trim()).filter(Boolean) },
                  erp: pricing.erp.map((plan) => ({ ...plan, features: plan.features.split("\n").map((f) => f.trim()).filter(Boolean) })),
                },
              })} disabled={saving["pricing"]}>
                {saving["pricing"] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Pricing
              </Button>
            </CardFooter>
          </Card>

          <div className="lg:col-span-2 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {message.all && (
              <div className={`text-sm px-3 py-2 rounded-md ${message.all.includes("success") ? "bg-green-100 text-green-800 border border-green-200" : "bg-red-100 text-red-800 border border-red-200"}`}>
                {message.all}
              </div>
            )}
            <Button type="submit" disabled={saving["all"]}>
              {saving["all"] ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save All Changes
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
