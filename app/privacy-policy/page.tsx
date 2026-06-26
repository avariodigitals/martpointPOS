import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "MartPoint privacy policy — how we collect, use, and protect your data.",
}

export default function PrivacyPolicyPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="w-full bg-background py-10 md:py-16 lg:py-20">
          <div className="container-martpoint max-w-3xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-6">
              Privacy Policy
            </h1>
            <p className="text-muted-foreground mb-12">
              Last updated: June 24, 2026
            </p>

            <div className="prose prose-slate max-w-none space-y-8">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">1. Introduction</h2>
                <p className="text-muted-foreground leading-relaxed">
                  MartPoint (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website, use our software, or interact with our services. Please read this policy carefully. If you do not agree with the terms of this policy, please do not access our services.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">2. Information We Collect</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We may collect information about you in a variety of ways. The information we may collect includes:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                  <li><strong>Personal Data:</strong> Name, email address, phone number, business name, and billing information that you voluntarily provide when registering for an account, requesting a demo, or contacting us.</li>
                  <li><strong>Usage Data:</strong> Information our servers automatically collect when you access our website or software, including browser type, operating system, access times, pages viewed, and the referring URL.</li>
                  <li><strong>Device Data:</strong> Information about the device you use to access our services, including device type, unique device identifiers, and mobile network information.</li>
                  <li><strong>Transaction Data:</strong> Records of products or services you purchase from us, including billing and payment details.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">3. How We Use Your Information</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We use the information we collect for various purposes, including to:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                  <li>Provide, operate, and maintain our software and services</li>
                  <li>Process transactions and send related information including confirmations and invoices</li>
                  <li>Respond to your comments, questions, and provide customer service</li>
                  <li>Send you technical notices, updates, security alerts, and support messages</li>
                  <li>Monitor and analyze usage and trends to improve your experience</li>
                  <li>Personalize and improve our services and deliver relevant content</li>
                  <li>Detect, prevent, and address fraud, security, or technical issues</li>
                  <li>Comply with legal obligations and enforce our terms</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">4. Cookies and Tracking Technologies</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We use cookies and similar tracking technologies to track activity on our website and store certain information. Cookies are files with a small amount of data that may include an anonymous unique identifier. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our services.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">5. Data Sharing and Disclosure</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We do not sell, trade, or rent your personal information to third parties. We may share information in the following situations:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                  <li><strong>Service Providers:</strong> We may share your information with third-party vendors, consultants, and other service providers who need access to such information to carry out work on our behalf.</li>
                  <li><strong>Legal Requirements:</strong> We may disclose your information if required to do so by law or in response to valid requests by public authorities.</li>
                  <li><strong>Business Transfers:</strong> In connection with any merger, sale of company assets, financing, or acquisition of all or a portion of our business.</li>
                  <li><strong>With Your Consent:</strong> We may share your information for any other purpose disclosed by us when you provide the information.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">6. Data Security</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, please be aware that no method of transmission over the Internet or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your personal information, we cannot guarantee its absolute security.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">7. Your Data Protection Rights</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Depending on your location, you may have the following rights regarding your personal data:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                  <li>The right to access the personal data we hold about you</li>
                  <li>The right to request correction of inaccurate personal data</li>
                  <li>The right to request deletion of your personal data</li>
                  <li>The right to object to processing of your personal data</li>
                  <li>The right to data portability</li>
                  <li>The right to withdraw consent at any time</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  To exercise any of these rights, please contact us at <a href="mailto:hello@martpoint.com.ng" className="text-retail underline hover:text-retail/80 transition-colors">hello@martpoint.com.ng</a>.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">8. Data Retention</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We will retain your personal information only for as long as is necessary for the purposes set out in this Privacy Policy. We will retain and use your information to the extent necessary to comply with our legal obligations, resolve disputes, and enforce our policies.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">9. Third-Party Services</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Our services may contain links to third-party websites and services that are not owned or controlled by MartPoint. We have no control over, and assume no responsibility for, the content, privacy policies, or practices of any third-party websites or services. We encourage you to review the privacy policies of every third-party website that you visit.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">10. Changes to This Privacy Policy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date. You are advised to review this Privacy Policy periodically for any changes.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">11. Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have any questions about this Privacy Policy, please contact us at <a href="mailto:hello@martpoint.com.ng" className="text-retail underline hover:text-retail/80 transition-colors">hello@martpoint.com.ng</a> or via WhatsApp at <a href="tel:+2348036028069" className="text-retail underline hover:text-retail/80 transition-colors">+234 803 602 8069</a>.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
