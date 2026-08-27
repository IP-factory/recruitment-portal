# Approved UI Kit Corrections

- [x] Normalize section numbering through `10 / States`.
- [x] Update email helper/error wording to allow any valid email address.
- [x] Remove the Application type radio example.
- [x] Update candidate-table sample roles to Business Development Manager.
- [x] Rename the displayed Portal Navy token to Primary Navy without changing its hex value.
- [x] Verify the production build after the corrections.

## Public Homepage

- [x] Build the approved hero and application process card at `/`.
- [x] Add the How the Application Works, Before You Start, and final CTA sections.
- [x] Connect homepage navigation and placeholder application notices as specified.
- [x] Verify desktop, tablet, mobile, and production build behavior.

## Homepage Verification Notes

The `/#how-it-works` anchor places the How it works section in the viewport. The Start Application control displays “The application workflow will be available in a later phase.” and does not navigate to or create an application workflow.

## Role Selection and Auth Routing

- [x] Build the public `/apply` role-selection page with reusable role-card structure.
- [x] Build the minimal `/auth` routing placeholder without authentication controls.
- [x] Route public Start Application actions to `/apply` and role selection to `/auth`.
- [x] Verify required route behavior, responsive layouts, and the production build.

## Role Selection Verification Notes

The `/apply` page displays the Business Development Manager role, its specified metadata, assessment items, open status, and the five-stage information panel. Selecting “Apply for this role” routes to `/auth`, where the account-access placeholder is displayed. “Back to opportunities” returns to `/apply`; the homepage hero Start Application action routes to `/apply`, and the public navigation and final CTA use the same route behavior. Desktop, tablet, and mobile layouts were reviewed; the production build succeeds.

## Applicant Authentication Screens

- [x] Build the shared focused authentication layout and route `/auth` to sign in.
- [x] Implement create-account, sign-in, and forgot-password visual-only forms with inline validation.
- [x] Update the Business Development Manager action to route to account creation.
- [x] Verify auth routing, validation states, responsive layouts, and production build behavior.

## Applicant Information Step

- [x] Build the reusable focused application shell with header, progress area, and summary panel.
- [x] Implement the Business Development Manager Applicant Information form with local validation and browser storage.
- [x] Add the CV placeholder route and connect the role action to the application information step.
- [x] Verify form validation, retained local data, routing, responsive layouts, and production build behavior.

## CV Upload Experience

- [x] Build the frontend-only CV upload surface, selected-file state, and inline file validation.
- [x] Update the application summary for the active CV stage and add the Assessment placeholder route.
- [x] Connect CV Back and Continue actions while preserving Applicant Information data.
- [x] Verify valid selection, invalid type and size handling, replacement/removal, routing, responsive layouts, and production build behavior.

## Assessment Introduction

- [x] Build the Assessment Introduction content card within the existing application shell.
- [x] Add the assessment-questions placeholder and route the start action to it.
- [x] Preserve stage completion state and existing Information and CV metadata through the flow.
- [x] Verify stage indicators, navigation, responsive layouts, and production build behavior.

## Assessment Question Experience

- [x] Create shared frontend demo-question data and locally retained answer state.
- [x] Build the one-question-at-a-time assessment navigation, answer rows, and sequential question navigator.
- [x] Add the assessment completion page and Review placeholder routes.
- [x] Verify answer validation, persistence, stage routing, responsive layouts, and production build behavior.

## Review and Submit Experience

- [x] Add shared frontend-only submission state and readiness validation helpers.
- [x] Build the data-driven Review page with applicant, CV, assessment, and declaration sections.
- [x] Build the prototype completion route and read-only post-submission review state.
- [x] Verify data rendering, edit routes, incomplete handling, declarations, local submission, responsive layouts, and production build behavior.

## Admin Demo Login and Dashboard

- [x] Add frontend-only admin session helpers, protected routes, and demo credential validation.
- [x] Build the focused admin login page with local credential feedback.
- [x] Build the reusable admin shell, dashboard overview, central mock data, and placeholder routes.
- [x] Verify session redirects, sign-in/sign-out, dashboard navigation, responsive layouts, and production build behavior.

## Admin Verification Notes

