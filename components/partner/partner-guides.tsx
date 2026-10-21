import { CheckCircle2, CircleHelp, FileCheck2, ShieldCheck, Wallet, ArrowRight, AlertTriangle, Award, BadgeCheck, Briefcase, Building2, ClipboardList, FileQuestion, FileText, FolderOpen, GraduationCap, LifeBuoy, Palette, Share2, Target, Users, type LucideIcon } from "lucide-react"

function GuideSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-retail text-sm font-bold text-white">{number}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">{children}</div>
        </div>
      </div>
    </section>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return <li className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-retail" /> <span>{children}</span></li>
}

function Screen({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} className="font-medium text-retail underline-offset-2 hover:underline">{children}</a>
}

function Handoff({ title, children, tone = "blue" }: { title: string; children: React.ReactNode; tone?: "blue" | "amber" | "green" }) {
  const styles = { blue: "border-blue-200 bg-blue-50 text-blue-950", amber: "border-amber-200 bg-amber-50 text-amber-950", green: "border-emerald-200 bg-emerald-50 text-emerald-950" }
  return <div className={`rounded-xl border p-4 text-sm leading-6 ${styles[tone]}`}><p className="font-semibold">{title}</p><div className="mt-1">{children}</div></div>
}

function Flow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 p-4 text-xs font-medium text-foreground">{children}</div>
}

function FlowStep({ children }: { children: React.ReactNode }) {
  return <><span className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm">{children}</span><ArrowRight className="h-4 w-4 text-muted-foreground" /></>
}

function ModuleCard({ href, label, description, icon: Icon }: { href: string; label: string; description: string; icon: LucideIcon }) {
  return (
    <a href={href} className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-retail/50 hover:bg-retail-soft/30">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-retail" />
        <div>
          <p className="font-semibold text-foreground group-hover:text-retail">{label}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
    </a>
  )
}

