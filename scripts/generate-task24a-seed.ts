import { FRAMEWORK_QUESTIONS } from "@/lib/frameworkQuestionData";
import { getBusinessDevelopmentOfficerRole } from "@/lib/adminRoleData";
import { V2_BONUS_CAP, V2_BONUS_ITEMS, V2_DIMENSION_FLOORS, V2_INTEGRITY_PENALTY, V2_SCREENING_BANDS, V2_VERIFICATION_MULTIPLIERS } from "@/lib/v2ModifierScoring";

const role = getBusinessDevelopmentOfficerRole();
const roleId = role.id;
const assessmentId = "assessment-business-development-officer-v2";
const assessmentSlug = "business-development-officer-assessment-v2";
const screeningId = "screening-config-business-development-officer-v2";
const dimensionNames = { D1: "Business Development Track Record", D2: "Verified Commercial Results", D3: "Sector & Segment Relevance", D4: "Abuja Market Access", D5: "Commercial Judgement", D6: "Communication & Proposal Quality", D7: "Drive & Resilience", D8: "Tools & Digital Fluency" } as const;
const dimensionWeights = { D1: 22, D2: 18, D3: 14, D4: 12, D5: 12, D6: 8, D7: 8, D8: 6 } as const;
const sql = (value: unknown) => value === null || value === undefined ? "NULL" : typeof value === "number" ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
const json = (value: unknown) => JSON.stringify(value ?? {});
const rows: string[] = [];
const deferredEvidenceLinks: Array<{ id: string; evidenceQuestionId: string; claimedQuestionId: string }> = [];
const deferredCrossChecks: Array<{ id: string; sourceQuestionId: string; comparisonQuestionId: string; ruleType: string; ruleConfiguration: string; description: string; defaultOutcome: string; status: string }> = [];
const insert = (table: string, columns: string[], values: unknown[]) => rows.push(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${values.map(sql).join(",")}) ON DUPLICATE KEY UPDATE ${columns.slice(1).map((column) => `${column}=VALUES(${column})`).join(",")};`);

insert("recruitment_roles", ["id","slug","title","department","location","employment_type","short_description","full_description","status","opening_date","closing_date"], [roleId, role.slug, role.title, role.department, role.location, role.employmentType, role.shortDescription, role.fullDescription, role.status, role.openingDate, role.closingDate]);
// Role-specific configurable eligibility gates (Task 24E). Each gate's
// configuration declares its inputType, pass/fail rule, blocking flag and any
// supporting values. The server evaluator dispatches on inputType only — the
// reference strings below are labels, never branch keys.
type GateSeedRow = readonly [string, string, string, string, string, Record<string, unknown>];
const gates: GateSeedRow[] = [
  ["G1", "Abuja availability", "Which statement best describes your current location and availability to work in Abuja?", "eligibility", "Active", {
    inputType: "SINGLE_SELECT", label: "Abuja availability", isBlocking: true,
    options: [
      { value: "abuja", text: "I currently live in Abuja.", outcome: "PASS" },
      { value: "relocate", text: "I do not currently live in Abuja, but I am committed to relocating before the required start date.", outcome: "PASS_WITH_FLAG", flag: "Relocation commitment" },
      { value: "not-relocate", text: "I do not live in Abuja and I am not currently planning to relocate.", outcome: "FAIL" },
    ],
    allowSupplementaryField: true, supplementaryFieldKey: "plannedRelocationDate", supplementaryFieldLabel: "Planned relocation date", supplementaryFieldVisibleWhen: "relocate",
  }],
  ["G2", "Right to work in Nigeria", "Do you have the legal right to work in Nigeria?", "eligibility", "Active", { inputType: "YES_NO", label: "Right to work in Nigeria", passRule: { match: "yes" }, isBlocking: true }],
  ["G3", "Minimum Business Development experience", "Minimum 3 years in a Business Development, corporate sales or account management role. Evaluated from the Applicant Information field.", "eligibility", "Active", {
    inputType: "APPLICATION_FIELD", fieldKey: "relevantExperience", label: "Minimum Business Development experience", minimumYears: 3, isBlocking: true,
    experienceBandMinimumYears: { "No direct experience": 0, "Less than 1 year": 0, "1–2 years": 1, "3–5 years": 3, "6–8 years": 6, "9+ years": 9 },
  }],
  ["G4", "Start availability", "Are you available to start by 1 September 2026 or earlier?", "eligibility", "Active", { inputType: "YES_NO", label: "Start availability", latestStartDate: "2026-09-01", deadlineLabel: "1 September 2026", passRule: { match: "yes" }, isBlocking: true }],
  ["G5", "Compensation expectation", "Is your gross annual salary expectation within the range of ₦6,000,000 – ₦9,600,000?", "eligibility", "Active", { inputType: "YES_NO", label: "Compensation expectation", minimumAmount: 6000000, maximumAmount: 9600000, currency: "NGN", period: "gross annual", rangeLabel: "₦6,000,000 – ₦9,600,000 gross per annum", passRule: { match: "yes" }, isBlocking: true }],
  ["G6", "Outbound work", "Are you willing to work in an outbound Business Development role that may involve client visits, site tours, evening events and occasional weekend events?", "eligibility", "Active", { inputType: "YES_NO", label: "Outbound work", passRule: { match: "yes" }, isBlocking: true }],
  ["G7", "Reference and employment verification", "Do you consent to reference and employment verification as part of the recruitment process?", "eligibility", "Active", { inputType: "YES_NO", label: "Reference and employment verification", passRule: { match: "yes" }, isBlocking: true }],
];
gates.forEach(([reference, name, description, gateType, status, configuration], index) => insert("eligibility_gates", ["id","role_id","reference","name","description","gate_type","status","display_order","configuration"], [`gate-${reference.toLowerCase()}`, roleId, reference, name, description, gateType, status, index + 1, json(configuration)]));
(Object.keys(dimensionNames) as Array<keyof typeof dimensionNames>).forEach((reference, index) => insert("assessment_dimensions", ["id","role_id","reference","name","weight","minimum_floor","display_order","status"], [`dimension-${reference.toLowerCase()}`, roleId, reference, dimensionNames[reference], dimensionWeights[reference], V2_DIMENSION_FLOORS[reference as keyof typeof V2_DIMENSION_FLOORS] ?? null, index + 1, "Active"]));

for (const [questionIndex, question] of FRAMEWORK_QUESTIONS.entries()) {
  const dimensionId = question.dimension ? `dimension-${question.dimension.toLowerCase()}` : null;
  insert("assessment_questions", ["id","reference","dimension_id","question_type","prompt","help_text","q_weight","max_score","required","status","time_limit_sec"], [question.id, question.reference, dimensionId, question.type, question.prompt, question.helpText, question.qWeight, question.max, question.required ? 1 : 0, question.status, question.timeLimitSec]);
  insert("question_type_configs", [`id`,`question_id`,`config_type`,`configuration`], [`type-config-${question.id}`, question.id, question.type, json(question.config)]);
  const options = question.config.evidenceConfig?.options ?? question.config.ordinalConfig?.options ?? question.config.multiConfig?.options ?? question.config.sjtConfig?.options ?? question.options;
  // Use option.id (the logical key stored by the applicant runtime) as the
  // question_options primary key. The scoring engine performs
  // config.options.find(o => o.id === responsePayload) so the DB id must
  // exactly match the value the client writes to assessmentResponses.
  options.forEach((option, optionIndex) => insert("question_options", ["id","question_id","option_text","display_order","raw_score","is_decoy","outcome_type","related_gate_id","internal_explanation","verification_multiplier"], [option.id, question.id, option.text, optionIndex + 1, option.rawPoints ?? null, option.decoy ? 1 : 0, option.outcome ?? null, option.relatedGate ? `gate-${option.relatedGate.toLowerCase()}` : null, option.whatThisReveals ?? null, option.verificationMultiplier ?? null]));
  if (question.config.numericConfig) {
    const numericConfig = question.config.numericConfig;
    insert("numeric_question_configs", [`id`,`question_id`,`mode`,`input_definitions`,`derived_calculation_type`], [`numeric-config-${question.id}`, question.id, numericConfig.mode, json(numericConfig.inputs), numericConfig.mode === "calendarYearExperience" ? "calendar_year_to_derived_years" : "two_inputs_to_percentage_attainment"]);
    numericConfig.bands.forEach((band, bandIndex) => insert("numeric_scoring_bands", ["id","question_id","lower_bound","upper_bound","raw_score","display_order"], [`numeric-band-${question.id}-${bandIndex + 1}`, question.id, band.lowerBound, band.upperBound, band.rawPoints, bandIndex + 1]));
  }
  if (question.config.openConfig) {
    const openConfig = question.config.openConfig;
    insert("open_question_configs", [`id`,`question_id`,`minimum_words`,`maximum_words`,`time_limit_sec`,`paste_allowed`], [`open-config-${question.id}`, question.id, null, openConfig.wordLimit ?? null, openConfig.timeLimitSec ?? question.timeLimitSec, openConfig.pasteAllowed ? 1 : 0]);
    openConfig.rubric.forEach((anchor, anchorIndex) => insert("open_rubric_anchors", ["id","question_id","score_min","score_max","anchor_text","display_order"], [`rubric-${question.id}-${anchorIndex + 1}`, question.id, anchor.points, anchor.points, anchor.anchor, anchorIndex + 1]));
  }
  if (question.config.evidenceConfig?.pairedQuestionRef) deferredEvidenceLinks.push({ id: `evidence-link-${question.id}`, evidenceQuestionId: question.id, claimedQuestionId: FRAMEWORK_QUESTIONS.find((item) => item.reference === question.config.evidenceConfig?.pairedQuestionRef)?.id ?? "" });
  const crossCheck = question.config.crossCheck;
  if (crossCheck) {
    const reverseSource = question.reference === "D1.Q2" || question.reference === "D4.Q2";
    const comparisonQuestion = FRAMEWORK_QUESTIONS.find((item) => item.reference === crossCheck.compareQuestionRef);
    const sourceQuestionId = reverseSource ? comparisonQuestion?.id ?? "" : question.id;
    const comparisonQuestionId = reverseSource ? question.id : comparisonQuestion?.id ?? "";
    const isManualReview = question.reference === "D4.Q2" || crossCheck.flagOutcome !== "integrity";
    deferredCrossChecks.push({ id: `cross-check-${question.reference.replaceAll(".", "-")}`, sourceQuestionId, comparisonQuestionId, ruleType: isManualReview ? "Manual review" : "Integrity flag", ruleConfiguration: json({ compareQuestionRef: crossCheck.compareQuestionRef }), description: crossCheck.ruleDescription, defaultOutcome: isManualReview ? "Manual review" : "Integrity flag", status: "Active" });
  }
}
deferredEvidenceLinks.forEach((link) => insert("question_evidence_links", ["id","evidence_question_id","claimed_question_id"], [link.id, link.evidenceQuestionId, link.claimedQuestionId]));
deferredCrossChecks.forEach((check) => insert("assessment_cross_checks", ["id","source_question_id","comparison_question_id","rule_type","rule_configuration","description","default_outcome","status"], [check.id, check.sourceQuestionId, check.comparisonQuestionId, check.ruleType, check.ruleConfiguration, check.description, check.defaultOutcome, check.status]));
insert("assessments", ["id","slug","role_id","name","description","status","version"], [assessmentId, assessmentSlug, roleId, "Business Development Officer Assessment v2", "Role-specific screening assessment for the approved Business Development Officer v2 framework.", "Draft", 2]);
FRAMEWORK_QUESTIONS.forEach((question, index) => insert("assessment_question_assignments", ["id","assessment_id","question_id","display_order"], [`assignment-${assessmentId}-${index + 1}`, assessmentId, question.id, index + 1]));
insert("screening_configurations", ["id","role_id","assessment_id","verification_values","integrity_penalty","bonus_cap","manual_review_rules"], [screeningId, roleId, assessmentId, json(V2_VERIFICATION_MULTIPLIERS), V2_INTEGRITY_PENALTY, V2_BONUS_CAP, json({ confirmedIntegrityFlagsAtLeast: 2, outcome: "Manual Review Required", automaticRejection: false })]);
Object.entries(V2_VERIFICATION_MULTIPLIERS).forEach(([code, multiplier], index) => insert("screening_verification_multipliers", ["id","screening_configuration_id","code","label","multiplier","display_order"], [`verification-${code}`, screeningId, code, code === "fully" ? "Fully verified" : code === "partial" ? "Partial verification" : "Material claims not verified", multiplier, index + 1]));
V2_BONUS_ITEMS.forEach((item, index) => insert("screening_bonus_criteria", ["id","screening_configuration_id","code","label","points","display_order"], [`bonus-${item.id}`, screeningId, item.id, item.label, item.points, index + 1]));
V2_SCREENING_BANDS.forEach((band, index) => insert("screening_bands", ["id","screening_configuration_id","band","minimum_score","maximum_score","label","display_order"], [`band-${band.band.toLowerCase()}`, screeningId, band.band, band.minimum, band.band === "A" ? 100 : band.band === "B" ? 79.999 : band.band === "C" ? 64.999 : 49.999, band.label, index + 1]));
Object.entries(V2_DIMENSION_FLOORS).forEach(([dimension, minimum]) => insert("dimension_floor_rules", ["id","screening_configuration_id","dimension_id","minimum_floor","maximum_applied_band","description"], [`floor-${dimension.toLowerCase()}`, screeningId, `dimension-${dimension.toLowerCase()}`, minimum, "C", `${dimension} below ${minimum} caps the applied band at C.`]));
console.log(rows.join("\n"));