Unauthenticated access to `/admin` redirects to `/admin/login`, where the separate focused Administration sign-in page renders without applicant-page chrome. Incorrect credentials render “The email address or password is incorrect.” inline without creating a session. The approved demo credentials create a local session and route to the structured Dashboard Overview with all four metrics, five recent applications, Active Role, and application-status summary. Applications navigation opens the protected shared-shell placeholder with the specified later-stage copy. The sign-out handler clears the local session and returns to `/admin/login`; authenticated visits to `/admin/login` redirect back to `/admin`; after sign-out, a direct `/admin` visit is again redirected to `/admin/login`. The desktop and mobile login layouts were reviewed, and the protected dashboard renders its desktop shell with table overflow control and responsive mobile drawer implementation. `pnpm check` and the production `pnpm build` both succeed; the bundle-size advisory is non-blocking.

## Admin Applications List

- [x] Expand central Admin mock data to at least 12 frontend-only application records.
- [x] Build the protected Applications management workspace with local search, filters, sorting, pagination, and empty state.
- [x] Add candidate-specific protected placeholder routes and keep non-Applications Admin placeholders unchanged.
- [x] Implement the responsive mobile applications list presentation within the approved Admin shell.
- [x] Verify route protection, list interactions, responsive layouts, and the production build.

## Admin Applications Verification Notes

The Applications route remains protected by the existing browser-local Admin session. The shared mock-data list renders 12 frontend-only records, and a case-insensitive name search for “Amina” narrows the result set to the corresponding candidate with the Clear filters action visible. A safe example-email search for `tunde.adeyemi@example.com` returns Tunde Adeyemi, and the In Progress application-status filter combines with that search without adding unrelated records. Clear filters restores the 12-record list; the Business Development Manager role filter is available and retains the current single-role records. Role and Completed assessment filters combine to show the seven matching frontend records. Selecting Hired alongside those active filters produces the specified “No applications found” state with the supporting copy and Clear filters action. Pagination shows the first ten records on page 1 and Emeka Obi plus Bolanle Ajayi on page 2. A View action opens the protected candidate-specific placeholder with the specified next-stage copy and the Applications navigation remains active; Back to applications returns to the list. Candidate-name sorting rearranges the visible list alphabetically, with Adaobi Nwosu first. Applied-date sorting reverses the default order and begins with the two 21 Aug 2026 records. The Dashboard View all applications action routes directly to the Applications workspace, which reads its five recent candidates from the same shared frontend data. Below the `md` breakpoint the desktop table is replaced by compact divider-separated application records; at tablet sizes the table remains contained in its own horizontal-scroll region, so the page itself does not overflow. The approved mobile Admin drawer remains responsible for workspace navigation. The final `pnpm check` and production `pnpm build` succeed; the bundle-size advisory is non-blocking. A clean development-server restart removed the historical import-resolution output, and the approved applicant Assessment Questions route still renders normally.

## Admin Candidate Application Review

- [x] Extend shared Admin mock data with candidate details, CV metadata, application progress, and assessment-response states.
- [x] Replace the candidate placeholder with the reusable protected Application Review header, status control, and three tabs.
- [x] Build the Overview, CV, and Assessment tab content without scores, ranking, or AI analysis.
- [x] Add frontend-local status changes, CV preview feedback, and download notice behavior.
- [x] Verify all candidate routes, tab states, local interactions, responsive layouts, and the production build.

## Recruitment Roles Management

- [x] Create a central frontend-only role data layer with local persistence and align the approved public role entry point where practical.
- [x] Build the protected responsive Recruitment Roles list with summary, search, status filter, and the approved Business Development Manager row.
- [x] Build the protected Create Recruitment Role form with local validation and frontend-only save behavior.
- [x] Build the reusable role detail and edit experience with Overview, Applications, and Assessment placeholder tabs.
- [x] Verify role lifecycle behavior, routes, local persistence, responsive layouts, public availability states, and the production build.

## Admin Question Bank

- [x] Create the central frontend-only twelve-question data layer, reusing the five approved Business Development questions.
- [x] Build the protected responsive Question Bank list with exact summary cards, local search, filters, and pagination.
- [x] Add read-only question-view and add-question placeholder routes while keeping Question Bank active in the Admin shell.
- [x] Verify the protected routes, list interactions, responsive behavior, and production build without introducing question editing or scoring.

## Admin Question Create and Edit