export function PartnerPortalGuide() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="rounded-3xl bg-gradient-to-br from-retail to-retail/75 p-7 text-white shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">MartPoint Partner Portal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Partner Portal: screen-by-screen guide</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">Follow the complete journey from first login, through lead registration and quote requests, to customer onboarding, invoices, commissions, and support.</p>
      </header>

      <Flow><FlowStep>Sign in</FlowStep><FlowStep>Register lead</FlowStep><FlowStep>Request quote</FlowStep><FlowStep>MartPoint issues quote</FlowStep><FlowStep>Customer receives invoice</FlowStep><span className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-800">Payment confirmed</span></Flow>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4"><FileCheck2 className="h-5 w-5 text-retail" /><p className="mt-3 font-semibold">Your documents</p><p className="mt-1 text-xs text-muted-foreground">The signed agreement and Commission Schedule control your commercial terms.</p></div>
        <div className="rounded-2xl border border-border bg-card p-4"><Wallet className="h-5 w-5 text-retail" /><p className="mt-3 font-semibold">Your earnings</p><p className="mt-1 text-xs text-muted-foreground">A lead, quote, invoice, or promise to pay is not yet a commission.</p></div>
        <div className="rounded-2xl border border-border bg-card p-4"><CircleHelp className="h-5 w-5 text-retail" /><p className="mt-3 font-semibold">Your support route</p><p className="mt-1 text-xs text-muted-foreground">Use Support Tickets for questions that need a written, traceable answer.</p></div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-retail">Navigation at a glance</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">What each portal module is for</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Use the left sidebar on desktop or the bottom menu and <strong>More</strong> menu on mobile. The portal only shows modules allowed by your user role and your organisation&apos;s capabilities, so two partner users may see different menus.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ModuleCard href="/partner" label="Dashboard" description="See your partner status, capability summary, compliance actions, key counts, and recent activity." icon={Building2} />
          <ModuleCard href="/partner/leads" label="Leads" description="Register customer opportunities, view lead status, and follow protection or matching decisions." icon={Target} />
          <ModuleCard href="/partner/referrals" label="Referrals" description="Review accepted referral opportunities and any action or decision history." icon={Share2} />
          <ModuleCard href="/partner/quotes" label="Quotes" description="Submit quote requests for eligible leads and track Sales review, issue, decline, or expiry." icon={FileQuestion} />
          <ModuleCard href="/partner/customers" label="Customers" description="Open assigned customer records and view the customer information your access level permits." icon={Briefcase} />
          <ModuleCard href="/partner/work-orders" label="Work Orders" description="Track approved implementation work, milestones, due dates, and evidence." icon={ClipboardList} />
          <ModuleCard href="/partner/commissions" label="Earnings" description="View commission status, statements, payout details, and eligible payout requests." icon={Wallet} />
          <ModuleCard href="/partner/profile" label="Profile" description="Maintain your organisation details, contact information, and approved logo." icon={Building2} />
          <ModuleCard href="/partner/team" label="Team" description="Invite and manage partner users when your role has team-management permission." icon={Users} />
          <ModuleCard href="/partner/compliance" label="Compliance" description="Submit requested compliance information and track review status; MartPoint performs verification." icon={FileCheck2} />
          <ModuleCard href="/partner/documents" label="Documents" description="Preview or download agreements, schedules, activation records, assignments, statements, and notices issued to you." icon={FileText} />
          <ModuleCard href="/partner/training" label="Training" description="Open MartPoint training videos, learning materials, demonstrations, and downloadable guides." icon={GraduationCap} />
          <ModuleCard href="/partner/certification" label="Certification" description="View certification requirements and certificates uploaded or issued by MartPoint." icon={Award} />
          <ModuleCard href="/partner/assessments" label="Assessments" description="Open assigned assessments, complete papers, and review your available assessment status." icon={ClipboardList} />
          <ModuleCard href="/partner/branded-materials" label="Branded Materials" description="Download approved co-branded materials and submit a branding request where available." icon={Palette} />
          <ModuleCard href="/partner/badge-kit" label="Badge Kit" description="Download the partner badge assets that MartPoint has issued for your organisation." icon={BadgeCheck} />
          <ModuleCard href="/partner/resources" label="Resources" description="Access shared MartPoint guides and documents that have been made available to your partner organisation." icon={FolderOpen} />
          <ModuleCard href="/partner/support" label="Support Tickets" description="Raise and track a written support request, then reply from the ticket thread." icon={LifeBuoy} />
        </div>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Why a module may be missing:</strong> navigation is permission- and capability-filtered. Ask your organisation administrator or MartPoint if you need a module that is not visible; do not use another person&apos;s account.</div>
      </section>

      <div className="space-y-4">
        <GuideSection number="1" title="Log in and change your password">
          <ol className="list-decimal space-y-2 pl-5"><li>Open <Screen href="/partner/login">Partner Login</Screen> and enter the email address used for your partner user account and your password.</li><li>Select <strong>Sign In</strong>. You will arrive at the Partner Dashboard.</li><li>If you cannot remember the password, select <strong>Forgot password?</strong>, enter your email, and select <strong>Send Reset Link</strong>.</li><li>Open the reset link from email, enter a new password of at least 10 characters, confirm it, and select <strong>Reset Password</strong>. Return to Partner Login.</li></ol>
          <p>The reset page intentionally confirms the request without revealing whether an email is registered. Check your inbox and spam folder, and never send a password or payment information through a support ticket.</p>
        </GuideSection>

        <GuideSection number="2" title="Start at the Dashboard, then complete your profile and team">
          <p>The Dashboard is the first screen after login. Use the sidebar to move between Leads, Quotes, Customers, Work Orders, Earnings, Documents, Training, Compliance, and Support.</p>
          <ul className="space-y-2"><Bullet>Open <Screen href="/partner/profile">Profile</Screen> to keep your organisation and contact information current.</Bullet><Bullet>Open <Screen href="/partner/team">Team</Screen> to invite approved colleagues and assign the correct partner role. Only users with the relevant permission can invite or manage team members.</Bullet><Bullet>Check the Dashboard&apos;s Recent Activity and the email address on your profile for referral, document, customer, payout, or account-status updates.</Bullet></ul>
        </GuideSection>

        <GuideSection number="3" title="Create a lead: Partner Portal → Leads → Register Lead">
          <p>Open <Screen href="/partner/leads">My Leads</Screen>, select <strong>Register Lead</strong>, complete the form, and submit it.</p>
          <p>Required fields are business name, contact name, phone, email, country, state, city, industry, business type, and interested product. You can also add branches, estimated users, estimated deal value, and notes.</p>
          <ul className="space-y-2"><Bullet>Use the customer&apos;s real details and confirm that you have permission to share them with MartPoint.</Bullet><Bullet>Open the lead after submission to monitor Lead Status and Protection status.</Bullet><Bullet>Protection reserves the opportunity for the stated period; it is not approval, a quote, an invoice, or a commission.</Bullet><Bullet>If the lead is lost or expired, the portal will not allow a new quote request against it.</Bullet></ul>
        </GuideSection>

        <GuideSection number="4" title="Request a quote: Partner Portal → Quotes">
          <p>Open <Screen href="/partner/quotes">Quote Requests</Screen>. Select an eligible registered lead, then complete the request:</p>
          <ul className="space-y-2"><Bullet><strong>Plan / product:</strong> the MartPoint product or plan requested.</Bullet><Bullet><strong>Locations:</strong> branches or operating locations.</Bullet><Bullet><strong>Estimated users:</strong> expected number of users.</Bullet><Bullet><strong>Services requested:</strong> for example implementation or training.</Bullet><Bullet><strong>Notes or assumptions:</strong> anything Sales should consider.</Bullet></ul>
          <p>Select <strong>Request quote</strong>. The request is sent to MartPoint Sales. The status will move through <strong>Submitted</strong>, <strong>Under review</strong>, <strong>Quote issued</strong>, <strong>Declined</strong>, or <strong>Expired</strong>. An issued quote reference confirms that Sales has issued a quote; it does not mean the customer has paid.</p>
        </GuideSection>

        <GuideSection number="5" title="What happens after you request a quote?">
          <Handoff title="Partner action"><p>Wait for the status and quote reference in <Screen href="/partner/quotes">Quotes</Screen>. Discuss the approved commercial proposal with the customer, but do not alter MartPoint pricing, promise a discount, or issue an invoice yourself.</p></Handoff>
          <Handoff title="MartPoint admin / Sales action"><p>Admin opens the partner record, reviews the request, and chooses <strong>Reviewing</strong>, <strong>Issue quote</strong>, or <strong>Decline</strong>. If the customer accepts, Admin moves the opportunity into the normal customer and Finance process.</p></Handoff>
          <Handoff title="Important system boundary" tone="amber"><p>The Partner Quote Request screen is a request-and-status tracker. It does not currently create the customer-facing Finance quote or invoice automatically. The formal invoice is created in <Screen href="/admin/finance/invoices">Finance → Invoices</Screen> for the customer&apos;s business.</p></Handoff>
        </GuideSection>

        <GuideSection number="6" title="How the customer receives and pays the invoice">
          <p>After the customer is ready to buy, MartPoint Admin ensures there is a customer business record, creates the invoice, checks the line items and due date, then selects <strong>Issue</strong> in Finance.</p>
          <ol className="list-decimal space-y-2 pl-5"><li>The invoice is emailed to the business&apos;s <strong>primary email</strong>.</li><li>The email includes the invoice number, due date, balance due, and a PDF attachment.</li><li>The customer pays by bank transfer using the invoice number as the payment reference and replies with proof of payment, unless MartPoint gives another approved payment instruction.</li><li>Admin records and confirms the payment in Finance. A payment confirmation and receipt are then sent to the customer.</li><li>Unpaid invoices may receive reminders, including automated reminders close to or after the due date.</li></ol>
          <Handoff title="What the partner can see" tone="green"><p>The partner can see the customer assignment and permitted customer/onboarding information in the Partner Portal. Customer commercial invoices and payment recording are handled by MartPoint Finance; they are not currently a Partner Portal invoice inbox. Ask Admin for the invoice number or payment status rather than creating a second invoice.</p></Handoff>
        </GuideSection>

        <GuideSection number="7" title="Customer onboarding, assignments, and work orders">
          <p>When the customer is converted and assigned, open <Screen href="/partner/customers">My Customers</Screen>. Select the business to view contact details, relationship, access level, business status, entitlements, and deployment status.</p>
          <ul className="space-y-2"><Bullet>If you have onboarding-manager access, open the customer&apos;s onboarding workspace and follow the assigned setup tasks.</Bullet><Bullet>Use <Screen href="/partner/work-orders">Work Orders</Screen> for approved implementation or delivery work. Record milestone evidence in the work order.</Bullet><Bullet>Do not activate licences, collect licence payments, or promise unsupported features unless MartPoint has given written authority.</Bullet></ul>
        </GuideSection>

        <GuideSection number="8" title="Documents, commission, payout, and support">
          <ul className="space-y-2"><Bullet>Open <Screen href="/partner/documents">Documents</Screen> for the Referral Partner Agreement, Commission Schedule, activation records, assignments, statements, and notices. Select <strong>Preview / download</strong> to open an issued document.</Bullet><Bullet>Open <Screen href="/partner/commissions">Earnings</Screen> to understand the commission status. The signed schedule controls eligible revenue, protection, holding, renewal, and payout timing.</Bullet><Bullet>Submit a payout request only after the earning is eligible and your payout details are verified. Payout timing remains subject to approval and the signed schedule.</Bullet><Bullet>Use <Screen href="/partner/support">Support</Screen> for access problems, lead decisions, customer issues, document gaps, or payout questions.</Bullet></ul>
        </GuideSection>
      </div>

      <div className="flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-retail" /> Keep customer data, pricing, payment evidence, and partner documents inside the approved MartPoint screens. The signed documents and written admin decisions are the source of truth.</div>
    </div>
  )
}

