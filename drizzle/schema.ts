import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, tinyint, uniqueIndex, index } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(), openId: varchar("openId", { length: 64 }).notNull().unique(), name: text("name"), email: varchar("email", { length: 320 }), loginMethod: varchar("loginMethod", { length: 64 }), role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(), passwordHash: varchar("password_hash", { length: 255 }), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(), lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const adminProfiles = mysqlTable("admin_profiles", {
  id: varchar("id", { length: 64 }).primaryKey(), authUserId: int("auth_user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }), email: varchar("email", { length: 320 }).notNull(), fullName: text("full_name"), role: mysqlEnum("role", ["Admin"]).notNull(), status: mysqlEnum("status", ["Active", "Inactive"]).notNull(), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const authSessions = mysqlTable("auth_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(), userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(), expiresAt: timestamp("expires_at").notNull(), createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({ userIndex: index("auth_sessions_user_idx").on(table.userId) }));

export const recruitmentRoles = mysqlTable("recruitment_roles", {
  id: varchar("id", { length: 64 }).primaryKey(), slug: varchar("slug", { length: 120 }).notNull().unique(), title: varchar("title", { length: 180 }).notNull(), department: varchar("department", { length: 160 }).notNull(), location: varchar("location", { length: 160 }).notNull(), employmentType: varchar("employment_type", { length: 80 }).notNull(), shortDescription: text("short_description").notNull(), fullDescription: text("full_description").notNull(), status: mysqlEnum("status", ["Draft", "Open", "Closed", "Archived"]).notNull(), openingDate: varchar("opening_date", { length: 32 }), closingDate: varchar("closing_date", { length: 32 }), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const eligibilityGates = mysqlTable("eligibility_gates", {
  id: varchar("id", { length: 64 }).primaryKey(), roleId: varchar("role_id", { length: 64 }).notNull().references(() => recruitmentRoles.id, { onDelete: "cascade" }), reference: varchar("reference", { length: 16 }).notNull(), name: varchar("name", { length: 180 }).notNull(), description: text("description").notNull(), gateType: varchar("gate_type", { length: 64 }).notNull(), status: mysqlEnum("status", ["Active", "Configuration Required", "Inactive"]).notNull(), displayOrder: int("display_order").notNull(), configuration: text("configuration").notNull(), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ roleReferenceUnique: uniqueIndex("eligibility_gates_role_reference_unique").on(table.roleId, table.reference), roleOrderIndex: index("eligibility_gates_role_order_idx").on(table.roleId, table.displayOrder) }));

export const assessmentDimensions = mysqlTable("assessment_dimensions", {
  id: varchar("id", { length: 64 }).primaryKey(), roleId: varchar("role_id", { length: 64 }).notNull().references(() => recruitmentRoles.id, { onDelete: "cascade" }), reference: varchar("reference", { length: 16 }).notNull(), name: varchar("name", { length: 180 }).notNull(), weight: int("weight").notNull(), minimumFloor: int("minimum_floor"), displayOrder: int("display_order").notNull(), status: mysqlEnum("status", ["Active", "Inactive"]).notNull(), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ roleReferenceUnique: uniqueIndex("assessment_dimensions_role_reference_unique").on(table.roleId, table.reference), roleOrderIndex: index("assessment_dimensions_role_order_idx").on(table.roleId, table.displayOrder) }));

export const assessmentQuestions = mysqlTable("assessment_questions", {
  id: varchar("id", { length: 96 }).primaryKey(), reference: varchar("reference", { length: 24 }).notNull().unique(), dimensionId: varchar("dimension_id", { length: 64 }).references(() => assessmentDimensions.id, { onDelete: "set null" }), questionType: mysqlEnum("question_type", ["GATE", "ORDINAL", "MULTI", "NUMERIC", "SJT", "OPEN", "EVIDENCE"]).notNull(), prompt: text("prompt").notNull(), helpText: text("help_text").notNull(), qWeight: int("q_weight"), maxScore: int("max_score"), required: tinyint("required").default(1).notNull(), status: mysqlEnum("status", ["Active", "Inactive", "Draft"]).notNull(), timeLimitSec: int("time_limit_sec"), scope: mysqlEnum("scope", ["QUESTION_BANK", "ROLE_ONLY"]).default("QUESTION_BANK").notNull(), ownerRoleId: varchar("owner_role_id", { length: 64 }).references(() => recruitmentRoles.id, { onDelete: "set null" }), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ typeIndex: index("assessment_questions_type_idx").on(table.questionType), dimensionIndex: index("assessment_questions_dimension_idx").on(table.dimensionId), scopeIndex: index("assessment_questions_scope_idx").on(table.scope) }));

export const questionOptions = mysqlTable("question_options", {
  id: varchar("id", { length: 96 }).primaryKey(), questionId: varchar("question_id", { length: 96 }).notNull().references(() => assessmentQuestions.id, { onDelete: "cascade" }), optionText: text("option_text").notNull(), displayOrder: int("display_order").notNull(), rawScore: int("raw_score"), isDecoy: tinyint("is_decoy").default(0).notNull(), outcomeType: varchar("outcome_type", { length: 64 }), relatedGateId: varchar("related_gate_id", { length: 64 }).references(() => eligibilityGates.id, { onDelete: "set null" }), internalExplanation: text("internal_explanation"), verificationMultiplier: decimal("verification_multiplier", { precision: 3, scale: 2 }), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ questionOrderUnique: uniqueIndex("question_options_question_order_unique").on(table.questionId, table.displayOrder), questionIndex: index("question_options_question_idx").on(table.questionId) }));

