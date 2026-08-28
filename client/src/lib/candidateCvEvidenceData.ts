/** Quiet Authority CV evidence data: explicit frontend demo evidence and Admin-only manual review state; no automatic extraction or score calculation. */
import { BUSINESS_DEVELOPMENT_MANAGER_ROLE_ID } from "@/lib/recruitmentRoleReferences";
import { getRoleCvCriteria, type CvEvidenceCriterion } from "@/lib/roleCvCriteriaData";

export type CvEvidenceItem = { source: string; period?: string; text: string; sectionReference?: string };
export type CvEvidenceReview = { rating: number | null; reviewNote: string };
export type CandidateCriterionEvidence = CvEvidenceReview & { criterionId: string; evidenceItems: CvEvidenceItem[] };
type ReviewStore = Record<string, Record<string, CvEvidenceReview>>;

export const CV_EVIDENCE_REVIEW_STORAGE_KEY = "recruitment-portal:admin-demo-cv-evidence-reviews";
const roleId = BUSINESS_DEVELOPMENT_MANAGER_ROLE_ID;
const evidence = (source: string, period: string | undefined, text: string): CvEvidenceItem => ({ source, period, text });

const candidateEvidence: Record<string, Record<string, CvEvidenceItem[]>> = {
  "app-chinedu-okafor": {
    "cv-criterion-bd-experience": [evidence("Experience · Crestline Solutions", "2022–Present", "Leads new-business development across corporate accounts, including prospecting, proposal development and client acquisition."), evidence("Experience · Northbridge Limited", "2020–2022", "Held a Senior Business Development Executive role focused on expanding enterprise relationships.")],
    "cv-criterion-prospecting": [evidence("Experience · Crestline Solutions", "2022–Present", "Built and maintained a prospect pipeline for corporate accounts through targeted outreach and stakeholder mapping.")],
    "cv-criterion-target-revenue": [evidence("Experience · Northbridge Limited", "2020–2022", "Managed an annual sales target of ₦120 million and reported monthly pipeline performance.")],
    "cv-criterion-account-management": [evidence("Experience · Crestline Solutions", "2022–Present", "Manages ongoing relationships with corporate clients after acquisition and coordinates commercial account activity.")],
    "cv-criterion-negotiation": [evidence("Experience · Crestline Solutions", "2022–Present", "Prepared commercial proposals and participated in agreement discussions with prospective clients.")],
    "cv-criterion-leadership": [],
    "cv-criterion-crm": [evidence("Experience · Northbridge Limited", "2020–2022", "Maintained opportunity records and produced monthly pipeline reporting for commercial leadership.")],
    "cv-criterion-achievements": [],
  },
  "app-amina-bello": {
    "cv-criterion-bd-experience": [evidence("Experience · Northstar Advisory", "2021–Present", "Leads Business Development initiatives for advisory services, from prospect identification through client conversion.")],
    "cv-criterion-prospecting": [evidence("Experience · Northstar Advisory", "2021–Present", "Established a repeatable outbound prospecting approach that opened new private-sector client conversations.")],
    "cv-criterion-target-revenue": [evidence("Experience · Northstar Advisory", "2021–Present", "Accountable for annual revenue objectives and quarterly commercial pipeline reviews.")],
    "cv-criterion-account-management": [evidence("Experience · Northstar Advisory", "2021–Present", "Oversees a portfolio of retained advisory accounts and renewal discussions.")],
    "cv-criterion-negotiation": [evidence("Experience · Northstar Advisory", "2021–Present", "Negotiated scopes and commercial terms for new client engagements."), evidence("Experience · Landmark Partners", "2018–2021", "Supported proposal close-out and contract renewals for key accounts.")],
    "cv-criterion-leadership": [evidence("Experience · Northstar Advisory", "2021–Present", "Coordinates two Business Development associates across prospect research and proposal preparation.")],
    "cv-criterion-crm": [evidence("Experience · Northstar Advisory", "2021–Present", "Uses CRM pipeline stages and weekly reporting to monitor commercial activity.")],
    "cv-criterion-achievements": [evidence("Selected achievements", undefined, "Exceeded annual new-client revenue objective in two consecutive years.")],
  },
  "app-ngozi-eze": {
    "cv-criterion-bd-experience": [evidence("Experience · Vertex Services", "2019–Present", "Responsible for developing new service-sector opportunities and managing commercial relationships.")],
    "cv-criterion-prospecting": [evidence("Experience · Vertex Services", "2019–Present", "Identified target organisations and initiated new-business outreach campaigns.")],
    "cv-criterion-target-revenue": [evidence("Experience · Vertex Services", "2019–Present", "Tracked revenue goals and opportunity values across the regional pipeline.")],
    "cv-criterion-account-management": [evidence("Experience · Vertex Services", "2019–Present", "Managed client accounts through ongoing service delivery discussions.")],
    "cv-criterion-negotiation": [evidence("Experience · Vertex Services", "2019–Present", "Contributed to commercial proposal and renewal negotiations.")],
    "cv-criterion-leadership": [],
    "cv-criterion-crm": [evidence("Experience · Vertex Services", "2019–Present", "Updated CRM records and prepared monthly sales reports.")],
    "cv-criterion-achievements": [evidence("Selected achievements", undefined, "Recognised for expanding regional client coverage during the previous financial year.")],
  },
  "app-kemi-adebayo": {
    "cv-criterion-bd-experience": [evidence("Experience · Fieldbridge Technologies", "2021–Present", "Manages partnership development and identifies commercial opportunities in technology services.")],
    "cv-criterion-prospecting": [evidence("Experience · Fieldbridge Technologies", "2021–Present", "Developed prospect lists and first-contact messaging for target partner segments.")],
    "cv-criterion-target-revenue": [],
    "cv-criterion-account-management": [evidence("Experience · Fieldbridge Technologies", "2021–Present", "Maintains partner relationships and supports account planning conversations.")],
    "cv-criterion-negotiation": [evidence("Experience · Fieldbridge Technologies", "2021–Present", "Participated in partner commercial-term discussions and proposal revisions.")],
    "cv-criterion-leadership": [evidence("Experience · Fieldbridge Technologies", "2021–Present", "Coordinates commercial activity with a small cross-functional growth team.")],
    "cv-criterion-crm": [evidence("Experience · Fieldbridge Technologies", "2021–Present", "Uses CRM reporting to monitor pipeline movement and next actions.")],
    "cv-criterion-achievements": [],
  },
  "app-ibrahim-musa": {
    "cv-criterion-bd-experience": [evidence("Experience · Sahara Distribution", "2020–Present", "Develops distributor and corporate customer relationships across a regional sales territory.")],
    "cv-criterion-prospecting": [evidence("Experience · Sahara Distribution", "2020–Present", "Generated new distributor leads through market visits and referral networks.")],
    "cv-criterion-target-revenue": [evidence("Experience · Sahara Distribution", "2020–Present", "Worked against regional sales targets and documented opportunity value.")],
    "cv-criterion-account-management": [evidence("Experience · Sahara Distribution", "2020–Present", "Supported ongoing distributor account relationships and issue resolution.")],
    "cv-criterion-negotiation": [],
    "cv-criterion-leadership": [],
    "cv-criterion-crm": [evidence("Experience · Sahara Distribution", "2020–Present", "Completed weekly sales activity and pipeline reports.")],
    "cv-criterion-achievements": [evidence("Selected achievements", undefined, "Expanded active distributor coverage within the assigned territory.")],
  },
  "app-adaobi-nwosu": {
    "cv-criterion-bd-experience": [evidence("Experience · Keystone Health", "2021–Present", "Leads growth partnerships and commercial relationship development for health-service partners.")],
    "cv-criterion-prospecting": [evidence("Experience · Keystone Health", "2021–Present", "Researched priority partner organisations and developed outbound engagement plans.")],
    "cv-criterion-target-revenue": [evidence("Experience · Keystone Health", "2021–Present", "Tracked partnership pipeline value and quarterly commercial targets.")],
    "cv-criterion-account-management": [evidence("Experience · Keystone Health", "2021–Present", "Managed partner onboarding and ongoing account coordination."), evidence("Experience · Medpoint Services", "2018–2021", "Supported client relationship management for service accounts.")],
    "cv-criterion-negotiation": [evidence("Experience · Keystone Health", "2021–Present", "Contributed to partnership scope and commercial terms discussions.")],
    "cv-criterion-leadership": [evidence("Experience · Keystone Health", "2021–Present", "Guides relationship coordinators on partner follow-up activity.")],
    "cv-criterion-crm": [evidence("Experience · Keystone Health", "2021–Present", "Maintained partnership records and reporting cadence in CRM."), evidence("Selected achievements", undefined, "Introduced a regular pipeline review routine for the partnerships team.")],
    "cv-criterion-achievements": [evidence("Selected achievements", undefined, "Supported launch of three new strategic partnership agreements.")],
  },
  "app-emeka-obi": {
    "cv-criterion-bd-experience": [evidence("Experience · PrimeAxis Logistics", "2020–Present", "Develops commercial opportunities with business customers in logistics services.")],
    "cv-criterion-prospecting": [evidence("Experience · PrimeAxis Logistics", "2020–Present", "Prospected manufacturing and retail businesses for logistics contracts.")],
    "cv-criterion-target-revenue": [],
    "cv-criterion-account-management": [evidence("Experience · PrimeAxis Logistics", "2020–Present", "Maintained relationships with new and existing commercial accounts.")],
    "cv-criterion-negotiation": [evidence("Experience · PrimeAxis Logistics", "2020–Present", "Supported quotation review and commercial close discussions.")],
    "cv-criterion-leadership": [],
    "cv-criterion-crm": [evidence("Experience · PrimeAxis Logistics", "2020–Present", "Recorded sales activity and account follow-up in CRM.")],
    "cv-criterion-achievements": [],
  },
};