export function PartnerAdminGuide() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-700 p-7 text-white shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">MartPoint Admin · Partner Operations</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Partner Module: admin operating guide</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/80">Use this sequence from application review and commercial setup through activation, lead engagement, quote handling, customer invoicing, onboarding, and commission close.</p>
      </header>

      <Flow><FlowStep>Application</FlowStep><FlowStep>Review & meetings</FlowStep><FlowStep>Agreement + Schedule</FlowStep><FlowStep>Activation gates</FlowStep><FlowStep>Lead → quote</FlowStep><FlowStep>Customer → invoice</FlowStep><span className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-800">Payment → commission</span></Flow>

      <Handoff title="The key quote-to-cash rule" tone="amber"><p>A partner submitting a Quote Request does not create a Finance quote or invoice. Admin/Sales reviews the request and issues the quote reference. Once the customer accepts, Admin creates or confirms the customer business, creates the formal invoice in Finance, issues it to the customer&apos;s primary email, and Finance records the payment.</p></Handoff>

      <div className="space-y-4">
        <GuideSection number="1" title="Application intake: decide whether this is a partner application or a lead invite">
          <p>Open <Screen href="/admin/partners">Partners</Screen> and use <strong>Applications</strong> for people who want to become MartPoint partners. Use <Screen href="/admin/partners/prospects">Prospects</Screen> for an unattributed prospect who may be invited to apply.</p>
          <Handoff title="Do not invite a partner-owned customer lead to become a partner" tone="amber"><p>If a lead already has a <strong>partner_id</strong>, it belongs to that partner&apos;s referral workflow. It should be reviewed as a customer opportunity, not sent an &quot;Invite to Partner Application&quot; email. Application invitations are for an admin-created, unattributed prospect or lead.</p></Handoff>
        </GuideSection>

        <GuideSection number="2" title="Review the application, meetings, assessment, and documents">
          <ol className="list-decimal space-y-2 pl-5"><li>Open the application reference from <Screen href="/admin/partners/applications">Partners → Applications</Screen>.</li><li>Confirm identity, business details, requested partner type, geography, experience, documents, assessment results, and discovery notes.</li><li>Use the application meeting tools when a discovery call or other meeting is required. Record the outcome and any follow-up.</li><li>Request more information when evidence is incomplete; do not approve based only on an email or verbal promise.</li><li>Approve, reject, or conditionally approve according to the evidence and internal decision.</li></ol>
        </GuideSection>

        <GuideSection number="3" title="Create the Referral Partner Agreement and preview it">
          <p>Open the partner record and the signed instruments panel. Create the agreement draft, then progress it through the appropriate review and signature states.</p>
          <ol className="list-decimal space-y-2 pl-5"><li>Create draft.</li><li>Complete Legal review, Commercial review, Approved for signature, Sent for signature, and Executed as those events occur.</li><li>Select <strong>Bring into force</strong> only when this version should govern the live relationship.</li><li>Select <strong>Generate preview</strong> or <strong>Preview document</strong> to inspect the stored document.</li><li>Confirm it appears in <Screen href="/partner/documents">Partner Documents</Screen> for the partner.</li></ol>
          <p>If an executed or active record has no preview, generate it from the signed instruments panel. This creates the missing document representation without changing the commercial terms.</p>
        </GuideSection>

        <GuideSection number="4" title="Create and explain the Commission Schedule">
          <p>In the partner record, select <strong>Draft new version</strong>. Enter first-year rate, first-renewal rate, protection days, holding days, payout days after month-end, approved split, and the justification for any non-standard term.</p>
          <ul className="space-y-2"><Bullet>The displayed standard terms are 10% first year, 5% first renewal, 90-day protection, 30-day holding, and 14 days after month-end.</Bullet><Bullet>The schedule controls the commission engine. Do not create a code exception for a special rate.</Bullet><Bullet>Progress the schedule through review and signature. Use <strong>Generate preview</strong> or <strong>Preview document</strong>.</Bullet><Bullet>After it is generated, verify that the partner can open it in Documents and that the version/effective date matches the approved terms.</Bullet></ul>
        </GuideSection>

        <GuideSection number="5" title="Complete activation gates and give portal access">
          <p>Before activation, verify the partner record and identity, executed agreement, executed Commission Schedule, payout and tax profile, orientation, and conduct acknowledgement.</p>
          <ol className="list-decimal space-y-2 pl-5"><li>Open the partner record&apos;s readiness panel and resolve each missing gate.</li><li>Open the <strong>Users</strong> tab to invite the owner or additional partner users. Select the appropriate role and confirm the invitation email is sent.</li><li>Activate the partner only when all required gates are green. Activation seeds the permitted capabilities and creates the activation confirmation document.</li><li>Tell the partner to use <Screen href="/partner/login">Partner Login</Screen>, then use Forgot password if they need a reset.</li></ol>
        </GuideSection>

        <GuideSection number="6" title="Operate the partner&apos;s first engagement: lead → quote request">
          <p>The partner registers the customer opportunity in <Screen href="/partner/leads">Partner Portal → Leads</Screen>. Admin reviews it in <Screen href="/admin/partners/leads">Partners → Leads</Screen>, including status, protection, duplicate/matching information, and any requested information.</p>
          <p>When the partner submits a quote request, open the partner record&apos;s <strong>Quote Requests</strong> section. Choose:</p>
          <ul className="space-y-2"><Bullet><strong>Reviewing:</strong> Sales is working on the request.</Bullet><Bullet><strong>Issue quote:</strong> enter the approved quote reference and any decision note. The partner sees the issued status and reference.</Bullet><Bullet><strong>Decline:</strong> enter a clear reason that can be safely communicated to the partner.</Bullet></ul>
          <p>Do not treat an issued quote reference as a payment, customer conversion, invoice, or commission event.</p>
        </GuideSection>

        <GuideSection number="7" title="After the customer accepts: create the customer and formal invoice">
          <p>Use the accepted customer opportunity to enter the normal MartPoint customer and Finance workflow. If the partner referral has not yet been converted, review it in <Screen href="/admin/partners/referrals">Partners → Referral Decisions</Screen> and convert it when the business is ready.</p>
          <ol className="list-decimal space-y-2 pl-5"><li>Confirm the customer business record exists and its primary contact email is correct.</li><li>If using the formal Finance quote workflow, send the approved quote and record acceptance before conversion.</li><li>Open <Screen href="/admin/finance/invoices">Finance → Invoices</Screen>. Create an invoice for the customer business, add the agreed line items, check due date, public notes, tax, and total.</li><li>Select <strong>Issue</strong>. The system emails the invoice to the business&apos;s primary email and attaches a PDF.</li><li>If the customer needs the invoice again, open the invoice and select <strong>Send</strong>. Use <strong>Send reminder</strong> for a due or overdue balance.</li></ol>
          <Handoff title="Customer payment handoff" tone="green"><p>The invoice email tells the customer to quote the invoice number when paying by bank transfer and reply with proof of payment. Admin/Finance then opens the invoice, records the payment, confirms it, and sends the payment confirmation/receipt. The partner should not record the customer&apos;s payment or issue a parallel invoice.</p></Handoff>
        </GuideSection>

        <GuideSection number="8" title="Onboarding, deployment, and engagement after payment">
          <p>Open <Screen href="/admin/onboarding">Onboarding</Screen> for the converted customer. Initiate onboarding, send the setup questions, review responses and documents, update onboarding stages, and send access details when the account is ready.</p>
          <ul className="space-y-2"><Bullet>Use the business onboarding stages from intake and payment confirmation through information received, setup review, provisioning, business setup, training, and completion.</Bullet><Bullet>Assign the partner/customer relationship and use the <strong>Work Orders</strong> tab on the individual partner record for implementation scope, fees, due dates, milestones, and evidence.</Bullet><Bullet>Keep payment, access credentials, and sensitive customer information in the approved workflow; do not put them in a general support group.</Bullet></ul>
        </GuideSection>

        <GuideSection number="9" title="Commission close, payout, and ongoing partner care">
          <ul className="space-y-2"><Bullet>Acceptance starts protection; it does not create a commission.</Bullet><Bullet>Commission eligibility depends on the active signed schedule, eligible collected revenue, licence activation where required, and the holding period.</Bullet><Bullet>Review <Screen href="/admin/finance/commission-close">Finance → Commission Close</Screen> for month-end evaluation, approval, scheduling, and payout.</Bullet><Bullet>Use <Screen href="/admin/partners/payout-requests">Payout Requests</Screen> for partner requests and <Screen href="/admin/partners/bank-changes">Bank Changes</Screen> for re-verification and dual approval.</Bullet><Bullet>Maintain the partner relationship through Resources, Branding Requests, Assessments, Certifications, Support, and the activity history on the partner record.</Bullet></ul>
        </GuideSection>

        <GuideSection number="10" title="Troubleshooting and handoff checklist">
          <ul className="space-y-2"><Bullet><strong>Partner cannot see agreement or schedule:</strong> open the signed instrument, generate the preview document, then confirm it appears in Partner Documents.</Bullet><Bullet><strong>Partner sees a quote request but no invoice:</strong> this is expected until Admin/Sales creates and issues the formal Finance invoice to the customer business.</Bullet><Bullet><strong>Customer did not receive an invoice:</strong> verify the business primary email, confirm the invoice is Issued rather than Draft, then use Send again and check email logs.</Bullet><Bullet><strong>Lead invite looks wrong:</strong> confirm the lead has no partner owner. Partner-owned leads stay in the partner referral workflow.</Bullet><Bullet><strong>Commission is missing:</strong> check schedule execution, eligible collected revenue, licence activation, holding period, payment confirmation, and Finance approval before escalating.</Bullet></ul>
        </GuideSection>
      </div>

      <div className="flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /> Record every material decision in the relevant screen. The partner portal is for partner-facing status and work; customer billing and payment confirmation remain Admin/Finance responsibilities.</div>
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground"><ShieldCheck className="h-5 w-5 text-retail" /> Keep commercial changes in the signed instrument workflow so the portal, commission engine, documents, and audit trail agree.</div>
    </div>
  )
}
