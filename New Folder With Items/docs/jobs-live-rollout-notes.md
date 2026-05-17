# Jobs, Dispatch, Communications, Customers, Invoices, Revenue, Home, And Technicians Live Rollout Notes

This document records the current state after the first eight production-grade live workflow rollouts: Jobs first, then Dispatch, then Communications, then Customers, then Invoices, then Revenue, then Home, then Technicians. It also records the remaining gaps between the frontend model assumptions and the normalized Supabase schema.

## Live Jobs Read Path

- `src/pages/JobsPage.jsx` only talks to the repository contract.
- `src/lib/repositories/supabaseOperationsRepository.js` decides whether to use live Supabase reads or mock fallback.
- `src/integrations/supabase/queries/jobs.js` owns the page-focused Jobs queries:
  - list jobs
  - get job detail by `job_id`
  - get invoice rows for a job
  - get timeline rows for a job
- The live Jobs list query now hydrates customer, technician, primary-invoice candidate, communications, and timeline context into the same `JobRecord` shape used by mock mode.
- `src/integrations/supabase/queries/communications.js` owns the per-job communications query used during detail hydration.
- `src/integrations/supabase/adapters/jobs.js` is the hydrator boundary that maps relational rows into the frontend `JobRecord` shape.

## Live Jobs Mutation Path

- `src/lib/repositories/supabaseOperationsRepository.js` exposes the live Jobs mutation entry points:
  - `jobs.create(draft)`
  - `jobs.assignTechnician(jobId, draft)`
  - `jobs.updateWorkflow(jobId, patch)`
  - `jobTimeline.append(draft)`
- `src/integrations/supabase/mutations/jobs.js` executes real inserts and updates against `jobs`.
- `src/integrations/supabase/mutations/jobTimelineEvents.js` executes real inserts against `job_timeline_events`.
- `src/pages/JobsPage.jsx` now exposes a technician picker in the Job details panel and routes the existing `Assign tech` quick action into that live assignment flow.
- Missing Supabase credentials still return typed placeholder responses instead of breaking local development.
- Successful live Jobs writes clear the shared read-model cache and the focused Jobs caches so the next repository read rehydrates fresh data.

## Live Dispatch Read Path

- `src/pages/DispatchPage.jsx` only talks to `repository.getDispatchPageData()`.
- `src/lib/repositories/supabaseOperationsRepository.js` now hydrates Dispatch through focused live reads instead of `loadSupabaseReadModels()`.
- `src/integrations/supabase/queries/dispatch.js` now owns the focused Dispatch reads:
  - active dispatch-board jobs
  - active unassigned jobs
  - active late / escalated jobs
  - technician availability rows
- `src/integrations/supabase/queries/jobs.js` still provides the shared hydrated job select used by both Jobs and Dispatch.
- `src/integrations/supabase/adapters/jobs.js` remains the shared row-to-`JobRecord` hydrator, so Dispatch consumes the same live `JobRecord` shape as Jobs and mock mode.
- Dispatch board hydration now includes:
  - job core fields
  - customer context
  - assigned technician context
  - ETA / lateness / status context
  - primary-invoice candidate context
  - communication context
  - timeline context
- Missing credentials and live read failures still fall back to mock Dispatch data through the repository boundary.

## Live Dispatch Mutation Path

- `src/lib/repositories/supabaseOperationsRepository.js` now exposes a Dispatch-specific repository surface:
  - `dispatch.assignTechnician(jobId, draft)`
  - `dispatch.updateStatus(jobId, patch)`
  - `dispatch.updateEta(jobId, patch)`
  - `dispatch.escalateJob(jobId, draft)`
- Dispatch writes reuse the real `jobs` and `job_timeline_events` Supabase mutation modules rather than introducing a second write stack.
- `src/pages/DispatchPage.jsx` now exposes:
  - a technician assignment panel that writes through `dispatch.assignTechnician(...)`
  - an escalation panel that writes through `dispatch.escalateJob(...)`
  - both panels refresh the live board after successful writes