- [x] Add a separate frontend-only Admin option-score configuration keyed by question and option, without changing applicant assessment objects.
- [x] Build the reusable protected Create and Edit Question form with four-to-five option controls, reorder actions, scoring guidance, and inline validation.
- [x] Update the Admin Question Detail with an Edit action and the internal-score / unconfigured-score view.
- [x] Verify question creation, editing, score persistence and isolation, responsive layouts, existing assessment behavior, and the production build.

## Admin Assessment Builder

- [x] Create shared browser-local assessment data with role assignment, selected question references, order, and score-readiness helpers.
- [x] Build protected Assessments list and Business Development Assessment detail routes with shared readiness summaries.
- [x] Build the Assessment Builder with question selection, ordering controls, score-status visibility, local validation, and save behavior.
- [x] Verify assessment routes, builder interactions, Question Bank score ownership, responsive layouts, existing applicant assessment behavior, and the production build.

## Admin Assessment Builder Verification Notes

The protected Assessments workspace lists the single Business Development Assessment with the Business Development Manager role, five assigned questions, 0 of 5 configured readiness, Active status, and the seeded 26 Aug 2026 update label in the reset demo state. The detail route keeps Assessments active in the Admin shell, has exactly Overview and Questions tabs, shows role, status, assigned-question count and derived scoring readiness, and directs each unconfigured question to its existing Question Bank scoring editor without displaying any numeric scores. The builder provides local validation for name, role and status; an editable description; a role selector sourced from browser-local Recruitment Roles; separate selected-question and Question Bank panels; competency search/filtering; disabled Added controls; Add, Move up, Move down and Remove actions; empty states; and Cancel/Save changes return behavior. A temporary Q-006 add, reorder and save persisted in the detail view; it was cleared before delivery. A temporary complete score configuration for Q-001 changed readiness to 1 of 6 from the separate Question Bank score store; it too was cleared without altering Question Bank content. The applicant Assessment Questions route now resolves the assigned Question Bank list dynamically, maintains Question 1 of 5 in the reset state, supports variable assigned-question counts, and receives only IDs, competency, question text and options—not score maps or candidate scoring. Desktop and narrow mobile application views remain readable; unauthenticated Admin route previews correctly redirect to the focused sign-in view. `pnpm check` and `pnpm build` succeed; the production build reports only the existing non-blocking chunk-size advisory.

## Admin Candidate Assessment Scoring

- [x] Map the completed Task 17 scoring requirements to the existing candidate response, assessment-assignment, and Question Bank score data.
- [x] Create shared frontend-only assessment scoring helpers with readiness checks, whole-percent results, competency breakdowns, and Admin interpretation bands.
- [x] Add the Admin-only candidate Assessment tab score summary and response-level selected-option score context.
- [x] Add Assessment Score display states and local sorting to the protected Applications list without ranking, CV scoring, analytics, backend, or AI.
- [x] Verify all assessment status and configuration states, applicant score isolation, responsive views, and type/build checks.

## Admin Candidate Assessment Scoring Verification Notes

The shared Admin-only scoring utility resolves the current assessment assignment, candidate option selections and separately stored Question Bank score maps. It requires Completed status, a response for every assigned question, and a numeric configured score for each selected option before returning a result; otherwise it returns no partial percentage. During a temporary five-question configuration, Chinedu Okafor’s selected scores totaled 19 out of 25 and rendered as 76% with the Good interpretation. The same result exposed one monochrome, text-labelled 80% competency row for each of Business Development Experience, Prospecting, Pipeline Management and Commercial Judgement, plus Client Relationship Management at 60%; selected responses displayed only their own Internal score: X / 5. With no score configuration, the completed candidate correctly showed Score unavailable with the required review action; it opened the Assessment Detail Questions tab. In-progress and not-started candidates rendered their required state messages with no scores. The Applications list displayed 76%, 80%, 64%, Pending setup and em dash states correctly; a user-triggered Assessment Score sort ordered available percentages without ranking candidates. Temporary score maps and local application records were cleared, restoring the default unconfigured setup. The applicant assessment remains limited to question content, answer options and progress with no score language.

## Role-Specific CV Evaluation Criteria

- [x] Review the complete Task 18 configuration requirements and the existing Recruitment Role detail structure.
- [x] Create browser-local, role-specific CV criteria data with the eight seeded Business Development Manager criteria, ordering, active totals, and validation helpers.
- [x] Add the CV Criteria role-detail tab with its required information note, summaries, weight state, and criteria workspace.
- [x] Implement criterion addition, editing, activation, ordering, inline validation, unsaved changes, and guarded save behavior.
- [x] Verify 100% active-weight readiness and warning states, role-specific persistence, responsive layouts, out-of-scope isolation, and type/build checks.