export const questionTypeConfigs = mysqlTable("question_type_configs", {
  id: varchar("id", { length: 96 }).primaryKey(), questionId: varchar("question_id", { length: 96 }).notNull().unique().references(() => assessmentQuestions.id, { onDelete: "cascade" }), configType: varchar("config_type", { length: 64 }).notNull(), configuration: text("configuration").notNull(), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const numericQuestionConfigs = mysqlTable("numeric_question_configs", {
  id: varchar("id", { length: 96 }).primaryKey(), questionId: varchar("question_id", { length: 96 }).notNull().unique().references(() => assessmentQuestions.id, { onDelete: "cascade" }), mode: mysqlEnum("mode", ["calendarYearExperience", "twoValueDerived"]).notNull(), inputDefinitions: text("input_definitions").notNull(), derivedCalculationType: varchar("derived_calculation_type", { length: 96 }).notNull(), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const numericScoringBands = mysqlTable("numeric_scoring_bands", {
  id: varchar("id", { length: 96 }).primaryKey(), questionId: varchar("question_id", { length: 96 }).notNull().references(() => assessmentQuestions.id, { onDelete: "cascade" }), lowerBound: decimal("lower_bound", { precision: 12, scale: 3 }), upperBound: decimal("upper_bound", { precision: 12, scale: 3 }), rawScore: int("raw_score").notNull(), displayOrder: int("display_order").notNull(), createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({ questionOrderUnique: uniqueIndex("numeric_bands_question_order_unique").on(table.questionId, table.displayOrder) }));

export const openQuestionConfigs = mysqlTable("open_question_configs", {
  id: varchar("id", { length: 96 }).primaryKey(), questionId: varchar("question_id", { length: 96 }).notNull().unique().references(() => assessmentQuestions.id, { onDelete: "cascade" }), minimumWords: int("minimum_words"), maximumWords: int("maximum_words"), timeLimitSec: int("time_limit_sec"), pasteAllowed: tinyint("paste_allowed").default(0).notNull(), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const openRubricAnchors = mysqlTable("open_rubric_anchors", {
  id: varchar("id", { length: 96 }).primaryKey(), questionId: varchar("question_id", { length: 96 }).notNull().references(() => assessmentQuestions.id, { onDelete: "cascade" }), scoreMin: int("score_min").notNull(), scoreMax: int("score_max").notNull(), anchorText: text("anchor_text").notNull(), displayOrder: int("display_order").notNull(),
}, (table) => ({ questionOrderUnique: uniqueIndex("open_rubric_anchors_question_order_unique").on(table.questionId, table.displayOrder) }));

export const questionEvidenceLinks = mysqlTable("question_evidence_links", {
  id: varchar("id", { length: 96 }).primaryKey(), evidenceQuestionId: varchar("evidence_question_id", { length: 96 }).notNull().references(() => assessmentQuestions.id, { onDelete: "cascade" }), claimedQuestionId: varchar("claimed_question_id", { length: 96 }).notNull().references(() => assessmentQuestions.id, { onDelete: "cascade" }), createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({ evidenceClaimedUnique: uniqueIndex("question_evidence_links_pair_unique").on(table.evidenceQuestionId, table.claimedQuestionId) }));

export const assessmentCrossChecks = mysqlTable("assessment_cross_checks", {
  id: varchar("id", { length: 96 }).primaryKey(), sourceQuestionId: varchar("source_question_id", { length: 96 }).notNull().references(() => assessmentQuestions.id, { onDelete: "cascade" }), comparisonQuestionId: varchar("comparison_question_id", { length: 96 }).notNull().references(() => assessmentQuestions.id, { onDelete: "cascade" }), ruleType: mysqlEnum("rule_type", ["Integrity flag", "Manual review"]).notNull(), ruleConfiguration: text("rule_configuration").notNull(), description: text("description").notNull(), defaultOutcome: varchar("default_outcome", { length: 64 }).notNull(), status: mysqlEnum("status", ["Active", "Inactive"]).notNull(), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ sourceComparisonUnique: uniqueIndex("assessment_cross_checks_pair_unique").on(table.sourceQuestionId, table.comparisonQuestionId) }));

export const assessments = mysqlTable("assessments", {
  id: varchar("id", { length: 96 }).primaryKey(), slug: varchar("slug", { length: 140 }).notNull(), roleId: varchar("role_id", { length: 64 }).notNull().references(() => recruitmentRoles.id, { onDelete: "cascade" }), name: varchar("name", { length: 180 }).notNull(), description: text("description").notNull(), status: mysqlEnum("status", ["Draft", "Active", "Inactive", "Archived"]).notNull(), version: int("version").notNull(), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ slugVersionUnique: uniqueIndex("assessments_slug_version_unique").on(table.slug, table.version), roleIndex: index("assessments_role_idx").on(table.roleId) }));

export const assessmentQuestionAssignments = mysqlTable("assessment_question_assignments", {
  id: varchar("id", { length: 120 }).primaryKey(), assessmentId: varchar("assessment_id", { length: 96 }).notNull().references(() => assessments.id, { onDelete: "cascade" }), questionId: varchar("question_id", { length: 96 }).notNull().references(() => assessmentQuestions.id, { onDelete: "cascade" }), displayOrder: int("display_order").notNull(), createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({ assessmentQuestionUnique: uniqueIndex("assessment_question_assignments_unique").on(table.assessmentId, table.questionId), assessmentOrderUnique: uniqueIndex("assessment_question_assignments_order_unique").on(table.assessmentId, table.displayOrder) }));

export const screeningConfigurations = mysqlTable("screening_configurations", {
  id: varchar("id", { length: 96 }).primaryKey(), roleId: varchar("role_id", { length: 64 }).notNull().references(() => recruitmentRoles.id, { onDelete: "cascade" }), assessmentId: varchar("assessment_id", { length: 96 }).references(() => assessments.id, { onDelete: "set null" }), verificationValues: text("verification_values").notNull(), integrityPenalty: int("integrity_penalty").notNull(), bonusCap: int("bonus_cap").notNull(), manualReviewRules: text("manual_review_rules").notNull(), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ roleAssessmentUnique: uniqueIndex("screening_configurations_role_assessment_unique").on(table.roleId, table.assessmentId) }));

export const screeningVerificationMultipliers = mysqlTable("screening_verification_multipliers", {
  id: varchar("id", { length: 96 }).primaryKey(), screeningConfigurationId: varchar("screening_configuration_id", { length: 96 }).notNull().references(() => screeningConfigurations.id, { onDelete: "cascade" }), code: varchar("code", { length: 64 }).notNull(), label: varchar("label", { length: 140 }).notNull(), multiplier: decimal("multiplier", { precision: 3, scale: 2 }).notNull(), displayOrder: int("display_order").notNull(),
}, (table) => ({ configCodeUnique: uniqueIndex("screening_verification_config_code_unique").on(table.screeningConfigurationId, table.code) }));

export const screeningBonusCriteria = mysqlTable("screening_bonus_criteria", {
  id: varchar("id", { length: 96 }).primaryKey(), screeningConfigurationId: varchar("screening_configuration_id", { length: 96 }).notNull().references(() => screeningConfigurations.id, { onDelete: "cascade" }), code: varchar("code", { length: 80 }).notNull(), label: varchar("label", { length: 220 }).notNull(), points: int("points").notNull(), displayOrder: int("display_order").notNull(),
}, (table) => ({ configCodeUnique: uniqueIndex("screening_bonus_config_code_unique").on(table.screeningConfigurationId, table.code) }));

export const screeningBands = mysqlTable("screening_bands", {
  id: varchar("id", { length: 96 }).primaryKey(), screeningConfigurationId: varchar("screening_configuration_id", { length: 96 }).notNull().references(() => screeningConfigurations.id, { onDelete: "cascade" }), band: mysqlEnum("band", ["A", "B", "C", "D"]).notNull(), minimumScore: decimal("minimum_score", { precision: 6, scale: 3 }).notNull(), maximumScore: decimal("maximum_score", { precision: 6, scale: 3 }), label: varchar("label", { length: 160 }).notNull(), displayOrder: int("display_order").notNull(),
}, (table) => ({ configBandUnique: uniqueIndex("screening_bands_config_band_unique").on(table.screeningConfigurationId, table.band) }));

export const dimensionFloorRules = mysqlTable("dimension_floor_rules", {
  id: varchar("id", { length: 96 }).primaryKey(), screeningConfigurationId: varchar("screening_configuration_id", { length: 96 }).notNull().references(() => screeningConfigurations.id, { onDelete: "cascade" }), dimensionId: varchar("dimension_id", { length: 64 }).notNull().references(() => assessmentDimensions.id, { onDelete: "cascade" }), minimumFloor: int("minimum_floor").notNull(), maximumAppliedBand: mysqlEnum("maximum_applied_band", ["A", "B", "C", "D"]).notNull(), description: text("description").notNull(),
}, (table) => ({ configDimensionUnique: uniqueIndex("dimension_floor_config_dimension_unique").on(table.screeningConfigurationId, table.dimensionId) }));

// ── Task 24D-1: Applicant runtime persistence ────────────────────────────────

export const applications = mysqlTable("applications", {
  id: varchar("id", { length: 64 }).primaryKey(),
  roleId: varchar("role_id", { length: 64 }).notNull().references(() => recruitmentRoles.id, { onDelete: "cascade" }),
  assessmentId: varchar("assessment_id", { length: 96 }),
  fullName: varchar("full_name", { length: 180 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 64 }).notNull(),
  city: varchar("city", { length: 160 }).notNull(),
  recentRole: varchar("recent_role", { length: 180 }).notNull(),
  recentEmployer: varchar("recent_employer", { length: 180 }),
  totalExperience: varchar("total_experience", { length: 64 }).notNull(),
  relevantExperience: varchar("relevant_experience", { length: 64 }).notNull(),
  linkedinUrl: varchar("linkedin_url", { length: 512 }),
  eligibilityStatus: mysqlEnum("eligibility_status", ["Pending", "Eligible", "Closed"]).notNull(),
  applicationStatus: mysqlEnum("application_status", ["In Progress", "Eligibility Closed", "Assessment In Progress", "Assessment Complete", "Submitted", "Shortlisted", "Hold", "Closed"]).notNull(),
  currentStep: varchar("current_step", { length: 64 }).notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  applicantTokenHash: varchar("applicant_token_hash", { length: 128 }).notNull(),
}, (table) => ({
  roleEmailIndex: index("applications_role_email_idx").on(table.roleId, table.email),
  tokenHashIndex: index("applications_token_hash_idx").on(table.applicantTokenHash),
}));

export const applicationEligibilityResponses = mysqlTable("application_eligibility_responses", {
  id: varchar("id", { length: 64 }).primaryKey(),
  applicationId: varchar("application_id", { length: 64 }).notNull().references(() => applications.id, { onDelete: "cascade" }),
  gateId: varchar("gate_id", { length: 16 }).notNull(),
  gateReference: varchar("gate_reference", { length: 16 }).notNull(),
  responseValue: text("response_value").notNull(),
  outcome: varchar("outcome", { length: 64 }).notNull(),
  internalFlag: varchar("internal_flag", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  applicationGateUnique: uniqueIndex("eligibility_responses_app_gate_unique").on(table.applicationId, table.gateId),
  applicationIndex: index("eligibility_responses_app_idx").on(table.applicationId),
}));

export const assessmentAttempts = mysqlTable("assessment_attempts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  applicationId: varchar("application_id", { length: 64 }).notNull().references(() => applications.id, { onDelete: "cascade" }),
  assessmentId: varchar("assessment_id", { length: 96 }).notNull().references(() => assessments.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", ["Not Started", "In Progress", "Complete"]).notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  applicationAssessmentIndex: index("attempts_app_assessment_idx").on(table.applicationId, table.assessmentId),
}));

export const assessmentResponses = mysqlTable("assessment_responses", {
  id: varchar("id", { length: 64 }).primaryKey(),
  attemptId: varchar("attempt_id", { length: 64 }).notNull().references(() => assessmentAttempts.id, { onDelete: "cascade" }),
  questionId: varchar("question_id", { length: 96 }).notNull().references(() => assessmentQuestions.id, { onDelete: "cascade" }),
  responseType: varchar("response_type", { length: 64 }).notNull(),
  responsePayload: text("response_payload").notNull(),
  startedAt: timestamp("started_at"),
  answeredAt: timestamp("answered_at"),
  elapsedSeconds: int("elapsed_seconds"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  attemptQuestionUnique: uniqueIndex("responses_attempt_question_unique").on(table.attemptId, table.questionId),
  attemptIndex: index("responses_attempt_idx").on(table.attemptId),
}));

// ── Task 24D-2: Scoring, review and Admin evaluation persistence ──────────────

export const openResponseReviews = mysqlTable("open_response_reviews", {
  id: varchar("id", { length: 64 }).primaryKey(),
  applicationId: varchar("application_id", { length: 64 }).notNull().references(() => applications.id, { onDelete: "cascade" }),
  attemptId: varchar("attempt_id", { length: 64 }).notNull().references(() => assessmentAttempts.id, { onDelete: "cascade" }),
  responseId: varchar("response_id", { length: 64 }).notNull().references(() => assessmentResponses.id, { onDelete: "cascade" }),
  questionId: varchar("question_id", { length: 96 }).notNull().references(() => assessmentQuestions.id, { onDelete: "cascade" }),
  adminProfileId: varchar("admin_profile_id", { length: 64 }).references(() => adminProfiles.id, { onDelete: "set null" }),
  rawScore: int("raw_score").notNull(),
  reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  responseQuestionUnique: uniqueIndex("open_reviews_response_question_unique").on(table.responseId, table.questionId),
  applicationIndex: index("open_reviews_app_idx").on(table.applicationId),
}));

export const applicationIntegrityFlags = mysqlTable("application_integrity_flags", {
  id: varchar("id", { length: 64 }).primaryKey(),
  applicationId: varchar("application_id", { length: 64 }).notNull().references(() => applications.id, { onDelete: "cascade" }),
  sourceQuestionId: varchar("source_question_id", { length: 96 }).notNull(),
  comparisonQuestionId: varchar("comparison_question_id", { length: 96 }),
  ruleId: varchar("rule_id", { length: 96 }),
  description: text("description").notNull(),
  source: varchar("source", { length: 96 }).notNull(),
  status: mysqlEnum("status", ["Clear", "Flagged", "Confirmed", "Dismissed"]).notNull(),
  confirmedBy: varchar("confirmed_by", { length: 64 }).references(() => adminProfiles.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  applicationIndex: index("integrity_flags_app_idx").on(table.applicationId),
}));

export const applicationBonusReviews = mysqlTable("application_bonus_reviews", {
  id: varchar("id", { length: 64 }).primaryKey(),
  applicationId: varchar("application_id", { length: 64 }).notNull().references(() => applications.id, { onDelete: "cascade" }),
  bonusType: varchar("bonus_type", { length: 80 }).notNull(),
  points: int("points").notNull(),
  confirmed: tinyint("confirmed").default(0).notNull(),
  adminProfileId: varchar("admin_profile_id", { length: 64 }).references(() => adminProfiles.id, { onDelete: "set null" }),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  applicationBonusUnique: uniqueIndex("bonus_reviews_app_type_unique").on(table.applicationId, table.bonusType),
  applicationIndex: index("bonus_reviews_app_idx").on(table.applicationId),
}));

export const applicationEvaluations = mysqlTable("application_evaluations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  applicationId: varchar("application_id", { length: 64 }).notNull().references(() => applications.id, { onDelete: "cascade" }),
  attemptId: varchar("attempt_id", { length: 64 }).notNull().references(() => assessmentAttempts.id, { onDelete: "cascade" }),
  baseAssessmentScore: decimal("base_assessment_score", { precision: 6, scale: 3 }),
  verificationMultiplier: decimal("verification_multiplier", { precision: 3, scale: 2 }),
  integrityPenalty: int("integrity_penalty"),
  bonus: int("bonus"),
  finalScreeningScore: decimal("final_screening_score", { precision: 6, scale: 3 }),
  rawBand: mysqlEnum("raw_band", ["A", "B", "C", "D"]),
  appliedBand: mysqlEnum("applied_band", ["A", "B", "C", "D"]),
  floorMissed: varchar("floor_missed", { length: 120 }),
  manualReviewRequired: tinyint("manual_review_required").default(0).notNull(),
  evaluationStatus: mysqlEnum("evaluation_status", ["Pending Assessment", "Pending OPEN Review", "Scored", "Manual Review Required"]).notNull(),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  applicationUnique: uniqueIndex("evaluations_app_unique").on(table.applicationId),
}));

export const applicationDimensionScores = mysqlTable("application_dimension_scores", {
  id: varchar("id", { length: 64 }).primaryKey(),
  applicationId: varchar("application_id", { length: 64 }).notNull().references(() => applications.id, { onDelete: "cascade" }),
  dimensionId: varchar("dimension_id", { length: 64 }).notNull(),
  dimensionReference: varchar("dimension_reference", { length: 16 }).notNull(),
  normalizedScore: decimal("normalized_score", { precision: 6, scale: 3 }).notNull(),
  weight: int("weight").notNull(),
  weightedContribution: decimal("weighted_contribution", { precision: 6, scale: 3 }).notNull(),
  floor: int("floor"),
  floorStatus: varchar("floor_status", { length: 32 }),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
}, (table) => ({
  applicationDimensionUnique: uniqueIndex("dimension_scores_app_dim_unique").on(table.applicationId, table.dimensionId),
  applicationIndex: index("dimension_scores_app_idx").on(table.applicationId),
}));

export const applicationShortlist = mysqlTable("application_shortlist", {
  id: varchar("id", { length: 64 }).primaryKey(),
  applicationId: varchar("application_id", { length: 64 }).notNull().references(() => applications.id, { onDelete: "cascade" }),
  shortlisted: tinyint("shortlisted").default(1).notNull(),
  updatedBy: varchar("updated_by", { length: 64 }).references(() => adminProfiles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  applicationUnique: uniqueIndex("shortlist_app_unique").on(table.applicationId),
}));

// ── Task 24G: CV upload metadata and manual CV review ────────────────────────
// CV file bytes live in object/file storage (never TiDB); the database stores
// only the metadata/reference. The CV review is a separate application-level
// record — it is intentionally NOT part of the assessment evaluation tables
// so the scoring engine never sees it.

export const applicationCvFiles = mysqlTable("application_cv_files", {
  id: varchar("id", { length: 64 }).primaryKey(),
  applicationId: varchar("application_id", { length: 64 }).notNull().references(() => applications.id, { onDelete: "cascade" }),
  storageKey: varchar("storage_key", { length: 256 }).notNull(),
  originalFilename: varchar("original_filename", { length: 320 }).notNull(),
  mimeType: varchar("mime_type", { length: 120 }).notNull(),
  fileSize: int("file_size").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  applicationUnique: uniqueIndex("cv_files_app_unique").on(table.applicationId),
}));

