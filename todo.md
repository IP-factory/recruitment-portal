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

## Authentication Verification Notes

The `/auth/create-account` route displays the required shared application-context panel, required applicant fields, terms confirmation, disabled primary state, and sign-in alternative. Invalid email input produces the local “Enter a valid email address.” field error after blur. The legacy `/auth` route redirects to `/auth/sign-in`. The sign-in Forgot password link routes to `/auth/forgot-password`, and Back to sign in returns to `/auth/sign-in`. The sign-in Create an account link routes to `/auth/create-account`. Valid email and matching-password states are accepted locally while the action remains disabled until terms are accepted. With terms confirmed, the enabled Create account action displays “Account creation will be connected in the next implementation stage.” and does not create an account or navigate away. The Business Development Manager action from `/apply` routes to `/auth/create-account`.