## Role-Specific CV Evaluation Criteria Verification Notes

The Business Development Manager Role Detail now has its fourth CV Criteria tab, while Overview, Applications and Assessment remain intact. The role-specific browser-local configuration starts with the prescribed eight Active criteria at 30%, 15%, 15%, 10%, 10%, 10%, 5% and 5%, producing data-derived Active Criteria 8, Total Weight 100% and Ready indicators. The concise Overview row reads “8 criteria · Configured.” The criteria workspace contains the required explanation, one main table/compact-record surface, Add criterion action, individual Edit and Move controls, inactive status treatment, a save confirmation and the Admin-only future 0–5 evidence-rating reference. Empty criterion submission exposes required inline name, description and whole-number weight messages. A temporary inactive fifth-weight criterion maintained the active total at 100% and saved to browser-local storage; a temporary active 30%→29% edit produced Total weight 99%, Needs attention, the prescribed warning and a disabled Save control. Reordering changed only display order. All temporary data was cleared, restoring the specified eight-item default state. Applicant and candidate experiences have no CV evaluation, evidence rating, CV Evidence Score or Overall Fit additions. Narrow-screen capture retains the existing responsive applicant experience and compact protected entry; `pnpm check` and `pnpm build` pass with only the existing non-blocking chunk-size advisory.

## Candidate CV Evidence Review

- [x] Review the complete Task 19 requirements and map the existing candidate detail, CV metadata, role CV criteria, and mock-data structure.
- [x] Add structured role-specific demo CV evidence and browser-local application-by-criterion rating and note persistence.
- [x] Add the CV Evidence candidate-detail tab with configured active criteria, evidence states, CV reference, rating guide, and review readiness.
- [x] Implement Admin-only evidence-rating and review-note interaction, validation, local save, and success feedback.
- [x] Verify completed/in-progress/not-started review behavior, no-evidence states, local persistence, responsive layouts, scope isolation, and type/build checks.

## Candidate CV Evidence Review Verification Notes

Candidate Detail now has Overview, CV, CV Evidence and Assessment tabs in the requested order. The CV Evidence workspace derives its eight displayed rows, configured order, names, descriptions and secondary weights from the Business Development Manager role criteria. Chinedu’s structured mock evidence demonstrates multiple evidence items, single evidence items and two neutral Not clearly evidenced states; Amina’s explicit seeded reviews demonstrate Complete at 8 of 8, while Chinedu begins Incomplete at 6 of 8 and David begins Not Started at 0 of 8. The candidate Overview presents the concise matching CV Evidence Review status without any percentage. Each criterion supports an Admin-only 0–5 select and optional internal note. Temporarily rating Chinedu’s two unrated no-evidence criteria produced Complete at 8 of 8; Save CV review persisted those application-by-criterion entries in browser-local storage and displayed “CV evidence review saved.” Temporary review edits were cleared, restoring the seed states. David’s no-CV record uses a neutral CV-not-available reference and no fabricated evidence. No CV Evidence score, weighted contribution, assessment combination, Overall Fit, ranking, shortlisting, backend or AI capability was introduced. Applicant routes remain unchanged and show no CV review material. Desktop direct-browser inspection, narrow-route capture and `pnpm check && pnpm build` pass; the build retains only the existing non-blocking chunk-size advisory.

## Weighted CV Evidence Score

- [x] Review the full Task 20 calculation, readiness, score-display, and Applications-list requirements.
- [x] Create deterministic browser-only CV Evidence Score helpers using active role criteria and saved manual ratings.
- [x] Add completed and unavailable CV Evidence score summaries, weighted breakdowns, and criterion contribution context to Candidate Detail.
- [x] Add CV Evidence score states and local CV Evidence Score sorting to the Applications table and mobile records without changing default order.
- [x] Verify incomplete, zero-rating, invalid-weight, completed-score, summary, Applications-list, responsive, scope-isolation, and type/build behavior.

## Weighted CV Evidence Score Verification Notes

