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

  **Update:** tenant ranges originally required both `startMonth` and
  `endMonth` together, but real scenarios are often open-ended (e.g. "starts
  renting after year 1, ongoing indefinitely"). `isMonthInRange` now treats
  each bound independently (`null` = unbounded in that direction) instead of
  treating any single missing bound as "no restriction at all" - this also
  fixed a real bug in the Timeline Explorer's status classification, which
  compared `timelineMonth > t.endMonth` directly and would coerce a `null`
  endMonth to `0`, marking an ongoing tenant as "(Done)" almost immediately.
  The "Add Tenant" form now has an independent "Has an end date?" checkbox
  (default unchecked = ongoing) instead of requiring both bounds whenever
  "Limited period?" is on. The form also now pre-fills from config
  (`newTenantRent: 600`, `newTenantStartMonth: 13`) to match the common
  "rent out a room starting after year 1" scenario, without auto-adding
  anything - the user still confirms with "Add Tenant".

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

- [x] **TODO-15: Configurable loan term**
  No calculation logic needed to change - `calculateMonthlyPayment` and
  `calculateNoOffsetTotalInterest` (`src/calculations/loan.js`) already take
  `totalMonths` as a generic parameter (with `= TOTAL_MONTHS` only as a
  fallback default), and their tests already exercise other terms via that
  same parameter, so this was mostly wiring: a new "Loan Term" `NumberSliderField`
  (1-30 years) in the Property & Loan card, `totalMonths = loanTermYears * 12`
  replacing the `TOTAL_MONTHS` constant, and a new `loanTermYears` key in
  `config.default.json`. The investigation surfaced one real bug worth
  fixing along the way: both `calculateLoanWithOffset` call sites omitted
  `maxMonths` entirely, silently falling back to its own independent
  `30 * 12` default - so a 15-year term would've correctly raised the
  monthly payment while leaving the amortization loop capped at 360 months
  regardless. Now `maxMonths: totalMonths` is passed explicitly at both call
  sites. Also fixed the one hardcoded UI string ("Without offset (30
  years)") to interpolate the chosen term, and updated 3 README mentions of
  a fixed 30-year term. Verified in the browser: dropping to 15 years raised
  Monthly Payment from $3,301 to $4,620 and the savings card correctly read
  "Without offset (15 years)"; returning to 30 restored the exact original
  numbers.

- [x] **TODO-17: Make it mobile responsive**
  Found 3 bare `grid-cols-2` sections with no mobile fallback (tenant
  Start/End Month, offset contribution "At Month"/"Amount", exceptional
  expense Start/End Month) - all now `grid-cols-1 sm:grid-cols-2` (or plain
  `space-y-2` for the tenant one, since it also gained a new "Has an end
  date?" checkbox as part of the tenant open-ended-range work, making a
  stacked layout the natural fit anyway). Audited the rest of the file for
  fixed pixel widths, tables, and `nowrap` that could force horizontal
  scroll on a phone - none found. **Caveat worth flagging:** this session's
  browser automation couldn't actually shrink the viewport below ~980px
  (the `resize_window` tool reported success but the real window never went
  under that - confirmed via `window.innerWidth`, and CSS `zoom` doesn't
  affect Tailwind's media-query breakpoints either), so true sub-640px
  behavior was verified by code review against Tailwind's fixed breakpoints
  and the same `sm:`/`md:` mobile-first pattern already proven correct
  elsewhere in this file (e.g. `src/App.jsx`'s existing `md:grid-cols-2`),
  not by looking at a real phone-width render. Worth a follow-up pass with
  actual device/DevTools emulation if that becomes available.

- [x] **TODO-13: Editable loan amount**
  `loanAmount` stays a purely derived value (`calculateLoanAmount`, unchanged)
  rather than becoming a third independent `useState` - a new
  `handleLoanAmountChange` handler just translates an edit into a new
  `downPayment` (`setDownPayment(propertyPrice - clampToRange(nextLoanAmount,
  0, propertyPrice))`), reusing the same `clampToRange` pattern as
  `handleDownPaymentChange`. This means the invariant `loanAmount =
  propertyPrice - downPayment` can never drift, and all ~13 existing
  read-sites of `loanAmount` (LVR, LMI, monthly payment, both simulations,
  the Timeline Explorer snapshot, the ownership progress bar) needed zero
  changes. New "Loan Amount" `NumberSliderField` added right after Down
  Payment, with a "Deposit: $X (Y% of price)" caption mirroring Down
  Payment's existing "Loan: $X (Y% LVR)" one. `handlePropertyPriceChange`
  was intentionally left untouched (still anchors on keeping the deposit
  fixed when price changes) - only the new edit direction was added, per
  the TODO's own scope. Verified in the browser: typing $400,000 into Loan
  Amount (on an $850,000 property) correctly set Down Payment to $450,000;
  the $0 and full-price extremes both worked with no `NaN`; dropping
  Property Price below the current loan amount correctly re-clamped without
  going negative.

- [x] **TODO-20: Collapse Property Expenses, Rental Income, and Personal Expenses like the Closing Costs breakdown**
  Reused the exact `showClosingCostsBreakdown` pattern (TODO-11) three more
  times: a `text-sm font-medium text-blue-600` button reading `{▾/▸} <label>
  (subtotal: $X)`, collapsed by default (`useState(false)`), with the fields
  only rendered when expanded. Property Expenses and Personal Expenses each
  had their standalone subtotal box (`Property Subtotal: $X/month`, `Total
  Personal Expenses: $X/week`) removed, since the toggle button now shows the
  same figure - matching Closing Costs, which never had a separate subtotal
  box either. Rental Income's "Tenants" header, "+ Add" form, and list all
  moved inside the new collapse (previously always visible), and its old
  standalone "Total Weekly Rent: $X" box was removed the same way. Personal
  Expenses' collapse only wraps the Food/Transport/Other fields - Fortnightly
  Income and the already-independently-toggled Offset Contributions Schedule
  and Exceptional Expenses sub-sections were left untouched. Verified in the
  browser: all three render collapsed by default with the correct subtotal in
  the link text, expand/collapse correctly, and none of the untouched
  sibling sections (Fortnightly Income, Offset Contributions, Exceptional
  Expenses) were affected.

- [x] **TODO-18: Strata fees should only apply to units/apartments**
  Added a `propertyType` ('house' | 'unit') toggle right under Property Price
  in the Property & Loan card. Rather than clearing `strataFeesField`'s
  stored value when "house" is selected, strata is zeroed at the
  **calculation level** in both places it matters - the static "now" value
  (`const strataFees = propertyType === 'house' ? 0 : getSteppedValue(...)`)
  and the simulation's `expenseFields.strataFees` (swapped for `{ base: 0,
  changes: [] }` when propertyType is 'house') - and the Strata
  `SteppedExpenseField` itself is hidden from the Property Expenses
  breakdown for houses. This means switching back to "unit" restores
  whatever the user had typed before, since nothing is destructively reset.
  A small `handlePropertyTypeChange` bumps `strataFeesField.base` from $0 to
  a sensible $1,000 default the first time a user switches to "unit" (so
  they're not staring at a $0 field), but only if it's still at the
  as-shipped $0 - it won't clobber a value they've already set. Verified in
  the browser: "House" (default) shows "No strata..." and $0 everywhere;
  switching to "Unit / Apartment" revealed Strata pre-filled at $1,000 and
  correctly raised Total Monthly Expenses by $250/month; switching back to
  "House" hid the field again and restored the exact original numbers.

---

## 🟡 MEDIUM PRIORITY (Important, but not blocking)

- [ ] **TODO-21: Save scenarios to the browser (localStorage)**
  Requested directly by the user. Right now every value resets to
  `config.default.json` (optionally overridden by `config.local.json` at
  build time - TODO-16) on every page load; there's no way to save a
  session's inputs and come back to them later. Needs a design pass before
  implementing (**"Analizar bien las opciones"**, per the user's own
  framing) - at minimum: what triggers a save (explicit "Save" button vs.
  autosave on every change - autosave is probably friendlier, but needs
  debouncing so it isn't writing to `localStorage` on every keystroke);
  what gets saved (all ~30 inputs including `tenants`/`exceptExpenses`/
  `offsetContributions` arrays, or just the scalar fields); versioning
  (what happens if a future release adds/renames a field - a saved blob
  from an older version could crash a naive `JSON.parse` + spread onto
  state); and multiple scenarios vs. a single autosaved slot (the existing
  README roadmap already lists "Save scenarios to browser" as a future
  idea, so there may be an implied expectation of *multiple* named saves,
  not just one). **Explicit requirement from the user:** if saved data
  exists in the browser, it should replace `config.default.json` (and
  presumably `config.local.json`, whichever wins today) as the source of
  initial state - i.e. the precedence becomes saved-in-browser >
  `config.local.json` > `config.default.json`, not just "load defaults,
  then overwrite from storage" after the fact, since the latter could
  flash default values before the saved ones apply.

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
