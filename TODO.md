# TODO

List of pending activities for the Property Investment Calculator.
Mark with `[x]` when complete. This numbering is independent of the git
commit history — it's just a stable ID for each item, which you can
optionally reuse in the commit message when you implement it.

- [x] **TODO-1: Add unit tests**
  Added Vitest and extracted the pure financial calculations (loan amount,
  monthly payment, net balance — including the PCALC-6 fix — and the
  amortization/offset loop) into `src/calculations/`, each with its own test
  file. Scope was limited to the financial calculations; the Timeline
  Explorer and form validations were left as new items below.

- [x] **TODO-2: Fix inconsistent / hardcoded interest figures**
  Two pre-existing bugs found while auditing every interest number in the UI.
  (a) "Interest Amount (monthly)" in the Property Balance panel ignored the
  recurring monthly surplus deposited to offset, so it showed $1,121 while the
  Timeline Explorer showed $1,103 for the same month. It now reads the real
  month-1 value from the simulation. (b) The "Savings vs no offset" card
  hardcoded a $272,000 baseline — wrong by ~$18k even for the default loan, and
  never updated when the loan changed. It's now derived via
  `calculateNoOffsetTotalInterest`. Also removed dead locals (lint is now clean)
  and corrected README claims about features that don't exist.

- [ ] **TODO-3: Numeric inputs for Property Price, Down Payment and Loan**
  Currently `Property Price` and `Down Payment` can only be adjusted with
  sliders (`src/App.jsx:255-282`), and `Loan` is a read-only derived value
  (`loanAmount = calculateLoanAmount(propertyPrice, downPayment)`,
  `src/calculations/loan.js`, displayed at `src/App.jsx:282`). Add the
  ability to enter these values directly as numbers (in addition to the
  slider, or replacing it). Define how they recalculate each other when the
  user edits `Loan` instead of `Down Payment`.

- [ ] **TODO-4: Rental income by date range (optional)**
  Today each tenant's rental income is a fixed weekly amount applied across
  the whole timeline (`tenants`, `calculateWeeklyRentalIncome` in
  `src/calculations/loan.js`). Allow an optional start/end month per tenant
  (similar to the pattern already used in `exceptExpenses` with
  `startMonth`/`endMonth`, `src/App.jsx:217-218`). If no range is specified,
  it should apply to the entire timeline (current behavior).

- [ ] **TODO-5: Property expenses and personal expenses by date range (optional)**
  Same concept as the previous item, applied to property expenses and
  personal expenses (currently fixed monthly/weekly values with no dates).
  Reuse the same optional month-range pattern.

- [ ] **TODO-6: Interest rate with fine-grained decimals (e.g. 5.85%)**
  The interest rate slider uses `step="0.1"` (`src/App.jsx:294`), which
  doesn't allow values like 5.85%. Switch to a numeric input (or
  `step="0.01"`) that accepts 2 decimals.

- [ ] **TODO-7: Handle the "loan never pays off" case in the Timeline Explorer**
  When there's no monthly surplus and no scheduled contributions,
  `calculateLoanWithOffset` returns `{years, totalInterest, monthlyData}`
  **without `months`**, while the normal path does include it. The Timeline
  Explorer isn't gated on that case, so it renders `max={undefined}` on the
  slider (`src/App.jsx:1116`), `Middle (NaN)` (`:1123`) and `End (undefined)`
  (`:1124`). Needs a product decision on what the UI should show when the loan
  never pays off, then a consistent return shape from the simulation.

- [ ] **TODO-8: Extract and test the Timeline Explorer snapshot**
  Left out of scope of the tests work (TODO-1): the logic starting at
  `src/App.jsx:1093` (month-by-month snapshot, `effectiveProgress`,
  classifying each exceptional expense's status as future/active/past)
  still lives inline in JSX, not extracted to `src/calculations/`.

- [ ] **TODO-9: Extract and test form validations**
  Also left out of scope: the validation predicates inside
  `addOffsetContribution` (`src/App.jsx:149`) and `addExceptionalExpense`
  (`src/App.jsx:195`) — duplicate month, start > end, required fields — are
  mixed in with `setState` calls and aren't independently testable yet.

- [ ] **TODO-10: Decide the fate of uncalled functions in `src/calculations/loan.js`**
  `getMonth1Offset`, `calculateInitialPrincipal`,
  `calculateMonthlyPropertyBalance` and `calculateWeeklyPropertyBalance` no
  longer have callers after TODO-2. They're tested and correct, so they were
  left in place rather than widening a bug-fix diff — decide whether the module
  should be a general formula library or contain only what the app uses.