The reusable `cvEvidenceScoring` utility derives scoring readiness, total active weight, rated count, raw contribution values, a whole-percent display value, interpretation and a reason when scoring is unavailable. It uses the active Business Development Manager role criteria as the single source of weights and the browser-local Admin review records as the single source of ratings; no percentages are stored in candidate data. Amina’s completed seed review correctly calculates to 84% and Strong from contributions of 30/30, 12/15, 12/15, 8/10, 6/10, 8/10, 4/5 and 4/5. Candidate Overview adds the concise “CV Evidence Score: 84%” only while a score is available. Chinedu’s incomplete six-of-eight review renders Score unavailable with its actual remaining-rating explanation and no provisional result. A temporary valid all-zero eight-rating review returned available, 0%, 8/8 and zero contributions, confirming zero is valid rather than unrated; it was cleared after the test. A temporary active-weight change from 100% to 95% rendered Score unavailable, stated the exact 95% total, and opened the Role CV Criteria tab via Review CV criteria; it was cleared after testing. A non-persisted 84.6 scoring calculation displayed 85%, confirming whole-percent rounding. The Applications table and mobile records add CV Evidence after Assessment Score with 84%, Pending review, Pending setup and em-dash states; optional explicit sort places available values first while default remains newest first. Desktop direct-browser inspection and narrow captures preserve Admin-only score visibility. Applicant routes remain free of CV scores, ratings, weights, contributions and interpretation labels. `pnpm check && pnpm build` succeed, with only the existing non-blocking chunk-size advisory.

## Overall Fit Score

- [x] Review the full Task 21 calculation, readiness, candidate-detail, Applications-list, responsive, and acceptance requirements.
- [x] Create a centralized browser-only Overall Fit utility using existing Assessment and CV Evidence scoring results with central 70/30 weights.
- [x] Add available and unavailable Overall Fit cards with transparent contribution details to Candidate Overview.
- [x] Add Overall Fit states and optional local Overall Fit sorting to the Applications table and mobile records while retaining newest-first default order.
- [x] Verify component availability, setup and invalid-weight states, rounding, contribution precision, responsive layouts, applicant isolation, and type/build checks.

## Overall Fit Score Verification Notes

The new reusable `overallFitScoring` utility keeps the central `overallFitWeights` configuration at Assessment 70% and CV Evidence 30%, validates its total before calculating, consumes only the existing deterministic Assessment and CV Evidence utilities, and exposes raw component values, readable contributions, whole-percent display, interpretation and unavailable reason. It never uses demographic or candidate-profile data. With temporary complete Question Bank scoring, Amina’s 80% Assessment and 84% CV Evidence results produced 56 / 70 and 25.2 / 30 contributions, a raw Overall Fit of 81.2, and a rounded 81% Strong display in the new Overview card. The card preserves component scores, weights, contributions, the combined-screening label and the required human-review note; the candidate header remains score-free. Chinedu’s completed assessment plus incomplete CV review showed Overall Fit Unavailable with the required CV-review message and no partial score. Restoring no Assessment configuration showed the required assessment-unavailable message. A temporary 60/30 central component-weight test returned `invalid-component-weights` and no score; values were immediately restored. The Applications table and mobile records now place Overall Fit after CV Evidence with 81%, Pending assessment, Pending CV review and Pending setup states. Explicit Overall Fit sort placed available scores first; default remained newest-first. All temporary Question Bank scoring was cleared. Applicants remain score-free. Desktop and narrow visual checks passed, and `pnpm check && pnpm build` succeed with only the existing non-blocking chunk-size advisory.

## Candidate Screening and Shortlist Workspace

- [x] Review the full Task 22 navigation, screening data, filtering, top-view, manual shortlist, responsive, and acceptance requirements.
- [x] Create browser-local shortlist state and reusable screening helpers for eligibility, sorting, filters, summaries, and top-view limits.
- [x] Add the protected Screening navigation item and role-specific comparison workspace with score states, controls, filters, summaries, and candidate routes.
- [x] Implement confirmation-based manual add-to-shortlist and removal flows with browser-local persistence and application-status restoration.
- [x] Verify default screening order, sort/filter combinations, top-view constraints, shortlist actions, cross-page state, responsive layouts, applicant isolation, and type/build checks.

## Candidate Screening and Shortlist Workspace Verification Notes

