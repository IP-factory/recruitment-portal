var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, tinyint, uniqueIndex, index } from "drizzle-orm/mysql-core";
var users, adminProfiles, authSessions, recruitmentRoles, eligibilityGates, assessmentDimensions, assessmentQuestions, questionOptions, questionTypeConfigs, numericQuestionConfigs, numericScoringBands, openQuestionConfigs, openRubricAnchors, questionEvidenceLinks, assessmentCrossChecks, assessments, assessmentQuestionAssignments, screeningConfigurations, screeningVerificationMultipliers, screeningBonusCriteria, screeningBands, dimensionFloorRules, applications, applicationEligibilityResponses, assessmentAttempts, assessmentResponses, openResponseReviews, applicationIntegrityFlags, applicationBonusReviews, applicationEvaluations, applicationDimensionScores, applicationShortlist;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    users = mysqlTable("users", {
      id: int("id").autoincrement().primaryKey(),
      openId: varchar("openId", { length: 64 }).notNull().unique(),
      name: text("name"),
      email: varchar("email", { length: 320 }),
      loginMethod: varchar("loginMethod", { length: 64 }),
      role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
      passwordHash: varchar("password_hash", { length: 255 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
      lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
    });
    adminProfiles = mysqlTable("admin_profiles", {
      id: varchar("id", { length: 64 }).primaryKey(),
      authUserId: int("auth_user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
      email: varchar("email", { length: 320 }).notNull(),
      fullName: text("full_name"),
      role: mysqlEnum("role", ["Admin"]).notNull(),
      status: mysqlEnum("status", ["Active", "Inactive"]).notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    });
    authSessions = mysqlTable("auth_sessions", {
      id: varchar("id", { length: 64 }).primaryKey(),
      userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
      expiresAt: timestamp("expires_at").notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull()
    }, (table) => ({ userIndex: index("auth_sessions_user_idx").on(table.userId) }));
    recruitmentRoles = mysqlTable("recruitment_roles", {
      id: varchar("id", { length: 64 }).primaryKey(),
      slug: varchar("slug", { length: 120 }).notNull().unique(),
      title: varchar("title", { length: 180 }).notNull(),
      department: varchar("department", { length: 160 }).notNull(),
      location: varchar("location", { length: 160 }).notNull(),
      employmentType: varchar("employment_type", { length: 80 }).notNull(),
      shortDescription: text("short_description").notNull(),
      fullDescription: text("full_description").notNull(),
      status: mysqlEnum("status", ["Draft", "Open", "Closed", "Archived"]).notNull(),
      openingDate: varchar("opening_date", { length: 32 }),
      closingDate: varchar("closing_date", { length: 32 }),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    });
    eligibilityGates = mysqlTable("eligibility_gates", {
      id: varchar("id", { length: 64 }).primaryKey(),
      roleId: varchar("role_id", { length: 64 }).notNull().references(() => recruitmentRoles.id, { onDelete: "cascade" }),
      reference: varchar("reference", { length: 16 }).notNull(),
      name: varchar("name", { length: 180 }).notNull(),
      description: text("description").notNull(),
      gateType: varchar("gate_type", { length: 64 }).notNull(),
      status: mysqlEnum("status", ["Active", "Configuration Required", "Inactive"]).notNull(),
      displayOrder: int("display_order").notNull(),
      configuration: text("configuration").notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    }, (table) => ({ roleReferenceUnique: uniqueIndex("eligibility_gates_role_reference_unique").on(table.roleId, table.reference), roleOrderIndex: index("eligibility_gates_role_order_idx").on(table.roleId, table.displayOrder) }));
    assessmentDimensions = mysqlTable("assessment_dimensions", {
      id: varchar("id", { length: 64 }).primaryKey(),
      roleId: varchar("role_id", { length: 64 }).notNull().references(() => recruitmentRoles.id, { onDelete: "cascade" }),
      reference: varchar("reference", { length: 16 }).notNull(),
      name: varchar("name", { length: 180 }).notNull(),
      weight: int("weight").notNull(),
      minimumFloor: int("minimum_floor"),
      displayOrder: int("display_order").notNull(),
      status: mysqlEnum("status", ["Active", "Inactive"]).notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    }, (table) => ({ roleReferenceUnique: uniqueIndex("assessment_dimensions_role_reference_unique").on(table.roleId, table.reference), roleOrderIndex: index("assessment_dimensions_role_order_idx").on(table.roleId, table.displayOrder) }));
    assessmentQuestions = mysqlTable("assessment_questions", {
      id: varchar("id", { length: 96 }).primaryKey(),
      reference: varchar("reference", { length: 24 }).notNull().unique(),
      dimensionId: varchar("dimension_id", { length: 64 }).references(() => assessmentDimensions.id, { onDelete: "set null" }),
      questionType: mysqlEnum("question_type", ["GATE", "ORDINAL", "MULTI", "NUMERIC", "SJT", "OPEN", "EVIDENCE"]).notNull(),
      prompt: text("prompt").notNull(),
      helpText: text("help_text").notNull(),
      qWeight: int("q_weight"),
      maxScore: int("max_score"),
      required: tinyint("required").default(1).notNull(),
      status: mysqlEnum("status", ["Active", "Inactive", "Draft"]).notNull(),
      timeLimitSec: int("time_limit_sec"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    }, (table) => ({ typeIndex: index("assessment_questions_type_idx").on(table.questionType), dimensionIndex: index("assessment_questions_dimension_idx").on(table.dimensionId) }));
    questionOptions = mysqlTable("question_options", {
      id: varchar("id", { length: 96 }).primaryKey(),
      questionId: varchar("question_id", { length: 96 }).notNull().references(() => assessmentQuestions.id, { onDelete: "cascade" }),
      optionText: text("option_text").notNull(),
      displayOrder: int("display_order").notNull(),
      rawScore: int("raw_score"),
      isDecoy: tinyint("is_decoy").default(0).notNull(),
      outcomeType: varchar("outcome_type", { length: 64 }),
      relatedGateId: varchar("related_gate_id", { length: 64 }).references(() => eligibilityGates.id, { onDelete: "set null" }),
      internalExplanation: text("internal_explanation"),
      verificationMultiplier: decimal("verification_multiplier", { precision: 3, scale: 2 }),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    }, (table) => ({ questionOrderUnique: uniqueIndex("question_options_question_order_unique").on(table.questionId, table.displayOrder), questionIndex: index("question_options_question_idx").on(table.questionId) }));
    questionTypeConfigs = mysqlTable("question_type_configs", {
      id: varchar("id", { length: 96 }).primaryKey(),
      questionId: varchar("question_id", { length: 96 }).notNull().unique().references(() => assessmentQuestions.id, { onDelete: "cascade" }),
      configType: varchar("config_type", { length: 64 }).notNull(),
      configuration: text("configuration").notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    });
    numericQuestionConfigs = mysqlTable("numeric_question_configs", {
      id: varchar("id", { length: 96 }).primaryKey(),
      questionId: varchar("question_id", { length: 96 }).notNull().unique().references(() => assessmentQuestions.id, { onDelete: "cascade" }),
      mode: mysqlEnum("mode", ["calendarYearExperience", "twoValueDerived"]).notNull(),
      inputDefinitions: text("input_definitions").notNull(),
      derivedCalculationType: varchar("derived_calculation_type", { length: 96 }).notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    });
    numericScoringBands = mysqlTable("numeric_scoring_bands", {
      id: varchar("id", { length: 96 }).primaryKey(),
      questionId: varchar("question_id", { length: 96 }).notNull().references(() => assessmentQuestions.id, { onDelete: "cascade" }),
      lowerBound: decimal("lower_bound", { precision: 12, scale: 3 }),
      upperBound: decimal("upper_bound", { precision: 12, scale: 3 }),
      rawScore: int("raw_score").notNull(),
      displayOrder: int("display_order").notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull()
    }, (table) => ({ questionOrderUnique: uniqueIndex("numeric_bands_question_order_unique").on(table.questionId, table.displayOrder) }));
    openQuestionConfigs = mysqlTable("open_question_configs", {
      id: varchar("id", { length: 96 }).primaryKey(),
      questionId: varchar("question_id", { length: 96 }).notNull().unique().references(() => assessmentQuestions.id, { onDelete: "cascade" }),
      minimumWords: int("minimum_words"),
      maximumWords: int("maximum_words"),
      timeLimitSec: int("time_limit_sec"),
      pasteAllowed: tinyint("paste_allowed").default(0).notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    });
    openRubricAnchors = mysqlTable("open_rubric_anchors", {
      id: varchar("id", { length: 96 }).primaryKey(),
      questionId: varchar("question_id", { length: 96 }).notNull().references(() => assessmentQuestions.id, { onDelete: "cascade" }),
      scoreMin: int("score_min").notNull(),
      scoreMax: int("score_max").notNull(),
      anchorText: text("anchor_text").notNull(),
      displayOrder: int("display_order").notNull()
    }, (table) => ({ questionOrderUnique: uniqueIndex("open_rubric_anchors_question_order_unique").on(table.questionId, table.displayOrder) }));
    questionEvidenceLinks = mysqlTable("question_evidence_links", {
      id: varchar("id", { length: 96 }).primaryKey(),
      evidenceQuestionId: varchar("evidence_question_id", { length: 96 }).notNull().references(() => assessmentQuestions.id, { onDelete: "cascade" }),
      claimedQuestionId: varchar("claimed_question_id", { length: 96 }).notNull().references(() => assessmentQuestions.id, { onDelete: "cascade" }),
      createdAt: timestamp("created_at").defaultNow().notNull()
    }, (table) => ({ evidenceClaimedUnique: uniqueIndex("question_evidence_links_pair_unique").on(table.evidenceQuestionId, table.claimedQuestionId) }));
    assessmentCrossChecks = mysqlTable("assessment_cross_checks", {
      id: varchar("id", { length: 96 }).primaryKey(),
      sourceQuestionId: varchar("source_question_id", { length: 96 }).notNull().references(() => assessmentQuestions.id, { onDelete: "cascade" }),
      comparisonQuestionId: varchar("comparison_question_id", { length: 96 }).notNull().references(() => assessmentQuestions.id, { onDelete: "cascade" }),
      ruleType: mysqlEnum("rule_type", ["Integrity flag", "Manual review"]).notNull(),
      ruleConfiguration: text("rule_configuration").notNull(),
      description: text("description").notNull(),
      defaultOutcome: varchar("default_outcome", { length: 64 }).notNull(),
      status: mysqlEnum("status", ["Active", "Inactive"]).notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    }, (table) => ({ sourceComparisonUnique: uniqueIndex("assessment_cross_checks_pair_unique").on(table.sourceQuestionId, table.comparisonQuestionId) }));
    assessments = mysqlTable("assessments", {
      id: varchar("id", { length: 96 }).primaryKey(),
      slug: varchar("slug", { length: 140 }).notNull(),
      roleId: varchar("role_id", { length: 64 }).notNull().references(() => recruitmentRoles.id, { onDelete: "cascade" }),
      name: varchar("name", { length: 180 }).notNull(),
      description: text("description").notNull(),
      status: mysqlEnum("status", ["Draft", "Active", "Inactive", "Archived"]).notNull(),
      version: int("version").notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    }, (table) => ({ slugVersionUnique: uniqueIndex("assessments_slug_version_unique").on(table.slug, table.version), roleIndex: index("assessments_role_idx").on(table.roleId) }));
    assessmentQuestionAssignments = mysqlTable("assessment_question_assignments", {
      id: varchar("id", { length: 120 }).primaryKey(),
      assessmentId: varchar("assessment_id", { length: 96 }).notNull().references(() => assessments.id, { onDelete: "cascade" }),
      questionId: varchar("question_id", { length: 96 }).notNull().references(() => assessmentQuestions.id, { onDelete: "cascade" }),
      displayOrder: int("display_order").notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull()
    }, (table) => ({ assessmentQuestionUnique: uniqueIndex("assessment_question_assignments_unique").on(table.assessmentId, table.questionId), assessmentOrderUnique: uniqueIndex("assessment_question_assignments_order_unique").on(table.assessmentId, table.displayOrder) }));
    screeningConfigurations = mysqlTable("screening_configurations", {
      id: varchar("id", { length: 96 }).primaryKey(),
      roleId: varchar("role_id", { length: 64 }).notNull().references(() => recruitmentRoles.id, { onDelete: "cascade" }),
      assessmentId: varchar("assessment_id", { length: 96 }).references(() => assessments.id, { onDelete: "set null" }),
      verificationValues: text("verification_values").notNull(),
      integrityPenalty: int("integrity_penalty").notNull(),
      bonusCap: int("bonus_cap").notNull(),
      manualReviewRules: text("manual_review_rules").notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    }, (table) => ({ roleAssessmentUnique: uniqueIndex("screening_configurations_role_assessment_unique").on(table.roleId, table.assessmentId) }));
    screeningVerificationMultipliers = mysqlTable("screening_verification_multipliers", {
      id: varchar("id", { length: 96 }).primaryKey(),
      screeningConfigurationId: varchar("screening_configuration_id", { length: 96 }).notNull().references(() => screeningConfigurations.id, { onDelete: "cascade" }),
      code: varchar("code", { length: 64 }).notNull(),
      label: varchar("label", { length: 140 }).notNull(),
      multiplier: decimal("multiplier", { precision: 3, scale: 2 }).notNull(),
      displayOrder: int("display_order").notNull()
    }, (table) => ({ configCodeUnique: uniqueIndex("screening_verification_config_code_unique").on(table.screeningConfigurationId, table.code) }));
    screeningBonusCriteria = mysqlTable("screening_bonus_criteria", {
      id: varchar("id", { length: 96 }).primaryKey(),
      screeningConfigurationId: varchar("screening_configuration_id", { length: 96 }).notNull().references(() => screeningConfigurations.id, { onDelete: "cascade" }),
      code: varchar("code", { length: 80 }).notNull(),
      label: varchar("label", { length: 220 }).notNull(),
      points: int("points").notNull(),
      displayOrder: int("display_order").notNull()
    }, (table) => ({ configCodeUnique: uniqueIndex("screening_bonus_config_code_unique").on(table.screeningConfigurationId, table.code) }));
    screeningBands = mysqlTable("screening_bands", {
      id: varchar("id", { length: 96 }).primaryKey(),
      screeningConfigurationId: varchar("screening_configuration_id", { length: 96 }).notNull().references(() => screeningConfigurations.id, { onDelete: "cascade" }),
      band: mysqlEnum("band", ["A", "B", "C", "D"]).notNull(),
      minimumScore: decimal("minimum_score", { precision: 6, scale: 3 }).notNull(),
      maximumScore: decimal("maximum_score", { precision: 6, scale: 3 }),
      label: varchar("label", { length: 160 }).notNull(),
      displayOrder: int("display_order").notNull()
    }, (table) => ({ configBandUnique: uniqueIndex("screening_bands_config_band_unique").on(table.screeningConfigurationId, table.band) }));
    dimensionFloorRules = mysqlTable("dimension_floor_rules", {
      id: varchar("id", { length: 96 }).primaryKey(),
      screeningConfigurationId: varchar("screening_configuration_id", { length: 96 }).notNull().references(() => screeningConfigurations.id, { onDelete: "cascade" }),
      dimensionId: varchar("dimension_id", { length: 64 }).notNull().references(() => assessmentDimensions.id, { onDelete: "cascade" }),
      minimumFloor: int("minimum_floor").notNull(),
      maximumAppliedBand: mysqlEnum("maximum_applied_band", ["A", "B", "C", "D"]).notNull(),
      description: text("description").notNull()
    }, (table) => ({ configDimensionUnique: uniqueIndex("dimension_floor_config_dimension_unique").on(table.screeningConfigurationId, table.dimensionId) }));
    applications = mysqlTable("applications", {
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
      applicantTokenHash: varchar("applicant_token_hash", { length: 128 }).notNull()
    }, (table) => ({
      roleEmailIndex: index("applications_role_email_idx").on(table.roleId, table.email),
      tokenHashIndex: index("applications_token_hash_idx").on(table.applicantTokenHash)
    }));
    applicationEligibilityResponses = mysqlTable("application_eligibility_responses", {
      id: varchar("id", { length: 64 }).primaryKey(),
      applicationId: varchar("application_id", { length: 64 }).notNull().references(() => applications.id, { onDelete: "cascade" }),
      gateId: varchar("gate_id", { length: 16 }).notNull(),
      gateReference: varchar("gate_reference", { length: 16 }).notNull(),
      responseValue: text("response_value").notNull(),
      outcome: varchar("outcome", { length: 64 }).notNull(),
      internalFlag: varchar("internal_flag", { length: 64 }),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    }, (table) => ({
      applicationGateUnique: uniqueIndex("eligibility_responses_app_gate_unique").on(table.applicationId, table.gateId),
      applicationIndex: index("eligibility_responses_app_idx").on(table.applicationId)
    }));
    assessmentAttempts = mysqlTable("assessment_attempts", {
      id: varchar("id", { length: 64 }).primaryKey(),
      applicationId: varchar("application_id", { length: 64 }).notNull().references(() => applications.id, { onDelete: "cascade" }),
      assessmentId: varchar("assessment_id", { length: 96 }).notNull().references(() => assessments.id, { onDelete: "cascade" }),
      status: mysqlEnum("status", ["Not Started", "In Progress", "Complete"]).notNull(),
      startedAt: timestamp("started_at").defaultNow().notNull(),
      completedAt: timestamp("completed_at"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    }, (table) => ({
      applicationAssessmentIndex: index("attempts_app_assessment_idx").on(table.applicationId, table.assessmentId)
    }));
    assessmentResponses = mysqlTable("assessment_responses", {
      id: varchar("id", { length: 64 }).primaryKey(),
      attemptId: varchar("attempt_id", { length: 64 }).notNull().references(() => assessmentAttempts.id, { onDelete: "cascade" }),
      questionId: varchar("question_id", { length: 96 }).notNull().references(() => assessmentQuestions.id, { onDelete: "cascade" }),
      responseType: varchar("response_type", { length: 64 }).notNull(),
      responsePayload: text("response_payload").notNull(),
      startedAt: timestamp("started_at"),
      answeredAt: timestamp("answered_at"),
      elapsedSeconds: int("elapsed_seconds"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    }, (table) => ({
      attemptQuestionUnique: uniqueIndex("responses_attempt_question_unique").on(table.attemptId, table.questionId),
      attemptIndex: index("responses_attempt_idx").on(table.attemptId)
    }));
    openResponseReviews = mysqlTable("open_response_reviews", {
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
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    }, (table) => ({
      responseQuestionUnique: uniqueIndex("open_reviews_response_question_unique").on(table.responseId, table.questionId),
      applicationIndex: index("open_reviews_app_idx").on(table.applicationId)
    }));
    applicationIntegrityFlags = mysqlTable("application_integrity_flags", {
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
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    }, (table) => ({
      applicationIndex: index("integrity_flags_app_idx").on(table.applicationId)
    }));
    applicationBonusReviews = mysqlTable("application_bonus_reviews", {
      id: varchar("id", { length: 64 }).primaryKey(),
      applicationId: varchar("application_id", { length: 64 }).notNull().references(() => applications.id, { onDelete: "cascade" }),
      bonusType: varchar("bonus_type", { length: 80 }).notNull(),
      points: int("points").notNull(),
      confirmed: tinyint("confirmed").default(0).notNull(),
      adminProfileId: varchar("admin_profile_id", { length: 64 }).references(() => adminProfiles.id, { onDelete: "set null" }),
      note: text("note"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    }, (table) => ({
      applicationBonusUnique: uniqueIndex("bonus_reviews_app_type_unique").on(table.applicationId, table.bonusType),
      applicationIndex: index("bonus_reviews_app_idx").on(table.applicationId)
    }));
    applicationEvaluations = mysqlTable("application_evaluations", {
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
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    }, (table) => ({
      applicationUnique: uniqueIndex("evaluations_app_unique").on(table.applicationId)
    }));
    applicationDimensionScores = mysqlTable("application_dimension_scores", {
      id: varchar("id", { length: 64 }).primaryKey(),
      applicationId: varchar("application_id", { length: 64 }).notNull().references(() => applications.id, { onDelete: "cascade" }),
      dimensionId: varchar("dimension_id", { length: 64 }).notNull(),
      dimensionReference: varchar("dimension_reference", { length: 16 }).notNull(),
      normalizedScore: decimal("normalized_score", { precision: 6, scale: 3 }).notNull(),
      weight: int("weight").notNull(),
      weightedContribution: decimal("weighted_contribution", { precision: 6, scale: 3 }).notNull(),
      floor: int("floor"),
      floorStatus: varchar("floor_status", { length: 32 }),
      calculatedAt: timestamp("calculated_at").defaultNow().notNull()
    }, (table) => ({
      applicationDimensionUnique: uniqueIndex("dimension_scores_app_dim_unique").on(table.applicationId, table.dimensionId),
      applicationIndex: index("dimension_scores_app_idx").on(table.applicationId)
    }));
    applicationShortlist = mysqlTable("application_shortlist", {
      id: varchar("id", { length: 64 }).primaryKey(),
      applicationId: varchar("application_id", { length: 64 }).notNull().references(() => applications.id, { onDelete: "cascade" }),
      shortlisted: tinyint("shortlisted").default(1).notNull(),
      updatedBy: varchar("updated_by", { length: 64 }).references(() => adminProfiles.id, { onDelete: "set null" }),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
    }, (table) => ({
      applicationUnique: uniqueIndex("shortlist_app_unique").on(table.applicationId)
    }));
  }
});

// shared/questionBankApi.ts
function isScoredQuestionType(type) {
  return SCORED_QUESTION_TYPES.includes(type);
}
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function isIntegerInRange(value, min, max) {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= min && value <= max;
}
function isNonEmptyString(value, maxLength = 4e3) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}
function validateOptionsArray(candidate, context) {
  if (!Array.isArray(candidate)) return [`${context} options are missing.`];
  if (candidate.length === 0) return [`Add at least one option to this ${context} question.`];
  return null;
}
function validateCrossCheck(candidate) {
  if (!candidate || typeof candidate !== "object") return { errors: ["Cross-check configuration is missing."] };
  const value = candidate;
  const errors = [];
  const comparisonQuestionReference = typeof value.comparisonQuestionReference === "string" ? value.comparisonQuestionReference.trim() : "";
  if (!comparisonQuestionReference) errors.push("Select the question to cross-check against.");
  const ruleType = value.ruleType;
  if (typeof ruleType !== "string" || !CROSS_CHECK_RULE_TYPES.includes(ruleType)) errors.push("Select a valid cross-check rule type.");
  const description = typeof value.description === "string" ? value.description.trim() : "";
  if (!description) errors.push("Describe the cross-check rule.");
  const defaultOutcome = typeof value.defaultOutcome === "string" && value.defaultOutcome.trim() ? value.defaultOutcome.trim() : ruleType;
  const status = value.status === "Inactive" ? "Inactive" : "Active";
  if (errors.length) return { errors };
  return { input: { comparisonQuestionReference, ruleType, description, defaultOutcome, status } };
}
function validateQuestionInput(candidate) {
  if (!candidate || typeof candidate !== "object") return { errors: ["Question data is missing."] };
  const value = candidate;
  const errors = [];
  const reference = typeof value.reference === "string" ? value.reference.trim() : "";
  if (!reference) errors.push("Enter a question reference.");
  else if (reference.length > QUESTION_REFERENCE_MAX_LENGTH) errors.push("Question reference is too long.");
  const dimensionReference = value.dimensionReference === "" || value.dimensionReference == null ? null : value.dimensionReference;
  if (dimensionReference !== null && (typeof dimensionReference !== "string" || !/^[A-Z0-9]{1,16}$/.test(dimensionReference))) {
    errors.push("Select a valid dimension.");
  }
  const type = value.type;
  if (typeof type !== "string" || !QUESTION_TYPES.includes(type)) {
    errors.push("Select a valid question type.");
    return { errors };
  }
  const questionType = type;
  const scored = isScoredQuestionType(questionType);
  const qWeight = value.qWeight == null ? null : value.qWeight;
  if (scored && !isIntegerInRange(qWeight, 1, 3)) errors.push("Question weight must be 1, 2 or 3.");
  if (!scored && qWeight != null) errors.push("Gate and evidence questions do not carry a question weight.");
  const prompt = typeof value.prompt === "string" ? value.prompt.trim() : "";
  if (!prompt) errors.push("Enter the question prompt.");
  const helpText = typeof value.helpText === "string" ? value.helpText.trim() : "";
  const status = value.status;
  if (typeof status !== "string" || !QUESTION_BANK_STATUSES.includes(status)) errors.push("Select a valid question status.");
  const timeLimitSec = value.timeLimitSec == null || value.timeLimitSec === "" ? null : value.timeLimitSec;
  if (timeLimitSec !== null && (!isFiniteNumber(timeLimitSec) || !Number.isInteger(timeLimitSec) || timeLimitSec <= 0)) {
    errors.push("The time limit must be a positive number of seconds.");
  }
  let crossCheck;
  if (value.crossCheck != null) {
    const checked = validateCrossCheck(value.crossCheck);
    if ("errors" in checked) errors.push(...checked.errors);
    else crossCheck = checked.input;
  }
  if (errors.length) return { errors };
  const base = {
    reference,
    dimensionReference,
    required: value.required !== false,
    prompt,
    helpText,
    status,
    timeLimitSec,
    ...crossCheck ? { crossCheck } : {}
  };
  switch (questionType) {
    case "GATE": {
      const optionErrors = validateOptionsArray(value.options, "gate");
      if (optionErrors) return { errors: optionErrors };
      const options = value.options.map((entry) => entry ?? {});
      options.forEach((option, index2) => {
        if (!isNonEmptyString(option.text)) errors.push(`Option ${index2 + 1} needs answer text.`);
        if (!isNonEmptyString(option.outcomeType, 64)) errors.push(`Option ${index2 + 1} needs a gate outcome.`);
      });
      if (errors.length) return { errors };
      return { input: { ...base, type: "GATE", options: options.map((option) => ({ text: option.text.trim(), outcomeType: option.outcomeType.trim() })) } };
    }
    case "ORDINAL": {
      const optionErrors = validateOptionsArray(value.options, "ordinal");
      if (optionErrors) return { errors: optionErrors };
      const options = value.options.map((entry) => entry ?? {});
      if (options.length < ORDINAL_MIN_OPTIONS || options.length > ORDINAL_MAX_OPTIONS) errors.push(`Ordinal questions need between ${ORDINAL_MIN_OPTIONS} and ${ORDINAL_MAX_OPTIONS} options.`);
      options.forEach((option, index2) => {
        const label = `Option ${index2 + 1}`;
        if (!isNonEmptyString(option.text)) errors.push(`${label} needs answer text.`);
        const closing = option.outcomeType === "close";
        if (closing) {
          if (option.rawScore != null) errors.push(`${label} closes the application and cannot carry a raw score.`);
        } else if (!isIntegerInRange(option.rawScore, 0, SCORED_QUESTION_MAX)) {
          errors.push(`${label} must score between 0 and ${SCORED_QUESTION_MAX} points.`);
        }
        if (option.relatedGateReference != null && option.relatedGateReference !== "" && !isNonEmptyString(option.relatedGateReference, 16)) {
          errors.push(`${label} references an invalid gate.`);
        }
        if (option.outcomeType != null && option.outcomeType !== "close") errors.push(`${label} has an unsupported outcome.`);
      });
      if (errors.length) return { errors };
      return {
        input: {
          ...base,
          type: "ORDINAL",
          qWeight,
          options: options.map((option) => ({
            text: option.text.trim(),
            rawScore: option.outcomeType === "close" ? null : option.rawScore,
            outcomeType: option.outcomeType === "close" ? "close" : null,
            relatedGateReference: option.outcomeType === "close" ? option.relatedGateReference ?? null : null
          }))
        }
      };
    }
    case "MULTI": {
      const optionErrors = validateOptionsArray(value.options, "multi-select");
      if (optionErrors) return { errors: optionErrors };
      const options = value.options.map((entry) => entry ?? {});
      const scoreCap = value.scoreCap == null ? MULTI_DEFAULT_SCORE_CAP : value.scoreCap;
      if (!isIntegerInRange(scoreCap, 1, 25)) errors.push("The multi-select score cap must be a positive number.");
      let scoredCount = 0;
      options.forEach((option, index2) => {
        const label = `Option ${index2 + 1}`;
        if (!isNonEmptyString(option.text)) errors.push(`${label} needs answer text.`);
        const isDecoy = option.isDecoy === true;
        if (isDecoy) {
          if (option.rawScore !== -1) errors.push(`${label} is a decoy and must score \u22121.`);
        } else {
          scoredCount += 1;
          if (!isIntegerInRange(option.rawScore, 0, MULTI_SCORE_MAX)) errors.push(`${label} must score between 0 and ${MULTI_SCORE_MAX} points.`);
        }
      });
      if (scoredCount === 0) errors.push("Multi-select questions need at least one scorable option.");
      if (errors.length) return { errors };
      return {
        input: {
          ...base,
          type: "MULTI",
          qWeight,
          scoreCap,
          options: options.map((option) => ({ text: option.text.trim(), rawScore: option.rawScore, isDecoy: option.isDecoy === true }))
        }
      };
    }
    case "NUMERIC": {
      const config = value.numericConfig ?? {};
      const mode = config.mode;
      if (mode !== "calendarYearExperience" && mode !== "twoValueDerived") errors.push("Select a valid numeric scoring mode.");
      const inputs = Array.isArray(config.inputDefinitions) ? config.inputDefinitions.map((entry) => entry ?? {}) : [];
      if (inputs.length === 0) errors.push("Numeric questions need at least one input definition.");
      inputs.forEach((input, index2) => {
        if (!isNonEmptyString(input.label, 160)) errors.push(`Input ${index2 + 1} needs a label.`);
      });
      if (mode === "twoValueDerived" && inputs.length !== 2) errors.push("Two-value derived questions need exactly two inputs.");
      const bands = Array.isArray(config.bands) ? config.bands.map((entry) => entry ?? {}) : [];
      if (bands.length === 0) errors.push("Numeric questions need at least one scoring band.");
      const ranges = [];
      bands.forEach((band, index2) => {
        const label = `Band ${index2 + 1}`;
        if (!isFiniteNumber(band.lowerBound)) errors.push(`${label} needs a lower bound.`);
        const upper = band.upperBound == null ? null : band.upperBound;
        if (upper !== null && !isFiniteNumber(upper)) errors.push(`${label} has an invalid upper bound.`);
        if (isFiniteNumber(band.lowerBound) && upper !== null && isFiniteNumber(upper) && upper < band.lowerBound) {
          errors.push(`${label} cannot end below its lower bound.`);
        }
        if (!isIntegerInRange(band.rawScore, 0, SCORED_QUESTION_MAX)) errors.push(`${label} must score between 0 and ${SCORED_QUESTION_MAX} points.`);
        if (isFiniteNumber(band.lowerBound)) ranges.push([band.lowerBound, upper !== null && isFiniteNumber(upper) ? upper : Number.POSITIVE_INFINITY]);
      });
      const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
      for (let index2 = 1; index2 < sorted.length; index2 += 1) {
        if (sorted[index2][0] <= sorted[index2 - 1][1]) {
          errors.push("Numeric scoring bands must not overlap.");
          break;
        }
      }
      const derivedCalculationType = isNonEmptyString(config.derivedCalculationType, 96) ? config.derivedCalculationType.trim() : DEFAULT_DERIVED_CALCULATION[mode];
      if (errors.length) return { errors };
      return {
        input: {
          ...base,
          type: "NUMERIC",
          qWeight,
          numericConfig: {
            mode,
            inputDefinitions: inputs.map((input) => ({ label: input.label.trim(), unit: typeof input.unit === "string" ? input.unit.trim() : "" })),
            derivedCalculationType,
            bands: bands.map((band) => ({ lowerBound: band.lowerBound, upperBound: band.upperBound == null ? null : band.upperBound, rawScore: band.rawScore }))
          }
        }
      };
    }
    case "SJT": {
      const optionErrors = validateOptionsArray(value.options, "scenario");
      if (optionErrors) return { errors: optionErrors };
      const options = value.options.map((entry) => entry ?? {});
      if (options.length !== SJT_OPTION_COUNT) errors.push(`Scenario questions need exactly ${SJT_OPTION_COUNT} options.`);
      options.forEach((option, index2) => {
        const label = `Option ${index2 + 1}`;
        if (!isNonEmptyString(option.text)) errors.push(`${label} needs answer text.`);
        if (!isIntegerInRange(option.rawScore, SJT_SCORE_MIN, SJT_SCORE_MAX)) errors.push(`${label} must score between ${SJT_SCORE_MIN} and ${SJT_SCORE_MAX} points.`);
        if (!isNonEmptyString(option.internalExplanation)) errors.push(`${label} needs an internal explanation.`);
      });
      if (errors.length) return { errors };
      return {
        input: {
          ...base,
          type: "SJT",
          qWeight,
          options: options.map((option) => ({ text: option.text.trim(), rawScore: option.rawScore, internalExplanation: option.internalExplanation.trim() }))
        }
      };
    }
    case "OPEN": {
      const config = value.openConfig ?? {};
      const minimumWords = config.minimumWords == null ? null : config.minimumWords;
      const maximumWords = config.maximumWords == null ? null : config.maximumWords;
      if (minimumWords !== null && !isIntegerInRange(minimumWords, 1, 1e4)) errors.push("The minimum word count must be a positive number.");
      if (maximumWords !== null && !isIntegerInRange(maximumWords, 1, 1e4)) errors.push("The maximum word count must be a positive number.");
      if (minimumWords !== null && maximumWords !== null && isFiniteNumber(minimumWords) && isFiniteNumber(maximumWords) && minimumWords > maximumWords) {
        errors.push("The minimum word count cannot exceed the maximum.");
      }
      const configTimeLimit = config.timeLimitSec == null ? null : config.timeLimitSec;
      if (configTimeLimit !== null && (!isFiniteNumber(configTimeLimit) || !Number.isInteger(configTimeLimit) || configTimeLimit <= 0)) {
        errors.push("The time limit must be a positive number of seconds.");
      }
      const rubric = Array.isArray(config.rubric) ? config.rubric.map((entry) => entry ?? {}) : [];
      if (rubric.length === 0) errors.push("Open questions need at least one rubric anchor.");
      rubric.forEach((anchor, index2) => {
        const label = `Rubric anchor ${index2 + 1}`;
        const scoreMin = anchor.scoreMin;
        const scoreMax = anchor.scoreMax;
        const minValid = isIntegerInRange(scoreMin, 0, SCORED_QUESTION_MAX);
        const maxValid = isIntegerInRange(scoreMax, 0, SCORED_QUESTION_MAX);
        if (!minValid) errors.push(`${label} needs a valid minimum score.`);
        if (!maxValid) errors.push(`${label} needs a valid maximum score.`);
        if (minValid && maxValid && scoreMax < scoreMin) {
          errors.push(`${label} cannot end below its minimum score.`);
        }
        if (!isNonEmptyString(anchor.anchorText)) errors.push(`${label} needs anchor text.`);
      });
      if (errors.length) return { errors };
      return {
        input: {
          ...base,
          type: "OPEN",
          qWeight,
          openConfig: {
            minimumWords,
            maximumWords,
            timeLimitSec: configTimeLimit,
            pasteAllowed: config.pasteAllowed === true,
            rubric: rubric.map((anchor) => ({ scoreMin: anchor.scoreMin, scoreMax: anchor.scoreMax, anchorText: anchor.anchorText.trim() }))
          }
        }
      };
    }
    case "EVIDENCE": {
      const optionErrors = validateOptionsArray(value.options, "evidence");
      if (optionErrors) return { errors: optionErrors };
      const options = value.options.map((entry) => entry ?? {});
      const claimedQuestionReference = typeof value.claimedQuestionReference === "string" ? value.claimedQuestionReference.trim() : "";
      if (!claimedQuestionReference) errors.push("Select the claimed question this evidence verifies.");
      else if (claimedQuestionReference === reference) errors.push("An evidence question cannot verify itself.");
      options.forEach((option, index2) => {
        const label = `Option ${index2 + 1}`;
        if (!isNonEmptyString(option.text)) errors.push(`${label} needs answer text.`);
        const multiplier = option.verificationMultiplier;
        if (!isFiniteNumber(multiplier) || !EVIDENCE_MULTIPLIERS.some((allowed) => Math.abs(allowed - multiplier) < 1e-4)) {
          errors.push(`${label} must use a verification multiplier of 1.00, 0.95 or 0.85.`);
        }
      });
      if (errors.length) return { errors };
      return {
        input: {
          ...base,
          type: "EVIDENCE",
          claimedQuestionReference,
          options: options.map((option) => ({ text: option.text.trim(), verificationMultiplier: option.verificationMultiplier }))
        }
      };
    }
  }
}
function formatUsedInLabel(name, status) {
  return status === "Active" ? name : `${name} \u2014 ${status}`;
}
var QUESTION_TYPES, QUESTION_BANK_STATUSES, SCORED_QUESTION_TYPES, CROSS_CHECK_RULE_TYPES, EVIDENCE_MULTIPLIERS, SCORED_QUESTION_MAX, QUESTION_REFERENCE_MAX_LENGTH, SJT_OPTION_COUNT, SJT_SCORE_MIN, SJT_SCORE_MAX, MULTI_SCORE_MAX, MULTI_DEFAULT_SCORE_CAP, ORDINAL_MIN_OPTIONS, ORDINAL_MAX_OPTIONS, DEFAULT_DERIVED_CALCULATION;
var init_questionBankApi = __esm({
  "shared/questionBankApi.ts"() {
    "use strict";
    QUESTION_TYPES = ["GATE", "ORDINAL", "MULTI", "NUMERIC", "SJT", "OPEN", "EVIDENCE"];
    QUESTION_BANK_STATUSES = ["Active", "Inactive"];
    SCORED_QUESTION_TYPES = ["ORDINAL", "MULTI", "NUMERIC", "SJT", "OPEN"];
    CROSS_CHECK_RULE_TYPES = ["Integrity flag", "Manual review"];
    EVIDENCE_MULTIPLIERS = [1, 0.95, 0.85];
    SCORED_QUESTION_MAX = 5;
    QUESTION_REFERENCE_MAX_LENGTH = 24;
    SJT_OPTION_COUNT = 4;
    SJT_SCORE_MIN = -2;
    SJT_SCORE_MAX = 5;
    MULTI_SCORE_MAX = 5;
    MULTI_DEFAULT_SCORE_CAP = 5;
    ORDINAL_MIN_OPTIONS = 4;
    ORDINAL_MAX_OPTIONS = 5;
    DEFAULT_DERIVED_CALCULATION = {
      calendarYearExperience: "calendar_year_to_derived_years",
      twoValueDerived: "two_inputs_to_percentage_attainment"
    };
  }
});

// server/questionBankRepository.ts
import { randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
async function getQuestionDimensions() {
  const db = getDatabase();
  const rows = await db.select({ reference: assessmentDimensions.reference, name: assessmentDimensions.name }).from(assessmentDimensions).orderBy(asc(assessmentDimensions.displayOrder));
  const seen = /* @__PURE__ */ new Set();
  return rows.filter((row) => seen.has(row.reference) ? false : (seen.add(row.reference), true));
}
async function listQuestions(query) {
  const db = getDatabase();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 10));
  const search = query.search?.trim() ?? "";
  const conditions = [];
  if (search) {
    const term = `%${search}%`;
    conditions.push(or(like(assessmentQuestions.reference, term), like(assessmentQuestions.prompt, term)));
  }
  if (query.type) conditions.push(eq(assessmentQuestions.questionType, query.type));
  if (query.status) conditions.push(eq(assessmentQuestions.status, query.status));
  if (query.dimension === "GATE") conditions.push(isNull(assessmentQuestions.dimensionId));
  else if (query.dimension) conditions.push(eq(assessmentDimensions.reference, query.dimension));
  const where = conditions.length ? and(...conditions) : void 0;
  const joinDimension = () => db.select({
    id: assessmentQuestions.id,
    reference: assessmentQuestions.reference,
    questionType: assessmentQuestions.questionType,
    qWeight: assessmentQuestions.qWeight,
    status: assessmentQuestions.status,
    prompt: assessmentQuestions.prompt,
    dimensionReference: assessmentDimensions.reference,
    dimensionName: assessmentDimensions.name
  }).from(assessmentQuestions).leftJoin(assessmentDimensions, eq(assessmentQuestions.dimensionId, assessmentDimensions.id));
  const [totalRow] = await db.select({ value: count() }).from(assessmentQuestions).leftJoin(assessmentDimensions, eq(assessmentQuestions.dimensionId, assessmentDimensions.id)).where(where);
  const total = totalRow?.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const sortKey = query.sortKey && SORT_COLUMNS[query.sortKey] ? query.sortKey : "reference";
  const sortColumn = SORT_COLUMNS[sortKey];
  const ordered = query.sortDirection === "desc" ? desc(sortColumn) : asc(sortColumn);
  const rows = await joinDimension().where(where).orderBy(ordered, asc(assessmentQuestions.reference)).limit(pageSize).offset((Math.min(page, totalPages) - 1) * pageSize);
  const usedInByQuestion = await getUsedInLabels(rows.map((row) => row.id));
  const [dimensions, summary] = await Promise.all([getQuestionDimensions(), getQuestionBankSummary()]);
  const items = rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    type: row.questionType,
    dimension: row.dimensionReference ? { reference: row.dimensionReference, name: row.dimensionName ?? row.dimensionReference } : null,
    qWeight: row.qWeight,
    status: row.status,
    prompt: row.prompt,
    usedIn: usedInByQuestion.get(row.id) ?? []
  }));
  return { items, total, page: Math.min(page, totalPages), pageSize, totalPages, dimensions, summary };
}
async function getQuestionBankSummary() {
  const db = getDatabase();
  const [totalRow, activeRow] = await Promise.all([
    db.select({ value: count() }).from(assessmentQuestions),
    db.select({ value: count() }).from(assessmentQuestions).where(eq(assessmentQuestions.status, "Active"))
  ]);
  const dimensions = await getQuestionDimensions();
  return { total: totalRow[0]?.value ?? 0, active: activeRow[0]?.value ?? 0, dimensionCount: dimensions.length };
}
async function getUsedInLabels(questionIds) {
  const result = /* @__PURE__ */ new Map();
  if (questionIds.length === 0) return result;
  const db = getDatabase();
  const assignments = await db.select().from(assessmentQuestionAssignments).where(inArray(assessmentQuestionAssignments.questionId, questionIds));
  if (assignments.length === 0) return result;
  const assessmentRows = await db.select().from(assessments).where(inArray(assessments.id, Array.from(new Set(assignments.map((row) => row.assessmentId)))));
  const assessmentById = new Map(assessmentRows.map((row) => [row.id, row]));
  for (const assignment of assignments) {
    const assessment = assessmentById.get(assignment.assessmentId);
    if (!assessment) continue;
    const label = formatUsedInLabel(assessment.name, assessment.status);
    const existing = result.get(assignment.questionId) ?? [];
    existing.push(label);
    result.set(assignment.questionId, existing);
  }
  return result;
}
async function getQuestionById(id) {
  const db = getDatabase();
  return (await db.select().from(assessmentQuestions).where(eq(assessmentQuestions.id, id)).limit(1))[0] ?? null;
}
async function getQuestionByReference(reference) {
  const db = getDatabase();
  return (await db.select().from(assessmentQuestions).where(eq(assessmentQuestions.reference, reference)).limit(1))[0] ?? null;
}
async function getQuestionByIdOrReference(idOrReference) {
  return await getQuestionById(idOrReference) ?? await getQuestionByReference(idOrReference);
}
async function getQuestionOptions(questionId) {
  const db = getDatabase();
  const rows = await db.select({
    displayOrder: questionOptions.displayOrder,
    text: questionOptions.optionText,
    rawScore: questionOptions.rawScore,
    isDecoy: questionOptions.isDecoy,
    outcomeType: questionOptions.outcomeType,
    internalExplanation: questionOptions.internalExplanation,
    verificationMultiplier: questionOptions.verificationMultiplier,
    gateReference: eligibilityGates.reference,
    gateName: eligibilityGates.name
  }).from(questionOptions).leftJoin(eligibilityGates, eq(questionOptions.relatedGateId, eligibilityGates.id)).where(eq(questionOptions.questionId, questionId)).orderBy(asc(questionOptions.displayOrder));
  return rows.map((row) => ({
    displayOrder: row.displayOrder,
    text: row.text,
    rawScore: row.rawScore,
    isDecoy: Boolean(row.isDecoy),
    outcomeType: row.outcomeType,
    relatedGate: row.gateReference ? { reference: row.gateReference, name: row.gateName ?? row.gateReference } : null,
    internalExplanation: row.internalExplanation,
    verificationMultiplier: row.verificationMultiplier === null ? null : Number(row.verificationMultiplier)
  }));
}
async function getNumericConfig(questionId) {
  const db = getDatabase();
  const row = (await db.select().from(numericQuestionConfigs).where(eq(numericQuestionConfigs.questionId, questionId)).limit(1))[0];
  if (!row) return null;
  const inputDefinitions = parseJson(row.inputDefinitions, []).map((entry) => ({ label: entry.label ?? "", unit: entry.unit ?? "" }));
  return { mode: row.mode, inputDefinitions, derivedCalculationType: row.derivedCalculationType };
}
async function getNumericBands(questionId) {
  const db = getDatabase();
  const rows = await db.select().from(numericScoringBands).where(eq(numericScoringBands.questionId, questionId)).orderBy(asc(numericScoringBands.displayOrder));
  return rows.map((row) => ({ lowerBound: Number(row.lowerBound), upperBound: row.upperBound === null ? null : Number(row.upperBound), rawScore: row.rawScore, displayOrder: row.displayOrder }));
}
async function getOpenConfig(questionId) {
  const db = getDatabase();
  const row = (await db.select().from(openQuestionConfigs).where(eq(openQuestionConfigs.questionId, questionId)).limit(1))[0];
  if (!row) return null;
  return { minimumWords: row.minimumWords, maximumWords: row.maximumWords, timeLimitSec: row.timeLimitSec, pasteAllowed: Boolean(row.pasteAllowed) };
}
async function getOpenRubrics(questionId) {
  const db = getDatabase();
  const rows = await db.select().from(openRubricAnchors).where(eq(openRubricAnchors.questionId, questionId)).orderBy(asc(openRubricAnchors.displayOrder));
  return rows.map((row) => ({ scoreMin: row.scoreMin, scoreMax: row.scoreMax, anchorText: row.anchorText, displayOrder: row.displayOrder }));
}
async function getEvidenceLink(questionId) {
  const db = getDatabase();
  const rows = await db.select({ claimedQuestionId: questionEvidenceLinks.claimedQuestionId, claimedReference: assessmentQuestions.reference }).from(questionEvidenceLinks).innerJoin(assessmentQuestions, eq(questionEvidenceLinks.claimedQuestionId, assessmentQuestions.id)).where(eq(questionEvidenceLinks.evidenceQuestionId, questionId)).limit(1);
  const row = rows[0];
  return row ? { claimedQuestionId: row.claimedQuestionId, claimedQuestionReference: row.claimedReference } : null;
}
async function getQuestionCrossChecks(questionId) {
  const db = getDatabase();
  const rows = await db.select({
    id: assessmentCrossChecks.id,
    sourceQuestionId: assessmentCrossChecks.sourceQuestionId,
    comparisonQuestionId: assessmentCrossChecks.comparisonQuestionId,
    ruleType: assessmentCrossChecks.ruleType,
    description: assessmentCrossChecks.description,
    defaultOutcome: assessmentCrossChecks.defaultOutcome,
    status: assessmentCrossChecks.status,
    sourceReference: sql`sq.reference`,
    comparisonReference: sql`cq.reference`
  }).from(assessmentCrossChecks).innerJoin(sql`assessment_questions sq`, sql`sq.id = ${assessmentCrossChecks.sourceQuestionId}`).innerJoin(sql`assessment_questions cq`, sql`cq.id = ${assessmentCrossChecks.comparisonQuestionId}`).where(or(eq(assessmentCrossChecks.sourceQuestionId, questionId), eq(assessmentCrossChecks.comparisonQuestionId, questionId)));
  return rows.map((row) => ({
    id: row.id,
    direction: row.sourceQuestionId === questionId ? "source" : "comparison",
    otherQuestionReference: row.sourceQuestionId === questionId ? row.comparisonReference : row.sourceReference,
    ruleType: row.ruleType,
    description: row.description,
    defaultOutcome: row.defaultOutcome,
    status: row.status
  }));
}
async function getMultiScoreCap(questionId) {
  const db = getDatabase();
  const row = (await db.select({ configuration: questionTypeConfigs.configuration }).from(questionTypeConfigs).where(eq(questionTypeConfigs.questionId, questionId)).limit(1))[0];
  if (!row) return null;
  const configuration = parseJson(row.configuration, {});
  return typeof configuration.multiConfig?.scoreCap === "number" ? configuration.multiConfig.scoreCap : null;
}
async function getQuestionDetail(idOrReference) {
  const db = getDatabase();
  const question = await getQuestionByIdOrReference(idOrReference);
  if (!question) return null;
  const dimensionRows = question.dimensionId ? await db.select({ reference: assessmentDimensions.reference, name: assessmentDimensions.name }).from(assessmentDimensions).where(eq(assessmentDimensions.id, question.dimensionId)).limit(1) : [];
  const dimension = dimensionRows[0] ? { reference: dimensionRows[0].reference, name: dimensionRows[0].name } : null;
  const [options, numericConfig, numericBands, openConfig, openRubric, evidenceLink, crossChecks, usedInByQuestion, scoreCap] = await Promise.all([
    getQuestionOptions(question.id),
    getNumericConfig(question.id),
    getNumericBands(question.id),
    getOpenConfig(question.id),
    getOpenRubrics(question.id),
    getEvidenceLink(question.id),
    getQuestionCrossChecks(question.id),
    getUsedInLabels([question.id]),
    getMultiScoreCap(question.id)
  ]);
  return {
    id: question.id,
    reference: question.reference,
    type: question.questionType,
    dimension,
    qWeight: question.qWeight,
    maxScore: question.maxScore,
    required: Boolean(question.required),
    prompt: question.prompt,
    helpText: question.helpText,
    status: question.status,
    timeLimitSec: question.timeLimitSec,
    usedIn: usedInByQuestion.get(question.id) ?? [],
    options,
    scoreCap,
    numericConfig: numericConfig ? { ...numericConfig, bands: numericBands } : null,
    openConfig: openConfig ? { ...openConfig, rubric: openRubric } : null,
    evidenceLink,
    crossChecks,
    updatedAt: new Date(question.updatedAt).toISOString()
  };
}
async function resolveDimensionId(tx, dimensionReference) {
  if (!dimensionReference) return null;
  const rows = await tx.select({ id: assessmentDimensions.id }).from(assessmentDimensions).where(eq(assessmentDimensions.reference, dimensionReference)).limit(1);
  if (!rows[0]) throw new QuestionBankValidationError("The selected dimension does not exist.");
  return rows[0].id;
}
async function resolveGateId(tx, gateReference) {
  if (!gateReference) return null;
  const rows = await tx.select({ id: eligibilityGates.id }).from(eligibilityGates).where(eq(eligibilityGates.reference, gateReference)).limit(1);
  if (!rows[0]) throw new QuestionBankValidationError(`The related gate "${gateReference}" does not exist.`);
  return rows[0].id;
}
function buildTypeConfigSnapshot(input) {
  const letter = (index2) => String.fromCharCode(97 + index2);
  const letterLabel = (index2) => String.fromCharCode(65 + index2);
  if (input.type === "GATE") {
    const options2 = input.options.map((option, index2) => ({ id: letter(index2), label: letterLabel(index2), text: option.text, gateOutcome: option.outcomeType }));
    return JSON.stringify({ gateConfig: { options: options2 } });
  }
  if (input.type === "ORDINAL") {
    const options2 = input.options.map((option, index2) => {
      const base = { id: letter(index2), label: letterLabel(index2), text: option.text };
      if (option.rawScore !== null) base.rawPoints = option.rawScore;
      if (option.outcomeType === "close") {
        base.outcome = "close";
        if (option.relatedGateReference) base.relatedGate = option.relatedGateReference;
      }
      return base;
    });
    return JSON.stringify({ ordinalConfig: { options: options2 } });
  }
  if (input.type === "SJT") {
    const options2 = input.options.map((option, index2) => ({ id: letter(index2), label: letterLabel(index2), text: option.text, rawPoints: option.rawScore, whatThisReveals: option.internalExplanation }));
    return JSON.stringify({ sjtConfig: { options: options2 } });
  }
  if (input.type === "MULTI") {
    const options2 = input.options.map((option, index2) => ({ id: letter(index2), label: letterLabel(index2), text: option.text, rawPoints: option.rawScore, ...option.isDecoy ? { decoy: true } : {} }));
    return JSON.stringify({ multiConfig: { options: options2, scoreCap: input.scoreCap } });
  }
  if (input.type === "NUMERIC") {
    const bands = input.numericConfig.bands.map((band, index2) => ({ id: `band-${index2 + 1}`, lowerBound: band.lowerBound, ...band.upperBound === null ? {} : { upperBound: band.upperBound }, rawPoints: band.rawScore }));
    return JSON.stringify({ numericConfig: { mode: input.numericConfig.mode, inputs: input.numericConfig.inputDefinitions, bands } });
  }
  if (input.type === "OPEN") {
    const rubric = input.openConfig.rubric.map((anchor) => ({ id: anchor.scoreMin === anchor.scoreMax ? String(anchor.scoreMin) : `${anchor.scoreMin}-${anchor.scoreMax}`, points: anchor.scoreMax, anchor: anchor.anchorText }));
    return JSON.stringify({ openConfig: { pasteAllowed: input.openConfig.pasteAllowed, ...input.openConfig.timeLimitSec === null ? {} : { timeLimitSec: input.openConfig.timeLimitSec }, ...input.openConfig.maximumWords === null ? {} : { wordLimit: input.openConfig.maximumWords }, rubric } });
  }
  const options = input.options.map((option, index2) => ({ id: letter(index2), label: letterLabel(index2), text: option.text, verificationMultiplier: option.verificationMultiplier }));
  return JSON.stringify({ evidenceConfig: { pairedQuestionRef: input.claimedQuestionReference, options } });
}
async function insertNestedConfiguration(tx, questionId, input) {
  const insertOptions = async (rows) => {
    await rows.reduce(async (previous, row, index2) => {
      await previous;
      await tx.insert(questionOptions).values({ id: newId("option"), questionId, displayOrder: index2 + 1, isDecoy: 0, ...row });
    }, Promise.resolve());
  };
  if (input.type === "GATE") {
    await insertOptions(input.options.map((option) => ({ optionText: option.text, rawScore: null, outcomeType: option.outcomeType })));
  } else if (input.type === "ORDINAL") {
    const rows = await Promise.all(
      input.options.map(async (option) => ({
        optionText: option.text,
        rawScore: option.rawScore,
        outcomeType: option.outcomeType === "close" ? "close" : null,
        relatedGateId: option.outcomeType === "close" ? await resolveGateId(tx, option.relatedGateReference ?? null) : null
      }))
    );
    await insertOptions(rows);
  } else if (input.type === "SJT") {
    await insertOptions(input.options.map((option) => ({ optionText: option.text, rawScore: option.rawScore, internalExplanation: option.internalExplanation })));
  } else if (input.type === "MULTI") {
    await insertOptions(input.options.map((option) => ({ optionText: option.text, rawScore: option.rawScore, isDecoy: option.isDecoy ? 1 : 0 })));
  } else if (input.type === "NUMERIC") {
    await tx.insert(numericQuestionConfigs).values({
      id: newId("numeric-config"),
      questionId,
      mode: input.numericConfig.mode,
      inputDefinitions: JSON.stringify(input.numericConfig.inputDefinitions),
      derivedCalculationType: input.numericConfig.derivedCalculationType
    });
    await input.numericConfig.bands.reduce(async (previous, band, index2) => {
      await previous;
      await tx.insert(numericScoringBands).values({ id: newId("band"), questionId, lowerBound: String(band.lowerBound), upperBound: band.upperBound === null ? null : String(band.upperBound), rawScore: band.rawScore, displayOrder: index2 + 1 });
    }, Promise.resolve());
  } else if (input.type === "OPEN") {
    await tx.insert(openQuestionConfigs).values({
      id: newId("open-config"),
      questionId,
      minimumWords: input.openConfig.minimumWords,
      maximumWords: input.openConfig.maximumWords,
      timeLimitSec: input.openConfig.timeLimitSec,
      pasteAllowed: input.openConfig.pasteAllowed ? 1 : 0
    });
    await input.openConfig.rubric.reduce(async (previous, anchor, index2) => {
      await previous;
      await tx.insert(openRubricAnchors).values({ id: newId("rubric"), questionId, scoreMin: anchor.scoreMin, scoreMax: anchor.scoreMax, anchorText: anchor.anchorText, displayOrder: index2 + 1 });
    }, Promise.resolve());
  } else {
    await insertOptions(input.options.map((option) => ({ optionText: option.text, rawScore: null, verificationMultiplier: String(option.verificationMultiplier.toFixed(2)) })));
    const claimed = await tx.select({ id: assessmentQuestions.id }).from(assessmentQuestions).where(eq(assessmentQuestions.reference, input.claimedQuestionReference)).limit(1);
    if (!claimed[0]) throw new QuestionBankValidationError(`The claimed question "${input.claimedQuestionReference}" does not exist.`);
    await tx.insert(questionEvidenceLinks).values({ id: newId("evidence-link"), evidenceQuestionId: questionId, claimedQuestionId: claimed[0].id });
  }
  if (input.crossCheck) {
    const comparison = await tx.select({ id: assessmentQuestions.id }).from(assessmentQuestions).where(eq(assessmentQuestions.reference, input.crossCheck.comparisonQuestionReference)).limit(1);
    if (!comparison[0]) throw new QuestionBankValidationError(`The cross-check question "${input.crossCheck.comparisonQuestionReference}" does not exist.`);
    await tx.insert(assessmentCrossChecks).values({
      id: newId("cross-check"),
      sourceQuestionId: questionId,
      comparisonQuestionId: comparison[0].id,
      ruleType: input.crossCheck.ruleType,
      ruleConfiguration: JSON.stringify({ compareQuestionRef: input.crossCheck.comparisonQuestionReference }),
      description: input.crossCheck.description,
      defaultOutcome: input.crossCheck.defaultOutcome,
      status: input.crossCheck.status ?? "Active"
    });
  }
  await tx.insert(questionTypeConfigs).values({ id: newId("type-config"), questionId, configType: input.type, configuration: buildTypeConfigSnapshot(input) }).onDuplicateKeyUpdate({ set: { configType: input.type, configuration: buildTypeConfigSnapshot(input) } });
}
async function deleteNestedConfiguration(tx, questionId) {
  await tx.delete(questionOptions).where(eq(questionOptions.questionId, questionId));
  await tx.delete(numericQuestionConfigs).where(eq(numericQuestionConfigs.questionId, questionId));
  await tx.delete(numericScoringBands).where(eq(numericScoringBands.questionId, questionId));
  await tx.delete(openQuestionConfigs).where(eq(openQuestionConfigs.questionId, questionId));
  await tx.delete(openRubricAnchors).where(eq(openRubricAnchors.questionId, questionId));
  await tx.delete(questionEvidenceLinks).where(eq(questionEvidenceLinks.evidenceQuestionId, questionId));
  await tx.delete(assessmentCrossChecks).where(eq(assessmentCrossChecks.sourceQuestionId, questionId));
  await tx.delete(questionTypeConfigs).where(eq(questionTypeConfigs.questionId, questionId));
}
async function createQuestion(input) {
  const db = getDatabase();
  const duplicate = await getQuestionByReference(input.reference);
  if (duplicate) throw new QuestionBankValidationError(`A question with reference "${input.reference}" already exists.`);
  const questionId = newId("question");
  await db.transaction(async (tx) => {
    const dimensionId = await resolveDimensionId(tx, input.dimensionReference);
    const scored = isScoredQuestionType(input.type);
    const qWeight = scored && "qWeight" in input ? input.qWeight : null;
    await tx.insert(assessmentQuestions).values({
      id: questionId,
      reference: input.reference,
      dimensionId,
      questionType: input.type,
      prompt: input.prompt,
      helpText: input.helpText,
      qWeight,
      maxScore: scored ? SCORED_QUESTION_MAX : null,
      required: input.required ? 1 : 0,
      status: input.status,
      timeLimitSec: input.timeLimitSec
    });
    await insertNestedConfiguration(tx, questionId, input);
  });
  const created = await getQuestionDetail(questionId);
  if (!created) throw new Error("Question insert did not complete");
  return created;
}
async function updateQuestion(idOrReference, input) {
  const db = getDatabase();
  const existing = await getQuestionByIdOrReference(idOrReference);
  if (!existing) return null;
  if (input.reference !== existing.reference) {
    throw new QuestionBankValidationError("Question references cannot be changed after creation.");
  }
  if (input.type !== existing.questionType) {
    const usedIn = await getUsedInLabels([existing.id]);
    if ((usedIn.get(existing.id) ?? []).length > 0) {
      throw new QuestionBankValidationError("This question's type cannot change while it is used in an assessment.");
    }
  }
  await db.transaction(async (tx) => {
    const dimensionId = await resolveDimensionId(tx, input.dimensionReference);
    const scored = isScoredQuestionType(input.type);
    const qWeight = scored && "qWeight" in input ? input.qWeight : null;
    await tx.update(assessmentQuestions).set({
      dimensionId,
      questionType: input.type,
      prompt: input.prompt,
      helpText: input.helpText,
      qWeight,
      maxScore: scored ? SCORED_QUESTION_MAX : null,
      required: input.required ? 1 : 0,
      status: input.status,
      timeLimitSec: input.timeLimitSec
    }).where(eq(assessmentQuestions.id, existing.id));
    await deleteNestedConfiguration(tx, existing.id);
    await insertNestedConfiguration(tx, existing.id, input);
  });
  return getQuestionDetail(existing.id);
}
var QuestionBankValidationError, newId, SORT_COLUMNS;
var init_questionBankRepository = __esm({
  "server/questionBankRepository.ts"() {
    "use strict";
    init_schema();
    init_questionBankApi();
    init_db();
    QuestionBankValidationError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "QuestionBankValidationError";
      }
    };
    newId = (prefix) => `${prefix}-${randomBytes(12).toString("hex")}`;
    SORT_COLUMNS = {
      reference: sql`${assessmentQuestions.reference}`,
      dimension: sql`COALESCE(${assessmentDimensions.reference}, '~')`,
      type: sql`${assessmentQuestions.questionType}`,
      qWeight: sql`COALESCE(${assessmentQuestions.qWeight}, 0)`,
      status: sql`${assessmentQuestions.status}`
    };
  }
});

