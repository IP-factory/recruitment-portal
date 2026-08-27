import { describe, expect, it } from "vitest";
import { getApplicantBusinessDevelopmentAssessmentQuestions } from "@/lib/assessmentData";
import { QUESTION_BANK_DIMENSIONS, QUESTION_BANK_TYPES, QUESTION_BANK_QUESTIONS, validateQuestionInput, type AdminQuestionOption, type QuestionBankInput } from "@/lib/questionBankData";

const option = (id: string, points = 3): AdminQuestionOption => ({ id, label: id.toUpperCase(), text: `Option ${id}`, rawPoints: points });
const base = (type: QuestionBankInput["type"], options: AdminQuestionOption[] = []): QuestionBankInput => ({ reference: "D1.Q1", dimension: type === "GATE" || type === "EVIDENCE" ? "GATE" : "D1", type, qWeight: ["GATE", "EVIDENCE"].includes(type) ? null : 2, max: ["GATE", "EVIDENCE"].includes(type) ? null : 5, required: true, prompt: "A configured question prompt", helpText: "", status: "Active", options });

describe("Question Bank architecture", () => {
  it("supports all formal types and D1-D8 dimensions without replacing the twelve-question legacy bank", () => {
    expect(QUESTION_BANK_TYPES).toEqual(["GATE", "ORDINAL", "MULTI", "NUMERIC", "SJT", "OPEN", "EVIDENCE"]);
    expect(QUESTION_BANK_DIMENSIONS.map((dimension) => dimension.code)).toEqual(["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "GATE", "NA"]);
    expect(QUESTION_BANK_QUESTIONS).toHaveLength(12);
    expect(QUESTION_BANK_QUESTIONS.every((question) => question.max === 5 && question.required)).toBe(true);
  });

  it("keeps the applicant adapter on its existing score-free single-select shape", () => {
    const applicantQuestions = getApplicantBusinessDevelopmentAssessmentQuestions();
    expect(applicantQuestions).toHaveLength(5);
    expect(applicantQuestions[0]).toMatchObject({ id: "q-001", category: expect.any(String), question: expect.any(String) });
    expect(applicantQuestions[0]).not.toHaveProperty("qWeight");
    expect(applicantQuestions[0].options).toHaveLength(5);
  });

  it("validates GATE questions as binary, unweighted, and unscored", () => {
    const gate = { ...base("GATE", [option("a"), option("b")]), config: { gateConfig: { options: [{ ...option("a"), gateOutcome: "pass" }, { ...option("b"), gateOutcome: "fail" }] } } };
    expect(validateQuestionInput(gate)).toEqual([]);
    expect(validateQuestionInput({ ...gate, options: [option("a")], config: { gateConfig: { options: [{ ...option("a"), gateOutcome: "pass" }] } } })).toContain("GATE questions require exactly two binary options.");
    expect(validateQuestionInput({ ...gate, qWeight: 2, max: 5 })).toContain("GATE and EVIDENCE questions cannot use qWeight.");
  });

  it("validates ORDINAL, MULTI, and SJT option ranges", () => {
    const ordinal = { ...base("ORDINAL", [option("a", 0), option("b", 3), option("c", 5), option("d", 5)]), config: { ordinalConfig: { options: [option("a", 0), option("b", 3), option("c", 5), option("d", 5)] } } };
    expect(validateQuestionInput(ordinal)).toEqual([]);
    expect(validateQuestionInput({ ...ordinal, options: [option("a"), option("b")] })).toContain("ORDINAL questions require four or five options.");
    const multi = { ...base("MULTI", [option("a", -1), option("b", 5)]), config: { multiConfig: { options: [option("a", -1), option("b", 5)], scoreCap: 5 } } };
    expect(validateQuestionInput(multi)).toEqual([]);
    const sjt = { ...base("SJT", [option("a", -2), option("b", 1), option("c", 3), option("d", 5)]), config: { sjtConfig: { options: [option("a", -2), option("b", 1), option("c", 3), option("d", 5)] } } };
    expect(validateQuestionInput(sjt)).toEqual([]);
  });

  it("validates numeric modes, open rubrics, evidence multipliers, and cross-check configuration", () => {
    const numeric = { ...base("NUMERIC"), config: { numericConfig: { mode: "calendarYearExperience" as const, inputs: [{ label: "Calendar year", unit: "year" }], bands: [{ id: "b1", lowerBound: 0, rawPoints: 5 }] }, crossCheck: { compareQuestionRef: "D1.Q1", ruleDescription: "Derived years disagree by more than two years.", flagOutcome: "integrity" as const } } };
    expect(validateQuestionInput(numeric)).toEqual([]);
    const open = { ...base("OPEN"), config: { openConfig: { pasteAllowed: false, rubric: [{ id: "r1", points: 5 as const, anchor: "Names a quantified result and explains the commercial action." }] } } };
    expect(validateQuestionInput(open)).toEqual([]);
    const evidence = { ...base("EVIDENCE", [option("a"), option("b")]), config: { evidenceConfig: { pairedQuestionRef: "D2.Q1", options: [{ ...option("a"), verificationMultiplier: 1 }, { ...option("b"), verificationMultiplier: 0.85 }] } } };
    expect(validateQuestionInput(evidence)).toEqual([]);
    expect(validateQuestionInput({ ...evidence, config: { evidenceConfig: { pairedQuestionRef: "", options: [{ ...option("a"), verificationMultiplier: 0.8 as 1 }] } } })).toHaveLength(2);
  });
});