The protected Screening sidebar item now follows Applications and opens `/admin/screening` with the required header, Business Development Manager selector, data-derived 12-application summary, and human-review note. The shared browser-local screening helper uses only existing Assessment, CV Evidence and Overall Fit utilities to determine Ready or Awaiting Review; it stores only manual shortlist records containing application identifier, shortlist flag, timestamp and prior status. With the approved reset state, score configuration remains unset and the page correctly shows 0 Ready, 12 Awaiting Review and only Complete review actions. Under temporary complete Question Bank scoring, Amina became the one Ready record with 64% Assessment, 84% CV Evidence, 70% Overall Fit, Good interpretation and an Add to shortlist action; sorted screening placed that available Overall Fit above the pending records without rank labels. Show top 5 by Overall Fit limited the view to the ready result and did not alter status. Search for Amina returned the expected one candidate and Clear filters restored the default. The add confirmation performed no change until explicitly confirmed, then stored the shortlist record, changed Amina’s existing Application Status to Shortlisted, updated Screening’s summary/current-shortlist panel, updated the Applications list, and updated Dashboard’s Shortlisted metric and role summary to 1. The removal confirmation restored the prior Submitted status and cleared the shortlist state. All temporary shortlist, application and Question Bank score data was cleared before delivery. Applicant routes remain score-free and unchanged. Desktop and narrow responsive captures pass; `pnpm check && pnpm build` succeed with only the existing non-blocking chunk-size advisory.

## Admin Question Create and Edit Verification Notes

The protected Add Question route now renders the approved two-column Question setup form with Question details, four initial lettered options, 0–5 Internal score controls, move actions, Add fifth option, and the Admin-only Scoring guide. The first empty-submit click did not visibly surface validation, but direct native submission confirmed the required inline errors for question text, competency, type, all four option texts, all four internal score selections, and the missing maximum score of 5. The direct fifth-option handler adds the E row and exposes secondary Remove actions; removing it returns the form to four rows and restores the Add fifth option action. A valid four-option Experience question and Prospecting competency have been entered with a complete 0, 2, 5, 1 internal-score configuration. The local move-up control reorders the second option to A while retaining its score of 2; the former first option moves to B with score 0. The browser-local create flow assigns Q-013, retains the Not assigned relationship, and exposes each neutral Internal score in the Admin detail view. By contrast, original Q-001 retains only its applicant-visible option text, a Scoring — Not configured treatment, the required explanation, and Configure scoring with no invented score values. Its explicit Edit Question route pre-populates all content but leaves every internal score unset; direct validation confirms the required missing-score errors and the score-of-5 requirement before any save. The unconfigured original question is left unchanged. Configured Q-013 pre-populates all score selections; saving it as Inactive updates the Admin detail status while retaining its configured scores and Not assigned relationship. The Question Bank list reflects Q-013 as an Inactive, four-option, Not assigned record while continuing to hide all internal score values from its table. Temporary browser-local question and score records have been cleared; the delivered Question Bank returns to its approved 12-question, 12-active, unconfigured default state. Both the applicant Assessment Questions and Review pages render only the existing question, category, answer options, progress, and selected responses; they expose no internal scores, scoring guide, evaluation, or best-answer language. Narrow-screen previews confirm the applicant assessment and review remain readable on mobile; protected Admin route previews correctly redirect unauthenticated sessions to the compact Admin sign-in. `pnpm check` and the production `pnpm build` succeed, and the current development server restarted cleanly.

## Admin Question Bank Verification Notes

The protected Question Bank route renders 12 shared frontend-only questions, including the five approved applicant questions and seven additional Business Development questions. Its data-derived summary is 12 total questions, 12 active questions, and 8 competencies. Default sorting starts at Q-001, the first page contains 10 questions, and a case-insensitive search for “negotiation” returns only Q-006 with Clear filters available. That search combines with the Negotiation & Closing competency and Scenario type filters while preserving the correctly matched Q-006 record. Adding the Inactive status filter produces the specified no-match state with its supporting copy and Clear filters action; clearing from that state restores all 12 shared records. Pagination shows Q-011 and Q-012 on page 2. The protected Q-011 detail route retains Question Bank navigation, renders the complete question, five labeled read-only answer options, restrained metadata, and no scores or analytics. The Add Question route displays only the required next-stage creation and scoring configuration placeholder. An unknown identifier renders the clean Question not found state and a safe Question Bank return action. Reference sorting toggles the shared list from Q-001 first to descending order with Q-012 first, without adding multi-column sorting. The narrow-screen review confirms the protected Admin entry remains compact, while applicant assessment cards remain readable at mobile widths. `pnpm check` and the production `pnpm build` succeed after a clean server restart; the bundle-size advisory is non-blocking.

