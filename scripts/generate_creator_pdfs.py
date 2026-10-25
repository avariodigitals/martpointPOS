"""Generate the creator-safe PDF pack used by the MartPoint Creator portal.

These guides intentionally describe public product value, creator workflow and
challenge rules only. They do not copy internal routes, credentials,
infrastructure, database details, security findings or admin procedures.
"""

from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "creator-resources"
OUT.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor("#0A0F1C")
BLUE = colors.HexColor("#0057FF")
MINT = colors.HexColor("#DFF7EF")
INK = colors.HexColor("#172033")
MUTED = colors.HexColor("#5D687A")
LINE = colors.HexColor("#D9E0EA")


def styles():
    base = getSampleStyleSheet()
    return {
        "cover_kicker": ParagraphStyle(
            "cover_kicker", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=10, leading=13, textColor=MINT, alignment=TA_LEFT,
            spaceAfter=12,
        ),
        "cover_title": ParagraphStyle(
            "cover_title", parent=base["Title"], fontName="Helvetica-Bold",
            fontSize=28, leading=33, textColor=colors.white, alignment=TA_LEFT,
            spaceAfter=14,
        ),
        "cover_subtitle": ParagraphStyle(
            "cover_subtitle", parent=base["Normal"], fontName="Helvetica",
            fontSize=12, leading=18, textColor=colors.HexColor("#D8E4FF"),
            alignment=TA_LEFT,
        ),
        "h1": ParagraphStyle(
            "h1", parent=base["Heading1"], fontName="Helvetica-Bold",
            fontSize=19, leading=23, textColor=NAVY, spaceBefore=8, spaceAfter=10,
        ),
        "h2": ParagraphStyle(
            "h2", parent=base["Heading2"], fontName="Helvetica-Bold",
            fontSize=12.5, leading=16, textColor=BLUE, spaceBefore=10, spaceAfter=5,
        ),
        "body": ParagraphStyle(
            "body", parent=base["BodyText"], fontName="Helvetica",
            fontSize=9.6, leading=14, textColor=INK, spaceAfter=6,
        ),
        "small": ParagraphStyle(
            "small", parent=base["BodyText"], fontName="Helvetica",
            fontSize=8.3, leading=11, textColor=MUTED, spaceAfter=4,
        ),
        "bullet": ParagraphStyle(
            "bullet", parent=base["BodyText"], fontName="Helvetica",
            fontSize=9.3, leading=13, leftIndent=13, firstLineIndent=-8,
            textColor=INK, spaceAfter=4,
        ),
        "callout": ParagraphStyle(
            "callout", parent=base["BodyText"], fontName="Helvetica-Bold",
            fontSize=9.6, leading=14, textColor=NAVY, leftIndent=4,
            rightIndent=4, spaceAfter=5,
        ),
        "table_head": ParagraphStyle(
            "table_head", parent=base["BodyText"], fontName="Helvetica-Bold",
            fontSize=8.5, leading=11, textColor=colors.white,
        ),
        "table_body": ParagraphStyle(
            "table_body", parent=base["BodyText"], fontName="Helvetica",
            fontSize=8.1, leading=10.5, textColor=INK,
        ),
    }


S = styles()


def p(text, style="body"):
    return Paragraph(escape(text).replace("\n", "<br/>") , S[style])


def rich(text, style="body"):
    return Paragraph(text, S[style])


def bullets(items):
    return [p(f"- {item}", "bullet") for item in items]


def callout(text):
    table = Table([[p(text, "callout")]], colWidths=[170 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), MINT),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#9EDAC6")),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return table


def cover(title, subtitle):
    table = Table([
        [
            rich("MARTPOINT CREATOR NETWORK", "cover_kicker"),
        ],
        [rich(title, "cover_title")],
        [rich(subtitle, "cover_subtitle")],
    ], colWidths=[170 * mm], rowHeights=[16 * mm, 42 * mm, 28 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("LEFTPADDING", (0, 0), (-1, -1), 18),
        ("RIGHTPADDING", (0, 0), (-1, -1), 18),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return table


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 14 * mm, 192 * mm, 14 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 9 * mm, "MartPoint Creator Network")
    canvas.drawRightString(192 * mm, 9 * mm, f"Page {doc.page}")
    canvas.restoreState()


def table(rows, widths):
    rendered = []
    for row_index, row in enumerate(rows):
        style = "table_head" if row_index == 0 else "table_body"
        rendered.append([p(str(cell), style) for cell in row])
    t = Table(rendered, colWidths=widths, repeatRows=1, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F9FC")]),
    ]))
    return t


