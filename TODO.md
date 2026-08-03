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

- [x] **TODO-16: Externalize config defaults**
  Added `config.default.json` at the repo root with all 24 previously-hardcoded
  default values (property, expenses, income, and the NSW upfront-cost fields
  from TODO-11). `src/App.jsx` imports it and merges in an optional, git-ignored
  `config.local.json` via `import.meta.glob('../config.local.json', { eager:
  true })`, which resolves to an empty object rather than a build error when
  the file doesn't exist - no runtime fetch or fallback branching needed.
  Verified end-to-end: created a `config.local.json` overriding `propertyPrice`
  and `isFirstHomeBuyer`, rebuilt, and confirmed both the bundled JS and the
  running app reflected the override; removed the file afterwards so the repo
  defaults ship normally.

- [x] **TODO-4: Tenant rental income by date range (optional)** (reduced scope: tenants only)
  Added `src/calculations/dateRange.js` (`isMonthInRange`, null bounds = always
  active) and gave each tenant an optional `startMonth`/`endMonth`, using the
  same shape already established by `exceptExpenses`. The harder part was
  `offsetSimulation.js`: rental income used to be collapsed into the constant
  `monthlyToOffset` *before* the loop ran, which can't work once a tenant's
  income depends on the month - it's now computed **inside** the loop instead
  (mirroring how `exceptExpenses` already works), with `monthlyToOffset`
  redefined to mean "surplus excluding tenant rent". Verified this doesn't
  regress the existing 12 tests: for `y >= 0`, `max(0, max(0,x)-y) ==
  max(0,x-y)`, so with the default `tenants: []` the new math is provably
  identical to the old one. Also fixed a latent bug this surfaced: the
  sentinel short-circuit only checked the base surplus, so a tenant whose rent
  alone would produce a real surplus used to get masked by the "999 years"
  placeholder - it now requires `tenants.length === 0` too. The static summary
  cards (Property Balance, Property Summary) show tenants active "right now"
  (month 1), matching how `exceptExpenses` already don't affect those cards;
  the Timeline Explorer's Income Context panel got the same future/active/past
  classification `exceptExpenses` already has. **Scope note:** property and
  personal expenses (strata, utilities, council, insurance, food, transport,
  other) were deliberately left out - unlike tenants and exceptExpenses,
  they're flat scalars with no array behind them, so date-ranging them means
  converting each into an editable list first. Split into its own TODO below
  if it's ever needed.

- [x] **TODO-12: Link savings, deposit and offset**
  Added `calculateCashRemaining({ totalSavings, totalCashRequired,
  totalScheduledOffset })` to `src/calculations/totalCashRequired.js`, which
  `cashRemaining` in `App.jsx` now uses instead of the old plain
  `totalSavings - totalCashRequired` subtraction. Scope was deliberately kept
  to **detecting and surfacing** the contradiction (what the TODO actually
  asked for), not building an allocator that decides how to split savings.
  The "Upfront Costs (NSW)" card gets a new conditional "Scheduled Offset
  Contributions" line (only shown when non-zero, to avoid cluttering the
  common no-contributions case) and a red warning banner under Cash Remaining
  when it goes negative. No input is blocked - a shortfall is still a valid,
  visible scenario, same as everywhere else in the app. Verified in the
  browser: baseline (no contributions) unchanged; scheduling a $100,000
  month-1 contribution against $350k savings correctly dropped Cash Remaining
  to -$71,547 and surfaced the warning.

- [x] **TODO-19: Property and personal expenses with scheduled rate changes**
  Different semantics than tenants/exceptExpenses on purpose: a scheduled
  change here **replaces** the value from its start month onward (e.g.
  "council rates go from $450 to $2,000 starting month 15"), it doesn't stack
  like tenants do - stacking a temporary extra charge was already possible via
  Exceptional Expenses, so that case didn't need new plumbing. Added
  `getSteppedValue(base, changes, month)` (`src/calculations/steppedValue.js`)
  and the project's first custom hook, `useSteppedValue`
  (`src/hooks/useSteppedValue.js`), used once for each of the 7 fields
  (`strataFees`, `utilities`, `councilRates`, `insurance`, `foodExpenses`,
  `transportExpenses`, `otherExpenses`) instead of 7 bespoke implementations.
  A new `SteppedExpenseField` component wraps the existing
  `NumberSliderField` with a collapsed-by-default "+ Schedule a change" link.
  Same architectural move as TODO-4: `offsetSimulation.js` gets an optional
  `expenseFields` param (`null` by default, so all 16 existing tests are
  unaffected) and now resolves each field's effective value **per month**
  inside the loop rather than from a pre-collapsed constant; `baseMonthlySurplus`
  in `App.jsx` was widened to exclude all 7 fields (not just tenant rent).
  Verified in the browser: scheduled a council rates change ($450→$2,000/qtr
  from month 15) and confirmed the offset's monthly growth rate dropped from
  exactly $2,433.50/mo (months 11-12, pre-change) to exactly $2,046/mo
  (months 19-20, post-change) - a $387.50/mo difference, matching
  `(2000-450)/4` exactly.

---

## 🟡 MEDIUM PRIORITY (Important, but not blocking)

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

- [ ] **TODO-17: Make it mobile responsive**
  The top-level layout already collapses to one column below `lg`
  (`grid-cols-1 lg:grid-cols-3`, `src/App.jsx:317`), but several inner
  sections don't: the rental option cards and the two "add contribution" /
  "add exceptional expense" forms use a bare `grid-cols-2`
  (`src/App.jsx:644`, `:768`, `:984`) with no `grid-cols-1` mobile fallback,
  so those controls get cramped on narrow phone screens instead of stacking.
  Needs a pass across the whole page on an actual small viewport (not just
  resizing a desktop browser window) to catch anything else that doesn't
  reflow - tap target sizes on the sliders/number inputs, and the Timeline
  Explorer scrubber are worth checking too. The README's Roadmap already
  claims "Responsive design" as done, which should be corrected either way
  once this is scoped.

- [ ] **TODO-18: Strata fees should only apply to units/apartments**
  `strataFees` is currently just a generic slider with no concept of property
  type, but strata only exists for units/apartments/townhouses on a shared
  title - a standalone house has no strata at all (its default is now $0,
  see `config.default.json`). Add a "Property Type" input (house vs
  unit/apartment) and hide or zero out the strata field when "house" is
  selected, so the UI itself makes the invalid combination impossible instead
  of relying on the user to remember to set it to $0.

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
