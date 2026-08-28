macbook@macbooks-MacBook-Pro-2 recruitment-portal-foundation (1) % tree
.
├── client
│   ├── index.html
│   ├── public
│   │   └── __manus__
│   │       ├── debug-collector.js
│   │       └── version.json
│   └── src
│       ├── App.tsx
│       ├── components
│       │   ├── ErrorBoundary.tsx
│       │   ├── ManusDialog.tsx
│       │   ├── Map.tsx
│       │   ├── admin
│       │   │   ├── AdminShell.tsx
│       │   │   ├── CandidateCvEvidenceTab.tsx
│       │   │   ├── RoleCvCriteriaTab.tsx
│       │   │   ├── V2EvaluationFrameworkTab.tsx
│       │   │   └── V2ModifierPanel.tsx
│       │   ├── application
│       │   │   ├── ApplicantEligibilityGuard.tsx
│       │   │   ├── ApplicationShell.tsx
│       │   │   └── RoleEligibilitySection.tsx
│       │   ├── auth
│       │   │   └── AuthLayout.tsx
│       │   ├── foundation
│       │   │   ├── navigation.tsx
│       │   │   ├── portal-shell.tsx
│       │   │   └── ui.tsx
│       │   └── ui
│       │       ├── accordion.tsx
│       │       ├── alert-dialog.tsx
│       │       ├── alert.tsx
│       │       ├── aspect-ratio.tsx
│       │       ├── avatar.tsx
│       │       ├── badge.tsx
│       │       ├── breadcrumb.tsx
│       │       ├── button-group.tsx
│       │       ├── button.tsx
│       │       ├── calendar.tsx
│       │       ├── card.tsx
│       │       ├── carousel.tsx
│       │       ├── chart.tsx
│       │       ├── checkbox.tsx
│       │       ├── collapsible.tsx
│       │       ├── command.tsx
│       │       ├── context-menu.tsx
│       │       ├── dialog.tsx
│       │       ├── drawer.tsx
│       │       ├── dropdown-menu.tsx
│       │       ├── empty.tsx
│       │       ├── field.tsx
│       │       ├── form.tsx
│       │       ├── hover-card.tsx
│       │       ├── input-group.tsx
│       │       ├── input-otp.tsx
│       │       ├── input.tsx
│       │       ├── item.tsx
│       │       ├── kbd.tsx
│       │       ├── label.tsx
│       │       ├── menubar.tsx
│       │       ├── navigation-menu.tsx
│       │       ├── pagination.tsx
│       │       ├── popover.tsx
│       │       ├── progress.tsx
│       │       ├── radio-group.tsx
│       │       ├── resizable.tsx
│       │       ├── scroll-area.tsx
│       │       ├── select.tsx
│       │       ├── separator.tsx
│       │       ├── sheet.tsx
│       │       ├── sidebar.tsx
│       │       ├── skeleton.tsx
│       │       ├── slider.tsx
│       │       ├── sonner.tsx
│       │       ├── spinner.tsx
│       │       ├── switch.tsx
│       │       ├── table.tsx
│       │       ├── tabs.tsx
│       │       ├── textarea.tsx
│       │       ├── toggle-group.tsx
│       │       ├── toggle.tsx
│       │       └── tooltip.tsx
│       ├── const.ts
│       ├── contexts
│       │   └── ThemeContext.tsx
│       ├── hooks
│       │   ├── useComposition.ts
│       │   ├── useMobile.tsx
│       │   └── usePersistFn.ts
│       ├── index.css
│       ├── lib
│       │   ├── adminAssessmentData.ts
│       │   ├── adminMockData.ts
│       │   ├── adminRoleData.ts
│       │   ├── adminSession.ts
│       │   ├── applicationData.ts
│       │   ├── assessmentData.ts
│       │   ├── assessmentPreviewData.test.ts
│       │   ├── assessmentPreviewData.ts
│       │   ├── assessmentQuestionContent.ts
│       │   ├── assessmentScoring.ts
│       │   ├── candidateCvEvidenceData.ts
│       │   ├── cvEvidenceScoring.ts
│       │   ├── eligibilityData.test.ts
│       │   ├── eligibilityData.ts
│       │   ├── frameworkQuestionData.ts
│       │   ├── overallFitScoring.ts
│       │   ├── questionBankData.test.ts
│       │   ├── questionBankData.ts
│       │   ├── roleCvCriteriaData.ts
│       │   ├── screeningData.test.ts
│       │   ├── screeningData.ts
│       │   ├── submissionData.ts
│       │   ├── utils.ts
│       │   ├── v2BaseScoring.test.ts
│       │   ├── v2BaseScoring.ts
│       │   ├── v2EvaluationFramework.test.ts
│       │   ├── v2EvaluationFramework.ts
│       │   ├── v2ModifierScoring.test.ts
│       │   └── v2ModifierScoring.ts
│       ├── main.tsx
│       └── pages
│           ├── AdminApplications.tsx
│           ├── AdminAssessmentBuilder.tsx
│           ├── AdminAssessmentDetail.tsx
│           ├── AdminAssessmentPreview.tsx
│           ├── AdminAssessments.tsx
│           ├── AdminCandidatePlaceholder.tsx
│           ├── AdminDashboard.tsx
│           ├── AdminLogin.tsx
│           ├── AdminPlaceholder.tsx
│           ├── AdminQuestionBank.tsx
│           ├── AdminQuestionDetail.tsx
│           ├── AdminQuestionForm.tsx
│           ├── AdminQuestionNewPlaceholder.tsx
│           ├── AdminRoleDetail.tsx
│           ├── AdminRoleForm.tsx
│           ├── AdminRoles.tsx
│           ├── AdminScreening.tsx
│           ├── ApplicantAssessmentComplete.tsx
│           ├── ApplicantAssessmentPlaceholder.tsx
│           ├── ApplicantAssessmentQuestionsPlaceholder.tsx
│           ├── ApplicantCvPlaceholder.tsx
│           ├── ApplicantEligibilityCloseout.tsx
│           ├── ApplicantInformation.tsx
│           ├── ApplicantReviewPlaceholder.tsx
│           ├── ApplicantSubmitted.tsx
│           ├── Apply.tsx
│           ├── Auth.tsx
│           ├── AuthCreateAccount.tsx
│           ├── AuthForgotPassword.tsx
│           ├── AuthSignIn.tsx
│           ├── Home.tsx
│           ├── NotFound.tsx
│           ├── Portal.tsx
│           └── UiKit.tsx
├── components.json
├── dist
│   └── index.js
├── drizzle
│   ├── migrations
│   │   ├── 0000_big_luminals.sql
│   │   └── meta
│   │       ├── 0000_snapshot.json
│   │       └── _journal.json
│   ├── relations.ts
│   └── schema.ts
├── drizzle.config.ts
├── ideas.md
├── package.json
├── patches
│   └── wouter@3.7.1.patch
├── pnpm-lock.yaml
├── scripts
│   ├── generate-task24a-seed.ts
│   └── seed-task24a.ts
├── server
│   ├── db.ts
│   ├── index.ts
│   └── task24a.database.test.ts
├── shared
│   └── const.ts
├── task-23b2-framework-notes.md
├── task-23c2-browser-verification.md
├── task-23c3-browser-verification.md
├── template.json
├── todo.md
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── vitest.config.ts

23 directories, 169 files




<!-- ADMIN_PASSWORD='123456789123' npx tsx scripts/provision-task24b-admin.ts -->



npm run dev


npm run dev:server