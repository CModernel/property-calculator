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

- [ ] **TODO-2: Numeric inputs for Property Price, Down Payment and Loan**
  Currently `Property Price` and `Down Payment` can only be adjusted with
  sliders (`src/App.jsx:255-282`), and `Loan` is a read-only derived value
  (`loanAmount = calculateLoanAmount(propertyPrice, downPayment)`,
  `src/calculations/loan.js`, displayed at `src/App.jsx:282`). Add the
  ability to enter these values directly as numbers (in addition to the
  slider, or replacing it). Define how they recalculate each other when the
  user edits `Loan` instead of `Down Payment`.

- [ ] **TODO-3: Rental income by date range (optional)**
  Today each tenant's rental income is a fixed weekly amount applied across
  the whole timeline (`tenants`, `calculateWeeklyRentalIncome` in
  `src/calculations/loan.js`). Allow an optional start/end month per tenant
  (similar to the pattern already used in `exceptExpenses` with
  `startMonth`/`endMonth`, `src/App.jsx:217-218`). If no range is specified,
  it should apply to the entire timeline (current behavior).

- [ ] **TODO-4: Property expenses and personal expenses by date range (optional)**
  Same concept as the previous item, applied to property expenses and
  personal expenses (currently fixed monthly/weekly values with no dates).
  Reuse the same optional month-range pattern.

- [ ] **TODO-5: Interest rate with fine-grained decimals (e.g. 5.85%)**
  The interest rate slider uses `step="0.1"` (`src/App.jsx:291`), which
  doesn't allow values like 5.85%. Switch to a numeric input (or
  `step="0.01"`) that accepts 2 decimals.

- [ ] **TODO-6: Extract and test the Timeline Explorer snapshot**
  Left out of scope of the tests work (TODO-1): the logic starting at
  `src/App.jsx:1097` (month-by-month snapshot, `effectiveProgress`,
  classifying each exceptional expense's status as future/active/past)
  still lives inline in JSX, not extracted to `src/calculations/`.

- [ ] **TODO-7: Extract and test form validations**
  Also left out of scope: the validation predicates inside
  `addOffsetContribution` (`src/App.jsx:149`) and `addExceptionalExpense`
  (`src/App.jsx:195`) — duplicate month, start > end, required fields — are
  mixed in with `setState` calls and aren't independently testable yet.
