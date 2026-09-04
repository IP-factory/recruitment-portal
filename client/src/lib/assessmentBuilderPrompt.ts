/**
 * Xceptional Assessment Builder Prompt — single source of truth.
 *
 * This constant is imported by any component that exposes the
 * "Copy AI Prompt" action on an assessment CSV setup surface.
 * Do NOT duplicate the prompt text — always import from here.
 */
export const XCEPTIONAL_ASSESSMENT_BUILDER_PROMPT = `I am creating a role-specific recruitment assessment for Xceptional by IPFactory.

I have attached:
The Job Description
The official Xceptional Assessment CSV Template

Below are my rough assessment questions:




[PASTE YOUR ROUGH ASSESSMENT QUESTIONS HERE]




Act as a senior recruitment assessment designer.
Review the Job Description and my rough questions, improve the assessment, and return a completed CSV that can be uploaded directly into Xceptional.

Please:
Professionally rewrite unclear questions.
Combine or remove repetitive questions.
Add important questions that are missing based on the Job Description.
Identify items that are better treated as Eligibility Gates rather than scored assessment questions.
Choose the most appropriate supported question type for every question, such as ORDINAL, MULTI, SJT, OPEN, NUMERIC or EVIDENCE.
Create appropriate answer options.
Assign suitable option scores.
Set each question's maximum score and q_weight.
Create OPEN scoring rubrics where required.
Group questions into meaningful role-specific assessment dimensions.
Assign dimension weights that total exactly 100%.
Recommend dimension floors only where genuinely necessary.
Use the attached Xceptional CSV template exactly. Preserve all column names and column order and do not add or remove columns.

Before creating the CSV, first show me:
Proposed Assessment
Proposed Evaluation Framework
Recommended Eligibility Gates
Important questions added, removed, combined or changed

Then create and return a downloadable completed .csv file using the exact attached Xceptional template.
The CSV must be ready to upload directly into Xceptional and contain all required questions, options, scores, weights, dimensions, ordering and other applicable configuration.
Do not stop at recommendations. Return the completed CSV file.`;
