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

---

## 🟡 MEDIUM PRIORITY (Important, but not blocking)

- [ ] **TODO-38: Decide how "Investment Property" should interact with First Home Buyer / stamp duty concession**
  Deferred from TODO-35 (done) by explicit user choice, to keep that
  diff scoped to just Land Tax/Property Management. In NSW, the First
  Home Buyer stamp duty concession requires occupying the property (not
  renting it out), but `isInvestmentProperty` (`src/App.jsx`) and
  `isFirstHomeBuyer`/`calculateStampDuty`
  (`src/calculations/stampDuty.js`) today have zero interaction - a user
  can tick both "First Home Buyer" and "Investment Property" and still
  get the FHB stamp duty discount, which doesn't reflect the real rule.
  Needs a decision on how far to take this: at minimum, hide/disable/
  uncheck "First Home Buyer" when "Investment Property" is on; possibly
  also a disclaimer noting the two are mutually exclusive in practice.
  Small in code once decided (a one-line effect or conditional render in
  `App.jsx`), but the policy call itself needs its own discussion, same
  as TODO-35's original open question.

- [ ] **TODO-36: Add a Schedule-based expense list for Health/Subscriptions/Entertainment/Debt Repayments; replace "Other" with custom expenses**
  Requested by the user, referencing a bank-style Housing/Living/Debt
  categorization. Analysis of what fits where:
  - **Housing** maps to today's "Property Expenses" already (see TODO-35
    for its additions) - "Mortgage/Rent" deliberately excluded from any
    editable expense list, since the mortgage is already the core loan
    repayment calculation elsewhere, not a discretionary line item, and
    "Rent" doesn't apply (this app assumes the user is buying, not renting
    their own place).
  - **Living + Debt** are where the new work is. **Recommendation: don't
    fold Food/Transport into a new list** - they're `SteppedExpenseField`s
    today (`foodExpensesField`/`transportExpensesField`,
    `useSteppedValue`/`getSteppedValue`) and already support "current rate
    that changes at a scheduled month" (TODO-19's "Schedule a change").
    Moving them to the Schedule/list model (TODO-31's
    `getActiveAmount`/`recurrence`) would lose that specific capability
    unless rebuilt there too - not worth it since they already work well
    for "an ongoing rate that occasionally changes."
  - Health, Subscriptions, Entertainment, and Debt Repayments are
    different in kind - each is more naturally "a distinct expense with
    its own lifecycle" (a subscription starts and gets cancelled, a loan
    ends when paid off) - exactly what TODO-31's Schedule model
    (`{startMonth, recurrence: 'none'|'monthly'|'quarterly'|'yearly',
    endMonth}`) already fits, reused directly rather than inventing
    another shape. **Don't split Debt into Personal Loan/Car Loan/Credit
    Card presets** - a single generic "Debt Repayment" category plus a
    free-text/custom name (e.g. typing "Car Loan") covers the same ground
    without three near-identical presets.
  - **Replace the "Other" field entirely** with an "Add Custom Expense"
    entry in this same new list (not a dropdown category, just a free
    name) - covers Pet Expenses/Childcare/Gym/Parking/Coffee/Streaming/
    whatever else, per the user's own examples, without needing a preset
    for each.
  Net shape: Property Expenses card keeps Strata/Utilities/Council
  Rates/Insurance/Maintenance/Water Rates as `SteppedExpenseField`s (per
  TODO-35); Personal Expenses card keeps Food/Transport as
  `SteppedExpenseField`s, loses the standalone "Other" field, and gains a
  new list (mirroring Income Sources' UI/state pattern exactly: add-form
  with name/amount/one-time-checkbox/recurrence/end-month, a list with
  remove buttons) seeded with Health/Subscriptions/Entertainment/Debt
  Repayment presets plus free-text custom entries. Needs the same
  `offsetSimulation.js` wiring TODO-31 already did for `incomeSources`/
  `exceptExpenses` (pass the list in, resolve per month via
  `getActiveAmount`), and another `SCHEMA_VERSION` bump.

---

## 🟢 LOW PRIORITY (Polish, refactoring, cleanup)

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

- [ ] **TODO-37: Replace the Property Type button pair with a dropdown**
  Requested by the user - the two big House/Unit buttons
  (`src/App.jsx:538-556`, `handlePropertyTypeChange`) feel oversized for a
  simple two-option choice; a combo box/dropdown (`<select>`) reads better.
  Same pattern already used elsewhere in the app (e.g. the Income Name
  picklist) - swap the two `<button>`s for a single `<select value=
  {propertyType} onChange={(e) => handlePropertyTypeChange(e.target.value)}>`
  with House/Unit ⁄ Apartment options; `handlePropertyTypeChange` itself
  (the strata-default-on-switch-to-unit logic) needs no changes.
  