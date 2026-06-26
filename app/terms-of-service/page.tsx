import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "MartPoint terms of service — rules and guidelines for using our software and services.",
}

export default function TermsOfServicePage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="w-full bg-background py-10 md:py-16 lg:py-20">
          <div className="container-martpoint max-w-3xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-6">
              Terms of Service
            </h1>
            <p className="text-muted-foreground mb-12">
              Last updated: June 24, 2026
            </p>

            <div className="prose prose-slate max-w-none space-y-8">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">1. Agreement to Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  These Terms of Service (&quot;Terms&quot;) govern your access to and use of MartPoint&apos;s website, software, and services (&quot;Services&quot;). By accessing or using our Services, you agree to be bound by these Terms. If you do not agree to these Terms, you may not access or use our Services.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">2. Description of Services</h2>
                <p className="text-muted-foreground leading-relaxed">
                  MartPoint provides business management software including point-of-sale (POS) systems, inventory management, enterprise resource planning (ERP), and related tools designed for African retail businesses and enterprises. Our Services may include software downloads, cloud-based applications, mobile applications, and support services.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">3. Account Registration</h2>
                <p className="text-muted-foreground leading-relaxed">
                  To access certain features of our Services, you may need to register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete. You are responsible for safeguarding your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">4. License and Restrictions</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Subject to these Terms, MartPoint grants you a limited, non-exclusive, non-transferable, and revocable license to use our Services for your internal business purposes. You agree not to:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                  <li>Modify, copy, create derivative works from, reverse engineer, or decompile our software</li>
                  <li>Rent, lease, lend, sell, sublicense, or otherwise transfer rights to the Services</li>
                  <li>Use the Services for any illegal purpose or in violation of any applicable laws</li>
                  <li>Interfere with or disrupt the integrity or performance of the Services</li>
                  <li>Attempt to gain unauthorized access to the Services or related systems</li>
                  <li>Remove, alter, or obscure any proprietary notices or labels on the Services</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">5. Payment and Billing</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Certain Services require payment of fees. All fees are stated in African Naira (₦) and are exclusive of applicable taxes. You agree to pay all fees and charges associated with your account on a timely basis. Failure to pay may result in suspension or termination of your account. All purchases are final unless otherwise stated. Subscription fees are billed in advance on a periodic basis depending on your selected plan.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">6. Data and Content</h2>
                <p className="text-muted-foreground leading-relaxed">
                  You retain all rights to the data and content you input into our Services (&quot;Your Data&quot;). By using our Services, you grant MartPoint a limited license to use, store, and process Your Data solely for the purpose of providing and improving our Services. We will not use Your Data for any other purpose without your consent. You represent and warrant that you have the right to upload Your Data and that doing so does not violate any third-party rights.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">7. Intellectual Property</h2>
                <p className="text-muted-foreground leading-relaxed">
                  MartPoint and its licensors own all rights, title, and interest in and to the Services, including all intellectual property rights. Nothing in these Terms grants you any right, title, or interest in our trademarks, logos, or other brand features. You may not use MartPoint&apos;s trademarks without our prior written consent.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">8. Support and Maintenance</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We will provide technical support and maintenance for our Services as described in your service agreement or subscription plan. Support may be provided via email, WhatsApp, phone, or remote access during our standard business hours. We aim to respond to support requests within 24-48 hours during business days.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">9. Confidentiality</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Both parties agree to protect and keep confidential any proprietary or confidential information disclosed during the course of using our Services. This obligation shall survive termination of these Terms. Confidential information does not include information that is publicly available, already known to the receiving party, or independently developed without use of the disclosing party&apos;s confidential information.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">10. Disclaimer of Warranties</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Our Services are provided &quot;as is&quot; and &quot;as available&quot; without any warranties of any kind, either express or implied. We do not warrant that the Services will be uninterrupted, error-free, or free from viruses or other harmful components. We disclaim all warranties, express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">11. Limitation of Liability</h2>
                <p className="text-muted-foreground leading-relaxed">
                  To the maximum extent permitted by law, MartPoint shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of (or inability to access or use) our Services. Our total liability to you for all claims arising from or relating to these Terms shall not exceed the total amount paid by you to MartPoint in the twelve (12) months preceding the claim.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">12. Indemnification</h2>
                <p className="text-muted-foreground leading-relaxed">
                  You agree to indemnify, defend, and hold harmless MartPoint and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable legal fees, arising out of or in any way connected with your access to or use of the Services, your violation of these Terms, or your infringement of any intellectual property or other rights of any person or entity.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">13. Termination</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may terminate or suspend your access to our Services immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach these Terms. Upon termination, your right to use the Services will immediately cease. All provisions of these Terms which by their nature should survive termination shall survive termination, including ownership provisions, warranty disclaimers, indemnity, and limitations of liability.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">14. Governing Law</h2>
                <p className="text-muted-foreground leading-relaxed">
                  These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Africa, without regard to its conflict of law provisions. Any dispute arising under these Terms shall be subject to the exclusive jurisdiction of the courts of Lagos State, Africa.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">15. Changes to Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We reserve the right to modify or replace these Terms at any time. We will provide notice of any material changes by posting the updated Terms on our website. Your continued use of the Services after any such changes constitutes your acceptance of the new Terms.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">16. Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have any questions about these Terms of Service, please contact us at <a href="mailto:hello@martpoint.com.ng" className="text-retail underline hover:text-retail/80 transition-colors">hello@martpoint.com.ng</a> or via WhatsApp at <a href="tel:+2348036028069" className="text-retail underline hover:text-retail/80 transition-colors">+234 803 602 8069</a>.
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