- `dispatch.escalateJob(...)` performs a real live job update and appends a real timeline event through the repository path.
- Missing Supabase credentials still return typed placeholder mutation responses instead of breaking mock-mode development.
- Successful live Dispatch writes also clear the shared read-model cache and the focused Jobs caches.

## Live Communications Read Path

- `src/pages/CommunicationsPage.jsx` only talks to `repository.getCommunicationsPageData()`.
- `src/lib/repositories/supabaseOperationsRepository.js` now hydrates Communications through focused live reads instead of `loadSupabaseReadModels()`.
- `src/integrations/supabase/queries/communications.js` now owns the focused Communications reads:
  - list hydrated communications feed rows
  - filter feed rows by direction, status, or channel
  - get hydrated communication detail by `communication_id`
  - get per-job communication rows for Jobs detail hydration
- `src/integrations/supabase/adapters/communications.js` is now the row-to-`CommunicationRecord` hydrator boundary for the Communications workflow.
- Communications feed hydration now includes:
  - communication core fields
  - required customer context
  - nullable linked job context
  - linked technician context through the nullable job relationship
  - nullable invoice context
- Missing credentials and live read failures still fall back to mock Communications data through the repository boundary.

## Live Communications Mutation Path

- `src/lib/repositories/supabaseOperationsRepository.js` now exposes a Communications-specific repository surface:
  - `communications.listFeed(filters?)`
  - `communications.getDetail(communicationId)`
  - `communications.createLog(draft)`
  - `communications.markReviewed(communicationId, draft?)`
  - `communications.updateStatus(communicationId, patch)`
  - `communications.attachToJob(communicationId, draft)`
- `src/integrations/supabase/mutations/communications.js` now executes real inserts and updates against `communications`.
- `src/pages/CommunicationsPage.jsx` now wires the existing page actions into the live repository path:
  - `Review unresolved`
  - `Approve`
  - `Reject`
  - `Attach to job`
- Communications follow-up timeline writes reuse the real `job_timeline_events` mutation module instead of introducing a parallel write stack.
- Missing Supabase credentials still return typed placeholder mutation responses instead of breaking mock-mode development.
- Successful live Communications writes also clear the shared read-model cache and the focused Jobs caches.
- `server/twilioWebhookServer.js` now provides the first production-safe Twilio intake boundary for inbound SMS and call-status callbacks without moving page-level data access out of the repository path.
- Unmatched inbound Twilio calls and texts now persist into `unmatched_inbound_communications` and can be resolved from the Communications page into a real `communications` row plus optional job attachment without inventing fake customers.

## Live Customers Read Path

- `src/pages/CustomersPage.jsx` now keeps page-level data access behind the repository boundary for both halves of the current UI:
  - `repository.getCustomersPageData()` for the directory list
  - `repository.customers.getProfile(customerId)` for selected detail
- `src/lib/repositories/supabaseOperationsRepository.js` now hydrates Customers through focused live reads instead of `loadSupabaseReadModels()`.
- `src/integrations/supabase/queries/customers.js` now owns the focused Customers reads:
  - list hydrated customer directory rows
  - get hydrated customer profile detail by `customer_id`
- `src/integrations/supabase/adapters/customers.js` is now the row-to-`CustomerRecord` hydrator boundary for the Customers workflow.
- Customers hydration now includes:
  - customer core fields
  - linked job context through the shared Jobs hydration path
  - customer communication rows
  - derived invoice balance context through `jobs -> invoices`
- Active customer job selection is still derived from open jobs because `customers.active_job_id` does not exist in the schema.
- Missing credentials and live read failures still fall back to mock Customers data through the repository boundary.

## Live Customer UI Write Path

- `src/pages/CustomersPage.jsx` now exposes:
  - a real add-customer form that calls `repository.customers.create(...)`
  - a real basic profile form that calls `repository.customers.update(...)`
- `src/lib/repositories/supabaseOperationsRepository.js` now routes customer create and update through real Supabase mutations instead of fallback-only placeholders.
- `src/integrations/supabase/mutations/customers.js` now executes:
  - real inserts into `customers`
  - real updates to mutable customer profile fields