// server/assessmentRepository.ts
var assessmentRepository_exports = {};
__export(assessmentRepository_exports, {
  AssessmentValidationError: () => AssessmentValidationError,
  addAssessmentQuestion: () => addAssessmentQuestion,
  createAssessment: () => createAssessment,
  getAssessment: () => getAssessment,
  getAssessmentByIdOrSlug: () => getAssessmentByIdOrSlug,
  getAssessmentPreviewConfiguration: () => getAssessmentPreviewConfiguration,
  getAssignmentCount: () => getAssignmentCount,
  listAssessments: () => listAssessments,
  removeAssessmentQuestion: () => removeAssessmentQuestion,
  reorderAssessmentQuestions: () => reorderAssessmentQuestions,
  replaceAssessmentAssignments: () => replaceAssessmentAssignments,
  updateAssessment: () => updateAssessment
});
import { randomBytes as randomBytes2 } from "node:crypto";
import { and as and2, asc as asc2, count as count2, eq as eq2, inArray as inArray2 } from "drizzle-orm";
function slugify(name) {
  return name.toLowerCase().trim().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
async function buildUniqueSlug(name, version, excludeId) {
  const db = getDatabase();
  const base = slugify(name);
  const slug = base || "assessment";
  const existing = await db.select({ id: assessments.id }).from(assessments).where(and2(eq2(assessments.slug, slug), eq2(assessments.version, version))).limit(1);
  if (existing.length === 0 || excludeId && existing[0].id === excludeId) {
    return slug;
  }
  return `${slug}-${randomBytes2(3).toString("hex")}`;
}
async function listAssessments() {
  const db = getDatabase();
  const countRows = await db.select({
    assessmentId: assessmentQuestionAssignments.assessmentId,
    questionCount: count2(assessmentQuestionAssignments.id)
  }).from(assessmentQuestionAssignments).groupBy(assessmentQuestionAssignments.assessmentId);
  const countMap = new Map(countRows.map((row) => [row.assessmentId, row.questionCount]));
  const rows = await db.select({
    id: assessments.id,
    slug: assessments.slug,
    name: assessments.name,
    description: assessments.description,
    version: assessments.version,
    status: assessments.status,
    createdAt: assessments.createdAt,
    updatedAt: assessments.updatedAt,
    roleId: recruitmentRoles.id,
    roleSlug: recruitmentRoles.slug,
    roleTitle: recruitmentRoles.title
  }).from(assessments).innerJoin(recruitmentRoles, eq2(assessments.roleId, recruitmentRoles.id)).orderBy(asc2(assessments.name), asc2(assessments.version));
  const items = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    version: row.version,
    status: row.status,
    role: { id: row.roleId, slug: row.roleSlug, title: row.roleTitle },
    questionCount: countMap.get(row.id) ?? 0,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString()
  }));
  const roleIds = new Set(items.map((item) => item.role.id));
  const summary = {
    total: items.length,
    active: items.filter((item) => item.status === "Active").length,
    assignedRoles: roleIds.size
  };
  return { assessments: items, summary };
}
async function getAssessmentByIdOrSlug(idOrSlug) {
  const db = getDatabase();
  const byId = await db.select().from(assessments).where(eq2(assessments.id, idOrSlug)).limit(1);
  if (byId[0]) return byId[0];
  const bySlugs = await db.select().from(assessments).where(eq2(assessments.slug, idOrSlug)).orderBy(asc2(assessments.version));
  return bySlugs.at(-1) ?? null;
}
async function getAssignmentSummaries(assessmentId) {
  const db = getDatabase();
  const rows = await db.select({
    assignmentId: assessmentQuestionAssignments.id,
    displayOrder: assessmentQuestionAssignments.displayOrder,
    questionId: assessmentQuestions.id,
    reference: assessmentQuestions.reference,
    prompt: assessmentQuestions.prompt,
    type: assessmentQuestions.questionType,
    qWeight: assessmentQuestions.qWeight,
    required: assessmentQuestions.required,
    status: assessmentQuestions.status,
    dimensionRef: assessmentDimensions.reference,
    dimensionName: assessmentDimensions.name
  }).from(assessmentQuestionAssignments).innerJoin(assessmentQuestions, eq2(assessmentQuestionAssignments.questionId, assessmentQuestions.id)).leftJoin(assessmentDimensions, eq2(assessmentQuestions.dimensionId, assessmentDimensions.id)).where(eq2(assessmentQuestionAssignments.assessmentId, assessmentId)).orderBy(asc2(assessmentQuestionAssignments.displayOrder));
  return rows.map((row) => ({
    assignmentId: row.assignmentId,
    displayOrder: row.displayOrder,
    questionId: row.questionId,
    reference: row.reference,
    prompt: row.prompt,
    type: row.type,
    dimension: row.dimensionRef ? { reference: row.dimensionRef, name: row.dimensionName ?? row.dimensionRef } : null,
    qWeight: row.qWeight,
    required: Boolean(row.required),
    status: row.status
  }));
}
async function getAssessment(idOrSlug) {
  const db = getDatabase();
  const row = await getAssessmentByIdOrSlug(idOrSlug);
  if (!row) return null;
  const roleRows = await db.select({ id: recruitmentRoles.id, slug: recruitmentRoles.slug, title: recruitmentRoles.title }).from(recruitmentRoles).where(eq2(recruitmentRoles.id, row.roleId)).limit(1);
  const role = roleRows[0];
  if (!role) return null;
  const countRows = await db.select({ value: count2(assessmentQuestionAssignments.id) }).from(assessmentQuestionAssignments).where(eq2(assessmentQuestionAssignments.assessmentId, row.id));
  const questionCount = countRows[0]?.value ?? 0;
  const assignments = await getAssignmentSummaries(row.id);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    version: row.version,
    status: row.status,
    role: { id: role.id, slug: role.slug, title: role.title },
    questionCount,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    assignments
  };
}
async function getAssessmentPreviewConfiguration(idOrSlug) {
  const db = getDatabase();
  const row = await getAssessmentByIdOrSlug(idOrSlug);
  if (!row) return null;
  const roleRows = await db.select({ id: recruitmentRoles.id, slug: recruitmentRoles.slug, title: recruitmentRoles.title }).from(recruitmentRoles).where(eq2(recruitmentRoles.id, row.roleId)).limit(1);
  const role = roleRows[0];
  if (!role) return null;
  const assignmentRows = await db.select({
    assignmentId: assessmentQuestionAssignments.id,
    displayOrder: assessmentQuestionAssignments.displayOrder,
    questionId: assessmentQuestions.id
  }).from(assessmentQuestionAssignments).innerJoin(assessmentQuestions, eq2(assessmentQuestionAssignments.questionId, assessmentQuestions.id)).where(eq2(assessmentQuestionAssignments.assessmentId, row.id)).orderBy(asc2(assessmentQuestionAssignments.displayOrder));
  const questionDetails = await Promise.all(
    assignmentRows.map((assignment) => getQuestionDetail(assignment.questionId))
  );
  const assignmentsFull = assignmentRows.map((assignment, index2) => {
    const detail = questionDetails[index2];
    if (!detail) return null;
    return {
      assignmentId: assignment.assignmentId,
      displayOrder: assignment.displayOrder,
      question: detail
    };
  }).filter((item) => item !== null);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    version: row.version,
    status: row.status,
    role: { id: role.id, slug: role.slug, title: role.title },
    assignments: assignmentsFull
  };
}
async function createAssessment(input) {
  const db = getDatabase();
  const roleRows = await db.select({ id: recruitmentRoles.id, slug: recruitmentRoles.slug, title: recruitmentRoles.title }).from(recruitmentRoles).where(eq2(recruitmentRoles.id, input.roleId)).limit(1);
  if (!roleRows[0]) throw new AssessmentValidationError("The selected role does not exist.");
  const slug = await buildUniqueSlug(input.name, input.version);
  const id = newId2("assessment");
  await db.insert(assessments).values({
    id,
    slug,
    roleId: input.roleId,
    name: input.name,
    description: input.description,
    status: input.status,
    version: input.version
  });
  const created = await getAssessment(id);
  if (!created) throw new Error("Assessment insert did not complete");
  return created;
}
async function updateAssessment(idOrSlug, input) {
  const db = getDatabase();
  const existing = await getAssessmentByIdOrSlug(idOrSlug);
  if (!existing) return null;
  await db.update(assessments).set({ name: input.name, description: input.description }).where(eq2(assessments.id, existing.id));
  return getAssessment(existing.id);
}
async function getAssignmentCount(assessmentId) {
  const db = getDatabase();
  const rows = await db.select({ value: count2(assessmentQuestionAssignments.id) }).from(assessmentQuestionAssignments).where(eq2(assessmentQuestionAssignments.assessmentId, assessmentId));
  return rows[0]?.value ?? 0;
}
async function addAssessmentQuestion(assessmentId, questionId) {
  const db = getDatabase();
  const questionRows = await db.select({ id: assessmentQuestions.id, status: assessmentQuestions.status }).from(assessmentQuestions).where(eq2(assessmentQuestions.id, questionId)).limit(1);
  const question = questionRows[0];
  if (!question) throw new AssessmentValidationError("The selected question does not exist.");
  if (question.status !== "Active") {
    throw new AssessmentValidationError("Only Active questions can be assigned to an assessment.");
  }
  const existing = await db.select({ id: assessmentQuestionAssignments.id }).from(assessmentQuestionAssignments).where(
    and2(
      eq2(assessmentQuestionAssignments.assessmentId, assessmentId),
      eq2(assessmentQuestionAssignments.questionId, questionId)
    )
  ).limit(1);
  if (existing.length > 0) {
    throw new AssessmentValidationError("This question is already assigned to the assessment.");
  }
  const countRows = await db.select({ value: count2(assessmentQuestionAssignments.id) }).from(assessmentQuestionAssignments).where(eq2(assessmentQuestionAssignments.assessmentId, assessmentId));
  const nextOrder = (countRows[0]?.value ?? 0) + 1;
  const assignmentId = newId2("assignment");
  await db.insert(assessmentQuestionAssignments).values({
    id: assignmentId,
    assessmentId,
    questionId,
    displayOrder: nextOrder
  });
  return getAssignmentSummaries(assessmentId);
}
async function removeAssessmentQuestion(assessmentId, questionId) {
  const db = getDatabase();
  const existing = await db.select({ id: assessmentQuestionAssignments.id }).from(assessmentQuestionAssignments).where(
    and2(
      eq2(assessmentQuestionAssignments.assessmentId, assessmentId),
      eq2(assessmentQuestionAssignments.questionId, questionId)
    )
  ).limit(1);
  if (existing.length === 0) {
    throw new AssessmentValidationError("This question is not assigned to the assessment.");
  }
  await db.transaction(async (tx) => {
    await tx.delete(assessmentQuestionAssignments).where(
      and2(
        eq2(assessmentQuestionAssignments.assessmentId, assessmentId),
        eq2(assessmentQuestionAssignments.questionId, questionId)
      )
    );
    const remaining = await tx.select({
      id: assessmentQuestionAssignments.id,
      displayOrder: assessmentQuestionAssignments.displayOrder
    }).from(assessmentQuestionAssignments).where(eq2(assessmentQuestionAssignments.assessmentId, assessmentId)).orderBy(asc2(assessmentQuestionAssignments.displayOrder));
    const TEMP_OFFSET = 1e4;
    for (let i = 0; i < remaining.length; i++) {
      await tx.update(assessmentQuestionAssignments).set({ displayOrder: TEMP_OFFSET + i + 1 }).where(eq2(assessmentQuestionAssignments.id, remaining[i].id));
    }
    for (let i = 0; i < remaining.length; i++) {
      await tx.update(assessmentQuestionAssignments).set({ displayOrder: i + 1 }).where(eq2(assessmentQuestionAssignments.id, remaining[i].id));
    }
  });
  return getAssignmentSummaries(assessmentId);
}
async function reorderAssessmentQuestions(assessmentId, orderedQuestionIds) {
  const db = getDatabase();
  const currentAssignments = await db.select({ id: assessmentQuestionAssignments.id, questionId: assessmentQuestionAssignments.questionId }).from(assessmentQuestionAssignments).where(eq2(assessmentQuestionAssignments.assessmentId, assessmentId));
  const currentIds = new Set(currentAssignments.map((row) => row.questionId));
  if (orderedQuestionIds.length !== currentIds.size) {
    throw new AssessmentValidationError(
      "The reorder list must contain exactly the currently assigned questions."
    );
  }
  for (const id of orderedQuestionIds) {
    if (!currentIds.has(id)) {
      throw new AssessmentValidationError(
        "The reorder list contains a question not assigned to this assessment."
      );
    }
  }
  const assignmentById = new Map(currentAssignments.map((row) => [row.questionId, row.id]));
  await db.transaction(async (tx) => {
    const TEMP_OFFSET = 1e4;
    for (let i = 0; i < orderedQuestionIds.length; i++) {
      const assignmentId = assignmentById.get(orderedQuestionIds[i]);
      if (!assignmentId) continue;
      await tx.update(assessmentQuestionAssignments).set({ displayOrder: TEMP_OFFSET + i + 1 }).where(eq2(assessmentQuestionAssignments.id, assignmentId));
    }
    for (let i = 0; i < orderedQuestionIds.length; i++) {
      const assignmentId = assignmentById.get(orderedQuestionIds[i]);
      if (!assignmentId) continue;
      await tx.update(assessmentQuestionAssignments).set({ displayOrder: i + 1 }).where(eq2(assessmentQuestionAssignments.id, assignmentId));
    }
  });
  return getAssignmentSummaries(assessmentId);
}
async function replaceAssessmentAssignments(assessmentId, orderedQuestionIds) {
  const db = getDatabase();
  const seen = /* @__PURE__ */ new Set();
  for (const id of orderedQuestionIds) {
    if (seen.has(id)) {
      throw new AssessmentValidationError("The assignment list contains a duplicate question.");
    }
    seen.add(id);
  }
  if (orderedQuestionIds.length > 0) {
    const questionRows = await db.select({ id: assessmentQuestions.id, status: assessmentQuestions.status }).from(assessmentQuestions).where(inArray2(assessmentQuestions.id, orderedQuestionIds));
    const questionMap = new Map(questionRows.map((row) => [row.id, row.status]));
    for (const id of orderedQuestionIds) {
      if (!questionMap.has(id)) {
        throw new AssessmentValidationError(`Question "${id}" does not exist in the Question Bank.`);
      }
    }
    const currentRows = await db.select({ questionId: assessmentQuestionAssignments.questionId }).from(assessmentQuestionAssignments).where(eq2(assessmentQuestionAssignments.assessmentId, assessmentId));
    const currentlyAssigned = new Set(currentRows.map((row) => row.questionId));
    for (const id of orderedQuestionIds) {
      const status = questionMap.get(id);
      if (status !== "Active" && !currentlyAssigned.has(id)) {
        throw new AssessmentValidationError("Only Active questions can be newly assigned to an assessment.");
      }
    }
  }
  await db.transaction(async (tx) => {
    await tx.delete(assessmentQuestionAssignments).where(eq2(assessmentQuestionAssignments.assessmentId, assessmentId));
    for (let i = 0; i < orderedQuestionIds.length; i++) {
      await tx.insert(assessmentQuestionAssignments).values({
        id: newId2("assignment"),
        assessmentId,
        questionId: orderedQuestionIds[i],
        displayOrder: i + 1
      });
    }
  });
  return getAssignmentSummaries(assessmentId);
}
var AssessmentValidationError, newId2;
var init_assessmentRepository = __esm({
  "server/assessmentRepository.ts"() {
    "use strict";
    init_schema();
    init_questionBankRepository();
    init_db();
    AssessmentValidationError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "AssessmentValidationError";
      }
    };
    newId2 = (prefix) => `${prefix}-${randomBytes2(12).toString("hex")}`;
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  getActiveAssessmentForRole: () => getActiveAssessmentForRole,
  getAssessmentConfiguration: () => getAssessmentConfiguration,
  getDatabase: () => getDatabase,
  getRecruitmentRoleConfiguration: () => getRecruitmentRoleConfiguration
});
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { and as and3, asc as asc3, eq as eq3 } from "drizzle-orm";
function getDatabase() {
  if (!database) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not configured");
    database = drizzle(mysql.createPool(url));
  }
  return database;
}
async function getRecruitmentRoleConfiguration(slug) {
  const db = getDatabase();
  const role = (await db.select().from(recruitmentRoles).where(eq3(recruitmentRoles.slug, slug)).limit(1))[0];
  if (!role) return null;
  const [gates, dimensions, assessmentsForRole, screening] = await Promise.all([
    db.select().from(eligibilityGates).where(eq3(eligibilityGates.roleId, role.id)).orderBy(asc3(eligibilityGates.displayOrder)),
    db.select().from(assessmentDimensions).where(eq3(assessmentDimensions.roleId, role.id)).orderBy(asc3(assessmentDimensions.displayOrder)),
    db.select().from(assessments).where(eq3(assessments.roleId, role.id)).orderBy(asc3(assessments.version)),
    db.select().from(screeningConfigurations).where(eq3(screeningConfigurations.roleId, role.id)).limit(1)
  ]);
  return { role, gates, dimensions, assessments: assessmentsForRole, screening: screening[0] ?? null };
}
async function getAssessmentConfiguration(slug) {
  const { getAssessmentPreviewConfiguration: getAssessmentPreviewConfiguration2 } = await Promise.resolve().then(() => (init_assessmentRepository(), assessmentRepository_exports));
  const preview = await getAssessmentPreviewConfiguration2(slug);
  if (!preview) return null;
  return {
    assessment: preview,
    assignments: preview.assignments.map((a) => ({
      assignment: { id: a.assignmentId, assessmentId: preview.id, questionId: a.question.id, displayOrder: a.displayOrder, createdAt: /* @__PURE__ */ new Date() },
      question: a.question
    }))
    // firstQuestionOptions is intentionally absent. Do not re-introduce it.
  };
}
async function getActiveAssessmentForRole(roleId) {
  const db = getDatabase();
  return (await db.select().from(assessments).where(and3(eq3(assessments.roleId, roleId), eq3(assessments.status, "Active"))).limit(1))[0] ?? null;
}
var database;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    database = null;
  }
});

