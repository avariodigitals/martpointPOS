import {
  ShoppingCart,
  Building2,
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
  Briefcase,
  Mail,
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
        label: "MartPoint Enterprise",
        href: "/martpoint-erp",
        description: "For growing businesses that need finance, HR, procurement, approvals and reporting.",
        icon: Building2,
      },
      {
        label: "MartPoint Intelligence",
        href: "/martpoint-intelligence",
        description: "AI-powered insights, recommendations and business alerts.",
        icon: Sparkles,
        badge: "Coming Soon",
      },
      {
        label: "Compare Plans",
        href: "/pricing",
        description: "See which MartPoint edition fits your business.",
        icon: Tag,
      },
    ],
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
      { label: "Customers", href: "/customer-stories", icon: Users },
      { label: "Partners", href: "/partners", icon: HeartHandshake },
      { label: "Careers", href: "/careers", icon: Briefcase },
      { label: "Contact", href: "/contact", icon: Mail },
    ],
  },
]

export const ctaNav = {
  label: "Book a Demo",
  href: "https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20learning%20more%20about%20MartPoint%20Retail.%20Can%20we%20talk%3F",
}

export const footerColumns = {
  solutions: {
    title: "Solutions",
    links: [
      { label: "MartPoint Retail", href: "/martpoint-retail" },
      { label: "MartPoint Enterprise", href: "/martpoint-erp" },
      { label: "MartPoint Intelligence", href: "/martpoint-intelligence" },
      { label: "Pricing", href: "/pricing" },
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
      { label: "Download Brochure", href: "/download-brochure" },
    ],
  },
  company: {
    title: "Company",
    links: [
      { label: "About MartPoint", href: "/about" },
      { label: "Why MartPoint", href: "/why-martpoint" },
      { label: "Customers", href: "/customer-stories" },
      { label: "Partners", href: "/partners" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "/contact" },
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
]
