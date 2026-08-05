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

- [x] **TODO-21: Save scenarios to the browser (localStorage)**
  Explicit "Save" button (not autosave) backing a single saved slot (not
  multiple named scenarios) - both decided with the user upfront to keep
  this simple. `src/persistence/scenarioStorage.js` separates the pure,
  tested `parseScenarioPayload`/`serializeScenarioPayload` (versioned
  envelope - a version mismatch or corrupt JSON discards to `null` rather
  than attempting a migration) from thin `loadScenario`/`saveScenario`/
  `clearScenario` wrappers around `localStorage`, verified manually since
  the test environment has no DOM. `useSteppedValue` gained an optional
  `initialChanges` parameter so a saved scenario's scheduled rate changes
  seed each of the 7 `SteppedExpenseField`s, not just their base values.
  **Precedence, per the user's explicit requirement:** a saved-in-browser
  scenario now replaces the config chain outright -
  `{...defaultConfig, ...localConfig, ...savedScenario}` computed once at
  module load (same synchronous pattern TODO-16 established), so there's no
  flash of default values before the saved ones apply. A new bar under the
  header shows "This scenario is saved in your browser." / "Your inputs
  aren't saved yet..." with **Save** and (when a scenario exists) **Reset
  to defaults** buttons; Reset clears storage and reloads the page rather
  than manually resetting ~24 pieces of state. Only the ~24 "data" fields
  are saved (prices, rates, tenants, exceptional expenses, offset
  contributions, scheduled changes) - ephemeral UI state (collapsed
  sections, in-progress "Add" form drafts, the Timeline Explorer's selected
  month) is deliberately left out. Verified in the browser: changed
  Property Price and scheduled a Council Rates change, saved, reloaded, and
  confirmed both restored exactly (including the scheduled change altering
  the simulation, not just the static display); Reset to defaults (tested
  by clearing storage directly, since the confirm() dialog it's built on
  can't safely be automated) correctly reverted everything to
  `config.default.json` on reload.

- [x] **TODO-22: Show last-saved date/time, next to the Save bar**
  Requested by the user right after TODO-21 shipped, along with a look at
  the "Reset to defaults" button (it was plain gray text with no icon).
  `savedAt` (`Date.now()`) travels as just another field inside the scenario
  payload itself - no changes needed to `scenarioStorage.js`'s save/load/
  parse functions, since it's opaque data to them either way. A new
  `lastSavedAt` state (seeded from `savedScenario?.savedAt` at load, updated
  by `handleSaveScenario`) renders as "Saved 4 Aug 2026, 09:41"
  (`toLocaleString` with `dateStyle: 'medium', timeStyle: 'short'`) in place
  of the old static "This scenario is saved..." copy; a scenario saved
  before this shipped (no `savedAt` yet) falls back to that original static
  copy instead of showing a bogus Jan 1 1970 date. The Reset button also
  picked up a `RotateCcw` icon (lucide-react, already a project dependency)
  next to its label for a more intuitive "undo" affordance. Verified in the
  browser: saved and confirmed the timestamp appeared and read correctly,
  reloaded and confirmed it persisted unchanged.

- [x] **TODO-23: LVR risk indicator - colored symbol + hover tooltip table**
  Requested by the user, with the exact 6-band classification table
  (95-100% 🔴 Muy riesgoso through <60% 🔵 Excelente) given verbatim.
  `src/calculations/classifyLvr.js` holds `LVR_BANDS` (ordered highest-LVR
  first, each with an inclusive lower `min`) as the single source of truth
  for both the classification logic and the tooltip's row data - `classifyLvr`
  is just `LVR_BANDS.find(band => lvr >= band.min)`, so the tooltip can
  highlight the current row via reference equality without re-deriving
  thresholds. New `LvrBadge` component (`src/components/LvrBadge.jsx`) is
  fully hand-rolled with Tailwind `group`/`group-focus-within` (no
  `useState`, no new dependency - the project has no tooltip/popover
  library) - `group-focus-within` gets keyboard accessibility for free.
  Placed next to "LMI (estimate, X% LVR)" in the results panel (per the
  user's choice, keeping the diff to one call site rather than also
  touching the Property & Loan card's Down Payment caption). One fix during
  manual verification: the tooltip's initial `left-0` anchor clipped off
  the right edge of the viewport since the badge sits in the narrow results
  column - switched to `right-0` so it grows leftward instead. Verified in
  the browser at every band boundary (100%, 95%, 94%, down to 0%), each
  showing the correct badge color and highlighting the correct table row -
  confirmed the 80% exact boundary shows "Aceptable" (orange) even though
  the pre-existing "Pay LMI upfront" checkbox stays hidden until `lvr > 80`
  (a documented, expected divergence, not a bug).
  - **Update:** the user replaced the 6-band Spanish table with a 5-band
    English one (the two top red bands, 90-95% and 95-100%, collapsed into
    a single `>90%`), and added an intro line above the table: "The lower
    the LVR, the lower the risk and the greater the borrowing flexibility."
    `LVR_BANDS` now carries one `summary` string per band (e.g. "High risk,
    low equity") instead of separate `label`/`note` fields; column headers
    simplified to "LVR" / "Summary". Boundaries unchanged other than
    merging 90 and 95 into one `min: 90` band. Tests and the tooltip were
    updated to match; re-verified in the browser.

- [x] **TODO-24: Make "Your Personal Expenses (Weekly)" fully collapsible, like Property Expenses/Rental Income**
  Requested by the user; scope question resolved by asking directly -
  chose "everything behind one toggle" over keeping Fortnightly Income
  always visible, matching the Property Expenses/Rental Income pattern
  exactly. The pre-existing inner toggle from TODO-20
  (`showPersonalExpenses`, previously only wrapping the Food/Transport/
  Other `SteppedExpenseField`s) was repurposed to wrap the entire card
  instead: the toggle button moved to right after the `<h2>`, and
  everything from "Fortnightly Income" through the "Exceptional Expenses"
  sub-card now sits inside the same `{showPersonalExpenses && (...)}`
  block - no new state needed. Verified in the browser: collapsed by
  default (consistent with the other cards), expanding shows Fortnightly
  Income, Offset Contributions Schedule, the 3 expense fields, and
  Exceptional Expenses all together, and collapsing hides all of it again
  cleanly.

- [x] **TODO-25: Title change + financial-advice disclaimer**
  Requested by the user, for legal-safety reasons. Title changed to "NSW
  Property Investment Cash Flow Calculator" (NSW moved to the front, per
  the user's choice among 3 preview options) - the app already hardcodes
  NSW-specific stamp duty/LMI/closing-cost rules, so this makes the scope
  explicit instead of reading as general-purpose. Added a small always-
  visible amber disclaimer box (`bg-amber-50`/`border-amber-200`/
  `text-amber-800` - amber rather than the `yellow` "Exceptional Expenses"
  already uses, so the two don't get visually confused) between the header
  and the Save bar: "⚠️ Personal project for illustrative purposes only —
  not financial advice. Always consult a licensed financial adviser before
  making property decisions." Chose always-visible over a hover-tooltip
  variant (also offered as an option) since legal-safety text shouldn't be
  hidden by default. No new state/logic - pure text + a static Tailwind
  card. Verified in the browser (title and disclaimer both render
  correctly, don't overlap the Save bar) and re-ran the Spanish-text sweep
  from TODO-23 to confirm the new copy is 100% English.

- [x] **TODO-14: Small display and input leftovers**
  - Fixed the sign bug: "Net Property Monthly Balance" now reads
    `-$642/month` instead of `$-642/month` (`src/App.jsx:1501`) - the `$`
    literal was sitting before the minus sign `.toLocaleString()` generates
    for negative numbers. Matched the existing correct convention used for
    `cashRemaining` (`src/App.jsx:1472`): compute the sign as an explicit
    branch *before* the `$`, and use `Math.abs` so `.toLocaleString()` never
    contributes its own sign.
  - `NumberSliderField` gained an optional `hideSlider` prop (default
    `false`, fully backward-compatible) that skips rendering the range
    input and its min/max labels, keeping only the label/value display and
    the number input with its draft/commit "don't snap to 0 when cleared"
    behavior. `newContribAmount` (Offset Contributions) and `newExpAmount`
    (Exceptional Expenses) - previously bare `<input type="number">`s that
    reset to 0 on an empty field - now both use `NumberSliderField` with
    `hideSlider`, gaining the fix for free instead of duplicating the
    draft/commit logic.
  - **Decision on component tests** (made with the user): did not install
    React Testing Library/jsdom to test `NumberSliderField`'s draft/commit
    state machine. No other interactive component in the project
    (`SteppedExpenseField`, the tenant/exceptional-expense forms, etc.) has
    component tests either - all are verified manually - so adding new
    testing infrastructure for just this one component would break that
    consistency for a single-component's marginal benefit. The underlying
    pure helpers (`parseNumberInput.js`, `clampToRange.js`) remain
    unit-tested; the state-machine orchestration itself stays covered by
    manual verification, as it always has been.
  - Verified in the browser: forced a negative "Net Property Monthly
    Balance" and confirmed `-$X/month` renders correctly; cleared both
    "Amount ($)" fields (Offset Contributions and Exceptional Expenses)
    with the field focused and confirmed neither snaps to 0 on blur, and
    neither renders a slider underneath.

- [x] **TODO-27: Reorganize "Property & Loan" into "Purchase Details" + "Financial Position", rename fields**
  Requested by the user, with reasoning worth preserving: Down Payment
  isn't useless, but it represents a *decision* ("how much cash do I put
  in vs. keep liquid?"), separate from Total Savings Available, which
  represents *capacity* ("how much money do I have?") - worth keeping for
  a purchase-decision calculator, just not as the first/primary input.
  The single "Property & Loan" card was split into two:
  - **"Purchase Details"** ("what are you buying?"): Property Type, First
    Home Buyer, Property Price, **Deposit Contribution** (renamed from
    "Down Payment"), Loan Amount - resolving the open question from when
    this was queued, the user placed Property Type/First Home Buyer here
    too, alongside the property/loan-structure inputs.
  - **"Financial Position"** ("can you afford it and how will you manage
    it?"): **Available Savings** (renamed from "Total Savings Available"),
    Interest Rate, Loan Term, and the **Repayments** summary box (renamed
    from "Monthly Payment") - Interest Rate/Loan Term moved here from
    Purchase Details per the user's explicit split, since they're about
    the financing arrangement rather than the property itself. New
    `Wallet` icon (lucide-react) for this card's header.
  Renamed consistently everywhere the labels appeared, not just the input
  cards: "Repayments" (both the input card's summary box and the results
  panel's "Loan Information" box), "Available Savings" and "Remaining
  Savings" (renamed from "Cash Remaining") in the results panel's "Upfront
  Costs (NSW)" box. Pure text/JSX reorganization - no state, calculation,
  or prop renames (`downPayment`/`setDownPayment`/`totalSavings`/
  `monthlyPayment`/`cashRemaining` etc. all unchanged), so the diff is
  fully contained to labels and card boundaries. Verified in the browser:
  "Purchase Details" shows Property Type → First Home Buyer → Property
  Price → Deposit Contribution → Loan Amount in that order; "Financial
  Position" shows Available Savings → Interest Rate → Loan Term →
  Repayments; the results panel shows Available Savings, Total Cash
  Required, Remaining Savings, LVR (via the TODO-23 badge), and Repayments
  all correctly labeled.

- [x] **TODO-28: Add the LVR risk badge/tooltip to the Deposit Contribution caption too**
  Requested by the user - the "Deposit Contribution" field's caption
  ("Loan: $543,000 (63.9% LVR)") got the same `<LvrBadge lvr={lvr} />` the
  "LMI (estimate, X% LVR)" line already had from TODO-23, which had
  deliberately deferred this second call site to limit that diff. Trivial
  wiring, but it surfaced a real positioning bug: `LvrBadge`'s tooltip was
  hardcoded `right-0` (anchored to grow leftward), which worked in the
  narrow results-panel column it was designed in, but clipped off the
  *left* edge of the viewport here, since this caption sits near the left
  edge of the much wider left-panel column. Fixed by centering the tooltip
  under the badge instead (`left-1/2 -translate-x-1/2` in
  `src/components/LvrBadge.jsx`, replacing the `right-0` anchor) - robust
  in both narrow and wide containers instead of assuming one specific
  layout. Verified in the browser: hovering the badge at both call sites
  now shows the full, unclipped tooltip.

- [x] **TODO-26 (Phase 1): Generalize personal income into multiple sources**
  Requested by the user, scoped to Phase 1 with the user directly: only
  personal income was generalized this pass - tenants/"Rental Income" stay
  as their own separate concept for now (see TODO-29 for the deferred
  merge). Confirmed income was never hardcoded - `fortnightlyIncome` was a
  real, editable `useState` - the actual gap was the single-scalar model.
  The single `fortnightlyIncome` scalar was replaced by `incomeSources`, a
  list of named entries (`{id, name, amount, type: 'one-time' |
  'recurring', month, recurrence: 'forever' | 'period', startMonth,
  endMonth}`) - **the exact same shape Exceptional Expenses already used**,
  reused directly rather than inventing a new one. **Cadence switched to
  weekly** (per the user's preference, matching Sydney/NSW convention and
  Rental Income's existing cadence) - `amount` is now $/week everywhere,
  with month/year views still derived.
  - New shared pure function `getActiveAmount(items, month)`
    (`src/calculations/recurringAmount.js` + tests) resolves any one-time/
    forever/period item for a given month - extracted so Exceptional
    Expenses' inline per-month loop in `offsetSimulation.js` and the new
    Income Sources both use the same logic instead of duplicating it. This
    also fixed a real inconsistency: expenses previously checked date
    ranges with raw `months >= start && months <= end` instead of
    `isMonthInRange` (harmless in practice since expenses always set both
    bounds, but a divergence nonetheless) - now both paths share one
    implementation.
  - Personal income moved **inside** the simulation loop (`offsetSimulation.js`),
    resolved per month exactly like tenant rent and exceptional expenses,
    instead of being pre-collapsed into `baseMonthlySurplus` before the
    loop starts - required for a one-time or date-ranged income source to
    actually affect the simulation. `calculateWeeklyIncome`/
    `calculateMonthlyIncome` (which converted *from* fortnightly) were
    removed as dead code and replaced by a generic `calculateMonthlyFromWeekly`.
  - New "Income" card (`src/App.jsx`), placed before "Rental Income",
    mirroring Exceptional Expenses' add-form/list UI (name, weekly amount,
    one-time-vs-recurring, forever-vs-period) with its own collapsible
    toggle (TODO-24/20 pattern). The Timeline Explorer's "Financial Events
    Log" was also extended to show income sources' active/future/past
    status alongside tenants, for parity.
  - `SCHEMA_VERSION` bumped 1→2 in `scenarioStorage.js` so old saved
    scenarios (built around the removed `fortnightlyIncome` field) are
    cleanly discarded on load rather than silently merged into the new
    shape - verified in the browser with a real leftover v1 scenario.
  - Verified in the browser: default $1,614/week "Salary" entry produces
    identical results to the pre-refactor $3,228/fortnight default (same
    10.8-year payoff), confirming the migration preserves existing
    behavior; added a one-time $500 income at month 31 and confirmed the
    simulation reacted (129 months, interest dropped from $198,712 to
    $197,291); Financial Events Log correctly showed "Tax Refund (Done)"
    past month 31; save/reload round-tripped `incomeSources` correctly.

- [x] **TODO-31: Unify One-Time/Recurring/Forever/Period into a single "Schedule" model**
  Requested by the user, applied to both Income Sources and Exceptional
  Expenses (decided together with the user upfront). The insight: these
  weren't different types, they were all one concept - a vigency rule -
  modeled the way Google Calendar models recurring events, adapted for
  this app's month-granular (1-360) simulation (no Daily/Weekly/Fortnightly
  recurrence, since the sim doesn't run at that resolution):
  ```
  Schedule
  ├── Start Month (required, default 1)
  ├── Recurrence: None | Monthly | Quarterly | Yearly (Custom interval left out for now)
  └── End Month (only when recurrence != None; endMonth === 360 displays as "Forever")
  ```
  Replaced `{type: 'one-time'|'recurring', month, recurrence:
  'forever'|'period', startMonth, endMonth}` with a single `{startMonth,
  recurrence: 'none'|'monthly'|'quarterly'|'yearly', endMonth}` shape used
  by both `incomeSources` and `exceptExpenses`. `getActiveAmount`'s public
  signature was untouched, so `offsetSimulation.js`'s two call sites needed
  **zero changes** - only its internal `isScheduleActive` logic changed,
  now interval-aware (`monthly`/`quarterly`/`yearly` check `(month -
  startMonth) % interval === 0`) instead of "every month in range". This is
  a genuine new capability, not just a simplification: a quarterly bill or
  annual bonus can now be modeled natively, which the old "period"
  recurrence (active *every* month in range) couldn't express at all.
  New `formatScheduleLabel(schedule)` (`src/calculations/recurringAmount.js`)
  replaces the duplicated ternary that used to live in both Income's and
  Exceptional Expenses' list rendering.
  **UI**: the old One-Time/Recurring button pair became a single "One-Time"
  checkbox (default unchecked = recurring); the old Forever/Specific-Period
  button pair disappeared entirely - just one Start Month slider (always
  shown) and one End Month slider (shown when not one-time, labelled
  "Forever" at its max value of 360 instead of the number, per the user's
  own suggestion) plus a Monthly/Quarterly/Yearly selector. Income Sources
  additionally got a Name picklist (Salary/Freelance/Bonus/Other+custom)
  resolving the other half of the now-superseded TODO-30 - "Rental Income"
  was deliberately left out of the preset list per the user's own choice,
  reserved for when TODO-29 actually merges tenants in.
  `SCHEMA_VERSION` bumped 2→3 (`scenarioStorage.js`) so scenarios saved
  under the old shape are cleanly discarded rather than merged into the
  new one. Verified in the browser: the default "Salary" entry still
  produces the same 10.8-year payoff (equivalent to the old "Forever"
  encoded as `endMonth: 360`); added a Quarterly income and confirmed the
  label ("Quarterly, months 1-132") and subtotal math were correct; the
  One-Time checkbox correctly swapped between "Start Month" and "Occurs at
  Month" wording on both forms; saved a scenario and confirmed
  `version: 3` with the new shape in `localStorage`.

- [x] **TODO-33: Redesign "Shared Room" tenants as per-person income**
  Requested by the user. A tenant used to be `{type: 'single'|'shared',
  amount}` where `amount` was the *total* weekly rent for the room -
  `shared` only *displayed* `amount / 2` as an annotation, always assuming
  exactly 2 people. Replaced with `{isShared, numPeople, amountPerPerson,
  amount}`, where `amount` (`amountPerPerson * numPeople`) is now computed
  at add-time rather than entered directly - `calculateWeeklyRentalIncome`
  (`src/calculations/loan.js`) needed **zero changes**, since it just sums
  `amount` and never knew about `type` in the first place.
  UI: the Individual/Shared Room button pair became a single "Shared room?"
  checkbox (default unchecked); checking it reveals a "Number of People"
  slider (2-6) and relabels the amount field "Weekly Rent per Person",
  showing a live "Total: $X/week" preview. Default per-person amount set
  to **$300** (config.default.json: `newTenantRent` →
  `newTenantAmountPerPerson`), per the user's own Sydney-average framing -
  applies to both shared and individual rooms now (individual is just
  `numPeople: 1`). List display and the Timeline Explorer's tenant status
  line both updated to show `(N × $X each)` instead of the hardcoded ÷2.
  `SCHEMA_VERSION` bumped 3→4, discarding old-shape saved tenants cleanly.
  Verified in the browser: added a 3-person shared room at $300/person,
  confirmed the "Total: $900/week" preview matched the saved entry
  ("Shared Room, $900/week (3 × $300 each)"), the loan simulation reacted
  (6.2 years, down from 10.8), and the Timeline Explorer's Financial Events
  Log showed "Shared (3 × $300)" once past the tenant's start month.

- [x] **TODO-29 (Phase 2): Merge tenants/"Rental Income" into the unified Income model**
  Deferred from TODO-26, whose Phase 1 only generalized personal income.
  The user also asked to reconsider the "Tenants" name ("suena raro") -
  offered Lodgers/Boarders/Room Rentals as alternatives, but the user's
  explicit call was **"Dejalo como Tenants"** - name unchanged, only the
  data model merged. The separate `tenants` array/state, the "Rental
  Income" card, and `addTenant`/`removeTenant` were all removed entirely;
  a tenant is now just an `incomeSources` entry with a `'Tenants'` category
  plus extra `isShared`/`numPeople`/`amountPerPerson` fields (`amount =
  amountPerPerson * numPeople`, computed at add-time, unchanged from
  TODO-33) - `isShared !== undefined` is the criterion used everywhere to
  tell a Tenants entry apart from any other income category. Per the
  user's choice, the "Rental Income" subtotal stays **separate** in the
  results panel and Timeline Explorer, now derived by filtering the single
  `incomeSources` array (`isShared !== undefined`) instead of reading a
  second array - `weeklyIncome`/`weeklyRentalIncome` are simply two
  partitions of the same list.
  `src/calculations/offsetSimulation.js` lost the `tenants` parameter and
  its `isMonthInRange`-based resolution block entirely - `getActiveAmount`
  over the unified `incomeSources` already includes former-tenant entries,
  so the loop's income handling collapsed to one line instead of two. The
  sentinel condition dropped `tenants.length === 0` (redundant with
  `incomeSources.length === 0`). `calculateWeeklyRentalIncome`/
  `calculateMonthlyRentalIncome` (`src/calculations/loan.js`) became fully
  unused and were deleted along with their tests, since
  `calculateMonthlyFromWeekly` already does the same job generically; with
  `tenants` gone, `isMonthInRange` had no callers left anywhere in `src/`,
  so `src/calculations/dateRange.js` + its test were deleted too rather
  than left as dead code. The Timeline Explorer's "Financial Events Log"
  merged its separate `tenants.map`/`incomeSources.map` loops into one,
  using the same active/future/past classification for every entry.
  `SCHEMA_VERSION` bumped 4→5 (`scenarioStorage.js`), discarding old-shape
  saved scenarios (which had a top-level `tenants` field) cleanly.
  Verified in the browser: confirmed the "Rental Income" card no longer
  exists; added a 3-person shared Tenants entry ($300/person) through the
  "Income" card's "+ Add" form and confirmed it appears in the same list
  as "Salary" with the "Shared Room ... (3 × $300 each)" label; confirmed
  "Monthly Rental Income: +$3,900" still shows as its own line, separate
  from "Total Personal Income"; confirmed the Loan Simulation reacted
  (5.6 years, down from 10.8 with just Salary); the Timeline Explorer's
  merged Financial Events Log showed "Tenants Active: 1" and "• Shared (3
  × $300)" alongside "• Salary" once past month 0; saved a scenario and
  confirmed `version: 5` in `localStorage` with no `tenants` field, and
  the Tenants entry living inside `incomeSources`; reloaded the page and
  confirmed the restored scenario matched exactly.

- [x] **TODO-32: Apply the Schedule model to Offset Contributions**
  Requested by the user, following up on TODO-31 - asked whether the
  unified `Schedule` model should extend to other income/expense-like
  fields. `offsetContributions` entries switched from `{id, month, amount}`
  (always a single one-time lump sum) to the same Schedule shape as
  Income Sources/Exceptional Expenses: `{id, amount, startMonth,
  recurrence: 'none'|'monthly'|'quarterly'|'yearly', endMonth}` - a
  contribution can now recur (e.g. "$500 every quarter") instead of only
  ever being one lump sum. Contributions default to **One-Time** in the
  add form (unlike Income/Expenses, which default to recurring) to
  preserve the pre-TODO-32 behavior where every existing contribution was
  a single lump sum - recurring is opt-in via the same One-Time checkbox/
  Start Month/Monthly-Quarterly-Yearly/End Month controls already used
  elsewhere. `offsetSimulation.js`'s contribution-application logic
  collapsed from a `forEach` matching `contrib.month === months` to a
  single `offsetBalance += getActiveAmount(contributions, months)` -
  `getActiveAmount` already handled this shape for Income/Expenses, so no
  new resolution logic was needed there.
  **Design question resolved with the user**: should a recurring
  contribution's *total* commitment (all future occurrences) subtract from
  `cashRemaining` the same way a one-time lump sum already does? The
  user's call: **no** - `calculateTotalScheduledOffset`
  (`src/calculations/loan.js`) now only sums `recurrence === 'none'`
  contributions, since a recurring contribution is naturally funded by
  future cash flow (like the automatic monthly surplus already deposited
  into the offset), not a chunk of today's savings sitting in the bank -
  summing a "$500/quarter forever" contribution's full 30-year total
  against savings-on-hand today would be unrealistic. The UI makes this
  split explicit rather than silently under-counting: "One-Time
  Contributions Total" (renamed from "Total Scheduled Offset") plus a
  "Plus N recurring contribution(s) - ... not counted in this total or in
  Cash Remaining below" note; the Loan Simulation card's summary line
  similarly split into "N one-time payment(s) totaling $X" and "N
  recurring contribution(s)" instead of one now-inaccurate "N lump sum
  payments" line.
  New `countOccurrencesUpTo(schedule, month)` in
  `src/calculations/recurringAmount.js` (+ tests) powers the Timeline
  Explorer's "Offset History (Cumulative)" column, which needed a running
  total of how many times a recurring contribution has fired by the
  viewed month, not just an active/inactive check - replaces the old
  "list every one-time contribution whose month has passed" with
  "`formatScheduleLabel` + cumulative $ contributed so far" for every
  entry, one-time or recurring. `getNextSuggestion`
  (`src/calculations/suggestions.js`) updated to read `.startMonth`
  instead of the removed `.month` field.
  `SCHEMA_VERSION` bumped 5→6 (`scenarioStorage.js`), discarding old-shape
  saved scenarios (`{month, amount}` contributions) cleanly.
  Verified in the browser: added a $500 quarterly contribution (Forever)
  alongside the default Salary income, confirmed "One-Time Contributions
  Total: $0" with "Plus 1 recurring contribution..." shown correctly (not
  silently omitted), confirmed Remaining Savings was unaffected by the
  recurring contribution, confirmed Loan Simulation reacted (10.4 years,
  down from 10.8 with no contributions); jumped the Timeline Explorer to
  month 73 and confirmed "Offset History" showed "Quarterly, from month
  1: +$12,500" (25 quarterly occurrences × $500, matching
  `countOccurrencesUpTo`'s math exactly); saved a scenario and confirmed
  `version: 6` in `localStorage` with the new Schedule-shaped
  `offsetContributions` entry, and reloaded to confirm the restored
  scenario matched exactly.

- [x] **TODO-34: Expand Income Name to a full 15-type picklist, with a smart default Schedule per type**
  Requested by the user. Two open questions were resolved with the user
  before implementing: (1) **"Rental Income" dropped from the list
  entirely** (14 types, not 15) - `'Tenants'` (TODO-29) already covers
  both a shared room and a whole property let to one tenant
  (`isShared: false, numPeople: 1`), so a separate "Rental Income"
  category would only create ambiguity about which to pick; (2)
  **Dividends defaults to Quarterly** rather than adding a 5th
  "Half-Yearly" recurrence to the model - a reasonable approximation the
  user can override by hand, not worth the extra surface area across the
  three forms (Income/Expenses/Offset Contributions) that all show the
  same Monthly/Quarterly/Yearly buttons.
  Replaced the hardcoded Salary/Freelance/Bonus/Tenants/Other `<option>`s
  (`src/App.jsx`) with a `.map()` over a new `INCOME_CATEGORIES` list (14
  types + Tenants + Other) in `src/calculations/incomeCategories.js` (+
  test): Salary/Wages, Self-Employment, Freelance/Contracting, Business
  Income, Dividends, Interest, Government Benefits, Pension, Child
  Support, Bonus, Commission, Tax Refund, Gift, Tenants, Other. A sibling
  `INCOME_CATEGORY_DEFAULTS` lookup maps each category to its default
  Schedule (`{oneTime, recurrence, endMonth}`), applied by a new
  `handleIncomeCategoryChange` handler on the `<select>`'s `onChange` -
  Salary/Wages, Self-Employment, Business Income, Interest, Government
  Benefits, Pension, and Commission default to Monthly/Forever;
  Freelance/Contracting, Bonus, Tax Refund, and Gift default to One-Time;
  Dividends defaults to Quarterly/Forever. **Child Support is deliberately
  left out of the `endMonth` default** - it's the one recurring category
  with no universal sensible end date (until a set age, a custody change,
  etc.), so switching to it sets `oneTime: false`/`recurrence: 'monthly'`
  but leaves whatever End Month value is already on the slider untouched,
  rather than special-casing the UI to hide/reset that field. Categories
  not listed in the defaults map (`Tenants`, `Other`) keep whatever
  Schedule fields the form already has - manually toggling One-Time/
  Recurrence/End Month after picking a category still works exactly as
  before, since the defaults are just an initial nudge, not a lock.
  No `SCHEMA_VERSION` bump needed - `incomeSources` entries keep the exact
  same shape as before (`name` is still just a string), only the picklist
  offering more name choices and better form-defaults changed.
  Verified in the browser: confirmed all 14 categories + Tenants + Other
  appear in the dropdown; selecting "Bonus" auto-checked One-Time and
  showed "Occurs at Month: 1"; selecting "Dividends" auto-unchecked
  One-Time, selected "Quarterly", and set "End Month: Forever"; dragged
  End Month down to 131 while on Dividends, then switched to "Child
  Support" and confirmed it flipped to Monthly/not-one-time while **End
  Month stayed at 131** (not reset to Forever); added that Child Support
  entry and confirmed the list showed "$500/week • Monthly, months
  1-131" with the loan simulation reacting correctly.

- [x] **TODO-35: Add Maintenance & Repairs + Water Rates to Property Expenses; gate Land Tax/Property Management behind an investment-property toggle**
  Requested by the user. Two decisions resolved with the user before
  implementing: (1) **FHB/investment interaction scope: minimal** - the
  new `isInvestmentProperty` flag only gates Land Tax/Property Management;
  it does NOT touch `isFirstHomeBuyer`/`calculateStampDuty`, even though in
  NSW the FHB concession really requires occupying the property - that
  interaction is a known, deliberately deferred gap (see TODO-38); (2)
  **Property Management modeled as a flat monthly `SteppedExpenseField`**
  (like Utilities/Insurance), not a % of rental income - keeps it
  decoupled from `incomeSources`/Tenants and the simulation loop.
  **Maintenance & Repairs** (monthly) and **Water Rates** (quarterly, with
  the same "≈ $X/month" helper Strata/Council already show) were added as
  2 more always-visible `SteppedExpenseField`s in the "Property Expenses"
  card - Water Rates has no toggle of its own; like Strata already does
  for houses, it just defaults to $0 when it doesn't apply (e.g. the
  tenant pays it), no new control needed for that.
  **Land Tax** (yearly - NSW land tax is assessed annually, so it gets its
  own `calculateMonthlyLandTax` divide-by-12 conversion, distinct from the
  existing divide-by-4 quarterly ones) and **Property Management**
  (monthly) are gated behind a new `isInvestmentProperty` checkbox in
  "Purchase Details" (right after "First Home Buyer"), following the
  exact same 3-part pattern `propertyType`/Strata already established:
  a "month 1" ternary, an `expenseFields` ternary (both zero out to
  `{ base: 0, changes: [] }` when off), and a JSX `&&` guard - plus a
  `handleInvestmentPropertyChange` handler that seeds Land Tax/Property
  Management to sensible non-zero defaults ($2,000/year, $150/month) the
  first time the toggle turns on, mirroring `handlePropertyTypeChange`'s
  strata-seeding behavior.
  `calculateMonthlyPropertyExpenses` (`src/calculations/loan.js`)
  refactored from 4 positional params to a single object param - at 8
  inputs (4 new fields added) positional args risked silent
  argument-order mistakes, and it's a pure function with full test
  coverage protecting the refactor. `offsetSimulation.js` needed 4 more
  `getSteppedValue` calls inside its `expenseFields` block, in the exact
  same shape as the 7 existing sub-fields.
  **No `SCHEMA_VERSION` bump** (stayed at 6) - unlike every prior bump,
  this change is purely additive (5 new top-level keys, no changed shape
  of any existing field), so an old saved scenario still loads fine and
  the new keys simply fall through to `config.default.json`'s defaults
  via the existing `{...defaultConfig, ...localConfig, ...savedScenario}`
  merge - verified directly rather than assumed.
  Verified in the browser: confirmed Maintenance & Repairs and Water
  Rates appear always, with the subtotal going from $393 to $543/month;
  checked "Investment Property" and confirmed Land Tax ($2,000/year seed)
  and Property Management ($150/month seed) appeared under an "INVESTMENT
  PROPERTY" separator, subtotal rising to $859/month and "Time to pay
  off" rising from 11.3 to 12.3 years; unchecked it and confirmed both
  fields disappeared **and** the subtotal/payoff time reverted exactly
  (not just hidden - genuinely excluded from the simulation); saved a
  scenario with Investment Property on, confirmed `version: 6` (no bump)
  in `localStorage` with all 5 new keys present, reloaded and confirmed
  the restored scenario matched exactly, including the "Monthly Expenses"
  breakdown panel's new Maintenance/Water Rates/Land Tax/Property
  Management line items (added there too, for parity with the existing
  Strata/Council/Utilities/Insurance lines).

- [x] **TODO-38: Decide how "Investment Property" should interact with First Home Buyer / stamp duty concession**
  Deferred from TODO-35 by explicit user choice, to keep that diff scoped
  to just Land Tax/Property Management. In NSW, the First Home Buyer
  stamp duty concession requires occupying the property, but
  `isInvestmentProperty` and `isFirstHomeBuyer`/`calculateStampDuty` had
  zero interaction - a user could tick both and still get the FHB
  discount. Resolved with the user: ticking "Investment Property"
  (`handleInvestmentPropertyChange`, `src/App.jsx`) now force-unchecks
  "First Home Buyer" if it was on, and the FHB checkbox becomes
  `disabled` (greyed out, with a note: "Not available for an investment
  property - the FHB concession requires occupying it.") for as long as
  Investment Property stays checked - mirrors the existing
  `handlePropertyTypeChange`/Strata-seeding pattern rather than adding a
  new kind of cross-field validation. Un-checking Investment Property
  re-enables the FHB checkbox but does **not** auto-re-check it - that's
  a decision only the user should make, not something to guess on their
  behalf.
  Verified in the browser: checked Investment Property while First Home
  Buyer was on, confirmed it un-checked automatically and greyed out with
  the explanatory note; confirmed clicking the disabled checkbox does
  nothing; unchecked Investment Property and confirmed First Home Buyer
  re-enabled (still unchecked, not force-re-checked) and could be ticked
  normally again.

- [x] **TODO-36: Add a Schedule-based expense list for Health/Subscriptions/Entertainment/Debt Repayments; replace "Other" with custom expenses**
  Requested by the user, referencing a bank-style Housing/Living/Debt
  categorization. "Housing" already maps to "Property Expenses" (TODO-35);
  Food/Transport deliberately stayed as `SteppedExpenseField`s (not folded
  into the new list) since they need "current rate that changes at a
  scheduled month" (TODO-19), a capability the Schedule/list model doesn't
  have. The flat "Other" field was removed entirely and replaced by a new
  `otherExpenseItems` list (`src/App.jsx`) - a picklist of Health/
  Subscriptions/Entertainment/Debt Repayment/Custom (the last revealing a
  free-text name field, mirroring Income Sources' 'Other' pattern exactly)
  plus the same add-form/list UI as Exceptional Expenses (name, amount,
  One-Time checkbox, Monthly/Quarterly/Yearly, End Month). **Don't split
  Debt into Personal Loan/Car Loan/Credit Card presets** - a single
  generic "Debt Repayment" plus free-text custom name covers the same
  ground.
  **Resolved with the user**: the new items' `amount` is a **direct
  per-occurrence dollar amount** (e.g. Netflix $15 with recurrence=monthly
  costs $15 that month), the same convention as Exceptional Expenses -
  **not** a $/week rate like Income Sources (which even applies that
  framing to one-time items, a pre-existing quirk not worth carrying into
  a second list). Consequence, also matching Exceptional Expenses'
  existing behavior: these items do **not** appear in the static
  "Personal Expenses"/"TO OFFSET" summary - they only affect the
  simulation (Loan Simulation/Timeline Explorer), resolved via
  `getActiveAmount(otherExpenseItems, months)` exactly like
  `exceptExpenses` already was. `calculateWeeklyPersonalExpenses`
  (`src/calculations/loan.js`) dropped its `otherExpenses` parameter
  (now just `foodExpenses, transportExpenses`), and the Timeline
  Explorer's "Expenses Status" column merges `otherExpenseItems` into the
  same `exceptExpenses` list/status logic, one combined array.
  `SCHEMA_VERSION` bumped 6→7 - unlike TODO-35's purely-additive change,
  this genuinely retires a field (`otherExpenses`/`otherExpensesChanges`)
  that could hold real user data, so old scenarios are discarded cleanly
  rather than silently losing that expense on load.
  Verified in the browser: confirmed the "Other" field is gone from
  Personal Expenses (grid now just Food/Transport); added a "Debt
  Repayment" $500/month item via the new "Other Expenses" card and
  confirmed "Personal Expenses: -$650" and "TO OFFSET: $2500" stayed
  **unchanged** (not counted in the static summary, as designed), while
  "Time to pay off" rose from 10.7 to 12.1 years (correctly affects the
  simulation); confirmed the "Custom" category reveals a free-text name
  field; jumped the Timeline Explorer to month 78 and saw "Debt Repayment
  $500" in the merged Expenses Status column; saved a scenario and
  confirmed `version: 7` in `localStorage` with `otherExpenseItems`
  present and no `otherExpenses`/`otherExpensesChanges` fields, reloaded
  and confirmed the restored scenario matched exactly.

- [x] **TODO-8: Extract and test the Timeline Explorer snapshot**
  Left out of scope of the original tests work (TODO-1). Extracted the
  month-by-month snapshot logic from the Timeline Explorer's inline IIFE
  (`src/App.jsx`) into new `src/calculations/timelineSnapshot.js` (+
  tests): `getTimelineSnapshot` (month-0 synthetic snapshot vs. real
  `monthlyData` lookup, with a fallback to the last recorded month past
  the simulation's end), `calculateEffectiveProgress` (the "% Owned"
  figure), and `calculateTimeRemaining` (years/months split, clamped at
  zero). **Also extracted beyond the TODO's literal example**: the
  future/active/past status classifier was duplicated verbatim in two
  places (Income Context column and Expenses Status column) - pulled into
  a single `classifyScheduleStatus(schedule, month)` in the existing
  `src/calculations/recurringAmount.js` (same file as `isScheduleActive`,
  since it's the same Schedule-model concept), replacing both inline
  copies. Purely a refactor - no behavior change, verified by keeping
  every UI figure identical before/after.
  Verified in the browser: moved the Timeline Explorer to month 64,
  confirmed "5 Years, 4 Months", Net Effective Balance/Loan/Offset
  figures, "42.0% Owned", and "5y 4m" Time Remaining all matched the
  pre-refactor values; added a one-time "Bonus" income at month 30 and
  confirmed the Income Context column correctly showed "• Bonus (Done)"
  once the timeline passed month 30, proving `classifyScheduleStatus`
  behaves identically to the two inline copies it replaced.

- [x] **TODO-9: Extract and test form validations**
  Also left out of scope originally. New
  `src/calculations/scheduleFormValidation.js` (+ tests):
  `validateAmount(amount)`, `validateScheduleRange(oneTime, startMonth,
  endMonth)`, and the Offset-Contribution-specific
  `hasDuplicateOneTimeMonth(items, startMonth)` - the exact predicates
  that were previously inlined as boolean expressions inside
  `addOffsetContribution`/`addIncomeSource`/`addExceptionalExpense`/
  `addOtherExpenseItem` (`src/App.jsx`; the last two didn't exist yet at
  the time this TODO was originally written - TODO-34/36 added Income
  Sources' category picklist and the Other Expenses list since then, both
  sharing the identical validation shape). Each `add*` function keeps its
  own `alert(...)` wording (they differ: "income source" vs "expense")
  and call order - only the boolean checks themselves became calls to the
  shared, tested predicates. No behavior change - verified in the browser
  that the happy-path add flow still works identically for all four forms
  (Income Source, Exceptional Expense, Other Expense, Offset Contribution).

- [x] **TODO-10: Decide the fate of uncalled functions in `src/calculations/loan.js`**
  Requested a decision from the user - **delete them**, rather than
  keeping `loan.js` as a general formula library. Removed
  `getMonth1Offset`, `calculateInitialPrincipal`,
  `calculateMonthlyPropertyBalance`, and `calculateWeeklyPropertyBalance`
  (confirmed via grep: zero callers anywhere in `src/` outside their own
  tests). `getMonth1Offset` had also gone silently stale - it still read
  `c.month`, a field TODO-32 renamed to `startMonth` months ago, so it
  would have always returned 0 against real data. `calculateInitialMonthlyInterest`
  stays (it's genuinely called, with `loanAmount` passed directly) - its
  test that piped `calculateInitialPrincipal(250000, 20000)` in as input
  was rewritten to inline the arithmetic (`230000`) instead.

- [x] **TODO-39: Make "Monthly Expenses" (Property Balance panel) smaller/collapsible**
  Requested by the user - the "💳 Monthly Expenses" block (`src/App.jsx`,
  inside "🏠 Property Balance") had grown to 9+ line items after TODO-35/36
  each added their own row. Rather than reflexively wrapping the whole
  card in a toggle, grouped the property-expense-specific rows (Strata,
  Council, Utilities, Insurance, Maintenance & Repairs, Water Rates, and
  Land Tax/Property Management when Investment Property is on) behind a
  single "Property Expenses" subtotal line (reusing the already-computed
  `monthlyPropertyExpenses`), collapsed by default behind a new
  `showMonthlyExpensesBreakdown` toggle - the exact same "▸ breakdown
  (subtotal: $X)" pattern already used on the input side (e.g. "Property
  expenses breakdown"). This cuts the card from 9-11 rows down to 4 by
  default (Loan Payment, Property Expenses subtotal, Personal Expenses,
  Total), with the full itemized breakdown one click away.
  Verified in the browser: confirmed the collapsed card shows exactly 4
  rows with the correct $543/month subtotal; expanded the breakdown and
  confirmed all 6 property expense line items matched their individual
  values exactly; toggled "Investment Property" on and confirmed Land Tax
  ($167) and Property Management ($150) appeared in the expanded
  breakdown too, with the subtotal updating to $859.

- [x] **TODO-41: Consider moving "Upfront Costs (NSW)" higher on the page**
  Requested by the user, resolved via two quick decisions: (1) the input
  side already reads Purchase Details → Financial Position → Upfront
  Costs (NSW) → Property Expenses/Income - Upfront Costs was already
  before Property Expenses/Income, and moving it before Financial
  Position too was rejected, since "Remaining Savings" (inside Upfront
  Costs) depends on "Available Savings" (defined in Financial Position) -
  showing that derived figure before its input would read oddly, so the
  input-side order is unchanged; (2) the **results panel** did need the
  move - "Upfront Costs (NSW)" was the 4th sub-section inside "Property
  Balance" (`src/App.jsx`, after Loan Information, Monthly Expenses,
  Monthly Income), moved up to be the 2nd sub-section, right after Loan
  Information - groups the one-time purchase-time cost right alongside
  the other loan-level figure, ahead of the recurring monthly ones.
  Purely a JSX reorder (cut the "Upfront Costs section" block, pasted it
  right after "Loan Information"'s closing tag) - no logic changed.
  Verified in the browser: confirmed the new order (Loan Information →
  Upfront Costs (NSW) → Monthly Expenses → Monthly Income → Property
  Summary) and that every figure inside Upfront Costs (Stamp Duty, LMI,
  Closing Costs, Total Cash Required, Available Savings, Remaining
  Savings) still showed its correct value unchanged.

- [x] **TODO-37: Replace the Property Type button pair with a dropdown**
  Requested by the user, re-raised twice (once suggesting radio buttons
  as an acceptable alternative). Went with the dropdown, matching the
  session's own recommendation and the same pattern already used
  elsewhere (e.g. the Income Name picklist) - replaced the two House/Unit
  `<button>`s (`src/App.jsx`) with a single `<select value={propertyType}
  onChange={(e) => handlePropertyTypeChange(e.target.value)}>`.
  `handlePropertyTypeChange` itself needed no changes - the strata-seed-
  on-switch-to-unit logic is untouched, since it already only depended on
  the value passed in, not on how it was triggered.
  Verified in the browser: switched to "Unit / Apartment" via the new
  dropdown and confirmed the "No strata" message disappeared and the
  Property Expenses subtotal jumped from $543 to $793/month (the $1,000
  quarterly Strata seed applied correctly, same as with the old buttons);
  switched back to "House" and confirmed the message reappeared.

- [x] **TODO-44: Make the First Home Buyer / Investment Property mutual exclusion symmetric**
  Requested by the user, correcting a mistake in an earlier read of the
  TODO-38 code: the two checkboxes (`src/App.jsx`, "Purchase Details")
  were only disabled in one direction - checking Investment Property
  disabled/auto-unchecked First Home Buyer, but checking First Home Buyer
  didn't disable Investment Property at all (it would just silently get
  unchecked later, with no upfront warning, if the user then clicked
  Investment Property). Added a symmetric `handleFirstHomeBuyerChange`
  handler (mirroring `handleInvestmentPropertyChange`) that forces
  Investment Property off when First Home Buyer is checked, plus
  `disabled={isFirstHomeBuyer}` on the Investment Property checkbox and a
  matching explanatory note ("Not available for a first home buyer -
  occupying the property and investing in it are mutually exclusive.").
  Resulting UX (as anticipated in the original TODO): whichever checkbox
  is checked first now blocks the other entirely until unchecked, in
  both directions.
  Verified in the browser: with the default First Home Buyer checked,
  confirmed Investment Property showed disabled/greyed out from page
  load; unchecked First Home Buyer and confirmed Investment Property
  became clickable again; checked Investment Property and confirmed
  First Home Buyer disabled with its existing message, exactly mirroring
  the already-verified TODO-38 behavior from the other direction.

- [x] **TODO-46: Reconsider the "Tenants" name - maybe "House Rent"?**
  Requested by the user, reopening a naming question already discussed
  once during TODO-29 (back then, the explicit call was "Dejalo como
  Tenants" - keep it). Confirmed with the user this time: renamed to
  **"House Rent"** (`src/calculations/incomeCategories.js`'s
  `INCOME_CATEGORIES`, and every `'Tenants'` string/comment/variable name
  in `src/App.jsx`, e.g. `isTenants` → `isHouseRent`) - resolves the
  ambiguity of "tenants" reading as "lodgers/room-renters only" when the
  category already covers renting out the whole property too
  (`isShared: false, numPeople: 1`). The non-shared entry's list label
  also changed from **"Individual Room"** to **"Whole House"**
  (confirmed with the user), including its second appearance in the
  Timeline Explorer's Income Context status list (was "Individual").
  "Shared Room" was left unchanged, per the user's choice. Also renamed
  "Tenants Active" → "House Rent Active" and "No tenants or income
  sources" → "No house rent or income sources" in the Timeline Explorer
  for consistency. Purely a display-string/identifier-naming change -
  `isShared !== undefined` (not the category name) is still what
  identifies a House-Rent-category entry everywhere in the code, so no
  `SCHEMA_VERSION` bump was needed; an old saved scenario with a
  `name: 'Tenants'` entry keeps working exactly the same (the stored name
  is just a label, unrelated to the picklist's current option text).
  Verified in the browser: confirmed "House Rent" replaced "Tenants" in
  the Income Name dropdown; added an unshared House Rent entry and
  confirmed the list showed "Whole House" (not "Individual Room");
  advanced the Timeline Explorer and confirmed "House Rent Active: 1" and
  "• Whole House" appeared correctly in the Income Context column.

- [x] **TODO-53 (Analysis only, no code): How should variable bank interest rates be modeled?**
  Requested by the user - explicitly an analysis task. Findings:
  **Data shape - correcting the TODO's own suggestion**: `interestRate`
  is NOT a good fit for the recurring "Schedule" model
  (`src/calculations/recurringAmount.js`, used by Income Sources/
  Exceptional Expenses/Offset Contributions/Other Expenses) - that model
  represents "does a cash event fire this month", which doesn't apply
  here. Interest rate is instead exactly the same shape of thing the app
  already has a purpose-built pattern for: **`useSteppedValue`/
  `getSteppedValue`** (`src/hooks/useSteppedValue.js`/
  `src/calculations/steppedValue.js`, TODO-19) - "the current permanent
  value, superseded by later scheduled changes, no end date, no repeat
  interval" - precisely how Strata/Utilities/Council/Insurance/
  Maintenance/Water/Food/Transport already work. So: reuse
  `useSteppedValue` for `interestRate` directly, with a `{startMonth,
  amount}` (rate) changes list, resolved via `getSteppedValue` - **zero
  new data-modeling work needed**, the exact mechanism already exists.
  **The real design question - the repayment recalculation**: today
  `monthlyPayment` is computed **once** outside the simulation loop
  (`calculateMonthlyPayment(loanAmount, monthlyRate, totalMonths)`,
  `src/App.jsx`) and passed into `offsetSimulation.js` as a constant used
  for the entire loop (`principalPayment = monthlyPayment -
  monthlyInterest`, `src/calculations/offsetSimulation.js:129-134`). A
  real variable-rate mortgage does **not** just change the interest/
  principal split at a fixed repayment - the lender recalculates the
  repayment itself, to re-amortize the *remaining balance* over the
  *remaining term* at the *new rate*, keeping the loan on track to finish
  on schedule. Simply swapping in a new `monthlyRate` mid-loop while
  keeping `monthlyPayment` fixed is materially wrong (and can even break
  down entirely if a rate rise means the fixed old repayment no longer
  covers the new interest).
  **Recommended approach**: resolve the current rate every month inside
  `offsetSimulation.js`'s loop via `getActiveAmount`-style
  `getSteppedValue(interestRateField.base, interestRateField.changes,
  months)`; detect when it differs from the previous month's resolved
  rate; on a change, recompute `monthlyPayment =
  calculateMonthlyPayment(balance, newMonthlyRate, maxMonths - months)`
  using the loan's own existing formula (no new math needed) against the
  *current remaining balance and remaining months*, then keep that new
  repayment fixed until the next change. This moves `monthlyPayment`'s
  computation from "once, outside the loop" to "recomputed on rate-change
  months, inside the loop" - a real structural change to
  `offsetSimulation.js`, but one that reuses 100% existing functions.
  **Secondary scoping decisions**: the static "month 1" summary cards
  (Repayments, Interest Amount) should resolve the rate the same way
  every other stepped field already does
  (`getSteppedValue(field.base, field.changes, 1)`); the "Savings vs no
  offset" baseline (`calculateNoOffsetTotalInterest`) is recommended to
  keep using a single fixed rate (the month-1 rate) for its entire
  hypothetical no-offset run, as a deliberate simplification, since that
  figure is already a rough illustrative comparison, not a real forecast.
  **Conclusion: this is solvable with existing building blocks** (no new
  pure functions needed beyond wiring `getSteppedValue` +
  `calculateMonthlyPayment` differently) - captured as a concrete
  follow-up, TODO-57.

- [x] **TODO-48 (Analysis only, no code): Evaluate decoupling NSW-specific logic for other Australian states**
  Requested by the user - explicitly an analysis task. Findings, after
  reading every calculation module the original TODO flagged:
  **Genuinely state-specific (belongs behind a state boundary)**:
  `src/calculations/stampDuty.js` in full - `NSW_STAMP_DUTY_TIERS`, the
  First Home Buyer Assistance Scheme's $800k/$1M taper, and the 8%
  Foreign Purchaser Surcharge rate are all NSW law, and every other state
  has its own tiers, its own FHB scheme (different name, different
  thresholds), and its own surcharge-purchaser-duty rate. Also
  state-specific: the *registration fees/searches* portion of
  `src/calculations/closingCosts.js`'s `DEFAULT_CLOSING_COSTS` - these are
  government land-registry fees that genuinely differ by state.
  **Correction to the TODO's own framing - NOT actually state-specific**:
  `src/calculations/lmi.js` was listed as NSW-specific in the original
  TODO text, but LMI is priced by mortgage insurers/lenders operating
  nationally, not by state government - the "(NSW, 2026)" in its comment
  is misleading (an artifact of this app's origin, not a real dependency
  on state law). LMI should stay a single shared module regardless of
  which state is selected - it does **not** need to move behind the
  state boundary at all.
  **Land Tax**: also flagged as NSW-specific by the original TODO, but
  since TODO-35 it's already just a flat, user-edited figure (no formula
  computes it) - so there is nothing to decouple *today*. It only becomes
  a real per-state concern if a future TODO adds actual land-tax
  bracket/threshold calculations (out of scope here).
  **Conveyancing/inspection fees** (the rest of `DEFAULT_CLOSING_COSTS`):
  more like national market-rate averages that loosely vary by locality,
  not strict per-state law - but since the whole object is just default
  starting figures, the simplest design keeps it together with
  registration fees in one per-state defaults object rather than
  splitting the object in two.
  **UI text**: the title ("NSW Property Investment Cash Flow Calculator"),
  the disclaimer, "First Home Buyer (NSW stamp duty concession)", the
  Foreign Purchaser helper text ("NSW 8% Surcharge Purchaser Duty"), and
  both "Upfront Costs (NSW)" headings (`src/App.jsx`) all hardcode the
  literal string "NSW" and would need to read from the selected state's
  label/scheme name instead.
  **Recommended design**: a `src/calculations/states/` folder, one module
  per state (`nsw.js` first, matching today's exact behavior) exporting a
  consistent shape - `{ code, label, calculateStampDuty,
  calculateForeignPurchaserSurcharge, fhbSchemeName,
  foreignPurchaserSurchargeRate, defaultClosingCosts }` - plus a
  `states/index.js` registry (`STATES = { NSW: nswModule }`,
  `getStateModule(code)`), selected via a new `state` config field
  (defaulting to `'NSW'`, so existing saved scenarios need no migration).
  `App.jsx` swaps its current direct imports from `stampDuty.js`/
  `closingCosts.js` for calls through the selected module, and the
  hardcoded "NSW" UI strings interpolate the module's `label`/
  `fhbSchemeName` instead.
  **Conclusion**: the *extraction* half (moving today's NSW logic behind
  this module boundary, zero behavior change, fully covered by existing
  tests) is concretely buildable now - captured as TODO-58. Actually
  **adding** a second state's real tax data is a separate, much larger
  effort requiring genuine per-state tax research, and is explicitly out
  of scope for TODO-58.

- [x] **TODO-42: Rethink "Property Summary" when there's no rental income**
  Requested by the user - "Property Summary" (Total Property Monthly
  Expenses / Income / Net Property Monthly Balance, `src/App.jsx`) always
  showed a "Net Property Monthly Balance" even when `monthlyRentalIncome`
  was $0 (no House Rent/Room Rent added), where the figure was just
  "-(all property costs)" restated with a negative sign - not a
  meaningful comparison, and redundant with the Monthly Expenses card
  already shown above it. Design decision: the card is only meaningful
  once there's an actual rental income to net property costs against, so
  the whole "Property Summary" section (`src/App.jsx`) is now gated
  behind `monthlyRentalIncome > 0` - the same conditional-render pattern
  already used elsewhere (e.g. Land Tax/Property Management behind
  `isInvestmentProperty`, TODO-35), except keyed on rental income
  actually being present rather than the investment-property flag, since
  a non-investment property can still have House/Room Rent income (e.g. a
  first home buyer renting out a spare room), and that case should still
  see the card.
  Verified in the browser on the $850k default scenario: with no income
  sources renamed to a rental category, "📊 Property Summary" does not
  render at all (only "💳 Monthly Expenses" and "💰 Monthly Income" show);
  after adding a "House Rent" income source at $500/week, "📊 Property
  Summary" reappeared showing "Total Property Monthly Expenses: -$3,844",
  "Total Property Monthly Income: +$2,167", "Net Property Monthly
  Balance: -$1,677" - correct and consistent with the other cards' updated
  figures. `npm test -- --run` (200/200), `npm run lint`, and `npm run
  build` all stayed clean since this was a pure conditional-render change
  with no calculation logic touched.

- [x] **TODO-45: Persist expanded/collapsed panel state on Save**
  Requested by the user - `handleSaveScenario` (`src/App.jsx`) previously
  treated all `show*` toggles as ephemeral, not part of the saved
  scenario. Resolved the open question the TODO itself flagged (breakdown/
  view toggles only, vs. literally every `show*` including the "Add" form
  toggles) by asking the user directly: **only the breakdown/view
  toggles** - `showPropertyExpenses`, `showMonthlyExpensesBreakdown`,
  `showClosingCostsBreakdown`, `showIncome`, `showPersonalExpenses` - now
  initialize from `config.show* ?? false` (same config-precedence chain
  as every other saved field) and get written into `handleSaveScenario`'s
  scenario object. The four "Add" form toggles (`showAddIncome`,
  `showAddOtherExpense`, `showAddContribution`, `showAddExceptExp`) stay
  ephemeral by design - reopening a half-filled "Add" form after a reload
  wouldn't make sense anyway, since its in-progress field values were
  never saved either. Purely additive to the scenario shape (old v7
  scenarios simply lack these fields and fall back to `false` via the
  `?? false` default), so no `SCHEMA_VERSION` bump needed, matching the
  precedent set by TODO-35.
  Verified in the browser: expanded "Income breakdown" and "Personal
  expenses breakdown" (left both "Closing costs breakdown" and "Property
  expenses breakdown" collapsed), also opened the "Add Income" form, then
  clicked Save and reloaded the page - "Income breakdown" and "Personal
  expenses breakdown" came back expanded (▾) exactly as left, "Closing
  costs breakdown"/"Property expenses breakdown" stayed collapsed (▸) as
  before, and the "Add Income" form correctly reset to collapsed
  ("+ Add", not "✕ Cancel") since it isn't part of what's saved. `npm test
  -- --run` (200/200), `npm run lint`, and `npm run build` all clean.

- [x] **TODO-59: Make "Personal Expenses" collapsible/expandable in 💳 Monthly Expenses**
  Requested by the user. "Property Expenses" in the Monthly Expenses card
  (`src/App.jsx`) was already collapsible behind
  `showMonthlyExpensesBreakdown` (TODO-39); "Personal Expenses" right
  below it was still a single flat row. Added the identical
  collapse/expand pattern: a new `showPersonalExpensesBreakdown` toggle
  state (named distinctly from the pre-existing `showPersonalExpenses`,
  which controls the separate "Your Personal Expenses (Weekly)" *input*
  card, not this *results* row) reveals Food/Transport as indented
  sub-rows - `calculateMonthlyFromWeekly(foodExpenses)`/
  `calculateMonthlyFromWeekly(transportExpenses)` - mirroring Property
  Expenses' markup exactly. Wired into the same save/restore list TODO-45
  just added, so it persists on Save like the other four breakdown
  toggles; purely additive to the scenario shape, no `SCHEMA_VERSION`
  bump needed.
  Verified in the browser: expanded "Personal Expenses" and confirmed
  "Food: -$433" + "Transport: -$217" sum to the row's own "-$650" total;
  saved and reloaded the page, and the row came back expanded (▾) as
  left. `npm test -- --run` (200/200), `npm run lint`, and `npm run
  build` all clean.

- [x] **TODO-60: Clarify the weekly→monthly conversion factor (52÷12, not ×4) in the UI**
  Requested by the user, who noticed Food $100/week + Transport $50/week =
  $150/week, expected $150 × 4 = $600/month, but the app shows $650/month
  (Food $433 + Transport $217) and asked why. Investigated first:
  confirmed every weekly→monthly conversion in the app
  (`calculateMonthlyFromWeekly`/`calculateMonthlyPersonalExpenses`,
  `src/calculations/loan.js`) uses **52/12 ≈ 4.333** (actual weeks/year ÷
  months/year) consistently everywhere, already locked in by existing
  tests - not a bug, and nothing was changed by this TODO's own predecessor
  (TODO-59) either; that just displayed a total that was already computed
  this way. User explicitly confirmed the resolution: keep the realistic
  52÷12 value as-is (preferred over a simpler-but-less-accurate ×4, since
  it doesn't want a less-accurate figure just because it's easier to
  explain) and add a floating `(?)` tooltip explaining it wherever it
  could confuse a user.
  Built a new generic `src/components/InfoTooltip.jsx` - a `label`+
  `children` version of `LvrBadge.jsx`'s existing `group`/
  `group-focus-within` Tailwind hover/focus pattern (no new dependency),
  reusable anywhere a "(?) explain this figure" is needed - including the
  help dialogs TODO-54/TODO-55 already plan to add. A shared
  `WEEKLY_TO_MONTHLY_TOOLTIP` JSX constant (`src/App.jsx`) holds the
  explanation copy once, used across all placements rather than
  duplicating the text.
  Placed the tooltip in the three distinct spots where a weekly-sourced
  monthly figure appears (deliberately not on every single row, to avoid
  cluttering rows like Property Expenses/Loan Payment that aren't
  weekly-derived at all): the "Personal Expenses" row in 💳 Monthly
  Expenses (covers its Food/Transport breakdown from TODO-59), the
  "💰 Monthly Income" card header (covers Rental Income/Personal
  Income/Total Monthly Income, all weekly-sourced), and the Timeline
  Explorer's "Income Context" column header (covers its own Personal/
  Rental Income figures). Restructured the Personal Expenses row's markup
  in the process - it was previously one giant `<button>` spanning label
  + amount for the collapse toggle, which would have made the tooltip's
  own nested `<button>` invalid HTML; split it so only the label text is
  the clickable toggle, with the tooltip and dollar amount as a separate
  sibling group, preserving the exact same visual layout and click
  behavior otherwise.
  Verified in the browser: hovering each of the three `(?)` icons shows
  the same explanation ("Monthly figures convert weekly amounts using the
  actual number of weeks per year: 52 ÷ 12 ≈ 4.33, not a flat ×4...");
  confirmed the Personal Expenses row's collapse/expand toggle still
  works identically after the restructure. `npm test -- --run` (200/200),
  `npm run lint`, and `npm run build` all clean - no calculation logic
  was touched, this was UI-only.

- [x] **TODO-40: Simplify/clarify the "Upfront Costs (NSW)" results panel**
  Requested by the user - the panel (Stamp Duty, LMI, Closing Costs, Total
  Cash Required, Available Savings, Remaining Savings) read as unclear to
  a first-time user. Added three `InfoTooltip` (`src/components/
  InfoTooltip.jsx`, the generic tooltip introduced in TODO-60) instances
  to `src/App.jsx`'s Upfront Costs (NSW) panel, each answering exactly
  the question the TODO raised:
  - **LMI row**: explains what Lenders Mortgage Insurance is, that it
    only applies above 80% LVR (why it so often shows $0), and that it's
    financed into the loan by default unless "Pay LMI upfront in cash" is
    checked.
  - **Total Cash Required row**: spells out exactly what it sums -
    Deposit + Stamp Duty + Closing Costs, plus Foreign Purchaser
    Surcharge and/or LMI when they apply - and clarifies it's the cash
    needed on settlement day, separate from the loan and from ongoing
    income/expenses.
  - **Remaining Savings row**: explains its relationship to Available
    Savings - `Available Savings − Total Cash Required − one-time Offset
    Contributions` (recurring contributions excluded, since those draw on
    future income, not savings sitting in the bank today) - and
    distinguishes it from the ongoing monthly surplus shown in
    🎯 TO OFFSET.
  No layout restructuring needed beyond this - inline tooltips answered
  every question TODO-40 raised without a bigger redesign.
  Verified in the browser: hovered each of the three new `(?)` icons on
  the $850k default scenario and confirmed the tooltip text matches the
  underlying calculation (`calculateTotalCashRequired`/
  `calculateCashRemaining`, `src/calculations/totalCashRequired.js`) in
  each case. `npm test -- --run` (200/200), `npm run lint`, and `npm run
  build` all clean - UI-only, no calculation changes.

- [x] **TODO-61: Shorten the weekly→monthly `InfoTooltip` copy (TODO-60)**
  Requested by the user right after seeing TODO-60's tooltips in the
  browser - the shared `WEEKLY_TO_MONTHLY_TOOLTIP` constant
  (`src/App.jsx`) had two paragraphs, but the first alone explained the
  52÷12 conversion well enough. Trimmed it down to just that first `<p>`,
  dropping the second ("A flat ×4 would undercount...") entirely -
  applies everywhere the constant is used (Personal Expenses row, Monthly
  Income card header, Timeline Explorer's Income Context header)
  automatically, since they all reference the same shared constant.
  Verified in the browser: hovering the Monthly Income tooltip now shows
  only the single shortened sentence. `npm test -- --run` (200/200),
  `npm run lint`, and `npm run build` all clean.

- [x] **TODO-56: Split "House Rent" into "House Rent" vs. "Room Rent"**
  Requested by the user, a follow-up to TODO-46. "House Rent" is now a
  plain flat-amount category (`src/App.jsx`'s Add Income form falls into
  a dedicated "Weekly Rent" `NumberSliderField`, no shared/room fields at
  all - same slider bounds the combined category used to have). New
  **"Room Rent"** category (`INCOME_CATEGORIES`,
  `src/calculations/incomeCategories.js`) keeps the exact Shared-room-or-
  not + number-of-people + per-person-amount sub-form the old "House
  Rent" had - `addIncomeSource`'s `isHouseRent` variable renamed to
  `isRoomRent`, gated on `newIncomeCategory === 'Room Rent'` instead.
  **The rental-identification fix**: the old `isShared !== undefined`
  check (used to partition `weeklyIncome`/`weeklyRentalIncome`, and in
  the Timeline Explorer) broke the moment House Rent could have zero
  shared-room fields at all. Replaced with a new exported
  `RENTAL_INCOME_CATEGORIES = ['House Rent', 'Room Rent']`
  (`incomeCategories.js`) checked against `income.name` (which already
  stores the category verbatim for every category except 'Other') -
  correctly identifies both new categories, and since `name` was already
  "House Rent" for every legacy entry regardless of old shared/whole-house
  status, **old saved entries keep counting as rental income with zero
  data loss** - no `SCHEMA_VERSION` bump needed, purely additive/behavioral.
  Display-only fallout for old data: the old "Whole House" label (for a
  non-shared legacy House Rent entry) is renamed to "Single Room"
  everywhere it's shown (income list, Timeline Explorer's per-item label)
  since "whole house" is now exclusively the separate flat category -
  legacy entries with `isShared: false` will cosmetically show "Single
  Room" post-split instead of "Whole House", with their amount/schedule
  completely unaffected. Also renamed the Timeline Explorer's "House Rent
  Active" figure to "Rental Active", since it now covers both categories.
  Added `RENTAL_INCOME_CATEGORIES` test coverage
  (`incomeCategories.test.js`) and extended the existing "never overrides
  House Rent" defaults test to also cover Room Rent.
  Verified in the browser: added a "House Rent" entry ($500/week, shows
  as plain "House Rent" in the list, no shared checkbox) and a "Room
  Rent" entry with Shared Room checked (2 people × $500, shows as "Shared
  Room" / "Shared (2 × $500)" in the Timeline Explorer) - confirmed
  Monthly Rental Income correctly summed both ($6,500/month), Property
  Summary (TODO-42) reappeared correctly, and at Timeline month 25,
  "Rental Active: 2" and the per-item log showed "• House Rent" and
  "• Shared (2 × $500)" exactly as expected. `npm test -- --run`
  (201/201), `npm run lint`, and `npm run build` all clean.

- [x] **TODO-62 (Analysis only, no code): Evaluate testing `App.jsx`'s wiring - is it feasible, worth it, and how hard?**
  Requested by the user - explicitly an evaluation task. Confirmed current
  state: `vite.config.js`'s `test` block sets `environment: 'node'`
  globally, and `package.json` has no `jsdom`, no `@testing-library/*` -
  zero DOM-rendering test capability today. All 201 existing tests cover
  only `src/calculations/*.js` (pure functions); `App.jsx`'s ~2500 lines
  of state wiring and JSX have never been touched by an automated test,
  only manual browser verification.
  **Feasibility**: technically straightforward - vitest supports jsdom
  per-file via a `// @vitest-environment jsdom` docblock (no need to
  switch the whole suite, keeping the existing pure-function tests fast),
  plus installing `jsdom` + `@testing-library/react` +
  `@testing-library/jest-dom` + `@testing-library/user-event`. The real
  obstacle isn't the tooling, it's the shape of `App.jsx` itself: a single
  monolithic component (aside from a few shared pieces - `NumberSliderField`,
  `LvrBadge`, `SteppedExpenseField`, `InfoTooltip`) with no subcomponent
  decomposition, so any wiring test has to mount the entire page and query
  a very dense DOM by role/text - the same kind of ambiguity that caused
  the wrong-`<select>`-targeted mistake during TODO-46's manual browser
  verification could recur in RTL tests too, though `getByRole`/
  `getByLabelText` are more precise than a raw `querySelector`.
  **Worth it?** In favor: this session's own bug history is direct
  evidence - TODO-38's one-directional FHB/Investment mutual-exclusion
  bug and TODO-46's wrong-select mishap both happened exactly in this
  untested layer. Against: `App.jsx` gets rewritten in nearly every single
  TODO this session (60+ items touched it) - tests coupled to its exact
  DOM structure would need constant upkeep, adding real friction against
  the project's fast, conversational, one-TODO-at-a-time pace. Also,
  manual browser verification is *already* a mandatory step for every
  UI-touching TODO in this workflow, so wiring tests would mostly be
  redundant with what's already done by hand each time - their real value
  would be catching regressions on *future*, unrelated changes (which
  one-time manual verification does not), not replacing today's
  verification step.
  **Difficulty ladder**: this evaluation itself - trivial (done here).
  Installing jsdom/RTL and wiring up the per-file environment - easy,
  mechanical, no design decisions. A *small*, targeted set of regression
  tests (3-5) for the two wiring patterns already proven to cause real
  bugs (checkbox mutual-exclusion, category-conditional form rendering) -
  medium, achievable in one focused task. Comprehensive wiring coverage
  of all of `App.jsx` - high/very high, and likely not worth it at this
  project's current size/pace given the churn. A prerequisite refactor to
  decompose `App.jsx` into independently-testable subcomponents (so tests
  target smaller, more stable units instead of the whole page) - high
  effort, comparable to or larger than TODO-47 (dark mode) in scope, with
  its own regression risk.
  **Recommendation**: don't chase full coverage. Pilot a small, targeted
  jsdom+RTL setup covering just the two already-proven-risky wiring
  patterns - captured as a concrete follow-up, TODO-63. If it holds up
  without adding friction across a few more sessions, expand; if it
  becomes a maintenance drag, stop there.

- [ ] **TODO-63: Pilot a small jsdom + React Testing Library test suite for `App.jsx`'s riskiest wiring**
  Follow-up from TODO-62's evaluation (done) - the scoped-down version of
  "test App.jsx" that's actually worth doing now, per that analysis's
  recommendation. Add `jsdom`, `@testing-library/react`,
  `@testing-library/jest-dom`, `@testing-library/user-event` as
  devDependencies; new `src/App.test.jsx` (or similar) opting into jsdom
  via a `// @vitest-environment jsdom` docblock, leaving every existing
  `src/calculations/*.test.js` file on the fast `node` environment
  unchanged. Write 3-5 tests targeting only the two wiring patterns this
  session already proved buggy once each: (1) the First Home
  Buyer/Investment Property mutual-exclusion checkboxes (`src/App.jsx`,
  TODO-38/44) - checking one disables and unchecks the other, in both
  directions; (2) a category-conditional form render (e.g. picking
  "Room Rent" in the Income Name dropdown shows the Shared Room
  checkbox, picking "House Rent" or anything else does not, TODO-56).
  Explicitly **not** in scope: broad coverage of the rest of `App.jsx`,
  any subcomponent-extraction refactor, or replacing the existing
  mandatory manual browser verification step for future TODOs - this is
  a small, deliberately-scoped pilot to see whether wiring tests hold up
  against this project's pace before investing further.

---

## 🟡 MEDIUM PRIORITY (Important, but not blocking)

- [ ] **TODO-47: Add dark mode (mobile + web)**
  Requested by the user. The entire app today is hardcoded to a light
  Tailwind palette (`bg-white`, `bg-gray-50`, text colors, etc.) with no
  dark-mode variants anywhere - would need a systematic pass adding
  `dark:` variants across every card/component (`src/App.jsx`,
  `src/components/*.jsx`), plus a toggle (or `prefers-color-scheme`
  detection) and persisting the choice. Sizeable, mechanical effort given
  how many color classes exist across the app, not a quick add.

- [ ] **TODO-49: Let the user choose how much of the automatic surplus goes to Offset vs. Savings**
  Requested by the user. Today **100% of the monthly surplus automatically
  goes to the loan offset** - this is the app's core premise, stated
  right in the header tagline ("How much is left after EVERYTHING? That
  goes to offset automatically.") and implemented via
  `calculateMonthlyToOffset`/`baseMonthlySurplus`
  (`src/App.jsx`/`src/calculations/loan.js`) feeding straight into
  `offsetSimulation.js`'s loop with no split. Adding a user-configurable
  split (e.g. "70% to offset, 30% to savings") touches the core
  simulation loop and probably the header's own framing/tagline - a
  bigger change than it sounds, not a small settings tweak.

- [ ] **TODO-50: Model bank interest on Available Savings (customizable rate)**
  Requested by the user. `totalSavings`/`cashRemaining`
  (`src/calculations/totalCashRequired.js`) are static figures today -
  no interest accrual is modeled on the savings pool at all. Would need a
  new customizable interest rate input and a calculation for how much the
  remaining/unallocated savings earn over time, feeding into... unclear
  yet where this should surface (a new figure in "Financial Position"? in
  the Timeline Explorer?) - needs its own design pass.

- [ ] **TODO-51: Add more charts to visualize progress**
  Requested by the user, who asked for concrete suggestions on which
  charts matter most - proposed here, in priority order, all backed by
  data the simulation already computes (`loanSimulation.monthlyData`/
  `baselineSimulation.monthlyData`, `src/App.jsx`), so none need new
  calculation logic, only visualization:
  1. **Loan Balance vs. Offset vs. Effective Balance over time** (line/
     area) - the user's own suggestion ("Load balance over time...shows
     how the debt decreases"); the most fundamental chart, a full-timeline
     version of what the Timeline Explorer already shows one month at a
     time.
  2. **With-offset vs. without-offset comparison** (two lines - total
     interest accrued, or balance, over time) - today "Savings vs no
     offset" is a single "~$X saved" number; charting
     `loanSimulation.monthlyData` against `baselineSimulation.monthlyData`
     directly would make that gap visually obvious instead of a static
     figure.
  3. **Principal vs. Interest split per month** (stacked area) - the
     user's other suggestion; the classic amortization chart, showing the
     crossover point and how offset shifts it earlier.
  4. Optionally, **Effective Ownership % over time** - a full-timeline
     version of the Timeline Explorer's single-point progress bar.
  `recharts` (`package.json`) is already a dependency but **currently
  unused anywhere in `src/`** - the only "chart" today is the Total
  Summary's income/expense ring, which is a plain CSS `conic-gradient`
  (`src/App.jsx:1981`), not a recharts component - so building any of
  these means the first real recharts usage in the app. Still needs a
  decision on which 1-2 to build first, and where they'd live on the page
  (their own new card? inside the Timeline Explorer?).

- [ ] **TODO-52 (Analysis only, no code): When does it make sense to invest in ETFs instead of paying down the offset?**
  Requested by the user - explicitly an analysis task. The question:
  at what point (if any) does investing the surplus in ETFs (dividend-
  paying or growth) out-earn the guaranteed, tax-free "return" of
  reducing loan interest via the offset account? This is a genuine
  personal-finance modeling question (comparing a risk-free guaranteed
  rate - the loan's interest rate - against a variable, taxable
  investment return) - needs research/modeling before any code, and
  should be explicit that this app does not and should not give
  personalized financial advice (see the existing disclaimer, TODO-25) -
  any output here would need to stay clearly illustrative/educational.

- [ ] **TODO-54: "Realistic Mode" - model income tax on salary**
  Requested by the user, who flagged this as a **hard task with priority
  still to be decided**. Would need: accepting either gross or net weekly
  salary as input (with net→gross needing an approximate reverse
  calculation, since Australian income tax is progressive), accounting
  for any other income across the financial year, and modeling **when**
  tax is actually paid - e.g. as a periodic average (starting month 6,
  then every 12 months) vs. letting the user specify their actual next
  tax payment date/cadence. Touches `incomeSources`, the simulation loop,
  and probably needs new NSW/Australian tax-bracket data - a substantial
  feature, not a quick toggle. Needs a priority discussion with the user
  before scheduling. **Also requested**: a floating `(?)` help dialog
  explaining what Realistic Mode does and the tax assumptions behind it -
  reuse the existing hover-tooltip pattern from `src/components/LvrBadge.jsx`
  (TODO-23, a `group`/`group-focus-within` Tailwind tooltip, no new
  dependency needed).

- [ ] **TODO-55: Add a credit card usage option (delayed payment benefit)**
  Requested by the user, flagged as **hard, similar in scope to Realistic
  Mode (TODO-54)**. The idea: using a credit card for day-to-day spending
  (food, etc.) lets that cash sit in the offset account longer before the
  card's monthly statement is actually paid, effectively adding a bit of
  extra offset benefit - modeling this properly means simulating the
  card's billing cycle and payment timing against the existing monthly
  loop. The user offered a **fallback if the full simulation is too
  complex**: instead, just estimate a flat % benefit (they suggested ~2%)
  from paying eligible expenses by credit card instead of debit - net of
  any bank account fee some accounts charge for not using debit (which
  can wipe out the benefit entirely if not accounted for). Needs a design
  decision on which of the two approaches (full cycle simulation vs. flat
  %-benefit estimate) before implementing either. **Also requested**: a
  floating `(?)` help dialog (same `LvrBadge`-style tooltip pattern as
  TODO-54) explaining how to use the feature, including concrete guidance
  on which kinds of expenses should stay on debit instead of credit card
  (e.g. anything where the account charges an extra fee for not using
  debit, which would erase the benefit). **Follow-up analysis from the
  user, favoring the flat %-benefit fallback over full cycle
  simulation**: with typical eligible spending (~$1,000-1,500/month), a
  dedicated "big savings" section promising large gains from credit-card-
  plus-offset would be misleading - the realistic benefit is modest
  ("Estimated annual benefit: $50-200/year", depending on eligible
  spending, mortgage rate, cashback, and card fees). Proposed formula:
  **Annual Benefit ≈ Average Extra Offset Balance × Mortgage Rate** - e.g.
  $1,000 extra balance × 5.5% ≈ $55/year, $2,000 × 5.5% ≈ $110/year,
  $3,000 × 5.5% ≈ $165/year. Worth noting in the UI copy itself (not just
  internally) that the offset-timing benefit alone is small - the card's
  own cashback/rewards often matter as much or more than the extra
  interest saved, so the feature shouldn't overstate the offset side in
  isolation.


- [x] **TODO-43: Add NSW Foreign Purchaser Additional Duty Surcharge (8% extra)**
  Requested by the user, explicitly flagged as **not urgent**, with the
  8% rate confirmed by the user directly. Added
  `calculateForeignPurchaserSurcharge(propertyPrice, isForeignPurchaser)`
  (`src/calculations/stampDuty.js`) - a flat 8% of property price, kept
  deliberately simple: real-world double-tax-agreement exemptions for
  specific countries are **not** modeled, only a flat approximation.
  New `isForeignPurchaser` state (`src/App.jsx`) is fully **independent**
  of `isFirstHomeBuyer`/`isInvestmentProperty` - no mutual-exclusion logic
  added, since foreign-purchaser status depends on residency/citizenship,
  a genuinely different axis (a foreign buyer could be a first home buyer,
  an investor, or neither). New checkbox in "Purchase Details" (after
  Investment Property); `calculateTotalCashRequired`
  (`src/calculations/totalCashRequired.js`) gained an optional
  `foreignPurchaserSurcharge = 0` parameter so existing call sites/tests
  needed no changes; the Upfront Costs (NSW) results panel shows a new
  "Foreign Purchaser Surcharge (8%)" line, conditionally rendered only
  when checked, right below Stamp Duty.
  Verified in the browser: checked Foreign Purchaser on the $850k default
  purchase and confirmed "Foreign Purchaser Surcharge (8%): -$68,000"
  (exactly 8% of $850,000), Total Cash Required rising from $321,547 to
  $389,547, and Remaining Savings flipping to a negative $39,547 with the
  existing over-committed-savings warning; confirmed First Home Buyer
  stayed checked throughout with zero interaction, exactly as designed.

- [ ] **TODO-57: Implement scheduled/variable interest rate changes**
  Follow-up from TODO-53's analysis (done) - a concrete, buildable design
  rather than an open question. Replace the single static `interestRate`
  state (`src/App.jsx`) with `useSteppedValue(config.interestRate)` (the
  exact same hook already used for Strata/Utilities/Council/Insurance/
  Maintenance/Water/Food/Transport, TODO-19) - a "Schedule a rate change"
  add-form identical to those fields' UI, likely reusing
  `SteppedExpenseField` directly with `suffix="% p.a."`.
  The real work is in `src/calculations/offsetSimulation.js`: inside the
  loop, resolve the current annual rate every month via
  `getSteppedValue(interestRateField.base, interestRateField.changes,
  months)`; when it differs from the previous month's resolved rate,
  **recompute** `monthlyPayment = calculateMonthlyPayment(balance,
  calculateMonthlyRate(newRate), maxMonths - months)` - re-amortizing the
  *remaining* balance over the *remaining* term at the *new* rate, matching
  how real variable-rate mortgages actually work (not just swapping the
  interest/principal split at a fixed old repayment, which is materially
  wrong and can even fail to cover interest on a rate rise). Both
  `calculateMonthlyPayment` and `getSteppedValue` already exist and need
  no changes themselves - this is a wiring/structural change, moving
  `monthlyPayment`'s computation from "once, outside the loop" to
  "recomputed on rate-change months, inside the loop".
  Static "month 1" summary figures (Repayments, Interest Amount) should
  resolve the rate via `getSteppedValue(field.base, field.changes, 1)`,
  same convention as every other stepped field. `calculateNoOffsetTotalInterest`
  (the "Savings vs no offset" baseline) should keep using a single fixed
  rate (the month-1 rate) for its whole hypothetical run - a deliberate,
  documented simplification, since that figure is already an illustrative
  comparison rather than a real forecast. Needs a `SCHEMA_VERSION` bump
  (the saved shape changes from a flat `interestRate` number to a
  `{base, changes}` pair, same pattern as the other stepped-field bumps).

- [ ] **TODO-58: Extract NSW-specific logic behind a `state` module boundary**
  Follow-up from TODO-48's analysis (done) - the behavior-preserving half
  of that design, buildable now without needing a second state's actual
  tax data. Create `src/calculations/states/nsw.js` exporting
  `{ code: 'NSW', label: 'New South Wales', calculateStampDuty,
  calculateForeignPurchaserSurcharge, fhbSchemeName: 'First Home Buyer
  Assistance Scheme', foreignPurchaserSurchargeRate: 0.08,
  defaultClosingCosts }` - moving today's `stampDuty.js` functions and
  `closingCosts.js`'s `DEFAULT_CLOSING_COSTS` into it unchanged, plus a
  `src/calculations/states/index.js` registry (`STATES = { NSW: nswModule
  }`, `getStateModule(code)`). Add a new `state` config field defaulting
  to `'NSW'` (`config.default.json`, existing saved scenarios need no
  migration since the default covers them). `src/App.jsx` swaps its
  direct `stampDuty.js`/`closingCosts.js` imports for calls through
  `getStateModule(state)`, and the hardcoded "NSW" UI strings (title,
  disclaimer, "First Home Buyer (NSW stamp duty concession)", the
  Foreign Purchaser helper text, both "Upfront Costs (NSW)" headings)
  interpolate the selected module's `label`/`fhbSchemeName` instead.
  **Explicitly out of scope**: `lmi.js` stays a single shared module (per
  TODO-48's finding that LMI isn't actually state-specific); Land Tax
  stays a flat editable figure (no per-state bracket logic added); and no
  second state's real tax data gets added in this pass - this TODO only
  proves the boundary works by migrating NSW's own existing logic through
  it with zero behavior change, verified by the full existing test suite
  passing unchanged plus a browser check that every figure (stamp duty,
  FHB concession, foreign purchaser surcharge, closing costs defaults, all
  "NSW" UI text) is bit-for-bit identical before and after.