// server/app.ts
import mysql2 from "mysql2/promise";
import express6 from "express";

// server/adminAuth.ts
init_schema();
import { createHash, randomBytes as randomBytes3, scryptSync, timingSafeEqual } from "node:crypto";
import { sql as sql3 } from "drizzle-orm";
import express from "express";

// shared/adminAuth.ts
var ADMIN_PROFILE_ROLE = "Admin";
function evaluateAdminAuthorization(user, profile) {
  if (!user) return "unauthenticated";
  if (!profile) return "missing-profile";
  if (profile.status !== "Active") return "inactive-profile";
  if (profile.role !== ADMIN_PROFILE_ROLE) return "role-not-permitted";
  return "authorized";
}
function isAdminAuthorized(user, profile) {
  return evaluateAdminAuthorization(user, profile) === "authorized";
}

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;

// server/adminAuth.ts
init_db();
var SCRYPT_KEY_LENGTH = 64;
var SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };
var DUMMY_PASSWORD_HASH = hashPassword("task-24b-timing-equalizer");
function hashPassword(password) {
  const salt = randomBytes3(16).toString("hex");
  const derived = scryptSync(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_OPTIONS).toString("hex");
  return `scrypt:${SCRYPT_OPTIONS.N}:${SCRYPT_OPTIONS.r}:${SCRYPT_OPTIONS.p}:${salt}:${derived}`;
}
function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const parts = storedHash.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    verifyPassword(password, DUMMY_PASSWORD_HASH);
    return false;
  }
  const [, n, r, p, salt, expected] = parts;
  try {
    const derived = scryptSync(password, salt, Buffer.from(expected, "hex").length, { N: Number(n), r: Number(r), p: Number(p) });
    return timingSafeEqual(derived, Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
function generateSessionToken() {
  return randomBytes3(32).toString("hex");
}
function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
function serializeSessionCookie(token) {
  const parts = [`${COOKIE_NAME}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${Math.floor(ONE_YEAR_MS / 1e3)}`];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}
function serializeSignOutCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const piece of header.split(";")) {
    const separator = piece.indexOf("=");
    if (separator === -1) continue;
    const key = piece.slice(0, separator).trim();
    const value = piece.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}
function readSessionToken(request) {
  const token = parseCookies(request.headers.cookie)[COOKIE_NAME];
  return token && token.length > 0 ? token : null;
}
function resolveSafeAdminTarget(candidate) {
  if (typeof candidate !== "string") return "/admin";
  const trimmed = candidate.trim();
  if (!trimmed.startsWith("/admin") || trimmed.startsWith("//") || trimmed.includes("\\")) return "/admin";
  if (trimmed === "/admin/login" || trimmed.startsWith("/admin/login?") || trimmed.startsWith("/admin/login/")) return "/admin";
  const rest = trimmed.slice("/admin".length);
  if (rest !== "" && !rest.startsWith("/")) return "/admin";
  return trimmed;
}
function decodeOAuthState(state) {
  if (!state) return null;
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    if (typeof parsed.redirectUri !== "string") return null;
    return { redirectUri: parsed.redirectUri, next: typeof parsed.next === "string" ? parsed.next : void 0 };
  } catch {
    return null;
  }
}
async function createSessionForUser(userId) {
  const db = getDatabase();
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + ONE_YEAR_MS);
  await db.insert(authSessions).values({ id: `session-${randomBytes3(12).toString("hex")}`, userId, tokenHash: hashSessionToken(token), expiresAt });
  return { token };
}
async function resolveSession(token) {
  const db = getDatabase();
  const rows = await db.select({ sessionId: authSessions.id, expiresAt: authSessions.expiresAt, userId: users.id, email: users.email, name: users.name }).from(authSessions).innerJoin(users, sql3`${authSessions.userId} = ${users.id}`).where(sql3`${authSessions.tokenHash} = ${hashSessionToken(token)}`).limit(1);
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    await db.delete(authSessions).where(sql3`${authSessions.id} = ${row.sessionId}`).catch(() => void 0);
    return null;
  }
  return { user: { id: row.userId, email: row.email, name: row.name }, sessionId: row.sessionId };
}
async function revokeSession(token) {
  const db = getDatabase();
  await db.delete(authSessions).where(sql3`${authSessions.tokenHash} = ${hashSessionToken(token)}`);
}
async function findAdminProfileForUser(userId) {
  const db = getDatabase();
  return (await db.select().from(adminProfiles).where(sql3`${adminProfiles.authUserId} = ${userId}`).limit(1))[0] ?? null;
}
async function findUserByLowerEmail(email) {
  const db = getDatabase();
  return (await db.select().from(users).where(sql3`LOWER(${users.email}) = ${email.trim().toLowerCase()}`).limit(1))[0] ?? null;
}
function buildSessionPayload(user, profile) {
  const outcome = evaluateAdminAuthorization(user, profile);
  const authorized = outcome === "authorized";
  const userSummary = user ? { id: user.id, email: user.email, name: user.name } : null;
  const profileSummary = user && profile && profile.role === "Admin" ? { id: profile.id, email: profile.email, fullName: profile.fullName, role: "Admin", status: profile.status } : null;
  return { authenticated: Boolean(user), authorized, user: userSummary, profile: profileSummary };
}
async function exchangeOAuthCode(code) {
  const portalUrl = (process.env.OAUTH_PORTAL_URL || process.env.VITE_OAUTH_PORTAL_URL || "").replace(/\/+$/, "");
  const appId = process.env.APP_ID || process.env.VITE_APP_ID;
  if (!portalUrl || !appId) return null;
  const tokenUrl = process.env.OAUTH_TOKEN_URL || `${portalUrl}/token`;
  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId, appSecret: process.env.OAUTH_CLIENT_SECRET, code })
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("[auth] native OAuth token exchange failed:", error instanceof Error ? error.message : String(error));
    return null;
  }
}
function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
function createAdminAuthRouter() {
  const router = express.Router();
  router.get("/api/admin/session", async (request, response) => {
    if (!databaseConfigured()) {
      response.status(503).json({ ok: false });
      return;
    }
    const token = readSessionToken(request);
    if (!token) {
      response.json({ authenticated: false, authorized: false, user: null, profile: null });
      return;
    }
    try {
      const session = await resolveSession(token);
      if (!session) {
        response.setHeader("Set-Cookie", serializeSignOutCookie());
        response.json({ authenticated: false, authorized: false, user: null, profile: null });
        return;
      }
      const profile = await findAdminProfileForUser(session.user.id);
      response.json(buildSessionPayload(session.user, profile));
    } catch (error) {
      console.error("[auth] session resolution failed:", error instanceof Error ? error.message : String(error));
      response.status(503).json({ ok: false });
    }
  });
  router.post("/api/admin/auth/sign-in", async (request, response) => {
    if (!databaseConfigured()) {
      response.status(503).json({ ok: false });
      return;
    }
    const email = typeof request.body?.email === "string" ? request.body.email.trim() : "";
    const password = typeof request.body?.password === "string" ? request.body.password : "";
    if (!email || !password) {
      response.status(401).json({ ok: false });
      return;
    }
    try {
      const user = await findUserByLowerEmail(email);
      const valid = verifyPassword(password, user?.passwordHash ?? null);
      if (!user || !valid) {
        response.status(401).json({ ok: false });
        return;
      }
      const db = getDatabase();
      await db.update(users).set({ lastSignedIn: /* @__PURE__ */ new Date() }).where(sql3`${users.id} = ${user.id}`);
      const { token } = await createSessionForUser(user.id);
      response.setHeader("Set-Cookie", serializeSessionCookie(token));
      const profile = await findAdminProfileForUser(user.id);
      response.json({ ok: true, session: buildSessionPayload({ id: user.id, email: user.email, name: user.name }, profile) });
    } catch (error) {
      console.error("[auth] sign-in failed:", error instanceof Error ? error.message : String(error));
      response.status(503).json({ ok: false });
    }
  });
  router.post("/api/admin/auth/sign-out", async (request, response) => {
    const token = readSessionToken(request);
    if (token && databaseConfigured()) {
      await revokeSession(token).catch((error) => console.error("[auth] sign-out revoke failed:", error instanceof Error ? error.message : String(error)));
    }
    response.setHeader("Set-Cookie", serializeSignOutCookie());
    response.json({ ok: true });
  });
  router.get("/api/oauth/callback", async (request, response) => {
    const loginTarget = "/admin/login?authError=1";
    const state = decodeOAuthState(typeof request.query.state === "string" ? request.query.state : void 0);
    const code = typeof request.query.code === "string" ? request.query.code : "";
    const origin = `${request.protocol}://${request.get("host")}`;
    if (!state || !code || state.redirectUri !== `${origin}/api/oauth/callback` || !databaseConfigured()) {
      response.redirect(loginTarget);
      return;
    }
    try {
      const tokenResponse = await exchangeOAuthCode(code);
      const openId = tokenResponse?.openId ?? tokenResponse?.sub;
      if (!tokenResponse || !openId) {
        response.redirect(loginTarget);
        return;
      }
      const db = getDatabase();
      const existing = (await db.select().from(users).where(sql3`${users.openId} = ${openId}`).limit(1))[0];
      let userId;
      if (existing) {
        userId = existing.id;
        await db.update(users).set({ lastSignedIn: /* @__PURE__ */ new Date(), name: tokenResponse.name ?? existing.name, email: tokenResponse.email ?? existing.email, loginMethod: tokenResponse.loginMethod ?? existing.loginMethod }).where(sql3`${users.id} = ${existing.id}`);
      } else {
        await db.insert(users).values({ openId, name: tokenResponse.name ?? null, email: tokenResponse.email ?? null, loginMethod: tokenResponse.loginMethod ?? "oauth", role: "user" });
        userId = (await db.select().from(users).where(sql3`${users.openId} = ${openId}`).limit(1))[0].id;
      }
      const { token } = await createSessionForUser(userId);
      response.setHeader("Set-Cookie", serializeSessionCookie(token));
      response.redirect(resolveSafeAdminTarget(state.next));
    } catch (error) {
      console.error("[auth] OAuth callback failed:", error instanceof Error ? error.message : String(error));
      response.redirect(loginTarget);
    }
  });
  return router;
}

