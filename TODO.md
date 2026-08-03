# TODO

List of pending activities for the Property Investment Calculator.
Mark with `[x]` when complete. This numbering is independent of the git
commit history — it's just a stable ID for each item, which you can
optionally reuse in the commit message when you implement it.

## ✅ Completed

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

- [x] **TODO-3: Numeric inputs for the money values**
  All 12 money fields now use `src/components/NumberSliderField.jsx`: a number
  box (the source of truth, accepts any exact figure) paired with a slider over
  a typical range whose bounds are labelled. This unblocks large purchases — a
  $3,000,000 property was previously impossible, since the price slider capped
  at $800k and the deposit at $400k. Three input bugs were fixed alongside it:
  the deposit could exceed the price (producing a negative loan and a negative
  monthly payment), a zero loan amount printed `NaN`/`Infinity` in the progress
  bar and the offset summary, and clearing a field snapped it to 0 because
  `Number('')` is 0. Note the loan itself stays derived rather than editable —
  see TODO-13 for making it an input in its own right.

- [x] **TODO-6: Interest rate with fine-grained decimals (e.g. 5.85%)**
  Done as part of TODO-3. The rate is now a number field accepting 2 decimals,
  and its slider uses `step={0.01}` from a base of 3, so the 5.38 default sits
  exactly on the grid instead of jumping to 5.4 on the first drag. Its `min` is
  deliberately `0.1`, never 0: a 0% rate makes `calculateMonthlyPayment` divide
  0 by 0 and turns every figure on the page into `NaN`.

- [x] **TODO-7: Handle the "loan never pays off" case in the Timeline Explorer**
  Fixed during TODO-3, which made it trivially reachable: any large property
  price wipes out the monthly surplus, and the simulation's sentinel return was
  missing the `months` key that the normal path always includes, so the timeline
  rendered `max={undefined}`, `Middle (NaN)` and `End (undefined)`. The sentinel
  now returns `months: maxMonths`, and the Timeline Explorer shows an
  explanatory message instead of an empty scrubber whenever there's no
  month-by-month data — distinguishing "no loan at all" from "nothing going into
  the offset yet".

- [x] **TODO-11: Model the upfront cost of buying (NSW)**
  Added `src/calculations/stampDuty.js` (NSW 2026-27 progressive tiers +
  First Home Buyer concession, linearly tapered between $800k-$1M), `lmi.js`
  (LVR-banded estimate, triggered above 80%), `closingCosts.js` (9 editable
  line items with NSW-average defaults, ~$4,750 subtotal), and
  `totalCashRequired.js` (combines deposit + stamp duty + closing costs, with
  LMI only counted if the user opts to pay it upfront instead of financing it
  into the loan). New "Upfront Costs (NSW)" card in both panels: a First Home
  Buyer checkbox, a "Total Savings Available" field, and a collapsible closing
  costs breakdown on the input side; a Stamp Duty / LMI / Closing Costs /
  Total Cash Required / Cash Remaining summary (red when negative, reusing
  `getBalanceColor`/`getBalanceBgColor`) on the results side. Verified against
  the worked example ($900k FHB purchase, $250k deposit → $274,344 total cash
  required, $45,657 remaining from $320k savings) and the $500k/90% LVR LMI
  case ($12,375 estimate) directly in the browser.

---

## 🔴 HIGH PRIORITY (User-facing impact or blockers)

- [ ] **TODO-16: Externalize config defaults** ⭐ START HERE
  Right now, all default values are hardcoded in `src/App.jsx:34-72`: property
  price ($500k), down payment ($250k), interest rate (5.38%), all expenses, and
  income. Anyone downloading the app has to edit the code to change them. Create
  a `config.default.json` (or `.js`) in the repo root with all these values,
  load it at startup, and allow an optional user-provided `config.local.json`
  (git-ignored) to override them. This unblocks non-developers from using the
  app and lets teams share calculation presets. **Values to externalize:**
  `propertyPrice`, `downPayment`, `interestRate`, `strataFees`, `utilities`,
  `councilRates`, `insurance`, `fortnightlyIncome`, `foodExpenses`,
  `transportExpenses`, `otherExpenses`, `newTenantRent`, `newContribAmount`,
  `newExpAmount`, `isFirstHomeBuyer`, `totalSavings`, `conveyancing`,
  `buildingInspection`, `pestInspection`, `registrationFees`, `searches`,
  `loanEstablishmentFee`, `propertyValuation`, `homeInsurance`,
  `rateAdjustments` (the last 10 added by TODO-11).

- [ ] **TODO-4: Rental income by date range (optional)**
  Today each tenant's rental income is a fixed weekly amount applied across
  the whole timeline (`tenants`, `calculateWeeklyRentalIncome` in
  `src/calculations/loan.js`). Allow an optional start/end month per tenant
  (similar to the pattern already used in `exceptExpenses` with
  `startMonth`/`endMonth`, `src/App.jsx:217-218`). If no range is specified,
  it should apply to the entire timeline (current behavior).

- [ ] **TODO-5: Property expenses and personal expenses by date range (optional)**
  Same concept as TODO-4, applied to property expenses and
  personal expenses (currently fixed monthly/weekly values with no dates).
  Reuse the same optional month-range pattern.

---

## 🟡 MEDIUM PRIORITY (Important, but not blocking)

- [ ] **TODO-12: Link savings, deposit and offset**
  `downPayment` and `offsetContributions` are independent pieces of state with
  no cross-validation, so you can set a $250k deposit *and* a $250k month-1
  offset contribution — spending the same money twice with no warning. Deciding
  how to split a given pot of savings between deposit and offset is arguably
  the core question this calculator should answer, and right now it can't even
  detect the contradiction. TODO-11 added `totalSavings` as a standalone input
  (used only for the "Cash Remaining" figure) but did **not** solve this — there
  is still no cross-check between `totalSavings`, `downPayment` and
  `offsetContributions`, so the double-counting warning remains to be built.

- [ ] **TODO-15: Configurable loan term**
  `TOTAL_MONTHS = 30 * 12` (`src/calculations/loan.js:1`) is hardcoded and feeds
  the mortgage payment formula, the amortization loop's `maxMonths` cap, and the
  no-offset baseline used in the savings card. Making it a
  `NumberSliderField` (e.g. 1-30 years) means every one of those call sites
  needs the term passed through explicitly instead of relying on the default
  parameter, and the "30 years standard" / "30-year mortgage" wording sprinkled
  through the UI and README would need to reflect the chosen term instead.

- [ ] **TODO-13: Editable loan amount**
  `Loan` is still a read-only derived value
  (`loanAmount = propertyPrice - downPayment`). Making it directly editable
  means deciding what gives when the user types into it — presumably the
  deposit recalculates — and keeping the three fields consistent in every
  direction.

---

## 🟢 LOW PRIORITY (Polish, refactoring, cleanup)

- [ ] **TODO-14: Small display and input leftovers**
  - "Net Property Monthly Balance" renders a negative as `$-642/month` instead
    of `-$642/month` (`src/App.jsx:924`, from PCALC-2); every other figure in
    the app uses the `-$X` form.
  - The two remaining bare `type="number"` inputs (`newContribAmount`, and
    `newExpAmount` which has no `min`/`max`/`step` at all) still snap to 0 when
    cleared — they could reuse `NumberSliderField` in a number-only mode.
  - `NumberSliderField` itself has no component tests; React Testing Library is
    not installed, so its draft/commit typing behaviour is currently covered
    only through the pure helpers plus manual verification.

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