- After a successful customer write, the repository clears focused runtime caches so refreshed directory and profile views rehydrate from live Supabase data.

## Live Invoices Read Path

- `src/pages/InvoicesPage.jsx` now keeps both invoice page reads behind the repository boundary:
  - `repository.getInvoicesPageData()` for the queue and summary cards
  - `repository.invoices.getDetail(invoiceId)` for the selected invoice record
- `src/lib/repositories/supabaseOperationsRepository.js` now hydrates Invoices through focused live reads instead of `loadSupabaseReadModels()`.
- `src/integrations/supabase/queries/invoices.js` now owns the focused Invoices reads:
  - list hydrated invoice rows for the collections queue
  - get hydrated invoice detail by `invoice_id`
- `src/integrations/supabase/adapters/invoices.js` is now the row-to-`InvoiceRecord` hydrator boundary for the Invoices workflow.
- Invoice hydration now includes:
  - invoice core fields
  - required owning job context
  - derived customer context through `invoices -> jobs -> customers`
  - nullable servicing technician context through `invoices.servicing_tech_id`
- `src/lib/repositories/mockOperationsRepository.js` now exposes `invoices.getDetail(invoiceId)` so mock mode and live mode share the same invoice list/detail contract.
- The Invoices page keeps the current layout and list-driven behavior; the selected invoice now hydrates separately through the repository without importing Supabase helpers or raw mock data into the page.
- Missing credentials and live read failures still fall back to mock Invoices data through the repository boundary.

## Live Invoices Mutation Path

- `src/lib/repositories/supabaseOperationsRepository.js` still exposes the invoice mutation entry points:
  - `invoices.createForJob(draft)`
  - `invoices.updatePaymentStatus(invoiceId, patch)`
- `src/integrations/supabase/mutations/invoices.js` executes real inserts and payment-state updates against `invoices`.
- Focused invoice list/detail caches are cleared after successful live mutations so refreshed invoice views rehydrate from Supabase.

## Live Revenue Read Path

- `src/pages/RevenuePage.jsx` still only talks to `repository.getRevenuePageData()`.
- `src/lib/repositories/supabaseOperationsRepository.js` now hydrates Revenue through focused live reads instead of `loadSupabaseReadModels()`.
- `src/integrations/supabase/queries/revenue.js` now records the composite Revenue page plan instead of the old broad snapshot placeholder.
- Revenue now reuses the established focused query stack instead of inventing a Revenue-only data shape:
  - `src/integrations/supabase/queries/invoices.js` for hydrated invoice rows
  - `src/integrations/supabase/queries/technicianPayouts.js` for hydrated payout rows
  - `src/integrations/supabase/adapters/invoices.js` for shared invoice hydration
  - `src/integrations/supabase/adapters/technicianPayouts.js` for payout record hydration
- The live Revenue page path is now:
  - `RevenuePage`
  - `getOperationsRepository()`
  - `repository.getRevenuePageData()`
  - `supabaseOperationsRepository.getRevenuePageData()`
  - `loadLiveInvoiceList(getSupabaseClient())`
  - `loadLiveTechnicianPayouts(getSupabaseClient())`
  - `buildRevenuePageData(...)`
- Revenue live hydration now includes:
  - invoice core fields
  - required owning job context through `invoices -> jobs`
  - derived customer context through `jobs -> customers`
  - nullable invoice technician context through `invoices.servicing_tech_id`
  - payout core fields
  - linked payout technician context through `technician_payouts.tech_id`
  - linked payout invoice IDs through `technician_payout_invoice_links`
- `src/lib/repositories/supabaseOperationsRepository.js` now also exposes focused live payout reads through `technicianPayouts.list()` instead of the broad snapshot path, so Revenue and any payout-ready views share the same live record shape.
- Missing credentials and live read failures still fall back to mock Revenue data through the repository boundary.

## Live Revenue Cache Behavior

- Revenue now reuses the focused invoice list cache introduced by the Invoices rollout and adds a focused payout list cache for live payout hydration.
- Successful live mutations continue clearing the shared read-model cache and the focused Jobs/Invoices caches, and now also clear the focused payout cache so Revenue will not keep stale payout readiness data after a real write succeeds elsewhere.