// server/adminApplicationApi.ts
import express2 from "express";
import { and as and5, asc as asc5, desc as desc2, eq as eq5, sql as sql5 } from "drizzle-orm";
init_schema();

// shared/adminApplicationApi.ts
var ADMIN_APPLICATION_STATUSES = [
  "Submitted",
  "Under Review",
  "Shortlisted",
  "Hold",
  "Closed"
];
var BONUS_TYPES = [
  { code: "diplomatic-account", label: "Direct ownership of embassy/diplomatic account", points: 3 },
  { code: "french-arabic", label: "French or Arabic working proficiency", points: 2 },
  { code: "commercial-certification", label: "Revenue-management / hospitality commercial certification", points: 2 }
];
var BONUS_CAP = 5;
var INTEGRITY_PENALTY_PER_FLAG = 10;
var BAND_THRESHOLDS = [
  { band: "A", minimum: 80, label: "Fast-track review" },
  { band: "B", minimum: 65, label: "Interview pool" },
  { band: "C", minimum: 50, label: "Hold / further review" },
  { band: "D", minimum: 0, label: "Close-out review" }
];
function validateOpenReviewInput(input) {
  const errors = [];
  if (!input || typeof input !== "object") return { ok: false, errors: ["Invalid input."] };
  const obj = input;
  if (typeof obj.rawScore !== "number" || !Number.isInteger(obj.rawScore) || obj.rawScore < 0 || obj.rawScore > 5) {
    errors.push("Raw score must be an integer between 0 and 5.");
  }
  if (obj.note !== void 0 && typeof obj.note !== "string") {
    errors.push("Note must be a string.");
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, input: { rawScore: obj.rawScore, note: typeof obj.note === "string" ? obj.note : void 0 } };
}
function validateIntegrityFlagInput(input) {
  const errors = [];
  if (!input || typeof input !== "object") return { ok: false, errors: ["Invalid input."] };
  const obj = input;
  if (obj.status !== "Confirmed" && obj.status !== "Dismissed") {
    errors.push("Status must be Confirmed or Dismissed.");
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, input: { status: obj.status } };
}
function validateBonusInput(input) {
  const errors = [];
  if (!input || typeof input !== "object") return { ok: false, errors: ["Invalid input."] };
  const obj = input;
  if (typeof obj.confirmed !== "boolean") errors.push("Confirmed must be a boolean.");
  if (obj.note !== void 0 && typeof obj.note !== "string") errors.push("Note must be a string.");
  if (errors.length) return { ok: false, errors };
  return { ok: true, input: { confirmed: obj.confirmed, note: typeof obj.note === "string" ? obj.note : void 0 } };
}
function validateShortlistInput(input) {
  if (!input || typeof input !== "object" || typeof input.shortlisted !== "boolean") {
    return { ok: false, errors: ["Shortlisted must be a boolean."] };
  }
  return { ok: true, input: { shortlisted: input.shortlisted } };
}
function validateApplicationStatusInput(input) {
  if (!input || typeof input !== "object") return { ok: false, errors: ["Invalid input."] };
  const obj = input;
  if (typeof obj.status !== "string" || !ADMIN_APPLICATION_STATUSES.includes(obj.status)) {
    return { ok: false, errors: [`Status must be one of: ${ADMIN_APPLICATION_STATUSES.join(", ")}`] };
  }
  return { ok: true, input: { status: obj.status } };
}
function resolveBand(score) {
  for (const threshold of BAND_THRESHOLDS) {
    if (score >= threshold.minimum) return threshold.band;
  }
  return "D";
}
function applyFloorCap(rawBand, floorMissed) {
  if (floorMissed && (rawBand === "A" || rawBand === "B")) {
    return { appliedBand: "C", reason: "Dimension floor missed" };
  }
  return { appliedBand: rawBand };
}
function calculateFinalScore(base, verification, penalty, bonus) {
  return Math.min(100, Math.max(0, base * verification - penalty + bonus));
}

