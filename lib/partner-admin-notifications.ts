import { notifyAllAdmins } from "./admin-notifications"
import type { AssessmentAssignment } from "./partner-assessments"
import { REPLY_TO } from "./email"

/** Server-only admin delivery for partner events that need human review. */
export async function notifyPartnerAssessmentReview(assignment: AssessmentAssignment): Promise<void> {
  await notifyAllAdmins({
    type: "PARTNER_ASSESSMENT_REVIEW_REQUIRED",
    title: "Partner assessment needs review",
    message: `${assignment.assigneeName || "Partner applicant"} submitted an assessment that needs manual review.`,
    deep_link: "/admin/partners/assessments",
    source_type: "partner_assessment_assignment",
    source_id: assignment.id,
    roles: ["Admin", "Sales"],
    email: {
      route: "partner_assessment_review",
      subject: "Partner Assessment Awaiting Review",
      text: `${assignment.assigneeName || "A partner applicant"} submitted an assessment that needs manual review.

Assessment: ${assignment.template.name}
Partner/application: ${assignment.partnerId || assignment.applicationId || "Not linked"}

Open Partner Assessments in the Admin Portal:
/admin/partners/assessments`,
      replyTo: REPLY_TO.partners,
    },
  })
}