## Live Invoice UI Write Path

- `src/pages/InvoicesPage.jsx` now exposes:
  - a real create-invoice form that calls `repository.invoices.createForJob(...)`
  - a real selected-invoice payment update form that calls `repository.invoices.updatePaymentStatus(...)`
- `src/lib/repositories/supabaseOperationsRepository.js` now routes both invoice writes through real Supabase mutations instead of typed fallback placeholders.
- `src/integrations/supabase/mutations/invoices.js` now executes:
  - real inserts into `invoices`
  - real updates to invoice payment state
- After a successful invoice write, the repository clears focused runtime caches so refreshed collections views rehydrate from live Supabase data.

## Live Home Read Path

- `src/pages/HomePage.jsx` still only talks to `repository.getHomePageData()`.
- `src/lib/repositories/supabaseOperationsRepository.js` now hydrates Home through focused live reads instead of `loadSupabaseReadModels()`.
- `src/integrations/supabase/queries/home.js` now records a composite Home dashboard plan instead of the old broad snapshot-style placeholder.
- Home now reuses the existing focused live read stack rather than inventing a Home-only shape:
  - `src/integrations/supabase/queries/jobs.js` for hydrated job rows
  - `src/integrations/supabase/queries/communications.js` for the hydrated communication feed
  - `src/integrations/supabase/queries/invoices.js` for hydrated invoice rows
  - `src/integrations/supabase/queries/technicians.js` for technician rows
  - `src/lib/repositories/pageData.js` for the existing Home KPI, activity, queue, and watch-list assembly
- The live Home page path is now:
- `HomePage`
- `getOperationsRepository()`
- `repository.getHomePageData()`
- `supabaseOperationsRepository.getHomePageData()`
- `loadLiveHomeJobs(getSupabaseClient())`
- `loadLiveCommunicationFeed(getSupabaseClient())`
- `loadLiveInvoiceList(getSupabaseClient())`
- `loadLiveTechnicianRoster(getSupabaseClient())`
- `buildHomePageData(...)`
- Home live hydration now includes:
  - hydrated `JobRecord` rows with customer, technician, primary invoice candidate, communications, and timeline context
  - hydrated `CommunicationRecord` feed rows with customer, nullable job, technician-through-job, and nullable invoice context
  - hydrated `InvoiceRecord` rows with derived customer context through `jobs -> customers`
  - technician roster rows mapped from `technicians`
  - existing static hiring candidates still supplied by repository page assembly, unchanged
- Missing credentials and live read failures still fall back to mock Home data through the repository boundary.

## Live Technicians Read Path

- `src/pages/TechniciansPage.jsx` still only talks to `repository.getTechniciansPageData()`.
- `src/lib/repositories/supabaseOperationsRepository.js` now hydrates Technicians through the focused live technician roster path instead of `loadSupabaseReadModels()`.
- The focused live Technicians path reuses the existing technician query/mapping stack rather than inventing a Technicians-only data shape:
  - `src/integrations/supabase/queries/technicians.js` for roster rows from `technicians`
  - `src/integrations/supabase/mappers/technicians.js` for the shared row-to-frontend `Technician` mapping
  - `src/lib/repositories/pageData.js` for the existing `buildTechniciansPageData(...)` contract
- The live Technicians page path is now:
  - `TechniciansPage`
  - `getOperationsRepository()`
  - `repository.getTechniciansPageData()`
  - `supabaseOperationsRepository.getTechniciansPageData()`
  - `loadLiveTechnicianRoster(getSupabaseClient())`
  - `buildTechniciansPageData(...)`
- The shared technician repository surface now reuses the same focused roster loader for:
  - `repository.technicians.list()`
  - `repository.getDispatchPageData()`
  - `repository.getHomePageData()`
  - `repository.getTechniciansPageData()`
- Missing credentials and live read failures still fall back to mock Technicians data through the repository boundary.

## Verification Status

- `git diff --check` returned no output after the Technicians rollout.
  In this workspace, the changed files are currently untracked (`??` in `git status`), so `git diff --check` did not validate them as tracked diff hunks.
