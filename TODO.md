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

- [x] **TODO-63: jsdom + React Testing Library wiring test suite for `App.jsx`**
  Follow-up from TODO-62's evaluation (done). Originally scoped as a small
  3-5 test pilot, but the user explicitly asked to add as many tests as
  reasonably possible, so this landed much broader: **61 new tests across
  6 feature-scoped files**, on top of the existing 201 pure-function
  tests (263 total).
  Added `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`,
  `@testing-library/user-event` as devDependencies. Each new `.test.jsx`
  opts into jsdom per-file via a `// @vitest-environment jsdom` docblock -
  `vite.config.js`'s global `test.environment: 'node'` stays untouched,
  so every existing `calculations/*.test.js` file keeps running on the
  fast node environment unaffected. Shared `src/test/reactTestSetup.js`
  (imported explicitly per file, not wired into global `setupFiles`, to
  avoid running React's `cleanup()` after node-environment tests where
  `document` doesn't exist) handles `@testing-library/jest-dom` matchers
  and post-test cleanup.
  **A real environment bug found and fixed along the way**: Node 20+'s
  own experimental global `localStorage` (a no-op without a
  `--localstorage-file` CLI flag) shadows jsdom's working implementation,
  because vitest's jsdom environment setup only overrides global keys not
  already present on Node's own global, and `localStorage` isn't in its
  fixed override list. `reactTestSetup.js` force-assigns jsdom's real
  instance (exposed as `globalThis.jsdom.window.localStorage` by vitest's
  environment setup) onto `globalThis.localStorage` so
  `src/persistence/scenarioStorage.js`'s calls work correctly in tests -
  otherwise every persistence test would have silently failed.
  Test files: `App.mutualExclusionAndUpfront.test.jsx` (9 - FHB/Investment
  Property/Foreign Purchaser exclusion history from TODO-38/44, LMI
  checkbox LVR gating, Property Price/Deposit/Loan Amount invariants),
  `App.propertyTypeAndGating.test.jsx` (6 - house/unit Strata seeding,
  Investment Property gating Land Tax/Property Management, Property
  Summary visibility from TODO-42, independent show* toggles),
  `App.incomeSources.test.jsx` (11 - the House Rent/Room Rent category
  split from TODO-56, schedule defaults, validation, add/remove),
  `App.expensesAndContributions.test.jsx` (16 - Exceptional/Other
  Expenses validation and add/remove, Offset Contributions' duplicate-
  one-time-month guard, a representative `SteppedExpenseField` "Schedule
  a change" test), `App.collapsiblePanels.test.jsx` (12 - every `show*`
  toggle plus the `showPersonalExpenses` all-four-at-once gate),
  `App.persistence.test.jsx` (7 - save/load/clear round-trips, save
  failure, schema-version discard, saved-scenario-wins precedence).
  **Corrected two wrong assumptions found only by actually reading the
  code** (not just guessing from memory): `addOffsetContribution`'s
  invalid-amount path has no `alert()` at all (silently no-ops, unlike
  every other "Add" form) - adjusted that test accordingly instead of
  asserting a non-existent alert; and `SteppedExpenseField`'s "Schedule a
  change" mini-form has **no duplicate-month validation whatsoever**
  (the plan's assumption it mirrored `hasDuplicateOneTimeMonth` was
  wrong) - replaced with a real add/remove test of that component's
  actual behavior instead.
  Also worked around a genuine jsdom range-input quirk: setting a range
  input's value clamps immediately against its *current* `min`/`max`
  attributes, so testing an "inverted schedule" (Start Month > End Month)
  requires lowering End Month *before* raising Start Month, not the
  other order - raising Start first and then lowering End gets the End
  value clamped back up instead of creating the inversion.
  Verified: `npm test -- --run` (263/263, ~5.3s wall-clock vs. ~350ms for
  the pure-function suite alone - the added integration-test weight
  TODO-62 flagged as the real cost), `npm run lint` clean (no ESLint
  config changes needed - existing tests already use explicit
  `import {...} from 'vitest'` rather than relying on injected globals,
  so the new files follow the same pattern), `npm run build` clean and
  bundle size unaffected (test files aren't part of the production
  entry point).

- [x] **TODO-51: Add more charts to visualize progress**
  Requested by the user, who asked for concrete suggestions on which
  charts matter most. Asked the user to pick from the proposed list and
  where to place them: chose **#1 (Loan Balance vs. Offset vs. Effective
  Balance)** and **#3 (Principal vs. Interest per month, stacked)**, in
  their own new full-width card below "⏱️ Loan Simulation" (not inside
  the already-dense Timeline Explorer). Flagged one clarification before
  building: chart #2 ("with-offset vs. without-offset") as originally
  scoped would have compared `loanSimulation.monthlyData` against
  `baselineSimulation.monthlyData` - but `baselineSimulation`
  (`src/App.jsx`) only removes the user's *explicit* Offset Contributions
  while still applying the automatic monthly surplus, so it isn't the
  same "no offset at all" comparison as the existing static "Savings vs
  no offset" figure (`calculateNoOffsetTotalInterest`) - not built this
  round given the other two were prioritized instead.
  This is the app's **first real `recharts` usage** - the dependency
  existed unused since the Total Summary's income/expense ring is a plain
  CSS `conic-gradient`, not a chart component. New
  `src/components/LoanBalanceChart.jsx` (a `LineChart` with 3 lines -
  Loan Balance/Offset/Effective Balance, reusing `loanSimulation
  .monthlyData` directly, no new calculation needed) and
  `src/components/PrincipalInterestChart.jsx` (a stacked `AreaChart` -
  Principal/Interest per month).
  **One genuinely new calculation was needed despite the "no new
  calculation logic" framing**: `offsetSimulation.js`'s `monthlyData` only
  tracks `totalPrincipalPaid` as a running *cumulative* total (which is
  what the Timeline Explorer needs), not the per-month split the
  Principal/Interest chart needs - added `withMonthlyPrincipal`
  (`src/calculations/chartData.js`) to derive it by diffing consecutive
  cumulative totals, plus `getYearTickMonths` for both charts' X-axis
  year labels.
  **Two real bugs caught before shipping**: (1) X-axis labels initially
  showed nothing at all - `interval="preserveStartEnd"` only guarantees
  recharts' own *auto-sampled* ticks include the first/last one, it does
  **not** guarantee those sampled ticks land on year boundaries, so a
  `month % 12 === 0` formatter silently labelled nothing; fixed by passing
  an explicit `ticks={getYearTickMonths(...)}` array instead of relying on
  recharts' sampling at all. (2) A transient full-renderer freeze during
  browser verification turned out to be an unrelated Chrome-extension/CDP
  hiccup (reconnecting via `tabs_context_mcp` resolved it immediately,
  and DOM/SVG node counts were entirely normal - not a real app bug).
  Verified in the browser on the $850k default scenario: both charts
  render correctly with legible "1y"-"11y" x-axis labels: Loan Balance
  (red) declining gently, Offset (blue) rising, Effective Balance
  (purple) dropping fastest and crossing under Offset around year 7,
  reaching $0 at the ~11-year payoff point; hovering shows a tooltip with
  the exact month and all three formatted dollar figures; the Principal
  vs. Interest area chart shows the classic amortization crossover.
  `npm test -- --run` (270/270), `npm run lint`, and `npm run build` all
  clean - `recharts`' own dependencies did meaningfully grow the bundle
  (271KB → 627KB minified, 79KB → 184KB gzipped, triggering Vite's
  >500KB chunk-size advisory warning) - not addressed here (code-splitting
  would be its own separate task) but worth knowing about.

