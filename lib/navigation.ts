import {
  ShoppingCart,
  Sparkles,
  Tag,
  Store,
  Pill,
  UtensilsCrossed,
  Shirt,
  Smartphone,
  Scissors,
  GitBranch,
  ChevronRight,
  FileText,
  HelpCircle,
  Megaphone,
  Download,
  Users,
  HeartHandshake,
  ShieldCheck,
  Mail,
  Calculator,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface NavChild {
  label: string
  href: string
  description?: string
  icon?: LucideIcon
  badge?: string
}

export interface NavItem {
  label: string
  href?: string
  children?: NavChild[]
}

export const mainNav: NavItem[] = [
  {
    label: "Solutions",
    children: [
      {
        label: "MartPoint Retail",
        href: "/martpoint-retail",
        description: "For supermarkets, pharmacies, restaurants, fashion stores and everyday retailers.",
        icon: ShoppingCart,
      },
      {
        label: "MartPoint Intelligence",
        href: "/martpoint-intelligence",
        description: "Business insights, alerts and recommendations from your MartPoint data.",
        icon: Sparkles,
      },
      {
        label: "Compare Plans",
        href: "/pricing",
        description: "See which MartPoint edition fits your business.",
        icon: Tag,
      },
      {
        label: "Estimate Cost",
        href: "/estimate",
        description: "Answer a few questions and get an instant estimated cost range.",
        icon: Calculator,
      },
    ],
  },
  {
    label: "Features",
    href: "/features",
  },
  {
    label: "Industries",
    children: [
      { label: "Supermarkets", href: "/industries/supermarkets", icon: Store },
      { label: "Pharmacies", href: "/industries/pharmacies", icon: Pill },
      { label: "Restaurants", href: "/industries/restaurants", icon: UtensilsCrossed },
      { label: "Fashion Stores", href: "/industries/fashion-stores", icon: Shirt },
      { label: "Electronics Stores", href: "/industries/electronics-stores", icon: Smartphone },
      { label: "Beauty & Salons", href: "/industries/beauty-and-salons", icon: Scissors },
      { label: "Multi-Branch Retail", href: "/industries/multi-branch-retail", icon: GitBranch },
      { label: "View All Industries", href: "/industries", icon: ChevronRight },
    ],
  },
  {
    label: "Pricing",
    href: "/pricing",
  },
  {
    label: "Resources",
    children: [
      { label: "Blog", href: "/blog", icon: FileText },
      { label: "Customer Stories", href: "/customer-stories", icon: HeartHandshake },
      { label: "Help Centre", href: "/help-centre", icon: HelpCircle },
      { label: "Product Updates", href: "/product-updates", icon: Megaphone },
      { label: "Download Brochure", href: "/download-brochure", icon: Download },
    ],
  },
  {
    label: "Company",
    children: [
      { label: "About MartPoint", href: "/about", icon: Users },
      { label: "Why MartPoint", href: "/why-martpoint", icon: HeartHandshake },
      { label: "Partners", href: "/partners", icon: HeartHandshake },
      { label: "Partner Directory", href: "/partners/directory", icon: Users },
      { label: "Verify a Partner", href: "/partners/verify", icon: ShieldCheck },
      { label: "Contact", href: "/contact", icon: Mail },
    ],
  },
]

export const ctaNav = {
  label: "Book a Demo",
  href: "/book-demo",
}

export const partnerLoginNav = {
  label: "Partner Login",
  href: "/partner/login",
}

export const footerColumns = {
  solutions: {
    title: "Solutions",
    links: [
      { label: "MartPoint Retail", href: "/martpoint-retail" },
      { label: "Features", href: "/features" },
      { label: "MartPoint Intelligence", href: "/martpoint-intelligence" },
      { label: "Pricing", href: "/pricing" },
      { label: "Cost Estimator", href: "/estimate" },
    ],
  },
  industries: {
    title: "Industries",
    links: [
      { label: "Supermarkets", href: "/industries/supermarkets" },
      { label: "Pharmacies", href: "/industries/pharmacies" },
      { label: "Restaurants", href: "/industries/restaurants" },
      { label: "Fashion Stores", href: "/industries/fashion-stores" },
      { label: "Electronics Stores", href: "/industries/electronics-stores" },
      { label: "Beauty & Salons", href: "/industries/beauty-and-salons" },
      { label: "View All Industries", href: "/industries" },
    ],
  },
  resources: {
    title: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Customer Stories", href: "/customer-stories" },
      { label: "Help Centre", href: "/help-centre" },
      { label: "Product Updates", href: "/product-updates" },
      { label: "System Status", href: "/status" },
      { label: "Download Brochure", href: "/download-brochure" },
    ],
  },
  company: {
    title: "Company",
    links: [
      { label: "About MartPoint", href: "/about" },
      { label: "Why MartPoint", href: "/why-martpoint" },
      { label: "Partners", href: "/partners" },
      { label: "Partner Directory", href: "/partners/directory" },
      { label: "Verify a Partner", href: "/partners/verify" },
      { label: "Creator Network", href: "/creators" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "/contact" },
      { label: "Partner Login", href: "/partner/login" },
      { label: "Creator Login", href: "/creator/login" },
    ],
  },
  legal: {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Terms of Service", href: "/terms-of-service" },
    ],
  },
}

export const socialLinks = [
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "twitter", label: "X" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "youtube", label: "YouTube" },
  { key: "tiktok", label: "TikTok" },
]
