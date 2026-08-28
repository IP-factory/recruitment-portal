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
  id: varchar("id", { length: 96 }).primaryKey(), reference: varchar("reference", { length: 24 }).notNull().unique(), dimensionId: varchar("dimension_id", { length: 64 }).references(() => assessmentDimensions.id, { onDelete: "set null" }), questionType: mysqlEnum("question_type", ["GATE", "ORDINAL", "MULTI", "NUMERIC", "SJT", "OPEN", "EVIDENCE"]).notNull(), prompt: text("prompt").notNull(), helpText: text("help_text").notNull(), qWeight: int("q_weight"), maxScore: int("max_score"), required: tinyint("required").default(1).notNull(), status: mysqlEnum("status", ["Active", "Inactive", "Draft"]).notNull(), timeLimitSec: int("time_limit_sec"), createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ typeIndex: index("assessment_questions_type_idx").on(table.questionType), dimensionIndex: index("assessment_questions_dimension_idx").on(table.dimensionId) }));

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

export type RecruitmentRole = typeof recruitmentRoles.$inferSelect;
export type AssessmentDimension = typeof assessmentDimensions.$inferSelect;
export type AssessmentQuestion = typeof assessmentQuestions.$inferSelect;
export type Assessment = typeof assessments.$inferSelect;
export type AuthUser = typeof users.$inferSelect;
export type AdminProfile = typeof adminProfiles.$inferSelect;
export type AuthSession = typeof authSessions.$inferSelect;