- `npx vite build --minify=false` completed successfully in an isolated run after the focused timeline cleanup.
- `npm run build` completed successfully in an isolated run after the focused timeline cleanup.
  Final visible output:
  - `✓ 148 modules transformed.`
  - `rendering chunks...`
  - `computing gzip size...`
  - `✓ built in 6m 46s`
- The current workspace build is unusually slow, so short wait windows can make it look hung even when the build is still progressing.

## What Still Uses The Broad Read-Model Path

- No current live repository reads still depend on the broad snapshot-style `loadSupabaseReadModels()` path after the focused Technicians and timeline cleanup.
- `repository.jobTimeline.listByJob()` now uses focused timeline queries for both per-job and all-events reads, while mock mode still uses the existing mock read-model assembly path.
- The unused live `src/integrations/supabase/readModels.js` snapshot loader has been removed. Mock mode still uses `buildOperationsReadModels(getMockDatabaseSnapshot())` so local fallback behavior remains unchanged.

## Remaining Jobs Model Mismatches

- The frontend `Job` model is still label-first.
  The live adapter formats `scheduledStartLabel`, `etaLabel`, and `latenessLabel` from canonical database fields instead of exposing raw timestamps directly to the page.
- The frontend still treats a job as having a single primary invoice in `job.invoice`.
  The database is correctly one-to-many on `invoices.job_id`, so the adapter currently derives a primary invoice record in repository code.
- The UI still displays `jobId` directly.
  In live Supabase mode that is now a UUID because the normalized schema does not yet have a human-friendly job number column.

## Derived Fields To Move Later

- Primary invoice selection should eventually move into a selector or SQL view once the business rules for “primary” are agreed.
- `scheduledStartLabel`, `etaLabel`, and `latenessLabel` should eventually be produced by shared selectors instead of living only inside row mappers.
- If the Jobs page starts rendering timeline or invoice summaries directly, those aggregates should come from shared selectors or a dedicated Supabase view rather than ad hoc page formatting.

## Mock-Only Assumptions Still Present

- Mock Jobs still use friendly IDs like `ASAP-1042` instead of UUIDs.
- Mock Jobs still assume one obvious invoice per job, which hides the live schema’s one-to-many invoice relationship.
- Mock timeline events still contain legacy frontend aliases like `quote_sent` and `availability_update`, which are translated into the constrained database enum during mapping.

## Remaining Dispatch Mismatches And Risks

- Dispatch still renders the label-first `JobRecord` shape, so `scheduledStartLabel`, `etaLabel`, and `latenessLabel` are still derived in mappers instead of shared selectors or SQL views.
- The Dispatch UI still groups `en_route` via the current hybrid rule of `dispatchStatus === group || lifecycleStatus === group`, which reflects frontend assumptions rather than an explicit backend dispatch-board view.
- The board still displays raw live UUID `jobId` values because the schema does not yet have a human-friendly job number column.
- Dispatch only hydrates a derived primary invoice into `job.invoice` even though the live schema is one-to-many on `invoices.job_id`.
- Technician availability is still a lightweight mapping of `technicians.status_today` and `availability_notes`; it is not yet a workload-aware SQL summary or route-capacity view.
- `dispatch.escalateJob(...)` performs a job update plus a timeline append as two live writes, so the path is real but not yet wrapped in a database transaction.

## Remaining Communications Mismatches And Risks

- The frontend `Communication` shape is still label-first for `occurredAtLabel` instead of exposing canonical timestamps directly to the page.
- The Communications page still renders one shared feed across logs, transcript preview, and extracted events rather than separate backend queues. That current UI contract was preserved intentionally.
- The Communications logs column still renders `linkedJobId` directly, so live Supabase mode will show raw UUIDs for attached jobs until the UI gets a human-friendly job reference.
- `communications.customer_id` is still required, so unknown inbound contacts still cannot enter the main communications feed until office staff explicitly link them to an existing customer through the triage queue.
- `communications.markReviewed(...)` and `communications.attachToJob(...)` can append timeline context as a second live write, so those paths are structured and real but not transactional.