// server/evaluationScoring.ts
init_schema();
import { randomBytes as randomBytes4 } from "node:crypto";
import { and as and4, eq as eq4, asc as asc4 } from "drizzle-orm";
init_db();
function parseJson2(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
function generateId() {
  return randomBytes4(12).toString("hex");
}
function scoreObjectiveQuestion(config, response) {
  const rawPayload = response.responsePayload;
  switch (config.questionType) {
    case "ORDINAL":
    case "SJT":
    case "GATE": {
      let optionId;
      try {
        const parsed = JSON.parse(rawPayload);
        optionId = typeof parsed === "string" ? parsed : rawPayload;
      } catch {
        optionId = rawPayload;
      }
      if (!optionId) return null;
      const option = config.options.find((o) => o.id === optionId);
      return option?.rawScore ?? null;
    }
    case "MULTI": {
      const payload = parseJson2(rawPayload, null);
      if (!Array.isArray(payload)) return null;
      const selected = payload.filter((id) => typeof id === "string");
      let total = 0;
      for (const id of selected) {
        const option = config.options.find((o) => o.id === id);
        if (option?.rawScore !== null && option?.rawScore !== void 0) total += option.rawScore;
      }
      return Math.min(config.maxScore ?? 5, Math.max(0, total));
    }
    case "NUMERIC": {
      if (!config.numericConfig || config.numericBands.length === 0) return null;
      const payload = parseJson2(rawPayload, null);
      const obj = typeof payload === "object" && payload !== null ? payload : {};
      const defs = config.numericConfig.inputDefinitions;
      const resolved = { ...obj };
      if (defs.length > 0) {
        const firstLabel = defs[0]?.label ?? "";
        const secondLabel = defs[1]?.label ?? "";
        if (config.numericConfig.mode === "calendarYearExperience") {
          if (resolved.year === void 0 && firstLabel && obj[firstLabel] !== void 0) {
            resolved.year = obj[firstLabel];
          }
        } else {
          if (resolved.target === void 0 && firstLabel && obj[firstLabel] !== void 0) {
            resolved.target = obj[firstLabel];
          }
          if (resolved.actual === void 0 && secondLabel && obj[secondLabel] !== void 0) {
            resolved.actual = obj[secondLabel];
          }
        }
      }
      let derivedValue;
      if (config.numericConfig.mode === "calendarYearExperience") {
        if (resolved.never === true) derivedValue = 0;
        else if (typeof resolved.year !== "string" || !/^\d{4}$/.test(resolved.year)) return null;
        else derivedValue = (/* @__PURE__ */ new Date()).getFullYear() - Number(resolved.year);
      } else {
        const target = Number(resolved.target);
        const actual = Number(resolved.actual);
        if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(actual) || actual < 0) return null;
        derivedValue = actual / target * 100;
      }
      const band = config.numericBands.find((b) => {
        const lower = b.lowerBound !== null ? Number(b.lowerBound) : -Infinity;
        const upper = b.upperBound !== null ? Number(b.upperBound) : Infinity;
        return derivedValue >= lower && derivedValue <= upper;
      });
      return band?.rawScore ?? null;
    }
    case "EVIDENCE": {
      return null;
    }
    default:
      return null;
  }
}
function resolveEvidenceMultiplier(config, response) {
  if (config.questionType !== "EVIDENCE") return null;
  let optionId;
  try {
    const parsed = JSON.parse(response.responsePayload);
    optionId = typeof parsed === "string" ? parsed : response.responsePayload;
  } catch {
    optionId = response.responsePayload;
  }
  if (!optionId) return null;
  const option = config.options.find((o) => o.id === optionId);
  if (!option?.verificationMultiplier) return null;
  const value = Number(option.verificationMultiplier);
  return Number.isFinite(value) ? value : null;
}
function calculateDimensionScores(questionResults, openScores, dimensions) {
  return dimensions.map((dim) => {
    const assigned = questionResults.filter(
      (q) => q.dimensionId === dim.id && q.questionType !== "GATE" && q.questionType !== "EVIDENCE"
    );
    if (assigned.length === 0) {
      return {
        dimensionId: dim.id,
        dimensionReference: dim.reference,
        normalizedScore: 0,
        weight: dim.weight,
        weightedContribution: 0,
        floor: dim.minimumFloor,
        floorStatus: "No questions assigned"
      };
    }
    const scored = assigned.map((q) => {
      let raw = q.rawScore;
      if (q.questionType === "OPEN" && openScores[q.questionId] !== void 0) {
        raw = openScores[q.questionId];
      }
      return { ...q, resolvedRaw: raw };
    });
    const allScored = scored.every((q) => typeof q.resolvedRaw === "number" && typeof q.maxScore === "number" && typeof q.qWeight === "number");
    if (!allScored) {
      return {
        dimensionId: dim.id,
        dimensionReference: dim.reference,
        normalizedScore: null,
        // deliberately unresolved
        weight: dim.weight,
        weightedContribution: null,
        // deliberately unresolved
        floor: dim.minimumFloor,
        floorStatus: "Pending"
      };
    }
    const denominator = scored.reduce((sum, q) => sum + (q.qWeight ?? 0), 0);
    if (denominator <= 0) {
      return {
        dimensionId: dim.id,
        dimensionReference: dim.reference,
        normalizedScore: 0,
        weight: dim.weight,
        weightedContribution: 0,
        floor: dim.minimumFloor,
        floorStatus: "No weighted questions"
      };
    }
    const normalizedScore = Math.min(
      100,
      Math.max(
        0,
        scored.reduce((sum, q) => {
          const input = q.resolvedRaw / q.maxScore * q.qWeight;
          return sum + input;
        }, 0) / denominator * 100
      )
    );
    const weight = dim.weight;
    const weightedContribution = normalizedScore * weight / 100;
    const floorValue = dim.minimumFloor;
    const floorStatus = floorValue !== null ? normalizedScore >= floorValue ? "Passed" : "Below floor" : null;
    return {
      dimensionId: dim.id,
      dimensionReference: dim.reference,
      normalizedScore: Number(normalizedScore.toFixed(3)),
      weight,
      weightedContribution: Number(weightedContribution.toFixed(3)),
      floor: floorValue,
      floorStatus
    };
  });
}
function evaluateIntegrityCrossChecks(questionResults, responses, crossCheckConfigs, existingFlags) {
  const flags = [];
  for (const check of crossCheckConfigs) {
    if (check.status !== "Active") continue;
    const existing = existingFlags.find((f) => f.sourceQuestionId === check.sourceQuestionId);
    const currentStatus = existing?.status ?? "Flagged";
    const sourceResponse = responses.find((r) => r.questionId === check.sourceQuestionId);
    const comparisonResponse = responses.find((r) => r.questionId === check.comparisonQuestionId);
    if (!sourceResponse || !comparisonResponse) continue;
    if (check.ruleType === "Manual review") {
      flags.push({
        id: existing?.id ?? `flag-${generateId()}`,
        source: `${sourceResponse.reference} / ${comparisonResponse.reference}`,
        description: check.description,
        sourceQuestionId: check.sourceQuestionId,
        comparisonQuestionId: check.comparisonQuestionId,
        status: currentStatus
      });
      continue;
    }
    const sourcePayload = parseJson2(sourceResponse.responsePayload, null);
    const comparisonPayload = parseJson2(comparisonResponse.responsePayload, null);
    if (sourceResponse.reference === "D1.Q1" && comparisonResponse.reference === "D1.Q2") {
      const expectedYears = {
        a: 10,
        "framework-d1-q1-option-1": 10,
        b: 4,
        "framework-d1-q1-option-2": 4,
        c: 0,
        "framework-d1-q1-option-3": 0
      };
      let shouldFlag = false;
      if (typeof sourcePayload === "string") {
        const compObj = typeof comparisonPayload === "object" && comparisonPayload !== null ? comparisonPayload : {};
        let years;
        if (compObj.never === true) years = 0;
        else if (typeof compObj.year === "string" && /^\d{4}$/.test(compObj.year)) years = (/* @__PURE__ */ new Date()).getFullYear() - Number(compObj.year);
        if (years !== void 0 && expectedYears[sourcePayload] !== void 0 && Math.abs(years - expectedYears[sourcePayload]) > 2) {
          shouldFlag = true;
        }
      }
      if (shouldFlag) {
        flags.push({
          id: existing?.id ?? `flag-${generateId()}`,
          source: "D1.Q1 / D1.Q2",
          description: check.description,
          sourceQuestionId: check.sourceQuestionId,
          comparisonQuestionId: check.comparisonQuestionId,
          status: currentStatus
        });
      } else if (existing) {
        flags.push({
          id: existing.id,
          source: "D1.Q1 / D1.Q2",
          description: check.description,
          sourceQuestionId: check.sourceQuestionId,
          comparisonQuestionId: check.comparisonQuestionId,
          status: currentStatus
        });
      }
    }
    if (sourceResponse.reference === "D2.Q3" && comparisonResponse.reference === "D2.Q2") {
      const compObj = typeof comparisonPayload === "object" && comparisonPayload !== null ? comparisonPayload : {};
      const target = Number(compObj.target);
      const actual = Number(compObj.actual);
      const attainment = Number.isFinite(target) && target > 0 && Number.isFinite(actual) && actual >= 0 ? actual / target * 100 : void 0;
      let shouldFlag = false;
      if (attainment !== void 0 && attainment < 100) {
        shouldFlag = true;
      }
      if (shouldFlag) {
        flags.push({
          id: existing?.id ?? `flag-${generateId()}`,
          source: "D2.Q3 / D2.Q2",
          description: check.description,
          sourceQuestionId: check.sourceQuestionId,
          comparisonQuestionId: check.comparisonQuestionId,
          status: currentStatus
        });
      } else if (existing) {
        flags.push({
          id: existing.id,
          source: "D2.Q3 / D2.Q2",
          description: check.description,
          sourceQuestionId: check.sourceQuestionId,
          comparisonQuestionId: check.comparisonQuestionId,
          status: currentStatus
        });
      }
    }
  }
  return flags;
}
function calculateFullEvaluation(questionConfigs, responses, openScores, dimensions, integrityFlags, bonusConfirmed, attemptComplete) {
  const questionScores = questionConfigs.map((config) => {
    const response = responses.find((r) => r.questionId === config.questionId);
    if (!response) {
      return {
        questionId: config.questionId,
        reference: config.reference,
        questionType: config.questionType,
        dimensionId: config.dimensionId,
        dimensionReference: config.dimensionReference,
        qWeight: config.qWeight,
        maxScore: config.maxScore,
        rawScore: null
      };
    }
    const rawScore = scoreObjectiveQuestion(config, response);
    return {
      questionId: config.questionId,
      reference: config.reference,
      questionType: config.questionType,
      dimensionId: config.dimensionId,
      dimensionReference: config.dimensionReference,
      qWeight: config.qWeight,
      maxScore: config.maxScore,
      rawScore
    };
  });
  if (!attemptComplete) {
    return {
      evaluationStatus: "Pending Assessment",
      baseAssessmentScore: null,
      verificationMultiplier: null,
      integrityPenalty: 0,
      bonus: 0,
      finalScreeningScore: null,
      rawBand: null,
      appliedBand: null,
      floorMissed: null,
      manualReviewRequired: false,
      dimensions: [],
      questionScores
    };
  }
  const openQuestions = questionConfigs.filter((q) => q.questionType === "OPEN");
  const allOpenReviewed = openQuestions.every((q) => openScores[q.questionId] !== void 0);
  if (!allOpenReviewed) {
    const dims = calculateDimensionScores(questionScores, openScores, dimensions);
    return {
      evaluationStatus: "Pending OPEN Review",
      baseAssessmentScore: null,
      verificationMultiplier: null,
      integrityPenalty: 0,
      bonus: 0,
      finalScreeningScore: null,
      rawBand: null,
      appliedBand: null,
      floorMissed: null,
      manualReviewRequired: false,
      dimensions: dims,
      questionScores
    };
  }
  const dimensionResults = calculateDimensionScores(questionScores, openScores, dimensions);
  const pendingDimensions = dimensionResults.filter((d) => d.floorStatus === "Pending" || d.normalizedScore === null || d.weightedContribution === null);
  if (pendingDimensions.length > 0) {
    return {
      evaluationStatus: "Pending OPEN Review",
      baseAssessmentScore: null,
      verificationMultiplier: null,
      integrityPenalty: 0,
      bonus: 0,
      finalScreeningScore: null,
      rawBand: null,
      appliedBand: null,
      floorMissed: null,
      manualReviewRequired: false,
      dimensions: dimensionResults,
      questionScores
    };
  }
  const baseAssessmentScore = Number(
    dimensionResults.reduce((sum, dim) => sum + dim.weightedContribution, 0).toFixed(3)
  );
  let verificationMultiplier = 1;
  const evidenceQuestions = questionConfigs.filter((q) => q.questionType === "EVIDENCE");
  const evidenceMultipliers = [];
  for (const config of evidenceQuestions) {
    const response = responses.find((r) => r.questionId === config.questionId);
    if (response) {
      const mult = resolveEvidenceMultiplier(config, response);
      if (mult !== null) evidenceMultipliers.push(mult);
    }
  }
  if (evidenceMultipliers.length > 0) {
    verificationMultiplier = Math.min(...evidenceMultipliers);
  }
  const confirmedFlags = integrityFlags.filter((f) => f.status === "Confirmed");
  const integrityPenalty = confirmedFlags.length * INTEGRITY_PENALTY_PER_FLAG;
  const manualReviewRequired = confirmedFlags.length >= 2;
  const rawBonus = Object.entries(bonusConfirmed).filter(([, confirmed]) => confirmed).reduce((sum, [code]) => {
    const bonusDef = BONUS_TYPES.find((b) => b.code === code);
    return sum + (bonusDef?.points ?? 0);
  }, 0);
  const bonus = Math.min(BONUS_CAP, rawBonus);
  const finalScreeningScore = Number(
    calculateFinalScore(baseAssessmentScore, verificationMultiplier, integrityPenalty, bonus).toFixed(3)
  );
  const rawBand = resolveBand(finalScreeningScore);
  const failedFloors = dimensionResults.filter(
    (dim) => dim.floor !== null && dim.normalizedScore < dim.floor
  );
  const floorMissed = failedFloors.length > 0 ? failedFloors.map((f) => f.dimensionReference).join(", ") : null;
  const { appliedBand } = applyFloorCap(rawBand, failedFloors.length > 0);
  const evaluationStatus = manualReviewRequired ? "Manual Review Required" : "Scored";
  return {
    evaluationStatus,
    baseAssessmentScore,
    verificationMultiplier,
    integrityPenalty,
    bonus,
    finalScreeningScore,
    rawBand,
    appliedBand,
    floorMissed,
    manualReviewRequired,
    dimensions: dimensionResults,
    questionScores
  };
}
async function loadQuestionScoringConfigs(assessmentId) {
  const db = getDatabase();
  const assignments = await db.select({
    questionId: assessmentQuestionAssignments.questionId,
    displayOrder: assessmentQuestionAssignments.displayOrder
  }).from(assessmentQuestionAssignments).where(eq4(assessmentQuestionAssignments.assessmentId, assessmentId)).orderBy(asc4(assessmentQuestionAssignments.displayOrder));
  const results = [];
  for (const assignment of assignments) {
    const [questions, options, numericConfigs, numericBands] = await Promise.all([
      db.select().from(assessmentQuestions).where(eq4(assessmentQuestions.id, assignment.questionId)).limit(1),
      db.select().from(questionOptions).where(eq4(questionOptions.questionId, assignment.questionId)).orderBy(asc4(questionOptions.displayOrder)),
      db.select().from(numericQuestionConfigs).where(eq4(numericQuestionConfigs.questionId, assignment.questionId)).limit(1),
      db.select().from(numericScoringBands).where(eq4(numericScoringBands.questionId, assignment.questionId)).orderBy(asc4(numericScoringBands.displayOrder))
    ]);
    const question = questions[0];
    if (!question) continue;
    let dimensionReference = null;
    if (question.dimensionId) {
      const dims = await db.select().from(assessmentDimensions).where(eq4(assessmentDimensions.id, question.dimensionId)).limit(1);
      dimensionReference = dims[0]?.reference ?? null;
    }
    results.push({
      questionId: question.id,
      reference: question.reference,
      questionType: question.questionType,
      dimensionId: question.dimensionId,
      dimensionReference,
      qWeight: question.qWeight,
      maxScore: question.maxScore,
      options: options.map((o) => ({
        id: o.id,
        rawScore: o.rawScore,
        isDecoy: o.isDecoy,
        verificationMultiplier: o.verificationMultiplier,
        outcomeType: o.outcomeType
      })),
      numericConfig: numericConfigs[0] ? {
        mode: numericConfigs[0].mode,
        derivedCalculationType: numericConfigs[0].derivedCalculationType,
        inputDefinitions: parseJson2(
          numericConfigs[0].inputDefinitions,
          []
        )
      } : null,
      numericBands: numericBands.map((b) => ({
        lowerBound: b.lowerBound,
        upperBound: b.upperBound,
        rawScore: b.rawScore
      }))
    });
  }
  return results;
}
async function recalculateAndPersistEvaluation(applicationId) {
  const db = getDatabase();
  const [appRows] = await db.select().from(applications).where(eq4(applications.id, applicationId)).limit(1);
  if (!appRows) return null;
  const attempts = await db.select().from(assessmentAttempts).where(and4(eq4(assessmentAttempts.applicationId, applicationId))).limit(1);
  if (attempts.length === 0) return null;
  const attempt = attempts[0];
  const assessmentId = appRows.assessmentId ?? attempt.assessmentId;
  if (!assessmentId) return null;
  const [questionConfigs, responses, openReviews, existingFlags, bonusReviews, dimensions, crossCheckConfigs] = await Promise.all([
    loadQuestionScoringConfigs(assessmentId),
    db.select().from(assessmentResponses).where(eq4(assessmentResponses.attemptId, attempt.id)),
    db.select().from(openResponseReviews).where(eq4(openResponseReviews.applicationId, applicationId)),
    db.select().from(applicationIntegrityFlags).where(eq4(applicationIntegrityFlags.applicationId, applicationId)),
    db.select().from(applicationBonusReviews).where(eq4(applicationBonusReviews.applicationId, applicationId)),
    db.select().from(assessmentDimensions).where(eq4(assessmentDimensions.roleId, appRows.roleId)).orderBy(asc4(assessmentDimensions.displayOrder)),
    db.select().from(assessmentCrossChecks).where(eq4(assessmentCrossChecks.status, "Active"))
  ]);
  const openScores = {};
  for (const review of openReviews) {
    openScores[review.questionId] = review.rawScore;
  }
  const bonusConfirmed = {};
  for (const bonus of bonusReviews) {
    bonusConfirmed[bonus.bonusType] = bonus.confirmed === 1;
  }
  const responseData = responses.map((r) => {
    const config = questionConfigs.find((q) => q.questionId === r.questionId);
    return {
      questionId: r.questionId,
      responsePayload: r.responsePayload,
      questionType: r.responseType,
      reference: config?.reference ?? ""
    };
  });
  const integrityResults = evaluateIntegrityCrossChecks(
    questionConfigs.map((q) => ({
      questionId: q.questionId,
      reference: q.reference,
      questionType: q.questionType,
      dimensionId: q.dimensionId,
      dimensionReference: q.dimensionReference,
      qWeight: q.qWeight,
      maxScore: q.maxScore,
      rawScore: null
    })),
    responseData,
    crossCheckConfigs,
    existingFlags
  );
  const result = calculateFullEvaluation(
    questionConfigs,
    responses.map((r) => ({ questionId: r.questionId, responseType: r.responseType, responsePayload: r.responsePayload })),
    openScores,
    dimensions.map((d) => ({ id: d.id, reference: d.reference, weight: d.weight, minimumFloor: d.minimumFloor })),
    integrityResults,
    bonusConfirmed,
    attempt.status === "Complete"
  );
  const now = /* @__PURE__ */ new Date();
  const evalId = `eval-${generateId()}`;
  const existingEval = await db.select({ id: applicationEvaluations.id }).from(applicationEvaluations).where(eq4(applicationEvaluations.applicationId, applicationId)).limit(1);
  if (existingEval.length > 0) {
    await db.update(applicationEvaluations).set({
      baseAssessmentScore: result.baseAssessmentScore !== null ? String(result.baseAssessmentScore) : null,
      verificationMultiplier: result.verificationMultiplier !== null ? String(result.verificationMultiplier) : null,
      integrityPenalty: result.integrityPenalty,
      bonus: result.bonus,
      finalScreeningScore: result.finalScreeningScore !== null ? String(result.finalScreeningScore) : null,
      rawBand: result.rawBand,
      appliedBand: result.appliedBand,
      floorMissed: result.floorMissed,
      manualReviewRequired: result.manualReviewRequired ? 1 : 0,
      evaluationStatus: result.evaluationStatus,
      calculatedAt: now
    }).where(eq4(applicationEvaluations.applicationId, applicationId));
  } else {
    await db.insert(applicationEvaluations).values([{
      id: evalId,
      applicationId,
      attemptId: attempt.id,
      baseAssessmentScore: result.baseAssessmentScore !== null ? String(result.baseAssessmentScore) : null,
      verificationMultiplier: result.verificationMultiplier !== null ? String(result.verificationMultiplier) : null,
      integrityPenalty: result.integrityPenalty,
      bonus: result.bonus,
      finalScreeningScore: result.finalScreeningScore !== null ? String(result.finalScreeningScore) : null,
      rawBand: result.rawBand,
      appliedBand: result.appliedBand,
      floorMissed: result.floorMissed,
      manualReviewRequired: result.manualReviewRequired ? 1 : 0,
      evaluationStatus: result.evaluationStatus,
      calculatedAt: now
    }]);
  }
  await db.delete(applicationDimensionScores).where(eq4(applicationDimensionScores.applicationId, applicationId));
  const scoredDims = result.dimensions.filter(
    (dim) => dim.normalizedScore !== null && dim.weightedContribution !== null
  );
  if (scoredDims.length > 0) {
    await db.insert(applicationDimensionScores).values(
      scoredDims.map((dim) => ({
        id: `dim-${generateId()}`,
        applicationId,
        dimensionId: dim.dimensionId,
        dimensionReference: dim.dimensionReference,
        normalizedScore: String(dim.normalizedScore),
        weight: dim.weight,
        weightedContribution: String(dim.weightedContribution),
        floor: dim.floor,
        floorStatus: dim.floorStatus,
        calculatedAt: now
      }))
    );
  }
  for (const flag of integrityResults) {
    const existing = existingFlags.find((f) => f.sourceQuestionId === flag.sourceQuestionId);
    if (existing) {
      if (existing.status === "Confirmed" || existing.status === "Dismissed") continue;
      await db.update(applicationIntegrityFlags).set({ status: flag.status }).where(eq4(applicationIntegrityFlags.id, existing.id));
    } else if (flag.status === "Flagged") {
      await db.insert(applicationIntegrityFlags).values({
        id: flag.id,
        applicationId,
        sourceQuestionId: flag.sourceQuestionId,
        comparisonQuestionId: flag.comparisonQuestionId,
        description: flag.description,
        source: flag.source,
        status: flag.status
      });
    }
  }
  return result;
}