def build_product_guide(path):
    story = [
        cover(
            "Creator Content & Business Guide",
            "A practical, creator-safe guide to explaining how MartPoint helps real businesses run with more clarity.",
        ),
        Spacer(1, 12 * mm),
        p("Use this guide when planning a video, carousel, interview or demonstration. It is written for public creator content and does not require technical product knowledge.", "body"),
        callout("The safest rule: describe the business problem first, use only approved MartPoint assets, and never promise a result that MartPoint has not published."),
        p("What MartPoint helps with", "h1"),
        p("MartPoint brings everyday business records into one practical workspace. The exact setup depends on the business, but creators can safely explain these broad outcomes:", "body"),
        *bullets([
            "Record sales and issue customer receipts.",
            "Track products, quantities and stock movement.",
            "Keep customer records and follow-up information together.",
            "Review sales, stock and business reports instead of relying only on memory.",
            "Support online selling and customer enquiries where the business has those features enabled.",
            "Give owners clearer visibility across staff, products or branches where the selected setup supports it.",
        ]),
        p("How to explain it", "h1"),
        p("A strong creator explanation follows a simple sequence:", "body"),
        table([
            ["Step", "Creator prompt", "Example"],
            ["1. Hook", "Name a problem the audience recognises.", "You counted stock all night and still do not trust the number."],
            ["2. Context", "Show who experiences the problem.", "A busy shop owner with sales happening across the day."],
            ["3. MartPoint way", "Use the official screen or approved asset.", "Show the relevant sales, stock or report view."],
            ["4. Outcome", "Explain the practical improvement without exaggerating.", "The owner has a clearer record to review and act on."],
            ["5. CTA", "Give one next step.", "Book a free MartPoint demo - link in bio."],
        ], [25 * mm, 72 * mm, 73 * mm]),
        PageBreak(),
        p("Business-type angles", "h1"),
        p("Use the angle that matches the audience. Do not imply that one business has every feature or workflow shown in another business example.", "body"),
        table([
            ["Audience", "Problems to explore", "Safe content angle"],
            ["Supermarkets and grocery", "Fast checkout, many products, low-stock surprises, branch visibility.", "A busy day from shelf to checkout: how better records help the owner see what happened."],
            ["Restaurants and food", "Order mistakes, food cost, table flow, split payments and daily sales.", "Follow one order from customer request to payment and end-of-day review."],
            ["Pharmacies and health retail", "Product accuracy, expiry awareness, customer history and stock availability.", "Show why careful records matter when customers need the right product quickly."],
            ["Fashion, beauty and personal care", "Sizes, colours, styles, appointments and repeat customers.", "Show how a business can organise products or customer follow-up more clearly."],
            ["Electronics, phone and gadget stores", "Models, accessories, serial-aware sales, warranty follow-up and stock.", "Tell the story of a customer purchase and the record needed after the sale."],
            ["Wholesale, distribution and services", "Multiple customers, deliveries, invoices, jobs and payment follow-up.", "Show how one clear record helps the team know what is owed, delivered or next."],
        ], [39 * mm, 61 * mm, 70 * mm]),
        p("Approved language", "h1"),
        *bullets([
            "Say: helps you track, organise, review, record, monitor or understand.",
            "Say: features depend on the business setup and the current MartPoint product offering.",
            "Say: book a demo to see the right setup for your business.",
            "Avoid: guaranteed profit, guaranteed sales growth, zero theft, zero errors or instant results.",
            "Avoid inventing prices, discounts, integrations, screens or features.",
            "Avoid showing customer personal data, staff passwords, private business figures or internal dashboards.",
        ]),
        callout("If a feature is not in the approved Creator Kit or public MartPoint material, do not guess. Ask the MartPoint team before publishing."),
        PageBreak(),
        p("Before you publish", "h1"),
        *bullets([
            "Use official screenshots, logos, video and product descriptions from Creator Kit.",
            "Keep the content clear, honest and relevant to the chosen business type.",
            "Use the challenge brief requirements if the content is being submitted to a challenge.",
            "Include required disclosure and partnership wording where the platform requires it.",
            "Check names, numbers and product claims against the current public MartPoint information.",
            "Use one clear call-to-action and the correct creator tracking link when one has been issued.",
        ]),
        p("Simple formats that work", "h1"),
        *bullets([
            "A short before-and-after story: paper, memory or scattered messages versus a clearer record.",
            "A shop-owner interview: ask what is hardest to know at the end of a busy day.",
            "A screen-led explainer: show one approved workflow and explain the business value.",
            "A day-in-the-life skit: dramatise a familiar problem, then show a better way to organise it.",
            "A myth-versus-fact video: correct one common misunderstanding without attacking competitors.",
        ]),
        p("Sample CTA", "h1"),
        callout("Want to see what setup fits your business? Book a free MartPoint demo - use the link in my bio."),
        p("This guide is a public content aid. Challenge-specific rules, prizes, dates and submission requirements always take priority over general guidance.", "small"),
    ]
    doc = SimpleDocTemplate(
        str(path), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
        topMargin=16 * mm, bottomMargin=20 * mm, title="MartPoint Creator Content and Business Guide",
        author="MartPoint Creator Network",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def build_challenge_guide(path):
    story = [
        cover(
            "Creator Challenge & Tracking Guide",
            "How to join, create, submit, use your link and understand challenge performance.",
        ),
        Spacer(1, 12 * mm),
        p("This guide explains the normal challenge journey. Each challenge page remains the final source for its own dates, prizes, metrics and rules.", "body"),
        callout("Joining a challenge enters you into the published process. It does not guarantee payment or a prize."),
        p("The challenge journey", "h1"),
        table([
            ["Stage", "What you do", "What MartPoint does"],
            ["1. Prepare", "Complete the required Creator Centre lessons and review the brief.", "Confirms the challenge is suitable for eligible Creator Network members."],
            ["2. Join", "Read the terms, accept them and click Join challenge before the join window closes.", "Records your participation and the rules version you accepted."],
            ["3. Create", "Make original content that follows the brief and uses approved assets.", "Provides the content requirements, examples and prohibited claims."],
            ["4. Submit", "Publish publicly, then submit the public post URL before the deadline.", "Reviews the submission and may approve, request correction or reject it."],
            ["5. Measure", "Use the issued tracking link in an approved clickable placement.", "Records traffic, enquiries and verified performance for the challenge."],
            ["6. Decide", "Keep the post public and respond to reasonable evidence requests.", "Uses the published award rules, human review and verified data."],
        ], [28 * mm, 72 * mm, 70 * mm]),
        p("Your tracking links", "h1"),
        p("You do not create the link manually. Your creator account has a creator referral code, and an approved challenge submission can receive its own post-level token.", "body"),
        table([
            ["Link", "Use", "Example"],
            ["Creator link", "General creator-level traffic and referrals.", "https://www.martpoint.com.ng/?ref=MP-00001"],
            ["Submission link", "A specific approved challenge post.", "https://www.martpoint.com.ng/?ref=MP-00001&s=sub_..."],
        ], [32 * mm, 72 * mm, 66 * mm]),
        p("When someone clicks, MartPoint can connect the visit to the creator. Later enquiry, demo, signup or customer events may be attributed within the published attribution window.", "body"),
        PageBreak(),
        p("Where to place the link", "h1"),
        *bullets([
            "Profile bio or link-in-bio page.",
            "Story link or other platform-approved clickable placement.",
            "Pinned comment when the platform permits it.",
            "Another clear clickable destination allowed by the challenge brief.",
        ]),
        p("A post's views and likes are separate from link conversion. Reach and engagement come from platform evidence; clicks, enquiries and demos come through attributed MartPoint activity.", "body"),
        p("Challenge awards", "h1"),
        p("Awards are category-specific. A challenge may include performance, creative or overall awards. Read the exact expectation shown on the challenge page before you create.", "body"),
        table([
            ["Category lens", "What it can focus on"],
            ["Overall", "A balanced result using the published judging and verified performance method."],
            ["Conversion", "MartPoint-verified qualified enquiries, demos or other published outcomes - not raw clicks alone."],
            ["Reach", "Verified views or reach within the published comparable measurement window."],
            ["Creative", "Human judging of originality, clarity, accuracy and execution."],
            ["Rising", "Progress against the published baseline or threshold for the challenge."],
        ], [38 * mm, 132 * mm]),
        callout("High views do not automatically mean a conversion win. Raw clicks or unqualified traffic do not automatically count as a qualified outcome."),
        p("Integrity and evidence", "h1"),
        *bullets([
            "Submit real, publicly viewable content and keep it available during the challenge period.",
            "Do not buy engagement, use self-referrals, submit duplicate posts or alter evidence.",
            "MartPoint may ask for platform analytics or other reasonable proof.",
            "Unusual activity is reviewed by the MartPoint team; an automated signal is not the final decision.",
            "Low conversion by itself is not proof of wrongdoing. It is simply a performance result unless other evidence says otherwise.",
        ]),
        PageBreak(),
        p("Submission checklist", "h1"),
        *bullets([
            "The post is public and the URL opens without a private login.",
            "The content follows the challenge brief and uses the required platform, hashtags, mentions and CTA.",
            "Any product screen or logo shown is from the approved Creator Kit.",
            "The wording does not promise profit, guaranteed sales, fake discounts or unsupported features.",
            "The submitted post was published within the challenge's allowed timing.",
            "The correct tracking link is used in the permitted clickable placement.",
        ]),
        p("If your submission needs correction", "h1"),
        p("Read the feedback carefully, update the content where possible and resubmit the public URL before the deadline. A submission being returned for correction does not mean the challenge entry is permanently lost, but the challenge rules and deadline still apply.", "body"),
        p("When rules change", "h1"),
        p("Challenge rules are versioned. If a material change is made after you join, the portal will show the new version and ask you to review it. Your accepted version remains recorded for accountability.", "body"),
        callout("Use the challenge page for the exact dates, award amounts, thresholds and required wording. This guide explains the process; it does not replace the challenge brief."),
        p("Support", "h1"),
        p("Use the Creator Portal notifications, FAQ or support area when you need help. If a product claim is unclear, ask before publishing rather than guessing.", "body"),
    ]
    doc = SimpleDocTemplate(
        str(path), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
        topMargin=16 * mm, bottomMargin=20 * mm, title="MartPoint Creator Challenge and Tracking Guide",
        author="MartPoint Creator Network",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


if __name__ == "__main__":
    build_product_guide(OUT / "martpoint-creator-content-and-business-guide.pdf")
    build_challenge_guide(OUT / "martpoint-creator-challenge-and-tracking-guide.pdf")
    print("Generated creator-safe PDF pack in", OUT)
