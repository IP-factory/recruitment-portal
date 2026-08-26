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