// server/adminApplicationApi.ts
import { randomBytes as randomBytes5 } from "node:crypto";
function databaseConfigured2() {
  return Boolean(process.env.DATABASE_URL);
}
function fail(response, status, error) {
  response.status(status).json({ ok: false, error });
}
function logAdminAppError(context, error, safeMessage, response) {
  const entries = [];
  let cursor = error;
  let depth = 0;
  while (cursor && depth < 5) {
    if (cursor instanceof Error) {
      entries.push({
        depth,
        name: cursor.name,
        message: cursor.message,
        stack: cursor.stack?.split("\n").slice(0, 3).join("\n")
      });
      cursor = cursor.cause;
    } else if (typeof cursor === "object") {
      const e = cursor;
      entries.push({
        depth,
        code: e.code,
        errno: e.errno,
        sqlState: e.sqlState,
        sqlMessage: e.sqlMessage,
        message: e.message
      });
      cursor = e.cause;
    } else {
      entries.push({ depth, raw: cursor });
      break;
    }
    depth += 1;
  }
  console.error(`[admin-app] ${context} failed:`, JSON.stringify({ safeMessage, chain: entries }, null, 2));
  fail(response, 503, safeMessage);
}
function generateId2() {
  return randomBytes5(12).toString("hex");
}
async function requireAuthorizedAdmin(request, response, next) {
  if (!databaseConfigured2()) return fail(response, 503, "Unable to load application data.");
  try {
    const token = readSessionToken(request);
    const session = token ? await resolveSession(token) : null;
    const profile = session ? await findAdminProfileForUser(session.user.id) : null;
    if (!session || !isAdminAuthorized(session.user, profile)) {
      return fail(response, 401, "Admin authorization is required.");
    }
    request.adminProfileId = profile.id;
    next();
  } catch (error) {
    console.error("[admin-app] admin authorization failed:", error instanceof Error ? error.message : String(error));
    fail(response, 503, "Unable to load application data.");
  }
}
function createAdminApplicationApiRouter() {
  const router = express2.Router();
  router.get("/api/admin/applications", requireAuthorizedAdmin, async (request, response) => {
    try {
      const db = (await Promise.resolve().then(() => (init_db(), db_exports))).getDatabase();
      const allApps = await db.select({
        id: applications.id,
        fullName: applications.fullName,
        email: applications.email,
        roleId: applications.roleId,
        eligibilityStatus: applications.eligibilityStatus,
        applicationStatus: applications.applicationStatus,
        currentStep: applications.currentStep,
        submittedAt: applications.submittedAt,
        createdAt: applications.createdAt,
        roleTitle: recruitmentRoles.title
      }).from(applications).innerJoin(recruitmentRoles, eq5(applications.roleId, recruitmentRoles.id)).orderBy(desc2(applications.createdAt));
      const appIds = allApps.map((a) => a.id);
      const [evaluations, shortlists] = appIds.length > 0 ? await Promise.all([
        db.select().from(applicationEvaluations).where(sql5`${applicationEvaluations.applicationId} IN (${sql5.join(appIds.map((id) => sql5`${id}`), sql5`, `)})`),
        db.select().from(applicationShortlist).where(sql5`${applicationShortlist.applicationId} IN (${sql5.join(appIds.map((id) => sql5`${id}`), sql5`, `)})`)
      ]) : [[], []];
      const evalMap = new Map(evaluations.map((e) => [e.applicationId, e]));
      const shortlistMap = new Map(shortlists.map((s) => [s.applicationId, s]));
      const attempts = appIds.length > 0 ? await db.select({ applicationId: assessmentAttempts.applicationId, status: assessmentAttempts.status }).from(assessmentAttempts).where(sql5`${assessmentAttempts.applicationId} IN (${sql5.join(appIds.map((id) => sql5`${id}`), sql5`, `)})`) : [];
      const attemptMap = new Map(attempts.map((a) => [a.applicationId, a.status]));
      const summaryApps = allApps.map((app2) => {
        const evaluation = evalMap.get(app2.id);
        const shortlist = shortlistMap.get(app2.id);
        const attemptStatus = attemptMap.get(app2.id);
        const assessmentStatus = !attemptStatus ? "Pending" : attemptStatus === "Complete" ? "Complete" : "In Progress";
        return {
          id: app2.id,
          fullName: app2.fullName,
          email: app2.email,
          roleTitle: app2.roleTitle,
          eligibilityStatus: app2.eligibilityStatus,
          assessmentStatus,
          applicationStatus: app2.applicationStatus,
          finalScore: evaluation?.finalScreeningScore ? Number(evaluation.finalScreeningScore) : null,
          appliedBand: evaluation?.appliedBand ?? null,
          evaluationStatus: evaluation?.evaluationStatus ?? null,
          shortlisted: shortlist ? shortlist.shortlisted === 1 : false,
          submittedAt: app2.submittedAt?.toISOString() ?? null,
          createdAt: app2.createdAt.toISOString()
        };
      });
      const submitted = summaryApps.filter((a) => a.applicationStatus !== "In Progress" && a.applicationStatus !== "Eligibility Closed").length;
      const pendingReview = summaryApps.filter((a) => a.evaluationStatus === "Pending OPEN Review" || a.evaluationStatus === "Pending Assessment").length;
      const shortlisted = summaryApps.filter((a) => a.shortlisted).length;
      response.json({
        ok: true,
        applications: summaryApps,
        counts: { total: summaryApps.length, submitted, pendingReview, shortlisted }
      });
    } catch (error) {
      logAdminAppError("list applications", error, "Unable to load applications.", response);
    }
  });
  router.get("/api/admin/applications/:id", requireAuthorizedAdmin, async (request, response) => {
    const applicationId = request.params.id;
    try {
      const db = (await Promise.resolve().then(() => (init_db(), db_exports))).getDatabase();
      const [appRows] = await db.select({
        app: applications,
        roleTitle: recruitmentRoles.title
      }).from(applications).innerJoin(recruitmentRoles, eq5(applications.roleId, recruitmentRoles.id)).where(eq5(applications.id, applicationId)).limit(1);
      if (!appRows) return fail(response, 404, "Application not found.");
      const app2 = appRows.app;
      const [eligResponses, attempts, evaluation, dimScores, openRevs, intFlags, bonusRevs, shortlistRows] = await Promise.all([
        db.select().from(applicationEligibilityResponses).where(eq5(applicationEligibilityResponses.applicationId, applicationId)).orderBy(asc5(applicationEligibilityResponses.gateReference)),
        db.select().from(assessmentAttempts).where(eq5(assessmentAttempts.applicationId, applicationId)).limit(1),
        db.select().from(applicationEvaluations).where(eq5(applicationEvaluations.applicationId, applicationId)).limit(1),
        db.select().from(applicationDimensionScores).where(eq5(applicationDimensionScores.applicationId, applicationId)),
        db.select().from(openResponseReviews).where(eq5(openResponseReviews.applicationId, applicationId)),
        db.select().from(applicationIntegrityFlags).where(eq5(applicationIntegrityFlags.applicationId, applicationId)),
        db.select().from(applicationBonusReviews).where(eq5(applicationBonusReviews.applicationId, applicationId)),
        db.select().from(applicationShortlist).where(eq5(applicationShortlist.applicationId, applicationId)).limit(1)
      ]);
      const attempt = attempts[0];
      let candidateResponses = [];
      if (attempt) {
        const rawResponses = await db.select({
          resp: assessmentResponses,
          q: assessmentQuestions
        }).from(assessmentResponses).innerJoin(assessmentQuestions, eq5(assessmentResponses.questionId, assessmentQuestions.id)).where(eq5(assessmentResponses.attemptId, attempt.id));
        candidateResponses = rawResponses.map((r) => ({
          questionId: r.resp.questionId,
          questionReference: r.q.reference,
          questionType: r.q.questionType,
          prompt: r.q.prompt,
          responsePayload: (() => {
            try {
              return JSON.parse(r.resp.responsePayload);
            } catch {
              return r.resp.responsePayload;
            }
          })(),
          elapsedSeconds: r.resp.elapsedSeconds
        }));
      }
      const evalData = evaluation[0];
      const dims = dimScores.map((d) => ({
        dimensionId: d.dimensionId,
        dimensionReference: d.dimensionReference,
        normalizedScore: Number(d.normalizedScore),
        weight: d.weight,
        weightedContribution: Number(d.weightedContribution),
        floor: d.floor,
        floorStatus: d.floorStatus
      }));
      const openReviewsDetail = [];
      const pendingOpenQuestions = [];
      if (attempt && app2.assessmentId) {
        const assignments = await db.select({
          questionId: assessmentQuestionAssignments.questionId,
          displayOrder: assessmentQuestionAssignments.displayOrder
        }).from(assessmentQuestionAssignments).where(eq5(assessmentQuestionAssignments.assessmentId, app2.assessmentId)).orderBy(asc5(assessmentQuestionAssignments.displayOrder));
        for (const assignment of assignments) {
          const [questions] = await db.select().from(assessmentQuestions).where(eq5(assessmentQuestions.id, assignment.questionId)).limit(1);
          if (!questions || questions.questionType !== "OPEN") continue;
          const resp = candidateResponses.find((r) => r.questionId === assignment.questionId);
          const review = openRevs.find((r) => r.questionId === assignment.questionId);
          const rubric = await db.select().from(openRubricAnchors).where(eq5(openRubricAnchors.questionId, assignment.questionId)).orderBy(asc5(openRubricAnchors.displayOrder));
          const anchors = rubric.map((r) => ({ scoreMin: r.scoreMin, scoreMax: r.scoreMax, anchorText: r.anchorText }));
          if (review) {
            openReviewsDetail.push({
              questionId: assignment.questionId,
              questionReference: questions.reference,
              prompt: questions.prompt,
              candidateResponse: typeof resp?.responsePayload === "string" ? resp.responsePayload : JSON.stringify(resp?.responsePayload ?? ""),
              rawScore: review.rawScore,
              reviewNote: review.reviewNote,
              rubricAnchors: anchors
            });
          } else {
            pendingOpenQuestions.push({
              questionId: assignment.questionId,
              questionReference: questions.reference,
              prompt: questions.prompt,
              candidateResponse: typeof resp?.responsePayload === "string" ? resp.responsePayload : JSON.stringify(resp?.responsePayload ?? ""),
              rubricAnchors: anchors
            });
          }
        }
      }
      let questionScores = [];
      if (app2.assessmentId && attempt) {
        const configs = await loadQuestionScoringConfigs(app2.assessmentId);
        const dbResponses = await db.select().from(assessmentResponses).where(eq5(assessmentResponses.attemptId, attempt.id));
        for (const config of configs) {
          const resp = dbResponses.find((r) => r.questionId === config.questionId);
          let rawScore = null;
          if (resp) {
            rawScore = scoreObjectiveQuestion(config, { responseType: resp.responseType, responsePayload: resp.responsePayload });
            const openRev = openRevs.find((r) => r.questionId === config.questionId);
            if (config.questionType === "OPEN" && openRev) rawScore = openRev.rawScore;
          }
          questionScores.push({
            questionId: config.questionId,
            questionReference: config.reference,
            questionType: config.questionType,
            rawScore,
            maxScore: config.maxScore,
            qWeight: config.qWeight,
            dimensionReference: config.dimensionReference
          });
        }
      }
      const bonusReviewsDetail = BONUS_TYPES.map((bt) => {
        const existing = bonusRevs.find((b) => b.bonusType === bt.code);
        return {
          bonusType: bt.code,
          label: bt.label,
          points: existing?.points ?? bt.points,
          confirmed: existing ? existing.confirmed === 1 : false,
          note: existing?.note ?? null
        };
      });
      const attemptStatus = attempt?.status ?? "Not Started";
      const assessmentStatus = attemptStatus === "Complete" ? "Complete" : attemptStatus === "In Progress" ? "In Progress" : "Pending";
      response.json({
        ok: true,
        application: {
          id: app2.id,
          fullName: app2.fullName,
          email: app2.email,
          phone: app2.phone,
          city: app2.city,
          recentRole: app2.recentRole,
          recentEmployer: app2.recentEmployer,
          totalExperience: app2.totalExperience,
          relevantExperience: app2.relevantExperience,
          linkedinUrl: app2.linkedinUrl,
          roleTitle: appRows.roleTitle,
          eligibilityStatus: app2.eligibilityStatus,
          assessmentStatus,
          applicationStatus: app2.applicationStatus,
          submittedAt: app2.submittedAt?.toISOString() ?? null,
          createdAt: app2.createdAt.toISOString(),
          eligibilityResponses: eligResponses.map((e) => ({
            gateReference: e.gateReference,
            outcome: e.outcome,
            internalFlag: e.internalFlag
          })),
          assessmentResponses: candidateResponses,
          finalScore: evalData?.finalScreeningScore ? Number(evalData.finalScreeningScore) : null,
          appliedBand: evalData?.appliedBand ?? null,
          evaluationStatus: evalData?.evaluationStatus ?? null,
          shortlisted: shortlistRows.length > 0 && shortlistRows[0].shortlisted === 1
        },
        evaluation: {
          applicationId: app2.id,
          evaluationStatus: evalData?.evaluationStatus ?? "Pending Assessment",
          baseAssessmentScore: evalData?.baseAssessmentScore ? Number(evalData.baseAssessmentScore) : null,
          verificationMultiplier: evalData?.verificationMultiplier ? Number(evalData.verificationMultiplier) : null,
          integrityPenalty: evalData?.integrityPenalty ?? null,
          bonus: evalData?.bonus ?? null,
          finalScreeningScore: evalData?.finalScreeningScore ? Number(evalData.finalScreeningScore) : null,
          rawBand: evalData?.rawBand ?? null,
          appliedBand: evalData?.appliedBand ?? null,
          floorMissed: evalData?.floorMissed ?? null,
          manualReviewRequired: evalData ? evalData.manualReviewRequired === 1 : false,
          dimensions: dims,
          openReviews: openReviewsDetail,
          pendingOpenQuestions,
          integrityFlags: intFlags.map((f) => ({
            id: f.id,
            source: f.source,
            description: f.description,
            status: f.status
          })),
          bonusReviews: bonusReviewsDetail,
          questionScores
        }
      });
    } catch (error) {
      logAdminAppError("application detail", error, "Unable to load application detail.", response);
    }
  });
  router.get("/api/admin/applications/:id/evaluation", requireAuthorizedAdmin, async (request, response) => {
    const applicationId = request.params.id;
    try {
      const result = await recalculateAndPersistEvaluation(applicationId);
      if (!result) return fail(response, 404, "Application or assessment not found.");
      response.json({ ok: true, evaluation: result });
    } catch (error) {
      logAdminAppError("evaluation recalculate", error, "Unable to calculate evaluation.", response);
    }
  });
  router.put("/api/admin/applications/:id/open-reviews/:questionId", requireAuthorizedAdmin, async (request, response) => {
    const applicationId = request.params.id;
    const questionId = request.params.questionId;
    const adminProfileId = request.adminProfileId;
    const validation = validateOpenReviewInput(request.body);
    if (!validation.ok) return fail(response, 400, validation.errors.join(" "));
    try {
      const db = (await Promise.resolve().then(() => (init_db(), db_exports))).getDatabase();
      const attempts = await db.select().from(assessmentAttempts).where(eq5(assessmentAttempts.applicationId, applicationId)).limit(1);
      if (attempts.length === 0) return fail(response, 404, "Assessment attempt not found.");
      const attempt = attempts[0];
      const [resp] = await db.select().from(assessmentResponses).where(and5(eq5(assessmentResponses.attemptId, attempt.id), eq5(assessmentResponses.questionId, questionId))).limit(1);
      if (!resp) return fail(response, 404, "Response not found for this question.");
      const existing = await db.select().from(openResponseReviews).where(and5(eq5(openResponseReviews.responseId, resp.id), eq5(openResponseReviews.questionId, questionId))).limit(1);
      if (existing.length > 0) {
        await db.update(openResponseReviews).set({
          rawScore: validation.input.rawScore,
          reviewNote: validation.input.note ?? null,
          adminProfileId,
          reviewedAt: /* @__PURE__ */ new Date()
        }).where(eq5(openResponseReviews.id, existing[0].id));
      } else {
        await db.insert(openResponseReviews).values({
          id: `rev-${generateId2()}`,
          applicationId,
          attemptId: attempt.id,
          responseId: resp.id,
          questionId,
          adminProfileId,
          rawScore: validation.input.rawScore,
          reviewNote: validation.input.note ?? null,
          reviewedAt: /* @__PURE__ */ new Date()
        });
      }
      await recalculateAndPersistEvaluation(applicationId);
      response.json({ ok: true });
    } catch (error) {
      logAdminAppError("open review save", error, "Unable to save OPEN review.", response);
    }
  });
  router.put("/api/admin/applications/:id/integrity/:flagId", requireAuthorizedAdmin, async (request, response) => {
    const applicationId = request.params.id;
    const flagId = request.params.flagId;
    const adminProfileId = request.adminProfileId;
    const validation = validateIntegrityFlagInput(request.body);
    if (!validation.ok) return fail(response, 400, validation.errors.join(" "));
    try {
      const db = (await Promise.resolve().then(() => (init_db(), db_exports))).getDatabase();
      const [flag] = await db.select().from(applicationIntegrityFlags).where(and5(eq5(applicationIntegrityFlags.id, flagId), eq5(applicationIntegrityFlags.applicationId, applicationId))).limit(1);
      if (!flag) return fail(response, 404, "Integrity flag not found.");
      await db.update(applicationIntegrityFlags).set({
        status: validation.input.status,
        confirmedBy: adminProfileId,
        reviewedAt: /* @__PURE__ */ new Date()
      }).where(eq5(applicationIntegrityFlags.id, flagId));
      await recalculateAndPersistEvaluation(applicationId);
      response.json({ ok: true });
    } catch (error) {
      logAdminAppError("integrity flag update", error, "Unable to update integrity flag.", response);
    }
  });
  router.put("/api/admin/applications/:id/bonuses/:bonusType", requireAuthorizedAdmin, async (request, response) => {
    const applicationId = request.params.id;
    const bonusType = request.params.bonusType;
    const adminProfileId = request.adminProfileId;
    const validation = validateBonusInput(request.body);
    if (!validation.ok) return fail(response, 400, validation.errors.join(" "));
    const bonusDef = BONUS_TYPES.find((b) => b.code === bonusType);
    if (!bonusDef) return fail(response, 400, "Invalid bonus type.");
    try {
      const db = (await Promise.resolve().then(() => (init_db(), db_exports))).getDatabase();
      const existing = await db.select().from(applicationBonusReviews).where(and5(eq5(applicationBonusReviews.applicationId, applicationId), eq5(applicationBonusReviews.bonusType, bonusType))).limit(1);
      if (existing.length > 0) {
        await db.update(applicationBonusReviews).set({
          confirmed: validation.input.confirmed ? 1 : 0,
          note: validation.input.note ?? null,
          adminProfileId
        }).where(eq5(applicationBonusReviews.id, existing[0].id));
      } else {
        await db.insert(applicationBonusReviews).values({
          id: `bonus-${generateId2()}`,
          applicationId,
          bonusType,
          points: bonusDef.points,
          confirmed: validation.input.confirmed ? 1 : 0,
          adminProfileId,
          note: validation.input.note ?? null
        });
      }
      await recalculateAndPersistEvaluation(applicationId);
      response.json({ ok: true });
    } catch (error) {
      logAdminAppError("bonus review save", error, "Unable to save bonus review.", response);
    }
  });
  router.put("/api/admin/applications/:id/shortlist", requireAuthorizedAdmin, async (request, response) => {
    const applicationId = request.params.id;
    const adminProfileId = request.adminProfileId;
    const validation = validateShortlistInput(request.body);
    if (!validation.ok) return fail(response, 400, validation.errors.join(" "));
    try {
      const db = (await Promise.resolve().then(() => (init_db(), db_exports))).getDatabase();
      const existing = await db.select().from(applicationShortlist).where(eq5(applicationShortlist.applicationId, applicationId)).limit(1);
      if (validation.input.shortlisted) {
        if (existing.length > 0) {
          await db.update(applicationShortlist).set({ shortlisted: 1, updatedBy: adminProfileId }).where(eq5(applicationShortlist.id, existing[0].id));
        } else {
          await db.insert(applicationShortlist).values({
            id: `sl-${generateId2()}`,
            applicationId,
            shortlisted: 1,
            updatedBy: adminProfileId
          });
        }
      } else {
        if (existing.length > 0) {
          await db.update(applicationShortlist).set({ shortlisted: 0, updatedBy: adminProfileId }).where(eq5(applicationShortlist.id, existing[0].id));
        }
      }
      response.json({ ok: true });
    } catch (error) {
      logAdminAppError("shortlist update", error, "Unable to update shortlist status.", response);
    }
  });
  router.put("/api/admin/applications/:id/status", requireAuthorizedAdmin, async (request, response) => {
    const applicationId = request.params.id;
    const validation = validateApplicationStatusInput(request.body);
    if (!validation.ok) return fail(response, 400, validation.errors.join(" "));
    try {
      const db = (await Promise.resolve().then(() => (init_db(), db_exports))).getDatabase();
      const [app2] = await db.select().from(applications).where(eq5(applications.id, applicationId)).limit(1);
      if (!app2) return fail(response, 404, "Application not found.");
      const statusMap = {
        "Submitted": "Submitted",
        "Under Review": "Submitted",
        "Shortlisted": "Shortlisted",
        "Hold": "Hold",
        "Closed": "Closed"
      };
      const dbStatus = statusMap[validation.input.status] ?? validation.input.status;
      await db.update(applications).set({
        applicationStatus: dbStatus
      }).where(eq5(applications.id, applicationId));
      response.json({ ok: true });
    } catch (error) {
      logAdminAppError("application status update", error, "Unable to update application status.", response);
    }
  });
  return router;
}

// server/applicationApi.ts
init_schema();
import express3 from "express";
import { eq as eq8 } from "drizzle-orm";

// server/applicationRepository.ts
init_schema();
import { createHash as createHash2, randomBytes as randomBytes6 } from "node:crypto";
import { and as and6, asc as asc6, eq as eq6, sql as sql6 } from "drizzle-orm";

// shared/applicationApi.ts
function validateCreateApplicationInput(candidate) {
  if (!candidate || typeof candidate !== "object") return { errors: ["Application data is missing."] };
  const value = candidate;
  const errors = [];
  const roleSlug = typeof value.roleSlug === "string" ? value.roleSlug.trim() : "";
  if (!roleSlug) errors.push("Role is missing.");
  const fullName = typeof value.fullName === "string" ? value.fullName.trim() : "";
  if (!fullName) errors.push("Enter your full name.");
  else if (fullName.length > 180) errors.push("Full name is too long.");
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  if (!email) errors.push("Enter your email address.");
  else if (!/^\S+@\S+\.\S+$/.test(email)) errors.push("Enter a valid email address.");
  const phone = typeof value.phone === "string" ? value.phone.trim() : "";
  if (!phone) errors.push("Enter your phone number.");
  const city = typeof value.city === "string" ? value.city.trim() : "";
  if (!city) errors.push("Enter your current location.");
  const recentRole = typeof value.recentRole === "string" ? value.recentRole.trim() : "";
  if (!recentRole) errors.push("Enter your current or most recent job title.");
  const recentEmployer = typeof value.recentEmployer === "string" ? value.recentEmployer.trim() : "";
  const totalExperience = typeof value.totalExperience === "string" ? value.totalExperience.trim() : "";
  if (!totalExperience) errors.push("Select your total experience level.");
  const relevantExperience = typeof value.relevantExperience === "string" ? value.relevantExperience.trim() : "";
  if (!relevantExperience) errors.push("Select your relevant experience level.");
  const linkedinUrl = typeof value.linkedinUrl === "string" ? value.linkedinUrl.trim() : "";
  if (linkedinUrl && linkedinUrl.length > 512) errors.push("LinkedIn URL is too long.");
  const eligibility = value.eligibility;
  if (!eligibility || typeof eligibility !== "object") {
    errors.push("Eligibility answers are missing.");
  } else {
    const elig2 = eligibility;
    if (!["abuja", "relocate", "not-relocate"].includes(elig2.abujaAvailability)) errors.push("Select your Abuja availability.");
    if (elig2.abujaAvailability === "relocate" && (!elig2.plannedRelocationDate || typeof elig2.plannedRelocationDate !== "string" || !elig2.plannedRelocationDate.trim())) {
      errors.push("Enter your planned relocation date.");
    }
    if (!["yes", "no"].includes(elig2.rightToWork)) errors.push("Select your right to work status.");
    if (!["yes", "no"].includes(elig2.startAvailability)) errors.push("Select your start availability.");
    if (!["yes", "no"].includes(elig2.compensationBand)) errors.push("Select your compensation band confirmation.");
    if (!["yes", "no"].includes(elig2.outboundWork)) errors.push("Select your outbound work willingness.");
    if (!["yes", "no"].includes(elig2.verificationConsent)) errors.push("Select your verification consent.");
  }
  if (errors.length) return { errors };
  const elig = eligibility;
  return {
    input: {
      roleSlug,
      fullName,
      email,
      phone,
      city,
      recentRole,
      recentEmployer,
      totalExperience,
      relevantExperience,
      linkedinUrl,
      eligibility: {
        abujaAvailability: elig.abujaAvailability,
        plannedRelocationDate: typeof elig.plannedRelocationDate === "string" ? elig.plannedRelocationDate.trim() : "",
        rightToWork: elig.rightToWork,
        startAvailability: elig.startAvailability,
        compensationBand: elig.compensationBand,
        outboundWork: elig.outboundWork,
        verificationConsent: elig.verificationConsent
      }
    }
  };
}
function validateAssessmentResponseInput(candidate) {
  if (!candidate || typeof candidate !== "object") return { errors: ["Response data is missing."] };
  const value = candidate;
  const errors = [];
  const validTypes = ["ORDINAL", "MULTI", "NUMERIC", "SJT", "OPEN", "EVIDENCE"];
  const responseType = value.responseType;
  if (typeof responseType !== "string" || !validTypes.includes(responseType)) {
    errors.push("Invalid response type.");
    return { errors };
  }
  const responsePayload = value.responsePayload;
  if (responsePayload === void 0 || responsePayload === null) {
    errors.push("Response payload is missing.");
    return { errors };
  }
  const elapsedSeconds = typeof value.elapsedSeconds === "number" ? value.elapsedSeconds : void 0;
  return {
    input: {
      responseType,
      responsePayload,
      elapsedSeconds
    }
  };
}
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

