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
