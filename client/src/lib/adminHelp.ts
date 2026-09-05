export interface AdminHelpSection {
  id: string;
  title: string;
  introduction: string;
  href?: string;
  steps?: string[];
  topics: { title: string; text: string }[];
}

export const adminHelpSections: AdminHelpSection[] = [
  {
    id: "getting-started", title: "Getting started",
    introduction: "Use this manual to set up recruitment and review candidates. Choose a section in the help navigation to learn what a page does and how to use it.",
    steps: [
      "Sign in through Admin Login using the account provided by your administrator.",
      "Open Recruitment Roles to review the role description, eligibility rules and linked assessment before opening recruitment.",
      "Check the assessment questions and evaluation framework so you understand how candidates will be evaluated.",
      "Use Applications to open individual records, review written answers and score CVs.",
      "Use Screening to compare candidates for the same role and choose a shortlist.",
    ],
    topics: [
      { title: "Finding your way around", text: "The main sidebar opens each admin workspace. On a phone or smaller screen, use the menu button at the top to open it. Click a role, assessment, question or candidate row to open its detail page. Detail pages have tabs and back buttons for returning to their lists." },
      { title: "Saving changes", text: "Use the Save or confirmation button shown for each action and wait for success. If an error appears, read it before trying again. Filtering a table changes what you see; it does not change candidate records." },
      { title: "Signing out", text: "Use Sign out at the bottom of the main sidebar when you finish. Admin access is separate from the applicant flow; applicants start from the public application page." },
    ],
  },
  {
    id: "dashboard", title: "Dashboard", href: "/admin",
    introduction: "The dashboard gives an overview of recruitment activity across roles.",
    topics: [
      { title: "Summary cards", text: "Total Applications counts all application records. Submitted counts records that have progressed beyond In Progress and Eligibility Closed. Pending Review includes evaluations awaiting assessment completion or written-answer review. Shortlisted counts candidates manually selected for the shortlist." },
      { title: "Recent applications", text: "The table shows the five most recently created applications, including their role, score and status. Choose View all applications to open the complete list. A pending score means evaluation is not yet complete." },
    ],
  },
  {
    id: "applications", title: "Applications", href: "/admin/applications",
    introduction: "Use Applications to find a candidate and open their full application record.",
    topics: [
      { title: "Finding an application", text: "Use the search and available filters above the table to narrow the list. Check the role alongside the candidate name. Open a candidate row to review their information, assessment responses, CV and evaluation." },
      { title: "Application status", text: "In Progress means the applicant has not finished submitting. Submitted means the application has been submitted. Under Review, Shortlisted, Hold and Closed describe recruitment decisions or review progress. Eligibility Closed means the applicant did not pass the eligibility stage. Application status and evaluation status are separate: a submitted application can still need scoring." },
      { title: "Historical applications", text: "Deleting a recruitment role preserves its applications, CVs and scores. You can continue finding these candidates in Applications and Screening using their original role identity." },
    ],
  },
  {
    id: "candidate-review", title: "Candidate review",
    introduction: "Open a candidate from Applications or Screening. The page has four tabs and controls for application status and shortlisting.",
    steps: [
      "Read Overview and the eligibility responses.",
      "Open Assessment, review the recorded answers and score every OPEN answer that requires review.",
      "Open CV Review, read the uploaded CV and save your CV score.",
      "Review Integrity & Bonus and confirm or dismiss evidence-based findings.",
      "Check the updated evaluation, then choose the application status and whether to shortlist the candidate.",
    ],
    topics: [
      { title: "Overview tab", text: "Shows applicant information, eligibility responses and the application summary. Use it to understand the candidate's background and application progress before making a decision." },
      { title: "Assessment tab", text: "Shows recorded answers and the evaluation. OPEN questions are written answers requiring an admin rating. Read the candidate response and rubric anchors, enter a whole-number rating from 0 to 5, optionally add an internal note, and select Save review. The evaluation refreshes after saving. Pending OPEN Review means written answers still need review." },
      { title: "CV Review tab", text: "View or download the uploaded CV, then enter a score from 0 to 100 with at most one decimal place and an optional review note. Choose Save CV score or Update CV score. Remove score clears the review score; it does not delete the CV. Not uploaded and Pending review are different states. A score of zero is valid." },
      { title: "Integrity & Bonus tab", text: "Integrity flags identify answers requiring a closer look; they are not proof of misconduct. Review the relevant evidence before confirming or dismissing a flag. Confirm supported bonus items or remove a previous confirmation. These decisions can change the assessment's final screening score and review status." },
      { title: "Status and shortlist", text: "Use the status selector for recruitment progress and Add to shortlist or Remove from shortlist for shortlist membership. Scoring does not automatically make the recruitment decision. Check the resulting status and shortlist indicator after each change." },
    ],
  },
  {
    id: "screening", title: "Screening", href: "/admin/screening",
    introduction: "Compare candidates and build a shortlist. The Role applied for column identifies the role for every candidate, including on mobile.",
    steps: [
      "Choose a role from Role applied for above the table, or select All roles to view everyone. The list includes roles represented by existing applications, even if the role has been deleted from recruitment.",
      "Combine the role filter with candidate search, Status, Applied Band and Shortlist filters.",
      "Choose Sort by to compare assessment, CV or overall scores, dates or candidate names.",
      "Open a candidate for detailed review or select Shortlist and confirm your choice.",
      "Use Clear filters to restore all candidates and the default assessment score order.",
    ],
    topics: [
      { title: "Counts and filters", text: "The candidate count above the table reflects the current filters. The summary cards and Current shortlist show totals across all applications. Filters combine: a candidate must match every selected filter to appear. If no candidates appear, clear filters or widen your selection." },
      { title: "Roles with the same name", text: "The role filter keeps distinct roles separate even when their titles match. In this case, the dropdown adds the role identifier so you can tell the options apart." },
      { title: "Score columns", text: "Assessment Score is the final screening score from the assessment evaluation. CV Score is the admin's manual CV review. Overall Score is their equal average and appears only when both scores exist. Applied Band is the assessment band after floor rules. Pending values are not zero scores." },
      { title: "Review before deciding", text: "Open the candidate's Integrity & Bonus tab for actual integrity findings. Shortlist membership is a recruitment choice, not an integrity finding. Compare candidates within the same role because assessment requirements can differ." },
    ],
  },
  {
    id: "roles", title: "Recruitment Roles", href: "/admin/roles",
    introduction: "Create and maintain the roles applicants can apply for. Search by role details or use the Status filter.",
    steps: [
      "Select Create role and fill in the role information, descriptions, status and dates; save the form.",
      "Open the role row to inspect its tabs and use Edit role to change its details.",
      "Review eligibility rules and the assessment before setting the role to Open.",
    ],
    topics: [
      { title: "Role statuses", text: "Draft is not published to applicants. Open accepts new applications. Closed remains publicly listed but does not accept new applications. Archived is hidden from applicants and remains manageable in Recruitment Roles. Changing a role's status is different from deleting it." },
      { title: "Overview tab", text: "Shows the role description, department, location, employment type, dates and setup summary. Check application counts, eligibility readiness, the linked assessment and evaluation framework here." },
      { title: "Applications tab", text: "Lists the applications associated with the role. Select View to open a candidate. View all applications opens the broader Applications workspace." },
      { title: "Eligibility tab", text: "Manage the questions and rules that determine whether applicants can proceed. The next help section explains their types and statuses." },
      { title: "Assessment tab", text: "Shows the linked assessment and gives access to assessment management, CSV templates and CSV import. Configure questions before accepting applicants." },
      { title: "Evaluation Framework tab", text: "Read the role's scoring dimensions, weights, minimum floors, modifiers and bands. This is a reference view, not a general scoring-rule editor." },
      { title: "Deleting a role", text: "Use the trash icon in the role row or mobile card. The confirmation names the role and explains the effect. Delete role removes it from recruitment listings and stops new applications. Applications, CVs, scores and related evaluation records are preserved for review. Cancel leaves the role unchanged. There is no restore button; use Closed or Archived instead if you expect to reopen the role." },
    ],
  },
  {
    id: "eligibility", title: "Eligibility rules",
    introduction: "Open Recruitment Roles, select a role, then choose Eligibility. Each rule belongs to that role and controls an applicant requirement.",
    topics: [
      { title: "Adding and editing rules", text: "Use the add or edit controls to set the rule reference, name, applicant-facing wording, order, input type and configuration. Complete the fields shown for the chosen input type and save. Review the applicant wording carefully before enabling a rule." },
      { title: "Input types", text: "Rules can use yes/no answers, selection options, dates, compensation ranges or information already entered in the application, such as experience. Configure the outcomes and limits available for that type. Supplementary fields collect extra detail when enabled." },
      { title: "Blocking and status", text: "A blocking rule can close an application when its requirement is not met. Non-blocking rules collect information or flag it for review. Active rules are enabled; Inactive rules are disabled. Configuration Required indicates unfinished setup that must be reviewed before using the role." },
      { title: "Removing a rule", text: "Use the rule's delete action and review the confirmation. Changes affect the role's eligibility setup, so agree the requirements before collecting applications and avoid changing them casually during recruitment." },
    ],
  },
  {
    id: "assessments", title: "Assessments", href: "/admin/assessments",
    introduction: "An assessment is an ordered set of questions linked to a role. Open an assessment from the list to inspect or manage it.",
    topics: [
      { title: "Overview tab", text: "Shows the assessment name, description, assigned role, version, status and question count. Draft is being prepared, Active is available for the applicant runtime, and Inactive is not currently active." },
      { title: "Questions tab", text: "Shows assigned questions in their assessment order, with their references, types and configuration indicators. Open a question to inspect its full content and scoring configuration." },
      { title: "Edit assessment", text: "Use the editor to update settings, search the Question Bank, add questions, remove assignments and reorder the assessment. Removing an assignment does not delete the shared question. Use the provided save controls and check success messages. Question scoring configuration is edited in Question Bank, not in the assessment's ordering controls." },
      { title: "Activating and deactivating", text: "Activate makes a prepared assessment available, subject to the server's validation. An empty assessment cannot be activated. Deactivate removes its active status. Resolve any validation message and confirm the correct role and question set before activation." },
      { title: "Preview", text: "The preview is an admin view of the question experience and does not submit a real application. The current app has a dedicated preview route for the Business Development Officer v2 assessment; other assessments may not have a working preview route yet. Use their Questions tab to inspect content." },
    ],
  },
  {
    id: "csv-import", title: "CSV assessment import",
    introduction: "Open a role's Assessment tab and choose the CSV import action to bring in a prepared question set.",
    steps: [
      "Download the CSV template and follow its column and formatting instructions.",
      "Upload your CSV. Read the validation preview and correct any row errors before continuing.",
      "If the role lacks the required framework, review the proposed dimensions and weights before choosing Create Framework & Continue. This saves the framework as a separate action.",
      "Choose Save to Question Bank for reusable questions or Use for this role only for role-specific questions.",
      "Review the preview, then select Confirm Import. Wait for the result before leaving the page.",
    ],
    topics: [
      { title: "What the scope means", text: "Question Bank questions are reusable and appear in the shared library. Role-only questions stay specific to the selected role and are not listed in the shared Question Bank. Both use the same assessment scoring system." },
      { title: "When data is saved", text: "Uploading and previewing the CSV do not import questions. Creating a missing framework saves that framework; Confirm Import saves the question import. Check the result and linked assessment after import before activating it." },
    ],
  },
  {
    id: "question-bank", title: "Question Bank", href: "/admin/questions",
    introduction: "The Question Bank contains reusable questions and their scoring configuration. Search and filter the list, then open a question to inspect it.",
    topics: [
      { title: "Creating, editing and duplicating", text: "Use the new-question action to create a question. Set its reference, prompt, help text, type, dimension, importance, required state and status, then complete the type-specific configuration. Use Edit for an existing question or Duplicate to create a separate version. Save and verify the result." },
      { title: "Question detail", text: "Shows the applicant prompt, answer options or numeric/rubric configuration, maximum score, timing, status and Used in assessments. Check Used in before editing a shared question because the same question can be assigned to multiple assessments." },
      { title: "ORDINAL and SJT", text: "ORDINAL uses a scored single-choice scale. SJT is a situational judgement question with scored choices. Configure the wording and points for each answer." },
      { title: "MULTI and NUMERIC", text: "MULTI allows multiple selections, with option scores, possible decoys and a score cap. NUMERIC collects numbers and maps a value or derived calculation to scoring bands. Check the numeric input labels, units and band boundaries." },
      { title: "OPEN, GATE and EVIDENCE", text: "OPEN collects written responses for manual rubric-based review. GATE uses answer outcomes to control progression. EVIDENCE records support for a claim and can affect verification. Review their type-specific settings, links and cross-checks before assigning them." },
      { title: "Status and timing", text: "Draft and Inactive questions are not ready for active assessment use. Set Active only after reviewing the full configuration. Required flags, time limits, word limits and paste settings affect the applicant experience where supported by the question type." },
    ],
  },
  {
    id: "scores", title: "Scores & evaluation framework",
    introduction: "Use the role's Evaluation Framework tab and each candidate's evaluation to understand how results are calculated.",
    topics: [
      { title: "Dimensions, weights and floors", text: "A dimension is a capability being assessed. Question scores contribute to dimension scores, and dimension weights determine their contribution to the base assessment score. A floor is a minimum dimension score; missing a required floor can cap the final band even when the total score is high." },
      { title: "Assessment score", text: "The base assessment score is adjusted by evidence verification, confirmed integrity penalties and confirmed bonuses to produce the final screening score. The Raw Band comes from that score; the Applied Band also accounts for floor rules. Manual Review Required means an admin should examine the underlying findings." },
      { title: "CV and overall scores", text: "The CV score is a separate manual rating. Overall Score = (Assessment Score + CV Score) ÷ 2. For example, assessment 80 and CV 60 produce overall 70. The CV score does not change the assessment dimensions or Applied Band. If either score is missing, the overall score remains pending." },
      { title: "Pending results", text: "Pending Assessment means assessment work is unfinished. Pending OPEN Review means the evaluation still needs review or scoring completion. Review all required written answers and check incomplete configuration before interpreting the result. A missing score is never the same as a reviewed score of zero." },
    ],
  },
  {
    id: "settings-support", title: "Settings & troubleshooting", href: "/admin/settings",
    introduction: "Settings is currently a placeholder. It does not yet provide working account, permission or platform configuration controls.",
    topics: [
      { title: "Access problems", text: "If redirected to Admin Login, sign in again. If your account cannot access the admin workspace, ask the person responsible for administrator accounts to check your access. There is no public admin-registration flow." },
      { title: "Missing candidates", text: "Clear the page's filters, check the role and inspect Applications as well as Screening. A draft application may still be In Progress. Deleted roles retain their historical candidates." },
      { title: "Loading or saving errors", text: "Use Retry when shown and keep a copy of unsaved text before reloading. If the issue persists, report the page, action, time and visible error to your platform support contact. Do not share your password or a candidate's CV in a general support message." },
      { title: "Applicants cannot start", text: "Check that the role is Open, its eligibility setup is complete, and the intended assessment has assigned questions and is Active. Deleted roles cannot accept new applications. CV upload failures may require the platform operator to check file storage configuration." },
    ],
  },
];