export const applicationCvReviews = mysqlTable("application_cv_reviews", {
  id: varchar("id", { length: 64 }).primaryKey(),
  applicationId: varchar("application_id", { length: 64 }).notNull().references(() => applications.id, { onDelete: "cascade" }),
  score: decimal("score", { precision: 5, scale: 1 }).notNull(),
  reviewNote: text("review_note"),
  reviewedBy: varchar("reviewed_by", { length: 64 }).references(() => adminProfiles.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  applicationUnique: uniqueIndex("cv_reviews_app_unique").on(table.applicationId),
}));

export type ApplicationCvFile = typeof applicationCvFiles.$inferSelect;
export type ApplicationCvReview = typeof applicationCvReviews.$inferSelect;

export type RecruitmentRole = typeof recruitmentRoles.$inferSelect;
export type AssessmentDimension = typeof assessmentDimensions.$inferSelect;
export type AssessmentQuestion = typeof assessmentQuestions.$inferSelect;
export type Assessment = typeof assessments.$inferSelect;
export type AuthUser = typeof users.$inferSelect;
export type AdminProfile = typeof adminProfiles.$inferSelect;
export type AuthSession = typeof authSessions.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type ApplicationEligibilityResponse = typeof applicationEligibilityResponses.$inferSelect;
export type AssessmentAttempt = typeof assessmentAttempts.$inferSelect;
export type AssessmentResponse = typeof assessmentResponses.$inferSelect;
export type OpenResponseReview = typeof openResponseReviews.$inferSelect;
export type ApplicationIntegrityFlag = typeof applicationIntegrityFlags.$inferSelect;
export type ApplicationBonusReview = typeof applicationBonusReviews.$inferSelect;
export type ApplicationEvaluation = typeof applicationEvaluations.$inferSelect;
export type ApplicationDimensionScore = typeof applicationDimensionScores.$inferSelect;
export type ApplicationShortlist = typeof applicationShortlist.$inferSelect;