const defaultReviews: ReviewStore = {
  "app-chinedu-okafor": {
    "cv-criterion-bd-experience": { rating: 4, reviewNote: "Direct Business Development experience is clearly described across two roles." },
    "cv-criterion-prospecting": { rating: 4, reviewNote: "Clear prospecting and stakeholder mapping evidence." },
    "cv-criterion-target-revenue": { rating: 4, reviewNote: "Target ownership is stated with a specific annual figure." },
    "cv-criterion-account-management": { rating: 3, reviewNote: "Ongoing client relationship responsibility is indicated." },
    "cv-criterion-negotiation": { rating: 3, reviewNote: "Participation is described, but outcomes are not detailed." },
    "cv-criterion-crm": { rating: 3, reviewNote: "CRM and reporting process experience is stated." },
  },
  "app-amina-bello": {
    "cv-criterion-bd-experience": { rating: 5, reviewNote: "" }, "cv-criterion-prospecting": { rating: 4, reviewNote: "" }, "cv-criterion-target-revenue": { rating: 4, reviewNote: "" }, "cv-criterion-account-management": { rating: 4, reviewNote: "" }, "cv-criterion-negotiation": { rating: 3, reviewNote: "" }, "cv-criterion-leadership": { rating: 4, reviewNote: "" }, "cv-criterion-crm": { rating: 4, reviewNote: "" }, "cv-criterion-achievements": { rating: 4, reviewNote: "" },
  },
};