- [x] **TODO-65: Move the Charts card below Timeline Explorer, shrink it, and make it collapsible + lazy-rendered**
  Requested by the user right after seeing TODO-51's charts in the
  browser. Three changes to the "📈 Progress Over Time" card
  (`src/App.jsx`): **repositioned** from right after the main grid
  (before both "How This Calculator Works" and "Timeline Explorer") to
  the very bottom of the page, after Timeline Explorer's own closing
  `</div>` - confirmed via DOM order in the browser, not just visually.
  **Shrunk** both `LoanBalanceChart`/`PrincipalInterestChart`
  (`src/components/`) from a fixed `height={300}` to `height={200}`.
  **Made collapsible and genuinely lazy**: new `showProgressCharts`
  toggle (`config.showProgressCharts ?? false`, collapsed by default),
  wired into `handleSaveScenario`'s save/restore list alongside the other
  breakdown toggles from TODO-45. The chart components sit behind
  `{showProgressCharts && (...)}` - conditional JSX, not conditional CSS
  visibility - so recharts genuinely doesn't mount/render anything while
  collapsed, matching the explicit "standby" requirement rather than just
  hiding already-rendered charts.
  Verified in the browser: confirmed zero `.recharts-wrapper` elements
  exist in the DOM while collapsed (not merely hidden), and that
  "Timeline Explorer" precedes "Progress Over Time" in document order;
  expanded the card and confirmed both `.recharts-responsive-container`
  elements measure 200px tall (down from 300px) and mount correctly only
  at that point; saved the scenario with the card expanded, reloaded the
  page, and confirmed it came back expanded (▾) exactly as left. `npm
  test -- --run` (270/270), `npm run lint`, and `npm run build` all clean
  - purely additive to the scenario shape, no `SCHEMA_VERSION` bump
  needed (same precedent as TODO-45/59's other breakdown toggles).

- [x] **TODO-58: Extract NSW-specific logic behind a `state` module boundary**
  Follow-up from TODO-48's analysis (done). New
  `src/calculations/states/nsw.js` exports `{ code: 'NSW', label: 'New
  South Wales', calculateStampDuty, calculateForeignPurchaserSurcharge,
  fhbSchemeName: 'First Home Buyer Assistance Scheme',
  foreignPurchaserSurchargeRate: 0.08, defaultClosingCosts }` - moved
  `stampDuty.js`'s three functions and `closingCosts.js`'s
  `DEFAULT_CLOSING_COSTS` into it unchanged (old `stampDuty.js` deleted
  entirely - nothing else stayed behind that would've made it a
  meaningful file on its own; `closingCosts.js` keeps only the
  state-agnostic `sumClosingCosts` utility). New
  `src/calculations/states/index.js` registry (`STATES = { NSW: nsw }`,
  `getStateModule(code)` - falls back to NSW for an unrecognised code
  rather than throwing, since a config typo shouldn't crash the app).
  Added `"state": "NSW"` to `config.default.json`; `src/App.jsx` reads it
  via a plain `const stateModule = getStateModule(config.state ?? 'NSW')`
  - **deliberately not a `useState`**, since there's no UI to switch
  states yet, so it's effectively a fixed config-level setting like any
  other default.
  `App.jsx` swapped its direct `stampDuty.js` import for calls through
  `stateModule.calculateStampDuty`/`calculateForeignPurchaserSurcharge`,
  and every hardcoded "NSW" UI string now interpolates the module: the
  title, both "Upfront Costs (NSW)" headings, the Foreign Purchaser
  helper text and its surcharge line (both now also interpolate the
  *rate* itself, `stateModule.foreignPurchaserSurchargeRate`, not just
  the state code - a small improvement beyond the original plan, since
  hardcoding "8%" right next to a variable rate would have been half a
  fix). The First Home Buyer checkbox keeps its generic "First Home Buyer
  (NSW stamp duty concession)" wording (a differently-named scheme
  wouldn't fit naturally inlined there) and gained a new `InfoTooltip`
  instead, naming the actual `fhbSchemeName` ("New South Wales's First
  Home Buyer Assistance Scheme...") - placed as a sibling of the
  `<label>`, not nested inside it, since nesting it would have pulled the
  tooltip button's own `aria-label` into the checkbox's computed
  accessible name (caught by the TODO-63 wiring tests immediately).
  **Explicitly out of scope, confirmed unchanged**: `lmi.js` stays a
  single shared module; Land Tax stays a flat editable figure; no second
  state's real data was added - `README.md` gained a new "Adapting to
  another Australian state" section (per the user's request) spelling
  out exactly this: add a module under `states/`, register it, set
  `config.state` - and explicitly documenting that LMI and Land Tax are
  *not* part of this per-state boundary and why.
  Verified: `npm test -- --run` (274/274 - 4 new tests in
  `states/nsw.test.js` and `states/index.test.js`, replacing the deleted
  `stampDuty.test.js`), `npm run lint`, `npm run build` all clean.
  Confirmed in the browser every figure is bit-for-bit identical to
  before the refactor on the $850k default scenario, including with
  Foreign Purchaser checked (Stamp Duty -$9,797, Foreign Purchaser
  Surcharge (8%) -$68,000, Total Cash Required $389,547, Remaining
  Savings -$39,547 - matching TODO-43's original verification numbers
  exactly), plus the new tooltip rendering correctly on hover.

- [x] **TODO-64: Add Phone/Internet as a third default Personal Expense field; clarify Exceptional Expenses as the place for arbitrary personal expenses**
  Requested by the user, who corrected the original framing: Food/Transport
  were *not* replaced with an addable list. Added a third fixed
  `SteppedExpenseField` - `phoneInternetField` (`src/App.jsx`), mirroring
  `foodExpensesField`/`transportExpensesField` exactly (same `$/week`
  steppable-rate model via `useSteppedValue`), seeded at $7/week
  (≈$30.33/month via the existing 52÷12 conversion, matching the user's
  "~$30/month" ask). `calculateWeeklyPersonalExpenses`
  (`src/calculations/loan.js`) gained a third `phoneInternet = 0` param
  (defaulted for backward compatibility); wired through
  `offsetSimulation.js`'s `expenseFields.phoneInternet` the same way
  food/transport already were; added to `handleSaveScenario` and
  `config.default.json`'s `"phoneInternet": 7`. Also added the new field
  to the Monthly Expenses card's "Personal Expenses" breakdown (TODO-59)
  alongside Food/Transport.
  For arbitrary personal expense types, rather than building a new
  addable-list mechanism, clarified that **"Exceptional Expenses"**
  already is that mechanism - it already has add/remove + the Schedule
  model (one-time or repeating by date), exactly what the user asked
  for. Left its underlying behavior unchanged (still simulation-only, per
  its existing documented scope - deliberately did **not** decide whether
  it should now also count toward the static "Personal Expenses"/"TO
  OFFSET" summary, since that's a real behavior change the TODO itself
  flagged as needing a decision, not something to guess at). Only updated
  its copy to make the existing dual-purpose obvious: added a one-line
  explanation under the heading ("For one-off costs... or a recurring
  personal expense you'd like to track separately...") and broadened the
  "Expense Name" placeholder from "e.g. Wedding, Car Repair" to also
  suggest "Netflix, Gym Membership".
  Verified in the browser on the $850k default scenario: "Personal
  expenses breakdown" subtotal became $157/week (100+50+7); the three
  SteppedExpenseFields (Food $100, Transport $50, Phone/Internet $7) all
  render with their own "+ Schedule a change" option; the Monthly
  Expenses breakdown correctly shows Food -$433/Transport -$217/
  Phone/Internet -$30 summing to the row's own -$680 total (up from
  -$650 pre-TODO-64); the Exceptional Expenses form shows the new
  clarifying copy and broadened placeholder. `npm test -- --run`
  (275/275 - updated `loan.test.js`/`offsetSimulation.test.js` fixtures
  plus a new phoneInternet-specific assertion), `npm run lint`, and `npm
  run build` all clean.

- [x] **TODO-66: Rebuild Personal Expenses as an addable/removable list, same model as Income Sources - not steppable-rate sliders**
  Requested by the user, who corrected TODO-64's implementation - they
  did not want Food/Transport/Phone-Internet kept as fixed
  `SteppedExpenseField`s. Confirmed two open design questions with the
  user before building: **(1) merge with Exceptional Expenses into one
  list** (chosen over keeping two separately-labeled lists sharing the
  same mechanism) and **(2) seed the new list with Food/Transport/
  Phone-Internet as starter items** (chosen over starting empty like
  Income Sources).
  Deleted `foodExpensesField`/`transportExpensesField`/
  `phoneInternetField` (`useSteppedValue`) entirely. Renamed
  `exceptExpenses` → **`personalExpenseItems`** throughout
  (`src/App.jsx`, `src/calculations/offsetSimulation.js` and its tests) -
  this single Schedule-shaped list (`{id, name, amount, startMonth,
  recurrence, endMonth}`, same shape as `otherExpenseItems`) now covers
  both routine costs (Food/Transport/Phone-Internet) and one-off/
  exceptional ones (a wedding, car repair), merging what used to be two
  separate sections into one "Personal Expenses" card - `addExceptionalExpense`/
  `removeExceptionalExpense` renamed to `addPersonalExpense`/
  `removePersonalExpense` to match. Seeded via
  `config.default.json`'s new `personalExpenseItems` array (Food $433,
  Transport $217, Phone/Internet $30 - the exact monthly-equivalent
  figures TODO-64's weekly rates already produced via the 52÷12
  conversion, so the default scenario's total is bit-for-bit unchanged:
  still -$680/month).
  **The static "Personal Expenses" figure needed a real fix, not just a
  rename**: Exceptional Expenses previously only affected the simulation
  (Loan Simulation/Timeline Explorer), never the static "Personal
  Expenses"/"TO OFFSET" summary - merging Food/Transport/Phone-Internet
  into that same list meant the static summary would have silently
  dropped to $0 without a corresponding fix. `monthlyPersonalExpenses`
  now resolves via `getActiveAmount(personalExpenseItems, 1)` (the same
  month-1-snapshot convention Income Sources already uses), with
  `weeklyPersonalExpenses` derived as its `× 12/52` inverse purely for
  `calculateWeeklyNetBalance`'s own weekly-denominated math - both the
  static summary and the simulation now correctly read from the one
  merged list. Also removed `calculateWeeklyPersonalExpenses`/
  `calculateMonthlyPersonalExpenses` from `src/calculations/loan.js`
  entirely (dead code once nothing called them, same "delete rather than
  keep an unused formula library" precedent as the earlier TODO-10).
  The Monthly Expenses card's "Personal Expenses" breakdown
  (`showPersonalExpensesBreakdown`, TODO-59) changed from 3 hardcoded
  Food/Transport/Phone-Internet lines to a dynamic map over
  `personalExpenseItems.filter(item => isScheduleActive(item, 1))` -
  correctly reflects whatever items actually exist, not just the three
  original ones.
  **Bumped `SCHEMA_VERSION` 7 → 8** (`src/persistence/
  scenarioStorage.js`): this genuinely drops the
  `foodExpenses`/`transportExpenses`/`phoneInternet` (+ their
  `*Changes` companions) and `exceptExpenses` fields in favor of the new
  `personalExpenseItems` shape - old scenarios are discarded cleanly
  (same "half-migrated is worse than defaults" reasoning as TODO-36's
  bump) rather than silently losing this data.
  Small correctness fix along the way: the "Expense Name" field's
  default value was the leftover string `'Rent'` (an odd default given
  the field's actual purpose) - changed to `''` so the field starts
  genuinely empty.
  Verified in the browser on the $850k default scenario: "Personal
  expenses breakdown (subtotal: $680/month)" - identical total to
  before; expanded to see "Personal Expenses" listing Food/Transport/
  Phone-Internet with their exact dollar figures and "+ Schedule a
  change" replaced by real add/remove controls; added a "Netflix"
  item ($920/month) and watched the subtotal, Total Monthly Expenses,
  Net Monthly Balance, and Loan Simulation all correctly recalculate
  (10.8 → 13.9 years to pay off), then removed it and confirmed the
  total returned to $680; saved with the merged list, reloaded, and
  confirmed `localStorage`'s payload was `{version: 8, personalExpenseItems:
  [...]}` with no trace of the old fields; seeded a fake old `version: 7`
  scenario and confirmed it was discarded cleanly (fresh defaults loaded,
  "not saved yet" banner) rather than crashing or partially applying.
  `npm test -- --run` (272/272 - net -3 after removing the two dead
  `loan.js` functions' tests), `npm run lint`, and `npm run build` all
  clean.

- [x] **TODO-57: Implement scheduled/variable interest rate changes**
  Follow-up from TODO-53's analysis. `interestRate` (`src/App.jsx`) is now
  `useSteppedValue(config.interestRate, config.interestRateChanges)` -
  the exact same "Schedule a rate change" UI as Strata/Utilities/etc,
  reusing `SteppedExpenseField` directly with `suffix="% p.a."`. The
  static "month 1" figures (Repayments, Interest Amount, upfront-cost
  estimates, the "Savings vs no offset" baseline) all keep resolving the
  rate via `getSteppedValue(interestRateField.base, interestRateField.changes,
  1)`, same convention as every other stepped field - a deliberate,
  documented simplification for `calculateNoOffsetTotalInterest`'s
  illustrative baseline specifically.
  The real work is in `src/calculations/offsetSimulation.js`:
  `calculateLoanWithOffset` gained an optional `interestRateField` param
  (omitted entirely -> byte-for-byte identical to the old fixed-rate
  behavior, so none of the ~25 existing tests needed to change). When
  given, the loop resolves the annual rate every month via
  `getSteppedValue`, and on any month where it differs from the previous
  one, **recomputes** `monthlyPayment = calculateMonthlyPayment(balance,
  calculateMonthlyRate(newRate), maxMonths - months + 1)` - re-amortizing
  the *remaining* balance (not the original loan amount) over the
  *remaining* term (`+1` because `months` is the about-to-be-paid
  installment's own 1-indexed number, so the remaining term includes it)
  at the *new* rate, matching how real variable-rate mortgages actually
  work. Also fixed a real correctness gap surfaced by this change:
  `monthlyToOffset` (the caller's surplus figure) has the *original*
  month-1 payment baked into it (`App.jsx`'s `baseMonthlySurplus`) - a
  rate change discovered mid-loop is now reconciled via a
  `(initialMonthlyPayment - currentMonthlyPayment)` correction term each
  month, so the reported offset surplus actually moves with the new
  installment instead of silently staying pinned to the stale one.
  No `SCHEMA_VERSION` bump: unlike TODO-36/66's genuine field drops, this
  is purely additive - `interestRate` stays the same key/shape (a plain
  number = the stepped field's `base`), and the new `interestRateChanges`
  array key defaults cleanly to `[]` via `useSteppedValue`'s own default
  parameter when absent from an old saved scenario, exactly like every
  other stepped field's original (un-bumped) introduction.
  Added 3 new tests to `offsetSimulation.test.js` (275 total):
  no-scheduled-changes equivalence to the old fixed-rate call, a rate
  hike re-amortized over the remaining term still reaching a fully
  paid-off balance exactly at term end, and the surplus-correction term
  showing a smaller (but still flat) net deposit starting exactly on the
  change's month. `npm test -- --run` (275/275), `npm run lint`, and
  `npm run build` all clean.
  Verified in the browser: added a schedule change (7.5% from month 13)
  under Interest Rate - "Time to pay off" correctly rose from 10.8 to
  11.6 years, while the static "Repayments: $3,301" stayed unchanged
  (month-1 figure, as designed); saved, reloaded, and confirmed the
  scheduled change survived exactly as entered; removed it and confirmed
  the list emptied cleanly.

- [x] **TODO-67 (Analysis only, no code): Which purchase-recommendation/risk indicators are worth adding, and how should they be shown?**
  Requested by the user, who fed a rules list generated by another model
  (18 candidate rules + 2 bonus rules + a weighted 0-100 "Overall
  Purchase Score") in response to a data-model summary I wrote for that
  model. Findings, ranked by buildability against what the app already
  computes and actual value:
  **Already implemented - no new work:** LVR (rule #2) is already
  `LvrBadge.jsx`/`classifyLvr.js` with near-identical bands. Loan Payoff
  Time / Interest Saved (#9/#10) are already the Loan Simulation card.
  Foreign Purchaser surcharge display + its Remaining Savings impact
  (#18) shipped with TODO-43. Refinancing Readiness (#14) is just
  "LVR<80%" restated with different copy, not a new metric.
  **Redundant pairs - build one, skip the other:** Emergency Buffer (#1,
  "months of expenses covered by Remaining Savings") vs. Remaining
  Savings Ratio (#7, "% of original savings left") measure the same
  cushion two ways - keep Emergency Buffer only, since "N months
  covered" maps directly to the well-known 3-6-month rule of thumb and
  is more intuitive than a raw percentage. Net Monthly Cash Flow (#4) is
  already the existing Net Monthly Balance card (`getBalanceColor`,
  `src/calculations/ui.js`, $-based bands) - not worth re-deriving with
  the %-of-income bands the model suggested. Monthly Offset Contribution
  (#6) is already the "TO OFFSET" card, and its proposed flat-dollar
  bands ($1,000/$500/$100) don't scale with loan size - a healthy
  surplus on a $2M loan looks nothing like one on a $400k loan - so
  skip this rule's bands rather than adapt them.
  **Tier 1 (build first) - zero new inputs, all pure re-combinations of
  existing `App.jsx` values:** Emergency Buffer (`cashRemaining` /
  (`totalPropertyCost + monthlyPersonalExpenses`)); Housing Cost Ratio
  (`totalPropertyCost / (monthlyIncome + monthlyRentalIncome)` - the
  model's own cost list is exactly `totalPropertyCost`, nothing to
  re-derive); Interest Rate Stress Test (re-run
  `calculateMonthlyRate`/`calculateMonthlyPayment`/
  `calculateTotalPropertyCost`/`calculateMonthlyNetBalance` at
  `interestRate + 1/2/3` and report the highest survived delta before
  the balance turns negative - genuinely free given TODO-57's rate
  infrastructure just landed); Upfront Cost Ratio
  (`(totalCashRequired - downPayment) / propertyPrice`); an FHB
  concession-loss warning (state-agnostic: `isFirstHomeBuyer &&
  stampDuty > 0` already means the concession is partially or fully
  gone, no NSW-specific threshold numbers need to leak into `App.jsx`).
  **Tier 2 (investment-property-only), still zero new inputs:**
  Investment Cash Flow / gearing sign (`monthlyRentalIncome -
  monthlyPayment - monthlyPropertyExpenses`, positive vs. negative
  gearing); Vacancy Buffer (`cashRemaining` / monthly property costs);
  Rental Yield (annualize the existing House Rent/Room Rent
  `incomeSources` entries instead of asking for a separate "expected
  rent" figure - shows an "not enough data yet" state when no rental
  income has been entered rather than forcing a new field).
  **Tier 3 - novel, high value per the other model's own note, but each
  needs exactly one new optional input:** Mortgage-Free Age (needs the
  user's current age - a single new optional number field; the whole
  indicator just hides itself when left blank, so no one is forced to
  disclose it) and Offset Utilisation (offset balance / loan balance -
  already available with zero new input, since the Timeline Explorer's
  `monthlyData` already carries both `offset` and `balance` per month;
  surface it tied to whatever month the Timeline Explorer slider is
  currently on).
  **Deliberately not queued as TODOs yet - need more design first:**
  Equity Growth (needs a brand-new "assumed annual growth rate" input
  and an appreciation-modeling concept the app has zero infrastructure
  for today); Diversification (needs an "other investments/net worth"
  input entirely outside the property-purchase domain this app covers);
  the Overall Purchase Score (an appealing capstone, but the suggested
  weights are unsourced/arbitrary and risk collapsing a deliberately
  "not financial advice" tool into a single false-confidence verdict -
  revisit only after the individual indicators below have shipped and
  been used for a while).
  **Presentation design:** reuse `LvrBadge.jsx`'s own established
  pattern exactly (a colored dot/badge plus an `InfoTooltip`-style hover
  card showing the full threshold table) for every new indicator -
  already-proven precedent, no new visual language to invent. Group
  Tier 1 (+ Tier 2 when `isInvestmentProperty`) into one new collapsible
  card, "🩺 Purchase Health Check", placed right after Property Balance
  in the results column - one row per indicator: label, current value,
  colored dot, one-line recommended action, and an `InfoTooltip` for the
  full threshold table plus a short rationale/source note. Reuse
  `getBalanceColor`/`getBalanceBgColor` (`src/calculations/ui.js`)'s
  existing green/yellow/red convention for every new value instead of
  inventing new color logic - this directly answers the user's own "red
  alert if values are negative" instinct, since that infrastructure
  already exists in the code and just isn't applied broadly yet. Any
  indicator landing in its worst band (negative cash flow, LVR>90%,
  buffer<3 months, stress test fails at +1%) should ALSO surface as a
  red banner at the very top of the page - same visual weight as the
  existing green "✅ Income covers all expenses" banner, just its
  failure case - so a critical risk can't be missed by not expanding the
  collapsed card.
  Concrete follow-ups queued below: TODO-68 (Tier 1 core panel), TODO-69
  (Tier 2 investment-only extensions), TODO-70 (Tier 3 - Mortgage-Free
  Age + Offset Utilisation, the one new optional input).

- [x] **TODO-47: Add dark mode (mobile + web)**
  Requested by the user. `tailwind.config.js` now sets `darkMode: 'class'`
  (was unset, defaulting to OS-only `'media'` - no manual toggle was
  possible before this). New `src/hooks/useDarkMode.js`: its own
  independent `localStorage` key (`propertyCalculator.theme`, deliberately
  **not** part of `src/persistence/scenarioStorage.js` - a theme
  preference is a device setting, not scenario data, so it must survive
  "Reset to defaults"), falling back to `window.matchMedia('(prefers-
  color-scheme: dark)')` when nothing's saved yet, and toggling the `dark`
  class on `document.documentElement`. A matching inline boot `<script>`
  in `index.html`'s `<head>` runs the identical logic synchronously before
  `main.jsx` loads, so there's no flash of the wrong theme on first paint.
  A `Sun`/`Moon` (`lucide-react`, already a dependency) icon-only toggle
  button sits in the top header card next to the H1.
  The ~465 color-utility occurrences across `src/App.jsx` and
  `InfoTooltip.jsx`/`LvrBadge.jsx`/`NumberSliderField.jsx`/
  `SteppedExpenseField.jsx` were swept with a one-off Node script (word-
  boundary-safe regex, e.g. `\bbg-gray-50\b`, so it can never mismatch
  `bg-gray-500`) applying one consistent mapping table per color family
  (e.g. `bg-{c}-50→dark:bg-{c}-950`, `text-{c}-600/700/800→dark:text-{c}-
  400`, `border-{c}-100..400→dark:border-{c}-700/800`) - deliberately
  **not** touching solid CTA buttons (`bg-blue-600` etc, already fine
  in both themes), `focus:ring-*`, `accent-*`, or shadows. Three files
  holding literal Tailwind class strings returned from code (not JSX) -
  `src/calculations/ui.js` (`getBalanceColor`/`getBalanceBgColor`),
  `src/calculations/classifyLvr.js` (`LVR_BANDS`) - were hand-edited with
  the same mapping table instead (small enough to review directly);
  `NumberSliderField.jsx`'s `TRACK_CLASSES` slider-track map was caught by
  the scripted sweep automatically, being plain text in the same file.
  Fixed a collapsed-hover-state bug the sweep introduced (`hover:text-
  blue-700` and its base `text-blue-600` both mapped to the same
  `dark:text-blue-400`, making hover a no-op in dark mode) by giving the
  5 affected "+ Schedule a change"-style links a distinct
  `dark:hover:text-blue-300`. Also hand-fixed plain `<input>`/`<select>`
  elements that had no explicit background class at all (relying on the
  browser's native white default, which the sweep couldn't catch since
  there was no existing class to attach a `dark:` variant to) - the
  `NumberSliderField` number input plus 3 `<select>`s and 2 custom-name
  `<input type="text">`s in `App.jsx` and the "New amount" input in
  `SteppedExpenseField.jsx` all gained explicit `bg-white dark:bg-gray-700
  text-gray-900 dark:text-gray-100`.
  `LoanBalanceChart.jsx`/`PrincipalInterestChart.jsx` gained a new
  `isDarkMode` prop (passed from `App.jsx`) since recharts props never see
  Tailwind's `dark:` variant - the `CartesianGrid` stroke, axis tick fill,
  and `Tooltip`'s `contentStyle`/`labelStyle` (recharts defaults to a
  hardcoded white tooltip box otherwise) now switch color in JS; the
  data-series line/area colors and the Total Summary donut's inline
  `conic-gradient` hex values stay the same in both themes - already
  vivid enough to read on a dark card, confirmed visually rather than
  assumed.
  `getInitialIsDarkMode()`/the boot script both guard `typeof
  window.matchMedia !== 'function'` - jsdom (the app's test environment)
  doesn't implement it, and it isn't guaranteed in every embedding
  context either; without the guard, mounting `App` inside any test threw
  and took out all 61 wiring tests at once. `ui.test.js`'s exact-string
  assertions on `getBalanceColor`/`getBalanceBgColor` were updated to
  match the new `dark:`-suffixed return values.
  `npm test -- --run` (275/275), `npm run lint`, `npm run build` all
  clean. Verified in the browser: the app booted directly into dark mode
  on first load (the test machine's OS preference is dark - confirmed the
  `matchMedia` fallback path for real, not just by reading the code);
  swept every section (Purchase Details, Financial Position incl. the
  `SteppedExpenseField`-based Interest Rate control, Upfront Costs,
  Property/Personal Expenses breakdowns, Property Balance/Monthly
  Expenses/Income cards, Timeline Explorer, both Progress Over Time
  charts incl. their tooltip popovers, `LvrBadge`'s hover tooltip) -
  legible contrast everywhere, nothing invisible-on-invisible; toggled to
  light mode and confirmed no regression there either; reloaded with an
  explicit choice saved and confirmed no flash and the choice persisted;
  saved a scenario, confirmed dark mode via `localStorage` inspection
  (`javascript_tool`, to avoid triggering the native `Reset to defaults`
  `window.confirm()` dialog, which froze the CDP connection the one time
  it fired mid-verification - recovered via a plain `navigate()`), cleared
  the scenario key the same way `handleClearSavedScenario` does, reloaded,
  and confirmed the scenario reset to defaults while dark mode stayed on -
  the two preferences are genuinely independent.
  **Follow-up fix (same session)**: the user reported the page background
  outside the content stayed white at wide aspect ratios. Cause: the
  gradient background lives on the `max-w-7xl mx-auto`-constrained root
  div (`src/App.jsx`), so anything wider than that (ultrawide monitors) or
  the iOS overscroll-bounce area shows `html`/`body` underneath, which had
  no background of their own. Fixed with a plain CSS rule in
  `src/index.css` (`html, body { @apply bg-slate-50 dark:bg-slate-900; }`)
  - `body` alone would likely have been enough (Tailwind's base reset
  already zeroes its margin), but `html` is included too since it's what
  actually shows during mobile overscroll rubber-banding, not `body`.
  Verified in the browser at a 2200×900 window (`resize_window`) in both
  themes - the gutters outside the centered content now match the theme
  instead of staying white - and again at a 390×844 mobile portrait size.

- [x] **TODO-71: Fix the Remaining Savings colored panel not covering the full bottom of the Upfront Costs (NSW) card**
  Reported by the user. First attempt (adding `-mx-3 -mb-3 px-3 pb-3
  rounded-b-lg` to the "Remaining Savings" highlight div, canceling the
  card's own `p-3`) fixed the left/right edges but the user immediately
  caught that the bottom gap was still there in both themes, and
  correctly guessed the cause themselves: `space-y-1` on the parent row
  container. Confirmed via `getBoundingClientRect`/`getComputedStyle` in
  the browser - `-mx-3` worked (`margin-left/right: -12px`), but
  `-mb-3` computed to `margin-bottom: 0px` regardless of the class being
  present and matching the element (`el.matches('.-mb-3')` was `true`).
  Root cause: Tailwind's `space-y-1` implements its gap by setting
  `margin-top`/`margin-bottom` via a `--tw-space-y-reverse`-driven calc()
  on `> :not([hidden]) ~ :not([hidden])` - a higher-specificity selector
  than a plain single utility class - so it was silently overriding this
  row's own `-mb-3` (margin-bottom explicitly forced to 0 on the group's
  last child) while leaving margin-left/right untouched, since space-y-*
  never touches the x-axis.
  Real fix: moved the highlight div to be a **sibling** of the
  `space-y-1` container instead of its last child, so it's no longer
  targeted by that selector at all - kept its own `mt-1` (0.25rem,
  identical to the space-y-1 gap it used to inherit) so the visual
  spacing above it is unchanged. `-mx-3 -mb-3 px-3 pb-3 rounded-b-lg`
  now apply cleanly with nothing overriding them. Confirmed the nested
  red "you've committed $X more..." warning box (`cashRemaining < 0`)
  was never a separate issue - it's self-contained regardless of the
  parent's sizing.
  `npm test -- --run` (275/275), `npm run lint`, `npm run build` all
  clean. Verified precisely this time, not just visually: re-ran the
  same `getBoundingClientRect` check after the fix (`marginBottom:
  "-12px"`, card-bottom-to-highlight-bottom gap of 1px = exactly the
  card's own border width) and zoomed screenshots in both light and dark
  mode, for both the positive (green, default $28,453) and negative
  (red, forced by dropping Available Savings to $10,000) states - the
  highlight now genuinely reaches the card's rounded bottom corner with
  no gap in any of the four combinations.

- [x] **TODO-72/73/81/84: Grupo A - dark mode polish fixes**
  Four small, already-diagnosed dark-mode issues, fixed together since
  they're all quick Tailwind class additions in the same general area.
  **TODO-72** (labels with no text-color class at all, inheriting the
  browser's default near-black text - missed by TODO-47's regex-based
  sweep since there was no existing color class to attach a `dark:`
  variant to): added `text-gray-700 dark:text-gray-200` via one
  `replace_all` on the shared `className="block text-xs font-medium
  mb-1"` string, fixing all 6 spots at once (Number of People, Income
  Sources' Start/End Month, Offset Contributions' End Month, Personal
  Expenses' End Month, Other Expenses' End Month) in `src/App.jsx`.
  **TODO-73** (Monthly/Quarterly/Yearly recurrence buttons, same root
  cause): added `text-gray-800 dark:text-gray-100` via one `replace_all`
  on the shared `` `flex-1 py-1 rounded border capitalize ${` `` prefix,
  fixing all 4 forms (Income Sources, Offset Contributions, Personal
  Expenses, Other Expenses) at once - reads clearly against both the
  "selected" and "unselected" backgrounds in both themes.
  **TODO-81**: `src/components/NumberSliderField.jsx`'s slider min/max
  boundary labels - `dark:text-gray-500` wasn't light enough; simplified
  to a single `text-gray-400` with no `dark:` override at all, since
  gray-400 already reads fine on both a white and a dark card background.
  **TODO-84**: the top warning banner (`src/App.jsx`) - changed
  `dark:bg-amber-950` to `dark:bg-amber-950/40` (translucent, blends into
  the page instead of standing out as a bright block) and
  `dark:border-amber-800` to `dark:border-amber-900` (a more subdued
  border), keeping `dark:text-amber-400` so the warning icon/text still
  reads clearly.
  `npm test -- --run` (275/275), `npm run lint`, `npm run build` all
  clean - pure class-string changes, no logic touched. Verified in the
  browser in dark mode: opened the Income Sources Add form and confirmed
  "Start Month: 1"/"End Month: Forever" and the Monthly/Quarterly/Yearly
  buttons are all clearly legible now (previously invisible-ish black-
  on-dark text); zoomed the `$0`/`$3M`-style slider boundary labels and
  confirmed readable; confirmed the top banner reads noticeably calmer
  than before. Re-checked light mode too - no regression there.

---

## 🟡 MEDIUM PRIORITY (Important, but not blocking)

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

- [ ] **TODO-68: Add a "🩺 Purchase Health Check" panel - Emergency Buffer, Housing Cost Ratio, Interest Rate Stress Test, Upfront Cost Ratio, FHB concession-loss warning**
  Follow-up from TODO-67's analysis (done). A new collapsible card in the
  results column, right after Property Balance, one row per indicator:
  label, current value, colored dot (reuse
  `getBalanceColor`/`getBalanceBgColor`, `src/calculations/ui.js`), a
  one-line recommended action, and an `InfoTooltip` (reuse
  `LvrBadge.jsx`'s existing hover-table pattern) showing the full
  threshold table plus a short rationale. Five indicators, all zero new
  inputs:
  Emergency Buffer = `cashRemaining / (totalPropertyCost +
  monthlyPersonalExpenses)` in months (≥12 excellent, 6-12 good, 3-6
  moderate, <3 high risk - the standard "3-6 months" rule of thumb).
  Housing Cost Ratio = `totalPropertyCost / (monthlyIncome +
  monthlyRentalIncome)` (<30% excellent, 30-40% good, 40-50% caution,
  ≥50% high risk).
  Interest Rate Stress Test: re-run
  `calculateMonthlyRate`/`calculateMonthlyPayment`/
  `calculateTotalPropertyCost`/`calculateMonthlyNetBalance` at
  `interestRate + 1/2/3` and report the highest rate rise the current
  cash flow survives before going negative (survives +3% excellent,
  +2% good, +1% moderate, fails already at +1% high risk).
  Upfront Cost Ratio = `(totalCashRequired - downPayment) /
  propertyPrice` (<2% excellent, 2-4% normal, ≥4% high).
  FHB concession-loss warning: `isFirstHomeBuyer && stampDuty > 0` (the
  concession is partially/fully gone) - a plain warning line, not a
  banded indicator, no NSW-specific threshold numbers hardcoded in
  `App.jsx` (stays state-module-agnostic per TODO-58).
  Any indicator in its worst band should also trigger the shared red
  top-of-page banner (same weight as the existing green "✅ Income
  covers all expenses" banner) - see TODO-67 for why.

- [ ] **TODO-69: Extend the Purchase Health Check panel with investment-property-only indicators - gearing, Vacancy Buffer, Rental Yield**
  Follow-up from TODO-67's analysis (done) and TODO-68 (build that
  first - this reuses its panel/row/tooltip pattern). Three more rows,
  shown only when `isInvestmentProperty`, still zero new inputs:
  Gearing sign = `monthlyRentalIncome - monthlyPayment -
  monthlyPropertyExpenses` (positive = positive gearing, negative =
  negative gearing - not itself good/bad, just a label plus a reminder
  that negative gearing needs to be affordable from other income).
  Vacancy Buffer = `cashRemaining / (monthlyPayment +
  monthlyPropertyExpenses)` in months (≥6 excellent, 3-6 good, <3 high
  risk).
  Rental Yield = annualized existing House Rent/Room Rent
  `incomeSources` entries (`weeklyRentalIncome * 52`) divided by
  `propertyPrice` - **not** a new "expected rent" input (<3% weak, 3-5%
  average, ≥5% strong); show an explicit "not enough data yet" state
  instead of a 0%/weak reading when no rental income has been entered
  at all, since that's a missing-data case, not a real weak yield.

- [ ] **TODO-70: Add Mortgage-Free Age and Offset Utilisation indicators**
  Follow-up from TODO-67's analysis (done) - the other model's own
  suggestion, flagged there as genuinely novel (most mortgage
  calculators don't show either). Two additions to the Purchase Health
  Check panel (TODO-68):
  Mortgage-Free Age needs exactly **one new optional input**: the
  user's current age (a plain number field, e.g. in Financial Position).
  Left blank, this whole indicator hides itself - no one is forced to
  disclose it. Age at payoff = current age + `loanSimulation.years`
  (<60 green, 60-67 yellow, 67-70 orange, >70 red - bands from the other
  model's own suggestion).
  Offset Utilisation needs **no new input** - the Timeline Explorer's
  `monthlyData` already carries both `offset` and `balance` per month
  (`src/calculations/offsetSimulation.js`), so `offset / (offset +
  balance)` at whichever month the Timeline Explorer's slider currently
  sits on is already fully derivable. Surface it next to the Timeline
  Explorer itself rather than in the health-check panel, since it's
  inherently tied to a selected month, not a single static "right now"
  figure the way every other indicator here is (>20% green, 10-20%
  yellow, 5-10% orange, <5% red).

- [ ] **TODO-74: Rename the default Personal Expense "Food" to "Groceries"**
  Requested by the user. `config.default.json`'s `personalExpenseItems`
  seed data (`{"id": 1, "name": "Food", ...}`) - simple rename, no
  behavior change.

- [ ] **TODO-75: Update the "Routine costs (Food, Transport, a phone/internet bill)" copy to match the Groceries rename**
  Requested by the user, follow-up to TODO-74 - suggested replacement:
  "(Groceries, Transport, Bills)" or similar. This is the Personal
  Expenses section's descriptive copy in `src/App.jsx` (added in
  TODO-66), referencing the old seeded category names directly in text.

- [ ] **TODO-76 (Analysis first): Consider modeling Personal Expenses with categorized types, similar to Income Sources**
  Requested by the user. Income Sources has a category dropdown
  (`INCOME_CATEGORIES`/`INCOME_CATEGORY_DEFAULTS`,
  `src/calculations/incomeCategories.js`) with per-category Schedule
  defaults; Personal Expenses (TODO-66) is already a Schedule-shaped
  addable/removable list like Income Sources, but its "name" is a plain
  free-text field, no category picklist. Analyze whether a similar
  fixed category list (e.g. Groceries/Transport/Bills/Subscriptions/
  Entertainment/Custom) with sensible per-category defaults would be
  worth adding, and whether/how it should relate to the existing
  "Other Expenses" categories (`OTHER_EXPENSE_CATEGORIES`) - see
  TODO-78, which questions whether Other Expenses should exist as a
  separate concept at all.

- [ ] **TODO-77 (Important): Clarify whether Personal Expenses "Amount" is weekly or monthly, and that the Schedule model has no weekly recurrence option**
  Requested by the user, flagged as important - they weren't sure if
  the entered `amount` is meant per-week or per-month, would prefer
  weekly, but the Schedule model
  (`src/calculations/recurringAmount.js`'s `INTERVAL_MONTHS = {monthly:
  1, quarterly: 3, yearly: 12}`) only supports monthly/quarterly/yearly
  recurrence - there's no weekly option to pick, unlike Income Sources
  which is explicitly weekly-denominated (`calculateMonthlyFromWeekly`)
  by convention/copy alone, not by the Schedule shape itself. Needs a
  design decision: either make it explicit in the UI that Personal/
  Other Expenses amounts are monthly (labeling, tooltip), or extend the
  Schedule model to support a weekly interval (touches
  `isScheduleActive`/`getActiveAmount`/`countOccurrencesUpTo`/
  `formatScheduleLabel`, all keyed off `INTERVAL_MONTHS`, plus every UI
  spot that lists recurrence options) - suggest a solution before
  implementing either.

- [ ] **TODO-78 (Analysis): What's the actual advantage of "Other Expenses" vs. Personal Expenses - aren't they redundant?**
  Requested by the user. Both are now Schedule-shaped addable/removable
  lists with near-identical UI (add form, recurrence buttons, remove
  button) - Personal Expenses seeds Food/Transport/Phone-Internet,
  Other Expenses has its own category list (`OTHER_EXPENSE_CATEGORIES`:
  Health/Subscriptions/Entertainment/Debt Repayment/Custom). Analyze
  whether there's a genuine conceptual distinction worth keeping two
  separate sections for, or whether they should be merged into one
  (relevant to TODO-76's categorization question too).

- [ ] **TODO-79 (Analysis): Why is Offset Contributions Schedule's "One-Time Contributions Total" $0 by default, and revisit the promised Offset vs. Savings split**
  Requested by the user, who recalled that the app was supposed to let
  the user choose how much of their weekly/monthly surplus goes to the
  loan offset vs. their personal balance - this is exactly **TODO-49**
  ("Let the user choose how much of the automatic surplus goes to
  Offset vs. Savings"), still pending. The $0 default is expected/by
  design (no contributions scheduled yet, `calculateTotalScheduledOffset`
  returns 0 for an empty list) - not a bug - but confirms TODO-49's
  underlying feature (a user-configurable split) hasn't been built yet;
  today 100% of the surplus is automatic, full stop. Treat this as a
  reminder/re-confirmation to prioritize TODO-49, not a new separate
  investigation.

- [ ] **TODO-80 (Analysis, follow-up to TODO-49/79): How to track/persist the user's actual bank balance separate from the offset account**
  Requested by the user - if TODO-49's Offset vs. Savings split gets
  built, the "Savings" side needs to actually accumulate somewhere
  across the simulation (today `totalSavings`/`cashRemaining`,
  `src/calculations/totalCashRequired.js`, are static point-in-time
  figures, not a running balance over the simulation timeline). Analyze
  how hard this would be to maintain correctly (mirroring how
  `offsetBalance` already accumulates month-by-month in
  `src/calculations/offsetSimulation.js`) before TODO-49 is scheduled -
  check whether any existing variable already represents this, or
  whether it's a genuinely new piece of state to design.

- [ ] **TODO-82: Allow adding a custom "Misc property expense" line item in Property Expenses**
  Requested by the user. Property Expenses today is a fixed set of 8
  `SteppedExpenseField`s (Strata/Utilities/Council/Insurance/
  Maintenance/Water/Land Tax/Property Management, `src/App.jsx`) with
  no way to add anything not in that list - unlike Personal/Other
  Expenses, which are open-ended addable lists. Needs a design decision
  on shape (a single flat custom-amount field vs. a full Schedule-based
  addable list like the others) before implementing.

- [ ] **TODO-83: Allow adding a custom "Misc Upfront Cost" line item in Upfront Costs**
  Requested by the user, same idea as TODO-82 for the other fixed-field
  section - Upfront Costs is a fixed set of fields (Conveyancing/
  Building Inspection/Pest Inspection/Registration Fees/Searches/Loan
  Establishment Fee/Property Valuation/Home Insurance/Rate Adjustments,
  state module `defaultClosingCosts` + `src/App.jsx`) with no custom
  addition mechanism.

---

## ⚪ LOW PRIORITY (Deprioritized - excluded from default TODO listings)

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
  Moved here at the user's request - deprioritized, and excluded by
  default the next time TODOs are listed (ask before including it).