// server/applicationRepository.ts
init_db();
function parseJson3(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
function generateApplicantToken() {
  return randomBytes6(32).toString("hex");
}
function hashApplicantToken(token) {
  return createHash2("sha256").update(token).digest("hex");
}
var EXPERIENCE_OPTION_MINIMUM_YEARS = {
  "No direct experience": 0,
  "Less than 1 year": 0,
  "1\u20132 years": 1,
  "3\u20135 years": 3,
  "6\u20138 years": 6,
  "9+ years": 9
};
function evaluateEligibilityServerSide(gates, eligibility, relevantExperience) {
  const results = [];
  for (const gate of gates) {
    const config = parseJson3(gate.configuration, {});
    if (gate.status === "Configuration Required") {
      results.push({ gateId: gate.id, gateReference: gate.reference, response: "", outcome: "Configuration required" });
      continue;
    }
    switch (gate.reference) {
      case "G1": {
        const response = eligibility.abujaAvailability;
        if (response === "not-relocate") {
          results.push({ gateId: gate.id, gateReference: "G1", response, outcome: "Failed" });
        } else if (response === "relocate") {
          results.push({ gateId: gate.id, gateReference: "G1", response, outcome: "Flagged", flagReason: "Relocation commitment" });
        } else {
          results.push({ gateId: gate.id, gateReference: "G1", response, outcome: "Passed" });
        }
        break;
      }
      case "G2": {
        const response = eligibility.rightToWork;
        results.push({ gateId: gate.id, gateReference: "G2", response, outcome: response === "yes" ? "Passed" : "Failed" });
        break;
      }
      case "G3": {
        const minimumYears = typeof config.minimumYears === "number" ? config.minimumYears : 3;
        const represented = EXPERIENCE_OPTION_MINIMUM_YEARS[relevantExperience] ?? 0;
        results.push({ gateId: gate.id, gateReference: "G3", response: relevantExperience, outcome: represented >= minimumYears ? "Passed" : "Failed" });
        break;
      }
      case "G4": {
        const response = eligibility.startAvailability;
        results.push({ gateId: gate.id, gateReference: "G4", response, outcome: response === "yes" ? "Passed" : "Failed" });
        break;
      }
      case "G5": {
        const response = eligibility.compensationBand;
        results.push({ gateId: gate.id, gateReference: "G5", response, outcome: response === "yes" ? "Passed" : "Failed" });
        break;
      }
      case "G6": {
        const response = eligibility.outboundWork;
        results.push({ gateId: gate.id, gateReference: "G6", response, outcome: response === "yes" ? "Passed" : "Failed" });
        break;
      }
      case "G7": {
        const response = eligibility.verificationConsent;
        results.push({ gateId: gate.id, gateReference: "G7", response, outcome: response === "yes" ? "Passed" : "Failed" });
        break;
      }
      default: {
        results.push({ gateId: gate.id, gateReference: gate.reference, response: "", outcome: "Configuration required" });
      }
    }
  }
  const failedGate = results.find((r) => r.outcome === "Failed");
  return {
    eligible: !failedGate,
    gates: results,
    failedGateId: failedGate?.gateId ?? null
  };
}
async function createApplication(input, role, eligibilityResult, activeAssessment) {
  const db = getDatabase();
  const token = generateApplicantToken();
  const tokenHash = hashApplicantToken(token);
  const applicationId = `app-${randomBytes6(12).toString("hex")}`;
  const eligible = eligibilityResult.eligible;
  const eligibilityStatus = eligible ? "Eligible" : "Closed";
  const applicationStatus = eligible ? "In Progress" : "Eligibility Closed";
  const currentStep = eligible ? "assessment" : "eligibility-closed";
  await db.insert(applications).values({
    id: applicationId,
    roleId: role.id,
    assessmentId: eligible && activeAssessment ? activeAssessment.id : null,
    fullName: input.fullName,
    email: normalizeEmail(input.email),
    phone: input.phone,
    city: input.city,
    recentRole: input.recentRole,
    recentEmployer: input.recentEmployer || null,
    totalExperience: input.totalExperience,
    relevantExperience: input.relevantExperience,
    linkedinUrl: input.linkedinUrl || null,
    eligibilityStatus,
    applicationStatus,
    currentStep,
    applicantTokenHash: tokenHash
  });
  const eligibilityResponses = eligibilityResult.gates.map((gate) => ({
    id: `elig-${randomBytes6(8).toString("hex")}`,
    applicationId,
    gateId: gate.gateId,
    gateReference: gate.gateReference,
    responseValue: gate.response,
    outcome: gate.outcome,
    internalFlag: gate.flagReason ?? null
  }));
  if (eligibilityResponses.length > 0) {
    await db.insert(applicationEligibilityResponses).values(eligibilityResponses);
  }
  return { applicationId, applicantToken: token };
}
async function findApplicationByToken(token) {
  const db = getDatabase();
  const tokenHash = hashApplicantToken(token);
  return (await db.select().from(applications).where(eq6(applications.applicantTokenHash, tokenHash)).limit(1))[0] ?? null;
}
async function findExistingApplication(roleId, email) {
  const db = getDatabase();
  const normalized = normalizeEmail(email);
  return (await db.select().from(applications).where(and6(eq6(applications.roleId, roleId), eq6(applications.email, normalized))).limit(1))[0] ?? null;
}
async function updateApplicationStatus(applicationId, status, step) {
  const db = getDatabase();
  const updates = { applicationStatus: status };
  if (step) updates.currentStep = step;
  await db.update(applications).set(updates).where(eq6(applications.id, applicationId));
}
async function buildApplicationState(application) {
  const db = getDatabase();
  const [eligibilityRows, attempt] = await Promise.all([
    db.select().from(applicationEligibilityResponses).where(eq6(applicationEligibilityResponses.applicationId, application.id)),
    getActiveAttempt(application.id)
  ]);
  let assessmentState = null;
  if (attempt && application.assessmentId) {
    const assessment = (await db.select().from(assessments).where(eq6(assessments.id, application.assessmentId)).limit(1))[0];
    if (assessment) {
      const questions = await loadApplicantSafeQuestions(application.assessmentId, attempt.id);
      const responseCount = (await db.select({ count: sql6`count(*)` }).from(assessmentResponses).where(eq6(assessmentResponses.attemptId, attempt.id)))[0]?.count ?? 0;
      assessmentState = {
        attemptId: attempt.id,
        assessmentName: assessment.name,
        questionCount: questions.length,
        currentProgress: responseCount,
        questions
      };
    }
  }
  return {
    applicationId: application.id,
    currentStep: application.currentStep,
    applicationStatus: application.applicationStatus,
    eligibilityStatus: application.eligibilityStatus,
    applicant: {
      fullName: application.fullName,
      email: application.email,
      phone: application.phone,
      city: application.city,
      recentRole: application.recentRole,
      recentEmployer: application.recentEmployer ?? "",
      totalExperience: application.totalExperience,
      relevantExperience: application.relevantExperience,
      linkedinUrl: application.linkedinUrl ?? ""
    },
    eligibility: {
      gates: eligibilityRows.map((row) => ({
        gateId: row.gateId,
        gateReference: row.gateReference,
        response: row.responseValue,
        outcome: row.outcome,
        ...row.internalFlag ? { flagReason: row.internalFlag } : {}
      })),
      eligible: application.eligibilityStatus === "Eligible"
    },
    assessment: assessmentState,
    submittedAt: application.submittedAt ? new Date(application.submittedAt).toISOString() : null
  };
}
async function getActiveAttempt(applicationId) {
  const db = getDatabase();
  return (await db.select().from(assessmentAttempts).where(eq6(assessmentAttempts.applicationId, applicationId)).orderBy(asc6(assessmentAttempts.createdAt)).limit(1))[0] ?? null;
}
async function createAssessmentAttempt(applicationId, assessmentId) {
  const db = getDatabase();
  const existing = await getActiveAttempt(applicationId);
  if (existing) return existing;
  const id = `attempt-${randomBytes6(12).toString("hex")}`;
  await db.insert(assessmentAttempts).values({
    id,
    applicationId,
    assessmentId,
    status: "Not Started"
  });
  return (await db.select().from(assessmentAttempts).where(eq6(assessmentAttempts.id, id)).limit(1))[0];
}
async function updateAttemptStatus(attemptId, status) {
  const db = getDatabase();
  const updates = { status };
  if (status === "Complete") updates.completedAt = /* @__PURE__ */ new Date();
  await db.update(assessmentAttempts).set(updates).where(eq6(assessmentAttempts.id, attemptId));
}
async function loadApplicantSafeQuestions(assessmentId, attemptId) {
  const db = getDatabase();
  const assignments = await db.select().from(assessmentQuestionAssignments).where(eq6(assessmentQuestionAssignments.assessmentId, assessmentId)).orderBy(asc6(assessmentQuestionAssignments.displayOrder));
  const questions = [];
  for (const assignment of assignments) {
    const question = (await db.select().from(assessmentQuestions).where(eq6(assessmentQuestions.id, assignment.questionId)).limit(1))[0];
    if (!question || question.status !== "Active") continue;
    const safe = await toApplicantSafeQuestion(question, attemptId);
    if (safe) questions.push(safe);
  }
  return questions;
}
async function toApplicantSafeQuestion(question, attemptId) {
  const db = getDatabase();
  switch (question.questionType) {
    case "ORDINAL":
    case "MULTI":
    case "SJT":
    case "EVIDENCE": {
      const options = await db.select().from(questionOptions).where(eq6(questionOptions.questionId, question.id)).orderBy(asc6(questionOptions.displayOrder));
      const safeOptions = options.map((opt) => ({ id: opt.id, text: opt.optionText }));
      return { id: question.id, type: question.questionType, prompt: question.prompt, options: safeOptions };
    }
    case "NUMERIC": {
      const numericConfig = (await db.select().from(numericQuestionConfigs).where(eq6(numericQuestionConfigs.questionId, question.id)).limit(1))[0];
      const inputDefs = numericConfig ? parseJson3(numericConfig.inputDefinitions, []) : [];
      return {
        id: question.id,
        type: "NUMERIC",
        prompt: question.prompt,
        inputLabels: inputDefs.map((d) => d.label || ""),
        unit: null
      };
    }
    case "OPEN": {
      const openConfig = (await db.select().from(openQuestionConfigs).where(eq6(openQuestionConfigs.questionId, question.id)).limit(1))[0];
      let timerStartedAt = null;
      if (openConfig?.timeLimitSec) {
        const existing = (await db.select().from(assessmentResponses).where(and6(eq6(assessmentResponses.attemptId, attemptId), eq6(assessmentResponses.questionId, question.id))).limit(1))[0];
        if (existing?.startedAt) timerStartedAt = new Date(existing.startedAt).toISOString();
      }
      return {
        id: question.id,
        type: "OPEN",
        prompt: question.prompt,
        maximumWords: openConfig?.maximumWords ?? null,
        timeLimitSec: openConfig?.timeLimitSec ?? null,
        pasteAllowed: Boolean(openConfig?.pasteAllowed),
        timerStartedAt
      };
    }
    default:
      return null;
  }
}
async function saveAssessmentResponse(attemptId, questionId, responseType, responsePayload, elapsedSeconds) {
  const db = getDatabase();
  const existing = (await db.select().from(assessmentResponses).where(and6(eq6(assessmentResponses.attemptId, attemptId), eq6(assessmentResponses.questionId, questionId))).limit(1))[0];
  const payload = typeof responsePayload === "string" ? responsePayload : JSON.stringify(responsePayload);
  const now = /* @__PURE__ */ new Date();
  if (existing) {
    await db.update(assessmentResponses).set({
      responsePayload: payload,
      answeredAt: now,
      elapsedSeconds: elapsedSeconds ?? null
    }).where(eq6(assessmentResponses.id, existing.id));
  } else {
    const id = `resp-${randomBytes6(8).toString("hex")}`;
    await db.insert(assessmentResponses).values({
      id,
      attemptId,
      questionId,
      responseType,
      responsePayload: payload,
      answeredAt: now,
      elapsedSeconds: elapsedSeconds ?? null
    });
  }
}
async function startOpenQuestionTimer(attemptId, questionId) {
  const db = getDatabase();
  const existing = (await db.select().from(assessmentResponses).where(and6(eq6(assessmentResponses.attemptId, attemptId), eq6(assessmentResponses.questionId, questionId))).limit(1))[0];
  if (existing) return existing.startedAt ? new Date(existing.startedAt).toISOString() : null;
  const id = `resp-${randomBytes6(8).toString("hex")}`;
  const now = /* @__PURE__ */ new Date();
  await db.insert(assessmentResponses).values({
    id,
    attemptId,
    questionId,
    responseType: "OPEN",
    responsePayload: "",
    startedAt: now
  });
  return now.toISOString();
}
async function getAssessmentResponses(attemptId) {
  const db = getDatabase();
  return db.select().from(assessmentResponses).where(eq6(assessmentResponses.attemptId, attemptId));
}
async function validateAssessmentResponse(questionId, responseType, responsePayload) {
  const db = getDatabase();
  const question = (await db.select().from(assessmentQuestions).where(eq6(assessmentQuestions.id, questionId)).limit(1))[0];
  if (!question) return { valid: false, error: "Question not found." };
  if (question.questionType !== responseType) return { valid: false, error: "Response type does not match question type." };
  switch (question.questionType) {
    case "ORDINAL":
    case "SJT":
    case "EVIDENCE": {
      if (typeof responsePayload !== "string") return { valid: false, error: "Invalid response format." };
      const options = await db.select().from(questionOptions).where(eq6(questionOptions.questionId, questionId));
      if (!options.some((opt) => opt.id === responsePayload)) return { valid: false, error: "Selected option is not valid for this question." };
      return { valid: true };
    }
    case "MULTI": {
      if (!Array.isArray(responsePayload)) return { valid: false, error: "Multi-select requires an array." };
      const options = await db.select().from(questionOptions).where(eq6(questionOptions.questionId, questionId));
      const validIds = new Set(options.map((opt) => opt.id));
      if (!responsePayload.every((id) => typeof id === "string" && validIds.has(id))) return { valid: false, error: "One or more selected options are not valid." };
      return { valid: true };
    }
    case "NUMERIC": {
      if (!responsePayload || typeof responsePayload !== "object") return { valid: false, error: "Invalid numeric response format." };
      return { valid: true };
    }
    case "OPEN": {
      if (typeof responsePayload !== "string") return { valid: false, error: "Open response must be a string." };
      const openConfig = (await db.select().from(openQuestionConfigs).where(eq6(openQuestionConfigs.questionId, questionId)).limit(1))[0];
      if (openConfig?.maximumWords) {
        const wordCount = responsePayload.trim().split(/\s+/).filter(Boolean).length;
        if (wordCount > openConfig.maximumWords) return { valid: false, error: `Response exceeds the ${openConfig.maximumWords}-word limit.` };
      }
      return { valid: true };
    }
    default:
      return { valid: false, error: "Unsupported question type." };
  }
}
async function validateAssessmentCompletion(attemptId, assessmentId) {
  const db = getDatabase();
  const assignments = await db.select().from(assessmentQuestionAssignments).where(eq6(assessmentQuestionAssignments.assessmentId, assessmentId));
  const responses = await db.select().from(assessmentResponses).where(eq6(assessmentResponses.attemptId, attemptId));
  const answeredQuestionIds = new Set(responses.map((r) => r.questionId));
  const requiredQuestions = assignments.filter((a) => {
    return true;
  });
  const missing = requiredQuestions.filter((a) => !answeredQuestionIds.has(a.questionId));
  if (missing.length > 0) {
    return { valid: false, error: `${missing.length} required question${missing.length > 1 ? "s" : ""} ${missing.length > 1 ? "are" : "is"} not answered.` };
  }
  return { valid: true };
}
async function checkD1Q1CloseOutcome(questionId, selectedOptionId) {
  const db = getDatabase();
  const option = (await db.select().from(questionOptions).where(and6(eq6(questionOptions.id, selectedOptionId), eq6(questionOptions.questionId, questionId))).limit(1))[0];
  if (!option) return false;
  return option.outcomeType === "Close Application / G3";
}

// server/applicationApi.ts
init_db();

// server/recruitmentRepository.ts
init_schema();
import { randomBytes as randomBytes7 } from "node:crypto";
import { asc as asc7, eq as eq7 } from "drizzle-orm";

// shared/recruitmentApi.ts
var ROLE_STATUSES = ["Draft", "Open", "Closed", "Archived"];
var EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Internship", "Temporary"];
var DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
function isValidDateString(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}
function validateRecruitmentRoleInput(candidate) {
  if (!candidate || typeof candidate !== "object") return { errors: ["Role data is missing."] };
  const value = candidate;
  const errors = [];
  const trimmed = (key) => typeof value[key] === "string" ? value[key].trim() : "";
  const title = trimmed("title");
  if (!title) errors.push("Enter a role title.");
  else if (title.length > 180) errors.push("Role title is too long.");
  const department = trimmed("department");
  if (!department) errors.push("Enter a department.");
  else if (department.length > 160) errors.push("Department is too long.");
  const location = trimmed("location");
  if (!location) errors.push("Enter a location.");
  else if (location.length > 160) errors.push("Location is too long.");
  const employmentType = value.employmentType;
  if (typeof employmentType !== "string" || !EMPLOYMENT_TYPES.includes(employmentType)) errors.push("Select a valid employment type.");
  const shortDescription = trimmed("shortDescription");
  if (!shortDescription) errors.push("Enter a short role description.");
  const fullDescription = typeof value.fullDescription === "string" ? value.fullDescription.trim() : "";
  const status = value.status;
  if (typeof status !== "string" || !ROLE_STATUSES.includes(status)) errors.push("Select a valid role status.");
  const openingDate = value.openingDate === "" || value.openingDate == null ? null : value.openingDate;
  const closingDate = value.closingDate === "" || value.closingDate == null ? null : value.closingDate;
  if (openingDate !== null && (typeof openingDate !== "string" || !isValidDateString(openingDate))) errors.push("The opening date is not valid.");
  if (closingDate !== null && (typeof closingDate !== "string" || !isValidDateString(closingDate))) errors.push("The closing date is not valid.");
  if (typeof openingDate === "string" && typeof closingDate === "string" && closingDate < openingDate) errors.push("Closing date must be after the opening date.");
  if (errors.length) return { errors };
  return {
    input: {
      title,
      department,
      location,
      employmentType,
      shortDescription,
      fullDescription,
      status,
      openingDate,
      closingDate
    }
  };
}
function slugifyRoleTitle(title) {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "recruitment-role";
}
function resolveUniqueSlug(base, taken) {
  if (!taken.has(base)) return base;
  for (let suffix = 2; suffix < 1e3; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("Unable to allocate a unique slug");
}

// server/recruitmentRepository.ts
init_db();
function parseJson4(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
var decimalToNumber = (value) => value === null ? null : Number(value);
async function listRecruitmentRoles() {
  const db = getDatabase();
  return db.select().from(recruitmentRoles).orderBy(asc7(recruitmentRoles.createdAt));
}
async function getRecruitmentRoleById(id) {
  const db = getDatabase();
  return (await db.select().from(recruitmentRoles).where(eq7(recruitmentRoles.id, id)).limit(1))[0] ?? null;
}
async function getRecruitmentRoleBySlug(slug) {
  const db = getDatabase();
  return (await db.select().from(recruitmentRoles).where(eq7(recruitmentRoles.slug, slug)).limit(1))[0] ?? null;
}
async function getRecruitmentRoleByIdOrSlug(idOrSlug) {
  return await getRecruitmentRoleById(idOrSlug) ?? await getRecruitmentRoleBySlug(idOrSlug);
}
async function createRecruitmentRole(input) {
  const db = getDatabase();
  const existing = await db.select({ slug: recruitmentRoles.slug }).from(recruitmentRoles);
  const slug = resolveUniqueSlug(slugifyRoleTitle(input.title), new Set(existing.map((row) => row.slug)));
  const id = `role-${randomBytes7(12).toString("hex")}`;
  await db.insert(recruitmentRoles).values({ id, slug, ...input, fullDescription: input.fullDescription || "" });
  const created = await getRecruitmentRoleById(id);
  if (!created) throw new Error("Role insert did not complete");
  return toAdminRole(created);
}
async function updateRecruitmentRole(id, input) {
  const db = getDatabase();
  const existing = await getRecruitmentRoleById(id);
  if (!existing) return null;
  await db.update(recruitmentRoles).set({ ...input, fullDescription: input.fullDescription || "" }).where(eq7(recruitmentRoles.id, id));
  const updated = await getRecruitmentRoleById(id);
  return updated ? toAdminRole(updated) : null;
}
function toAdminRole(role) {
  return {
    id: role.id,
    slug: role.slug,
    title: role.title,
    department: role.department,
    location: role.location,
    employmentType: role.employmentType,
    shortDescription: role.shortDescription,
    fullDescription: role.fullDescription,
    status: role.status,
    openingDate: role.openingDate,
    closingDate: role.closingDate,
    updatedAt: new Date(role.updatedAt).toISOString()
  };
}
function toPublicRole(role) {
  return {
    slug: role.slug,
    title: role.title,
    department: role.department,
    location: role.location,
    employmentType: role.employmentType,
    shortDescription: role.shortDescription,
    fullDescription: role.fullDescription,
    status: role.status,
    openingDate: role.openingDate,
    closingDate: role.closingDate
  };
}
async function getRoleEligibilityGates(roleId) {
  const db = getDatabase();
  return db.select().from(eligibilityGates).where(eq7(eligibilityGates.roleId, roleId)).orderBy(asc7(eligibilityGates.displayOrder));
}
function toAdminGate(gate) {
  return {
    reference: gate.reference,
    name: gate.name,
    description: gate.description,
    gateType: gate.gateType,
    status: gate.status,
    displayOrder: gate.displayOrder,
    configuration: parseJson4(gate.configuration, {})
  };
}
function toPublicEligibility(roleSlug, gates) {
  const publicGates = gates.map((gate) => {
    const configuration = parseJson4(gate.configuration, {});
    const minimumYears = gate.gateType === "experience" && typeof configuration.minimumYears === "number" ? configuration.minimumYears : void 0;
    return { reference: gate.reference, name: gate.name, description: gate.description, gateType: gate.gateType, status: gate.status, ...minimumYears !== void 0 ? { minimumYears } : {} };
  });
  return {
    roleSlug,
    gates: publicGates,
    summary: {
      totalCount: publicGates.length,
      activeCount: publicGates.filter((gate) => gate.status === "Active").length,
      configurationRequiredCount: publicGates.filter((gate) => gate.status === "Configuration Required").length
    }
  };
}
async function getRoleEvaluationFramework(roleId) {
  const db = getDatabase();
  const [dimensions, screeningRows, verificationRows, bonusRows, bandRows] = await Promise.all([
    db.select().from(assessmentDimensions).where(eq7(assessmentDimensions.roleId, roleId)).orderBy(asc7(assessmentDimensions.displayOrder)),
    db.select().from(screeningConfigurations).where(eq7(screeningConfigurations.roleId, roleId)).limit(1),
    db.select().from(screeningVerificationMultipliers),
    db.select().from(screeningBonusCriteria),
    db.select().from(screeningBands)
  ]);
  const screening = screeningRows[0] ?? null;
  const ownedVerification = screening ? verificationRows.filter((row) => row.screeningConfigurationId === screening.id) : [];
  const ownedBonus = screening ? bonusRows.filter((row) => row.screeningConfigurationId === screening.id) : [];
  const ownedBands = screening ? bandRows.filter((row) => row.screeningConfigurationId === screening.id) : [];
  return {
    roleId,
    dimensions: dimensions.map((dimension) => ({
      reference: dimension.reference,
      name: dimension.name,
      weight: dimension.weight,
      minimumFloor: dimension.minimumFloor,
      displayOrder: dimension.displayOrder,
      status: dimension.status
    })),
    totalWeight: dimensions.reduce((sum, dimension) => sum + dimension.weight, 0),
    screening: screening ? {
      integrityPenalty: screening.integrityPenalty,
      bonusCap: screening.bonusCap,
      verification: ownedVerification.sort((a, b) => a.displayOrder - b.displayOrder).map((row) => ({ code: row.code, label: row.label, multiplier: Number(row.multiplier) })),
      bonusItems: ownedBonus.sort((a, b) => a.displayOrder - b.displayOrder).map((row) => ({ code: row.code, label: row.label, points: row.points })),
      bands: ownedBands.sort((a, b) => a.displayOrder - b.displayOrder).map((row) => ({ band: row.band, minimumScore: Number(row.minimumScore), maximumScore: decimalToNumber(row.maximumScore), label: row.label })),
      manualReviewRules: parseJson4(screening.manualReviewRules, {})
    } : null
  };
}

// server/applicationApi.ts
function databaseConfigured3() {
  return Boolean(process.env.DATABASE_URL);
}
function fail2(response, status, error) {
  response.status(status).json({ ok: false, error });
}
function handleRouteError(context) {
  return (error, response) => {
    console.error(`[application] ${context} failed:`, error instanceof Error ? error.message : String(error));
    fail2(response, 503, "Unable to process your request.");
  };
}
function readApplicantToken(request) {
  const header = request.headers["x-application-token"];
  if (typeof header === "string" && header.trim()) return header.trim();
  return null;
}
async function requireApplicantToken(request, response, next) {
  const token = readApplicantToken(request);
  if (!token) {
    fail2(response, 401, "Application access is required.");
    return;
  }
  try {
    const application = await findApplicationByToken(token);
    if (!application) {
      fail2(response, 403, "Unable to access your application.");
      return;
    }
    request.application = application;
    request.applicantToken = token;
    next();
  } catch (error) {
    console.error("[application] token resolution failed:", error instanceof Error ? error.message : String(error));
    fail2(response, 503, "Unable to access your application.");
  }
}
function createApplicationApiRouter() {
  const router = express3.Router();
  router.post("/api/public/applications", async (request, response) => {
    if (!databaseConfigured3()) return fail2(response, 503, "Unable to process your application.");
    try {
      const validated = validateCreateApplicationInput(request.body);
      if ("errors" in validated) return fail2(response, 400, validated.errors[0]);
      const { input } = validated;
      const db = (await Promise.resolve().then(() => (init_db(), db_exports))).getDatabase();
      const role = (await db.select().from(recruitmentRoles).where(eq8(recruitmentRoles.slug, input.roleSlug)).limit(1))[0];
      if (!role) return fail2(response, 404, "The selected role is not available.");
      if (role.status !== "Open") return fail2(response, 400, "Applications are not currently being accepted for this role.");
      const normalizedEmail = normalizeEmail(input.email);
      const existing = await findExistingApplication(role.id, normalizedEmail);
      if (existing) {
        if (existing.applicationStatus === "Submitted" || existing.applicationStatus === "Shortlisted") {
          return fail2(response, 409, "You have already submitted an application for this role.");
        }
        if (existing.applicationStatus === "In Progress" || existing.applicationStatus === "Assessment In Progress") {
          return fail2(response, 409, "An application for this role is already in progress. Please check your browser for an existing session.");
        }
      }
      const gates = await getRoleEligibilityGates(role.id);
      const eligibilityResult = evaluateEligibilityServerSide(gates, input.eligibility, input.relevantExperience);
      const activeAssessment = eligibilityResult.eligible ? await getActiveAssessmentForRole(role.id) : null;
      const { applicationId, applicantToken } = await createApplication(input, role, eligibilityResult, activeAssessment);
      const nextStep = eligibilityResult.eligible ? "assessment" : "eligibility-closed";
      response.status(201).json({
        ok: true,
        applicationId,
        applicantToken,
        eligibilityStatus: eligibilityResult.eligible ? "Eligible" : "Closed",
        applicationStatus: eligibilityResult.eligible ? "In Progress" : "Eligibility Closed",
        eligibility: eligibilityResult,
        nextStep
      });
    } catch (error) {
      handleRouteError("create application")(error, response);
    }
  });
  router.get("/api/public/applications/me", requireApplicantToken, async (request, response) => {
    try {
      const application = request.application;
      const state = await buildApplicationState(application);
      if (!state) return fail2(response, 503, "Unable to load your application.");
      response.json({ ok: true, ...state });
    } catch (error) {
      handleRouteError("resume application")(error, response);
    }
  });
  router.get("/api/public/applications/me/assessment", requireApplicantToken, async (request, response) => {
    try {
      const application = request.application;
      if (application.eligibilityStatus !== "Eligible") {
        return fail2(response, 403, "Your application does not have access to the assessment.");
      }
      if (application.applicationStatus === "Assessment Complete" || application.applicationStatus === "Submitted") {
        const state = await buildApplicationState(application);
        return response.json({ ok: true, completed: true, ...state?.assessment });
      }
      if (!application.assessmentId) {
        return fail2(response, 404, "No assessment is configured for this role.");
      }
      const attempt = await createAssessmentAttempt(application.id, application.assessmentId);
      if (!attempt) return fail2(response, 503, "Unable to start your assessment.");
      if (attempt.status === "Not Started") {
        await updateAttemptStatus(attempt.id, "In Progress");
        await updateApplicationStatus(application.id, "Assessment In Progress", "assessment");
      }
      const assessment = (await (await Promise.resolve().then(() => (init_db(), db_exports))).getDatabase().select().from(assessments).where(eq8(assessments.id, application.assessmentId)).limit(1))[0];
      if (!assessment) return fail2(response, 404, "No assessment is configured for this role.");
      const questions = await loadApplicantSafeQuestions(application.assessmentId, attempt.id);
      const existingResponses = await getAssessmentResponses(attempt.id);
      const answeredIds = new Set(existingResponses.map((r) => r.questionId));
      response.json({
        ok: true,
        attemptId: attempt.id,
        assessmentName: assessment.name,
        questionCount: questions.length,
        currentProgress: answeredIds.size,
        questions
      });
    } catch (error) {
      handleRouteError("load assessment")(error, response);
    }
  });
  router.put("/api/public/applications/me/assessment/responses/:questionId", requireApplicantToken, async (request, response) => {
    try {
      const application = request.application;
      const questionId = request.params.questionId;
      if (application.eligibilityStatus !== "Eligible") return fail2(response, 403, "Your application does not have access to the assessment.");
      if (application.applicationStatus === "Assessment Complete" || application.applicationStatus === "Submitted") {
        return fail2(response, 400, "Your assessment has already been completed.");
      }
      const validated = validateAssessmentResponseInput(request.body);
      if ("errors" in validated) return fail2(response, 400, validated.errors[0]);
      const attempt = await getActiveAttempt(application.id);
      if (!attempt) return fail2(response, 400, "No active assessment attempt found.");
      if (attempt.status === "Complete") return fail2(response, 400, "Your assessment has already been completed.");
      const validation = await validateAssessmentResponse(questionId, validated.input.responseType, validated.input.responsePayload);
      if (!validation.valid) return fail2(response, 400, validation.error);
      const isCloseOutcome = await checkD1Q1CloseOutcome(questionId, typeof validated.input.responsePayload === "string" ? validated.input.responsePayload : "");
      if (isCloseOutcome) {
        await saveAssessmentResponse(attempt.id, questionId, validated.input.responseType, validated.input.responsePayload, validated.input.elapsedSeconds);
        await updateApplicationStatus(application.id, "Eligibility Closed", "eligibility-closed");
        return response.json({ ok: true, closed: true });
      }
      await saveAssessmentResponse(attempt.id, questionId, validated.input.responseType, validated.input.responsePayload, validated.input.elapsedSeconds);
      response.json({ ok: true });
    } catch (error) {
      handleRouteError("save response")(error, response);
    }
  });
  router.post("/api/public/applications/me/assessment/responses/:questionId/timer", requireApplicantToken, async (request, response) => {
    try {
      const application = request.application;
      const questionId = request.params.questionId;
      if (application.eligibilityStatus !== "Eligible") return fail2(response, 403, "Your application does not have access to the assessment.");
      const attempt = await getActiveAttempt(application.id);
      if (!attempt) return fail2(response, 400, "No active assessment attempt found.");
      if (attempt.status === "Complete") return fail2(response, 400, "Your assessment has already been completed.");
      const timerStartedAt = await startOpenQuestionTimer(attempt.id, questionId);
      response.json({ ok: true, timerStartedAt });
    } catch (error) {
      handleRouteError("start timer")(error, response);
    }
  });
  router.post("/api/public/applications/me/assessment/complete", requireApplicantToken, async (request, response) => {
    try {
      const application = request.application;
      if (application.eligibilityStatus !== "Eligible") return fail2(response, 403, "Your application does not have access to the assessment.");
      if (application.applicationStatus === "Assessment Complete" || application.applicationStatus === "Submitted") {
        return response.json({ ok: true, alreadyComplete: true });
      }
      if (!application.assessmentId) return fail2(response, 400, "No assessment is configured for this role.");
      const attempt = await getActiveAttempt(application.id);
      if (!attempt) return fail2(response, 400, "No active assessment attempt found.");
      if (attempt.status === "Complete") {
        return response.json({ ok: true, alreadyComplete: true });
      }
      const completionCheck = await validateAssessmentCompletion(attempt.id, application.assessmentId);
      if (!completionCheck.valid) return fail2(response, 400, completionCheck.error);
      await updateAttemptStatus(attempt.id, "Complete");
      await updateApplicationStatus(application.id, "Assessment Complete", "review");
      response.json({ ok: true });
    } catch (error) {
      handleRouteError("complete assessment")(error, response);
    }
  });
  router.post("/api/public/applications/me/submit", requireApplicantToken, async (request, response) => {
    try {
      const application = request.application;
      if (application.applicationStatus === "Submitted") {
        return response.json({ ok: true, alreadySubmitted: true, submittedAt: new Date(application.submittedAt).toISOString() });
      }
      if (application.eligibilityStatus !== "Eligible") return fail2(response, 400, "Your application must pass eligibility to be submitted.");
      if (application.applicationStatus !== "Assessment Complete") {
        return fail2(response, 400, "You must complete the assessment before submitting.");
      }
      const db = (await Promise.resolve().then(() => (init_db(), db_exports))).getDatabase();
      await db.update(applications).set({
        applicationStatus: "Submitted",
        submittedAt: /* @__PURE__ */ new Date(),
        currentStep: "submitted"
      }).where(eq8(applications.id, application.id));
      response.json({ ok: true, submittedAt: (/* @__PURE__ */ new Date()).toISOString() });
    } catch (error) {
      handleRouteError("submit application")(error, response);
    }
  });
  router.get("/api/public/applications/me/review", requireApplicantToken, async (request, response) => {
    try {
      const application = request.application;
      const state = await buildApplicationState(application);
      if (!state) return fail2(response, 503, "Unable to load your application.");
      const attempt = await getActiveAttempt(application.id);
      const responses = attempt ? await getAssessmentResponses(attempt.id) : [];
      const questionLabels = {};
      if (attempt && application.assessmentId) {
        const questions = await loadApplicantSafeQuestions(application.assessmentId, attempt.id);
        for (const question of questions) {
          const resp = responses.find((r) => r.questionId === question.id);
          if (resp) {
            if ("options" in question) {
              const payload = resp.responsePayload;
              if (typeof payload === "string") {
                const selectedOption = question.options.find((o) => o.id === payload);
                questionLabels[question.id] = selectedOption?.text ?? payload;
              } else if (Array.isArray(payload)) {
                const texts = payload.map((id) => {
                  const opt = question.options.find((o) => o.id === id);
                  return opt?.text ?? id;
                });
                questionLabels[question.id] = texts.join(", ");
              }
            } else {
              questionLabels[question.id] = typeof resp.responsePayload === "string" ? resp.responsePayload : JSON.stringify(resp.responsePayload);
            }
          }
        }
      }
      response.json({
        ok: true,
        applicant: state.applicant,
        eligibility: state.eligibility,
        assessmentResponses: questionLabels,
        submittedAt: state.submittedAt
      });
    } catch (error) {
      handleRouteError("review data")(error, response);
    }
  });
  return router;
}

// server/assessmentApi.ts
import express4 from "express";

// server/recruitmentApi.ts
import { Router } from "express";
function databaseConfigured4() {
  return Boolean(process.env.DATABASE_URL);
}
function fail3(res, status, error) {
  res.status(status).json({ ok: false, error });
}
function handleRouteError2(context) {
  return (error, res) => {
    console.error(`[recruitment] ${context} failed:`, error instanceof Error ? error.message : String(error));
    fail3(res, 503, "Unable to load recruitment data.");
  };
}
var requireAuthorizedAdmin2 = async (request, response, next) => {
  if (!databaseConfigured4()) {
    fail3(response, 503, "Unable to load recruitment data.");
    return;
  }
  try {
    const token = readSessionToken(request);
    const session = token ? await resolveSession(token) : null;
    const profile = session ? await findAdminProfileForUser(session.user.id) : null;
    if (!session || !isAdminAuthorized(session.user, profile)) {
      fail3(response, 401, "Admin authorization is required.");
      return;
    }
    next();
  } catch (error) {
    console.error("[recruitment] admin authorization failed:", error instanceof Error ? error.message : String(error));
    fail3(response, 503, "Unable to load recruitment data.");
  }
};
var getPublicRoles = async (_request, response) => {
  if (!databaseConfigured4()) return void fail3(response, 503, "Unable to load recruitment roles.");
  try {
    const roles = await listRecruitmentRoles();
    const visible = roles.filter((role) => role.status === "Open" || role.status === "Closed");
    response.json({ ok: true, roles: visible.map(toPublicRole) });
  } catch (error) {
    handleRouteError2("public role list")(error, response);
  }
};
var getPublicRoleEligibility = async (request, response) => {
  if (!databaseConfigured4()) return void fail3(response, 503, "Unable to load eligibility configuration.");
  try {
    const slug = request.params.slug ?? "";
    const role = await getRecruitmentRoleByIdOrSlug(slug);
    if (!role || role.slug !== slug || role.status !== "Open" && role.status !== "Closed") {
      return void fail3(response, 404, "Unable to load this recruitment role.");
    }
    const gates = await getRoleEligibilityGates(role.id);
    response.json({ ok: true, ...toPublicEligibility(role.slug, gates) });
  } catch (error) {
    handleRouteError2("public eligibility")(error, response);
  }
};
var getPublicRole = async (request, response) => {
  if (!databaseConfigured4()) return void fail3(response, 503, "Unable to load this recruitment role.");
  try {
    const slug = request.params.slug ?? "";
    const role = await getRecruitmentRoleByIdOrSlug(slug);
    if (!role || role.slug !== slug || role.status !== "Open" && role.status !== "Closed") {
      return void fail3(response, 404, "Unable to load this recruitment role.");
    }
    response.json({ ok: true, role: toPublicRole(role) });
  } catch (error) {
    handleRouteError2("public role detail")(error, response);
  }
};
var getAdminRoles = async (_request, response) => {
  try {
    const roles = await listRecruitmentRoles();
    response.json({ ok: true, roles: roles.map(toAdminRole) });
  } catch (error) {
    handleRouteError2("admin role list")(error, response);
  }
};
var createAdminRole = async (request, response) => {
  try {
    const validated = validateRecruitmentRoleInput(request.body);
    if ("errors" in validated) return void fail3(response, 400, validated.errors[0]);
    const role = await createRecruitmentRole(validated.input);
    response.status(201).json({ ok: true, role });
  } catch (error) {
    handleRouteError2("admin role create")(error, response);
  }
};
var getAdminRole = async (request, response) => {
  try {
    const role = await getRecruitmentRoleByIdOrSlug(request.params.idOrSlug ?? "");
    if (!role) return void fail3(response, 404, "Unable to load this recruitment role.");
    response.json({ ok: true, role: toAdminRole(role) });
  } catch (error) {
    handleRouteError2("admin role detail")(error, response);
  }
};
var patchAdminRole = async (request, response) => {
  try {
    const existing = await getRecruitmentRoleByIdOrSlug(request.params.idOrSlug ?? "");
    if (!existing) return void fail3(response, 404, "Unable to load this recruitment role.");
    const validated = validateRecruitmentRoleInput(request.body);
    if ("errors" in validated) return void fail3(response, 400, validated.errors[0]);
    const updated = await updateRecruitmentRole(existing.id, validated.input);
    if (!updated) return void fail3(response, 404, "Unable to load this recruitment role.");
    response.json({ ok: true, role: updated });
  } catch (error) {
    handleRouteError2("admin role update")(error, response);
  }
};
var getAdminRoleEligibility = async (request, response) => {
  try {
    const role = await getRecruitmentRoleByIdOrSlug(request.params.idOrSlug ?? "");
    if (!role) return void fail3(response, 404, "Unable to load this recruitment role.");
    const gates = await getRoleEligibilityGates(role.id);
    response.json({ ok: true, roleId: role.id, gates: gates.map(toAdminGate) });
  } catch (error) {
    handleRouteError2("admin eligibility")(error, response);
  }
};
var getAdminEvaluationFramework = async (request, response) => {
  try {
    const role = await getRecruitmentRoleByIdOrSlug(request.params.idOrSlug ?? "");
    if (!role) return void fail3(response, 404, "Unable to load this recruitment role.");
    const framework = await getRoleEvaluationFramework(role.id);
    response.json({ ok: true, ...framework });
  } catch (error) {
    handleRouteError2("admin evaluation framework")(error, response);
  }
};
function createRecruitmentApiRouter() {
  const router = Router();
  router.get("/api/public/recruitment-roles", getPublicRoles);
  router.get("/api/public/recruitment-roles/:slug/eligibility", getPublicRoleEligibility);
  router.get("/api/public/recruitment-roles/:slug", getPublicRole);
  router.get("/api/admin/recruitment-roles", requireAuthorizedAdmin2, getAdminRoles);
  router.post("/api/admin/recruitment-roles", requireAuthorizedAdmin2, createAdminRole);
  router.get("/api/admin/recruitment-roles/:idOrSlug", requireAuthorizedAdmin2, getAdminRole);
  router.patch("/api/admin/recruitment-roles/:idOrSlug", requireAuthorizedAdmin2, patchAdminRole);
  router.get("/api/admin/recruitment-roles/:idOrSlug/eligibility", requireAuthorizedAdmin2, getAdminRoleEligibility);
  router.get("/api/admin/recruitment-roles/:idOrSlug/evaluation-framework", requireAuthorizedAdmin2, getAdminEvaluationFramework);
  return router;
}

// server/assessmentApi.ts
init_assessmentRepository();

// shared/assessmentApi.ts
var ASSESSMENT_STATUSES = ["Draft", "Active", "Inactive", "Archived"];
function validateAssessmentCreateInput(candidate) {
  if (!candidate || typeof candidate !== "object") return { errors: ["Assessment data is missing."] };
  const value = candidate;
  const errors = [];
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name) errors.push("Enter an assessment name.");
  else if (name.length > 180) errors.push("Assessment name is too long.");
  const description = typeof value.description === "string" ? value.description.trim() : "";
  const roleId = typeof value.roleId === "string" ? value.roleId.trim() : "";
  if (!roleId) errors.push("Select an assigned role.");
  const version = typeof value.version === "number" && Number.isInteger(value.version) && value.version > 0 ? value.version : null;
  if (version === null) errors.push("Version must be a positive integer.");
  const status = value.status;
  if (typeof status !== "string" || !ASSESSMENT_STATUSES.includes(status)) {
    errors.push("Select a valid assessment status.");
  }
  if (errors.length) return { errors };
  return {
    input: {
      name,
      description,
      roleId,
      version,
      status
    }
  };
}
function validateAssessmentUpdateInput(candidate) {
  if (!candidate || typeof candidate !== "object") return { errors: ["Assessment data is missing."] };
  const value = candidate;
  const errors = [];
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name) errors.push("Enter an assessment name.");
  else if (name.length > 180) errors.push("Assessment name is too long.");
  const description = typeof value.description === "string" ? value.description.trim() : "";
  if (errors.length) return { errors };
  return { input: { name, description } };
}

// server/assessmentApi.ts
function createAssessmentApiRouter() {
  const router = express4.Router();
  router.get("/api/admin/assessments", requireAuthorizedAdmin2, async (_request, response) => {
    try {
      const payload = await listAssessments();
      response.json({ ok: true, ...payload });
    } catch (error) {
      handleRouteError2("admin assessment list")(error, response);
    }
  });
  router.post("/api/admin/assessments", requireAuthorizedAdmin2, async (request, response) => {
    try {
      const validated = validateAssessmentCreateInput(request.body);
      if ("errors" in validated) return fail3(response, 400, validated.errors[0]);
      const assessment = await createAssessment(validated.input);
      response.status(201).json({ ok: true, assessment });
    } catch (error) {
      if (error instanceof AssessmentValidationError) return fail3(response, 400, error.message);
      handleRouteError2("admin assessment create")(error, response);
    }
  });
  router.get("/api/admin/assessments/:idOrSlug", requireAuthorizedAdmin2, async (request, response) => {
    try {
      const assessment = await getAssessment(request.params.idOrSlug ?? "");
      if (!assessment) return fail3(response, 404, "Assessment not found.");
      response.json({ ok: true, assessment });
    } catch (error) {
      handleRouteError2("admin assessment detail")(error, response);
    }
  });
  router.patch("/api/admin/assessments/:idOrSlug", requireAuthorizedAdmin2, async (request, response) => {
    try {
      const validated = validateAssessmentUpdateInput(request.body);
      if ("errors" in validated) return fail3(response, 400, validated.errors[0]);
      const assessment = await updateAssessment(request.params.idOrSlug ?? "", validated.input);
      if (!assessment) return fail3(response, 404, "Assessment not found.");
      response.json({ ok: true, assessment });
    } catch (error) {
      if (error instanceof AssessmentValidationError) return fail3(response, 400, error.message);
      handleRouteError2("admin assessment update")(error, response);
    }
  });
  router.get("/api/admin/assessments/:idOrSlug/preview", requireAuthorizedAdmin2, async (request, response) => {
    try {
      const payload = await getAssessmentPreviewConfiguration(request.params.idOrSlug ?? "");
      if (!payload) return fail3(response, 404, "Assessment not found.");
      response.json({ ok: true, preview: payload });
    } catch (error) {
      handleRouteError2("admin assessment preview")(error, response);
    }
  });
  router.post("/api/admin/assessments/:idOrSlug/questions", requireAuthorizedAdmin2, async (request, response) => {
    try {
      const assessment = await getAssessmentByIdOrSlug(request.params.idOrSlug ?? "");
      if (!assessment) return fail3(response, 404, "Assessment not found.");
      const questionId = typeof request.body?.questionId === "string" ? request.body.questionId.trim() : "";
      if (!questionId) return fail3(response, 400, "A question ID is required.");
      const assignments = await addAssessmentQuestion(assessment.id, questionId);
      response.status(201).json({ ok: true, assignments });
    } catch (error) {
      if (error instanceof AssessmentValidationError) return fail3(response, 400, error.message);
      handleRouteError2("admin assessment add question")(error, response);
    }
  });
  router.delete(
    "/api/admin/assessments/:idOrSlug/questions/:questionId",
    requireAuthorizedAdmin2,
    async (request, response) => {
      try {
        const assessment = await getAssessmentByIdOrSlug(request.params.idOrSlug ?? "");
        if (!assessment) return fail3(response, 404, "Assessment not found.");
        const questionId = request.params.questionId ?? "";
        const assignments = await removeAssessmentQuestion(assessment.id, questionId);
        response.json({ ok: true, assignments });
      } catch (error) {
        if (error instanceof AssessmentValidationError) return fail3(response, 400, error.message);
        handleRouteError2("admin assessment remove question")(error, response);
      }
    }
  );
  router.put(
    "/api/admin/assessments/:idOrSlug/questions/order",
    requireAuthorizedAdmin2,
    async (request, response) => {
      try {
        const assessment = await getAssessmentByIdOrSlug(request.params.idOrSlug ?? "");
        if (!assessment) return fail3(response, 404, "Assessment not found.");
        const orderedQuestionIds = request.body?.orderedQuestionIds;
        if (!Array.isArray(orderedQuestionIds) || orderedQuestionIds.some((id) => typeof id !== "string")) {
          return fail3(response, 400, "orderedQuestionIds must be an array of question ID strings.");
        }
        const assignments = await reorderAssessmentQuestions(assessment.id, orderedQuestionIds);
        response.json({ ok: true, assignments });
      } catch (error) {
        if (error instanceof AssessmentValidationError) return fail3(response, 400, error.message);
        handleRouteError2("admin assessment reorder")(error, response);
      }
    }
  );
  return router;
}

// server/questionBankApi.ts
import express5 from "express";
init_questionBankRepository();
init_questionBankApi();
var SORT_KEYS = ["reference", "dimension", "type", "qWeight", "status"];
function toPositiveInt(value, fallback) {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
function createQuestionBankApiRouter() {
  const router = express5.Router();
  router.get("/api/admin/questions", requireAuthorizedAdmin2, async (request, response) => {
    try {
      const query = request.query;
      const type = typeof query.type === "string" && QUESTION_TYPES.includes(query.type) ? query.type : void 0;
      const status = typeof query.status === "string" && QUESTION_BANK_STATUSES.includes(query.status) ? query.status : void 0;
      const sortKey = typeof query.sortKey === "string" && SORT_KEYS.includes(query.sortKey) ? query.sortKey : void 0;
      const payload = await listQuestions({
        search: typeof query.search === "string" ? query.search : void 0,
        dimension: typeof query.dimension === "string" && query.dimension && query.dimension !== "all" ? query.dimension : void 0,
        type,
        status,
        sortKey,
        sortDirection: query.sortDirection === "desc" ? "desc" : "asc",
        page: toPositiveInt(query.page, 1),
        pageSize: toPositiveInt(query.pageSize, 10)
      });
      response.json({ ok: true, ...payload });
    } catch (error) {
      handleRouteError2("admin question list")(error, response);
    }
  });
  router.post("/api/admin/questions", requireAuthorizedAdmin2, async (request, response) => {
    try {
      const validated = validateQuestionInput(request.body);
      if ("errors" in validated) return fail3(response, 400, validated.errors[0]);
      const question = await createQuestion(validated.input);
      response.status(201).json({ ok: true, question });
    } catch (error) {
      if (error instanceof QuestionBankValidationError) return fail3(response, 400, error.message);
      handleRouteError2("admin question create")(error, response);
    }
  });
  router.get("/api/admin/questions/:idOrReference", requireAuthorizedAdmin2, async (request, response) => {
    try {
      const question = await getQuestionDetail(request.params.idOrReference ?? "");
      if (!question) return fail3(response, 404, "Unable to load this question.");
      response.json({ ok: true, question });
    } catch (error) {
      handleRouteError2("admin question detail")(error, response);
    }
  });
  router.patch("/api/admin/questions/:idOrReference", requireAuthorizedAdmin2, async (request, response) => {
    try {
      const validated = validateQuestionInput(request.body);
      if ("errors" in validated) return fail3(response, 400, validated.errors[0]);
      const question = await updateQuestion(request.params.idOrReference ?? "", validated.input);
      if (!question) return fail3(response, 404, "Unable to load this question.");
      response.json({ ok: true, question });
    } catch (error) {
      if (error instanceof QuestionBankValidationError) return fail3(response, 400, error.message);
      handleRouteError2("admin question update")(error, response);
    }
  });
  return router;
}

// server/app.ts
var app = express6();
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", process.env.TRUST_PROXY);
}
app.use(express6.json({ limit: "100kb" }));
app.get("/api/health/database", async (_req, res) => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    res.status(503).json({ ok: false, database: "unreachable", reason: "DATABASE_URL is not configured" });
    return;
  }
  let connection;
  try {
    connection = await mysql2.createConnection(url);
    await connection.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (err) {
    console.error("[health] database connectivity check failed:", err instanceof Error ? err.message : String(err));
    res.status(503).json({ ok: false, database: "unreachable" });
  } finally {
    await connection?.end().catch(() => void 0);
  }
});
app.use(createAdminAuthRouter());
app.use(createRecruitmentApiRouter());
app.use(createQuestionBankApiRouter());
app.use(createAssessmentApiRouter());
app.use(createApplicationApiRouter());
app.use(createAdminApplicationApiRouter());
var app_default = app;
export {
  app_default as default
};