## Recruitment Roles Verification Notes

The protected Recruitment Roles list renders the central default Business Development Manager record with the required 1 / 1 / 0 summary, search field, status filter, and View action. Its reusable detail page retains Recruitment Roles as the active Admin navigation item, displays the required metadata, status, role summary, and score-free Overview content. The Applications tab reuses the 12 shared candidate records in a deliberately compact table/list without the management toolbar. The Assessment tab provides only the required later-stage configuration placeholder and does not expose questions, scoring, or weights. The Create Recruitment Role route renders the focused main-form and right-side setup guidance layout with the required fields, Draft default, optional dates, and Cancel/Save role actions. Submitting it empty shows the required inline validation for title, department, location, and short description. A valid local Draft Partnerships Specialist role saves to browser-local role data and routes to the same reusable detail experience. Native submit verification was used because the initial viewport click did not reach the visible submit target; the form’s handler and local persistence are confirmed. The explicit edit route renders the same pre-populated focused form, and saving a Strategic Growth department change updates the reusable detail page from the browser-local role data. The Recruitment Roles list then renders both local roles with correct 2 / 1 / 1 totals; title search narrows to Partnerships Specialist and exposes Clear filters. The Draft status filter combines with that search and Clear filters restores the full browser-local role collection. The approved Business Development Manager uses the same pre-populated edit form. When its status is changed to Closed locally, the approved public opportunity remains visible with a Closed badge and a disabled “Applications closed” action; it was then restored to Open for the default demo state. Temporary local test records were cleared so the Roles list returns to the approved 1 / 1 / 0 default. Responsive route review confirms the public opportunity stacks cleanly at narrow widths, and the protected Admin entry remains compact. `pnpm check` and production `pnpm build` succeed; the bundle-size advisory is non-blocking.

## Admin Candidate Review Verification Notes

The reusable Chinedu Okafor review route opens inside the protected Admin shell with Applications active and Application Review in the top bar. The Overview tab renders shared applicant contact/professional details, application summary, and four application stages without scores or ranking. The CV tab renders the supplied filename, PDF type, size, Available badge, and non-storage-backed View CV and Download actions. View CV opens the explicit “CV preview will be connected when document storage is implemented.” modal and closes normally without attempting document access. Chinedu’s Assessment tab displays all five existing Business Development questions in order, their selected response text, Completed status, and “5 of 5 questions answered,” without evaluation fields. Tunde Adeyemi uses the same layout with the In Progress assessment and Review Not Started summary states; the Assessment tab shows the required incomplete-assessment message. David Johnson verifies the Not Started Assessment state, Not available CV summary, and Not provided fallback for absent phone and LinkedIn data. David’s CV tab displays the specified CV-not-available message, and his Assessment tab displays the specified assessment-not-started message. Changing David’s status locally to Under Review updates the candidate header and, after Back to applications, the shared Applications List row; the browser-local state is preserved in the frontend prototype. An invalid candidate identifier renders the clean Application not found state and return action. The Dashboard recent-applications row for David also reads the updated Under Review status from the same local frontend data. Download displays “CV download will be available when backend file storage is connected.” as an informational notice and does not initiate a file download. The review header, Overview columns, CV actions, tab strip, and assessment sections stack or scroll within their containers at narrow breakpoints; the established Admin drawer remains available for mobile navigation. `pnpm check` and the production `pnpm build` succeed. Following a clean server restart, the approved applicant Assessment Questions route remains unchanged and renders normally.

## Review and Submission Verification Notes

With the existing locally retained prototype data, the Review page renders Applicant Information, CV metadata, all five assessment responses, and no score data. The desktop summary shows Information, CV, and Assessment completed with Review active. Submission remains disabled until both independent declaration confirmations are selected. With both confirmations selected, Submit application stores the completed frontend-prototype state and routes to the no-score completion page with Role, Completed status, and 4 of 4 stages. View completed application returns to a read-only Review state: all sections use Completed labels and no edit, declaration, or submit controls are available. Before submission, Applicant Information Edit returns to the original Information step with all existing browser-stored values preserved, and CV Edit returns to the existing selected-file state with Replace and Remove controls.

## Assessment Question Verification Notes