function cloneReviewStore(value: ReviewStore) { return Object.fromEntries(Object.entries(value).map(([applicationId, reviews]) => [applicationId, Object.fromEntries(Object.entries(reviews).map(([criterionId, review]) => [criterionId, { ...review }]))])); }
function readReviews(): ReviewStore | null { if (typeof window === "undefined") return null; try { const stored = window.localStorage.getItem(CV_EVIDENCE_REVIEW_STORAGE_KEY); const parsed = stored ? JSON.parse(stored) : null; return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as ReviewStore : null; } catch { return null; } }
function reviewsForApplication(applicationId: string) { return (readReviews() ?? cloneReviewStore(defaultReviews))[applicationId] ?? {}; }
function validRating(value: unknown): value is number { return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 5; }

export function getCandidateCvEvidence(applicationId: string, configuredCriteria: CvEvidenceCriterion[] = getRoleCvCriteria(roleId)): CandidateCriterionEvidence[] {
  const reviews = reviewsForApplication(applicationId); const applicationEvidence = candidateEvidence[applicationId] ?? {};
  return configuredCriteria.map((criterion) => ({ criterionId: criterion.id, evidenceItems: [...(applicationEvidence[criterion.id] ?? [])], rating: validRating(reviews[criterion.id]?.rating) ? reviews[criterion.id].rating : null, reviewNote: reviews[criterion.id]?.reviewNote ?? "" }));
}

export function getCandidateCvEvidenceReviewSummary(applicationId: string, configuredCriteria: CvEvidenceCriterion[] = getRoleCvCriteria(roleId)) {
  const activeCriteria = configuredCriteria.filter((criterion) => criterion.status === "Active"); const reviews = getCandidateCvEvidence(applicationId, activeCriteria); const ratedCount = reviews.filter((review) => review.rating !== null).length;
  return { activeCriteria, reviews, ratedCount, totalCount: activeCriteria.length, complete: activeCriteria.length > 0 && ratedCount === activeCriteria.length, status: ratedCount === 0 ? "Not Started" : ratedCount === activeCriteria.length ? "Complete" : "In Progress" as "Not Started" | "In Progress" | "Complete" };
}

export function saveCandidateCvEvidenceReview(applicationId: string, reviews: CandidateCriterionEvidence[]) {
  const saved = readReviews() ?? cloneReviewStore(defaultReviews); const applicationReviews = Object.fromEntries(reviews.map((review) => [review.criterionId, { rating: validRating(review.rating) ? review.rating : null, reviewNote: review.reviewNote.trim() }]));
  if (typeof window !== "undefined") window.localStorage.setItem(CV_EVIDENCE_REVIEW_STORAGE_KEY, JSON.stringify({ ...saved, [applicationId]: applicationReviews }));
  return applicationReviews;
}