## Remaining Customers Mismatches And Risks

- The frontend `Customer` shape still exposes label-first `lastContactLabel` instead of canonical timestamps directly to the page.
- The schema correctly removed `customers.active_job_id`, so the active job shown in the Customers UI is still a repository-derived selection over the customer’s open jobs.
- The selected customer detail panel now loads through `repository.customers.getProfile(customerId)`, but the left directory still intentionally carries enough aggregate state to preserve the existing UI without redesigning it.
- Customer creation and basic profile updates are now live Supabase writes when credentials are configured.

## Remaining Invoices Mismatches And Risks

- The frontend `Invoice` and `InvoiceRecord` shapes still expose label-first fields like date-only `issuedOn` and `dueOn` instead of canonical timestamps or invoice-number-first display objects.
- The UI still renders `invoiceId` and `jobId` directly, so live Supabase mode will show raw UUIDs in the current page until the product adds human-friendly invoice/job references.
- Customer context for invoice reads is still repository-derived through `invoices -> jobs -> customers` because the schema correctly does not include `invoices.customer_id`.
- The selected invoice now hydrates separately through `repository.invoices.getDetail(invoiceId)`, but the page intentionally keeps the existing table/right-column design instead of introducing a new detail panel.
- Invoice creation and payment-status updates are now live Supabase writes when credentials are configured.

## Remaining Revenue Mismatches And Risks

- The frontend Revenue page still renders the existing summary-card and weekly-bar UI without exposing canonical reporting objects; this rollout preserved the current page contract instead of redesigning the finance model.
- Revenue summary values are still derived from hydrated invoices in repository code, so the current label-first/date-first frontend assumptions remain intact.
- The schema’s `revenue_summary_daily` view remains available, but this rollout intentionally reused the existing invoice-driven Revenue page behavior instead of changing the page to depend on a new reporting view.
- Technician payout creation and payout-to-invoice linking now write to `technician_payouts` and `technician_payout_invoice_links` when credentials are configured.

## Remaining Home Mismatches And Risks

- The Home dashboard still derives its KPI cards, urgent queues, activity feed, and watch list in repository/page-data code instead of reading from a dedicated backend dashboard view. That behavior was preserved intentionally.
- Home activity feed ordering still follows the current frontend assembly behavior over hydrated job timeline items plus the shared communications feed; this rollout did not change that display logic.
- Hiring candidates on Home still come from the existing static mock dataset because there is no hiring schema in `supabase/migrations/20260416_000001_asap_operations_core.sql`.

## Remaining Technicians Mismatches And Risks

- The Technicians page still renders the existing roster and scorecard UI over the label-first frontend `Technician` model; this rollout preserved that page contract instead of redesigning technician reporting objects.
- Technician availability still comes directly from `technicians.status_today` plus `availability_notes`; this rollout did not introduce a workload-aware capacity or routing summary.
- The live Technicians page intentionally reuses the same focused roster rows already used by Dispatch and Home, so it still reflects the current schema-level scorecard fields rather than a dedicated backend scorecard view.

## Prompt Messages

One-line handoff prompt:

`Continue from the current ASAP Operations CRM state where Jobs, Dispatch, Communications, Customers, Invoices, Revenue, Home, and Technicians are focused live workflows with safe mock fallback; if more snapshot-path cleanup is needed, audit remaining non-page repository utilities without changing the current UI or business logic.`

Full next-session prompt:

`Use the current ASAP Operations CRM codebase and continue from the exact state reached after the Jobs, Dispatch, Communications, Customers, Invoices, Revenue, Home, and Technicians live rollouts. The app supports async repository reads, has a real Supabase client path, uses safe mock fallback behavior, and pages load data asynchronously instead of assuming synchronous local reads. Keep all of that intact. Jobs, Dispatch, Communications, Customers, Invoices, and technician payout writes now use live Supabase mutations when credentials are configured, while mock mode remains the default and safe local fallback path. If you continue cleanup work, audit remaining non-page broad snapshot utilities such as repository-level all-timeline reads without redesigning pages or silently changing business logic.`