The assessment opens with one Business Development question, its five selectable answer rows, the question-only progress bar, and unavailable future navigator controls. Selecting Next without an answer renders “Select an answer before continuing.” inline and remains on Question 1. Choosing one answer creates the selected state, marks Question 1 answered, enables the next sequential question, and advances to Question 2. Previous returns to Question 1 with the selected answer intact; a browser refresh retains the response and current-question state. All five locally retained answers restore on Question 5, where Complete assessment replaces Next and no score is shown. Completing the assessment opens the no-score completion state; Review assessment responses returns to Question 1 with all retained answers marked in the navigator. Continue to review opens the Review placeholder with Information, CV, and Assessment completed and Review active.

## Assessment Introduction Verification Notes

The Assessment Introduction renders the requested three expectation rows, four guidance rows, no-score information note, completed Information and CV stages, and active Assessment stage. The Start assessment route handler opens `/apply/business-development-manager/assessment/questions`, where Assessment remains active and the requested questions placeholder appears without any sample questions or scoring. The questions placeholder return action restores the introduction. Back to CV restores the completed CV stage with the temporary selected-file metadata intact.

## CV Upload Verification Notes

The CV route renders the active CV progress state, upload surface, guidance rows, action controls, and the summary panel with Information completed and CV current. The file control declares the required PDF, DOC, and DOCX selection types. A temporary unsupported text-file selection renders “Upload your CV as a PDF, DOC or DOCX file.” inline, and an 11 MB PDF selection renders “Your CV must be 10 MB or smaller.” inline. A valid PDF selection displays the compact filename row, type and size metadata, and “CV selected successfully.” The Remove action clears the temporary metadata and returns to the upload state. Selecting Continue with no valid file renders “Upload your CV before continuing.” inline; a valid PDF routes to `/apply/business-development-manager/assessment`, where Assessment is active and the requested placeholder is displayed. Back to CV returns to the selected-file state without attempting a server upload. The Replace action updates the displayed metadata to the new valid DOCX file.

## Applicant Information Verification Notes

The Business Development Manager workspace renders the focused application header, four-step progress area, two form sections, and desktop summary panel. Attempting to continue with empty required fields triggers the local field-validation treatment and keeps the applicant on the Information step. Required text fields and total professional experience can be populated locally in preparation for CV-stage continuation. A fully valid required-field set routes to `/apply/business-development-manager/cv`, where the CV stage is active and the requested placeholder is displayed. Returning to Information restores the entered temporary browser data, and Exit application returns to `/apply`.

## Authentication Verification Notes

The `/auth/create-account` route displays the required shared application-context panel, required applicant fields, terms confirmation, disabled primary state, and sign-in alternative. Invalid email input produces the local “Enter a valid email address.” field error after blur. The legacy `/auth` route redirects to `/auth/sign-in`. The sign-in Forgot password link routes to `/auth/forgot-password`, and Back to sign in returns to `/auth/sign-in`. The sign-in Create an account link routes to `/auth/create-account`. Valid email and matching-password states are accepted locally while the action remains disabled until terms are accepted. With terms confirmed, the enabled Create account action displays “Account creation will be connected in the next implementation stage.” and does not create an account or navigate away. The Business Development Manager action from `/apply` routes to `/auth/create-account`.

## Task 23A — Business Development Officer Eligibility

- [x] Align the primary applicant role label and public journey to Business Development Officer.
- [x] Preserve the four-stage applicant structure: Information, CV, Assessment, and Review.
- [x] Implement active gates G1 Abuja presence, G2 right to work, G3 relevant experience, G6 outbound work, and G7 verification consent.
- [x] Require a planned relocation date when G1 relocation is selected.
- [x] Keep G4 start availability and G5 compensation band visible as Configuration required and inactive.
- [x] Persist applicant eligibility answers and the deterministic evaluation in browser-local storage.
- [x] Route incomplete or failed eligibility submissions appropriately, including the terminal eligibility close-out page.
- [x] Prevent closed applicants from entering CV, Assessment, or Review routes directly.
- [x] Show eligibility outcome and all seven gate states in Admin Candidate Detail.
- [x] Show eligibility configuration status in Admin Role Detail.
- [x] Redirect legacy Business Development Manager application URLs to the Officer journey.
- [x] Verify the complete eligible path, each gate closure path, relocation-date validation, Admin outcome visibility, and responsive layouts in the browser.
- [x] Keep the implementation frontend-only with no backend or AI dependency.
