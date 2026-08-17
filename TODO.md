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

- [x] **TODO-74/75: Grupo B - rename default Personal Expense "Food" to "Groceries" + update matching copy**
  `config.default.json`'s seeded `personalExpenseItems` entry renamed
  `Food` → `Groceries`; the Personal Expenses section's descriptive copy
  in `src/App.jsx` updated from "Routine costs (Food, Transport, a
  phone/internet bill)" to "Routine costs (Groceries, Transport, Bills)".
  Also updated every code comment that referenced the old seed names by
  name, so they don't go stale (`src/App.jsx` ×3, `src/calculations/
  offsetSimulation.js` ×2) - left the "Expense Name" input's generic
  placeholder (`"e.g. Food, Transport, Wedding, Netflix"`) and the "How
  This Calculator Works" section's generic "(food, transport, etc.)"
  aside untouched, since neither actually names the seeded item, just
  illustrative examples.
  Found and fixed 4 test assertions across `App.collapsiblePanels.test.jsx`
  and `App.propertyTypeAndGating.test.jsx` that expected the literal text
  `Food`/`Food:` - updated to `Groceries`/`Groceries:` to match.
  `npm test -- --run` (275/275), `npm run lint`, `npm run build` all
  clean. Verified in the browser: expanded the Personal Expenses
  breakdown and confirmed the seeded item now reads "Groceries" and the
  section's description reads "Routine costs (Groceries, Transport,
  Bills)...".

- [x] **TODO-76/77/78 (Analysis, Grupo C): Personal Expenses categorization, the Amount weekly/monthly ambiguity, and Other Expenses redundancy**
  Requested by the user, three interrelated questions analyzed together
  since they share the same underlying code.
  **TODO-78 - confirmed genuinely redundant.** Personal Expenses and
  Other Expenses (`src/App.jsx`) are near-total duplicates: identical
  Schedule shape, identical add-form mechanics (One-Time checkbox, Start
  Month slider, Monthly/Quarterly/Yearly buttons, End Month slider),
  identical `NumberSliderField` "Amount ($)" control (the only
  difference is the slider's max - $500k for Personal vs. $50k for
  Other, a range-tuning choice, not a conceptual one), identical
  remove-by-✕ mechanic, and both feed the exact same
  `getActiveAmount`/simulation totals with zero differentiated
  treatment. The only real differences: Personal Expenses has a
  free-text name input and ships seeded with 3 starter items
  (Groceries/Transport/Phone-Internet); Other Expenses has a category
  dropdown (`OTHER_EXPENSE_CATEGORIES`: Health/Subscriptions/
  Entertainment/Debt Repayment/Custom) and ships with **zero** seeded
  items, and its section has no descriptive text at all explaining what
  distinguishes it from Personal Expenses (Personal Expenses does: "Routine
  costs... or one-off/exceptional costs..."). Conclusion: no meaningful
  conceptual or computational distinction exists today - recommend
  merging into one section.
  **TODO-76 - recommend reusing Other Expenses' category list, not
  Income Sources' full pattern.** If merged, the natural category list
  is `OTHER_EXPENSE_CATEGORIES` extended with Groceries/Transport/Bills
  (Personal Expenses' current starter names), still ending in "Custom"
  for free text - directly reusing the dropdown-plus-Custom-reveals-a-
  text-field pattern already built for Other Expenses. Unlike Income
  Sources, recommend **skipping** per-category Schedule defaults
  (`INCOME_CATEGORY_DEFAULTS`'s equivalent) - income has a strong
  one-time-vs-recurring convention per category (Bonus vs. Salary);
  expense categories don't have an equally strong convention, so a
  per-category default would mostly just be noise.
  **TODO-77 - confirmed this is a labeling gap, not a data-model gap.**
  The "Amount ($)" field (both sections) has no cadence qualifier at
  all, unlike Income Sources' explicit "Weekly Amount ($)" label.
  Traced the actual consumption: when recurrence is `'monthly'`, the
  entered amount is used **directly** as a monthly dollar figure by
  `getActiveAmount`/`src/calculations/offsetSimulation.js` - there is no
  weekly-to-monthly conversion anywhere for Personal/Other Expenses
  (unlike Income Sources' explicit `calculateMonthlyFromWeekly`, ×52/12).
  Confirmed by the seeded magnitudes too: Groceries $433 as a *monthly*
  figure (≈$100/week) is realistic; as a *weekly* figure it would be
  ≈$1,878/month, unrealistically high. So the amount is already
  unambiguously monthly-equivalent by construction - recommend
  **against** adding a genuine weekly interval to the Schedule model
  (`src/calculations/recurringAmount.js`'s `INTERVAL_MONTHS = {monthly:
  1, quarterly: 3, yearly: 12}` is denominated in whole months by
  design - `isScheduleActive`'s `(month - startMonth) % INTERVAL_MONTHS
  === 0` check only makes sense at month granularity; shoehorning weeks
  in would mean restructuring the model's fundamental unit across every
  consumer, disproportionate to the actual problem). Recommend instead a
  cheap, purely cosmetic fix: relabel the field to make the monthly
  convention explicit (e.g. "Monthly Amount ($)").
  **Concrete follow-up queued**: TODO-85, combining all three
  conclusions into one implementation task.

- [x] **TODO-49/79/80: Grupo D - let the user split the monthly surplus between Offset and Savings**
  TODO-79/80 (analysis, done) confirmed TODO-49 was never built - 100% of
  the surplus went to the offset unconditionally - and that `cashRemaining`
  (`src/calculations/totalCashRequired.js`) already represents the user's
  actual bank balance right after settlement, just not as a *running*
  balance over the simulation timeline. This built the real feature using
  that finding directly.
  New `offsetAllocationPct` state (`src/App.jsx`, default **100** -
  preserves the original "100% to offset" behavior byte-for-byte unless
  changed), a new "Offset Allocation" `NumberSliderField` in Financial
  Position. `calculateLoanWithOffset`
  (`src/calculations/offsetSimulation.js`) gained two new params -
  `offsetAllocationPct = 100` and `initialSavingsBalance = 0`, both
  defaulting to the exact old behavior - and now splits each month's
  `netMonthlyDeposit` between `offsetBalance` and a new `savingsBalance`
  accumulator (mirrors how `offsetBalance` already accumulates), pushing
  a new `savings` field into `monthlyData` alongside `offset`. Both
  `loanSimulation` and `baselineSimulation` calls in `App.jsx` pass the
  same `offsetAllocationPct` and seed `initialSavingsBalance: cashRemaining`,
  so "interest saved" still isolates just the effect of manual
  contributions, not the split itself. `getTimelineSnapshot`
  (`src/calculations/timelineSnapshot.js`) gained a matching
  `initialSavingsBalance` param to seed `savings` at its synthetic month-0
  snapshot.
  UI: the "🎯 TO OFFSET" card stays exactly as-is at 100%; below 100% its
  title becomes "🎯 MONTHLY SURPLUS" and a new two-box breakdown shows "To
  Offset (X%)" / "To Savings (100-X%)", splitting the already-computed
  `monthlyToOffset` figure - no new calculation needed there. The header
  tagline is conditional the same way - unchanged at 100%, otherwise
  "...X% goes to your offset automatically, the rest builds your
  savings." The Timeline Explorer's "🏦 Loan | 💰 Offset" line gained a
  third "🐖 Savings" figure. `offsetAllocationPct` persists via
  `handleSaveScenario` - purely additive, **no `SCHEMA_VERSION` bump**
  (defaults to 100 via `config.offsetAllocationPct ?? 100` on an old
  save, identical to every other additive change this session).
  Explicitly out of scope (separate pending TODOs): interest accruing on
  the savings balance (TODO-50); `noOffsetTotalInterest`'s baseline stays
  untouched (already a deliberate fixed-payment-only simplification).
  Added 4 new tests to `offsetSimulation.test.js` (284 total) plus a
  `timelineSnapshot.test.js` update: default behavior unchanged, a
  70%/30% split diverts the correct amounts, `initialSavingsBalance`
  seeds and accumulates correctly, and passing `100` explicitly matches
  omitting the params entirely. `npm test -- --run`, `npm run lint`,
  `npm run build` all clean.
  Verified in the browser: at the 100% default, the card/header/Timeline
  Explorer are all unchanged from before this feature existed; set to
  70% - the card split into "To Offset (70%): $1,729" / "To Savings
  (30%): $741" (exactly 70%/30% of the $2,470 total surplus), the header
  updated, payoff time rose from 11.6 to 14.0 years and total interest
  from $258,967 to $323,239 (less money reaching the offset, as
  expected), and the Timeline Explorer's Savings figure grew from
  $28,453 at month 0 to $78,546 by month 81; set back to 100% and
  confirmed everything reverted exactly; saved, reloaded, confirmed the
  70%/55% split persisted; cleared the scenario (`localStorage`, to
  avoid the native `Reset to defaults` confirm dialog that previously
  froze the CDP connection during TODO-47's verification) and confirmed
  it reset cleanly to the 100%/default tagline.

- [x] **TODO-68/69/70: Grupo E - "🩺 Purchase Health Check" panel (10 indicators)**
  Follow-up from TODO-67's analysis (done). New `src/calculations/
  purchaseHealthCheck.js`: a generic `classifyByBands(value, bands)`
  helper (generalizes `classifyLvr.js`'s own mechanism - bands ordered
  highest-`min`-first, works identically whether higher or lower is
  "better" since direction is just baked into which band a threshold
  labels) plus a calculate+classify pair per indicator. New reusable
  `src/components/HealthCheckIndicator.jsx` row (label + `InfoTooltip` +
  colored symbol/value + one-line action) used by all 10 indicators
  instead of repeating the markup - new collapsible "🩺 Purchase Health
  Check" card in `src/App.jsx`, right after Property Balance, default
  **open** (unlike the "breakdown" toggles, which default closed).
  **Tier 1** (always shown, zero new inputs): Emergency Buffer, Housing
  Cost Ratio, Interest Rate Stress Test (re-amortizes at +1/+2/+3% and
  reports the highest survived delta), Upfront Cost Ratio, and a
  state-agnostic FHB concession-loss warning (`isFirstHomeBuyer &&
  stampDuty > 0` - reacts to the state module's own output, no NSW
  thresholds hardcoded in `App.jsx`, per TODO-58).
  **Tier 2** (`isInvestmentProperty`-gated, zero new inputs): Gearing
  (a label only, not itself good/bad), Vacancy Buffer, Rental Yield
  (annualizes existing rental `incomeSources`, with an explicit "not
  enough data yet" state instead of a misleading 0%/weak reading when
  no rental income has been entered).
  **Tier 3**: Mortgage-Free Age needs the **one** new input the analysis
  called for - "Your Current Age (optional)" in Financial Position,
  where **0 means "not provided"** (a `NumberSliderField` with a custom
  `formatValue` showing "Not set", rather than a true blank/empty
  input - simplest fit for this codebase's all-numeric-fields
  convention) and hides the indicator entirely. Offset Utilisation needs
  no new input - added next to the Timeline Explorer itself (not the
  main panel), tied to `snapshot.offset`/`snapshot.balance` at whichever
  month the Timeline Explorer's own slider is on.
  Two deliberate scope adjustments from TODO-67's original phrasing,
  called out here rather than silently: the "shared red top-of-page
  banner" became a banner **inside the health-check card itself**
  (`healthCheckHasCritical`, true when any Tier 1 indicator or the FHB
  warning is critical) rather than modifying the fixed page-top hero
  area - less invasive, same effect (impossible to miss without
  expanding the card, which is open by default anyway). The "full
  threshold table" from `LvrBadge.jsx`'s tooltip became short prose +
  a one-line threshold summary in each `InfoTooltip`, not a literal
  `<table>` - keeps `HealthCheckIndicator` simple across 10 reuses.
  `offsetAllocationPct`'s persistence pattern reused: `currentAge`/
  `showHealthCheck` added to `handleSaveScenario` - purely additive, no
  `SCHEMA_VERSION` bump.
  Added 24 new tests to a new `purchaseHealthCheck.test.js` covering
  every calculate/classify function and all documented band boundaries.
  `npm test -- --run` (304/304), `npm run lint`, `npm run build` all
  clean.
  Verified in the browser on the app's own default scenario (a genuine,
  useful finding, not just a smoke test): Housing Cost Ratio correctly
  flagged 🔴 55% (high risk) and the FHB concession-loss warning
  correctly fired (`$850k` sits in NSW's $800k-$1M taper zone, so
  `stampDuty` is already > 0 despite `isFirstHomeBuyer`), both real
  issues with the shipped default config, not bugs in the indicator
  logic; confirmed the critical banner appeared because of them.
  Switched to Investment Property and checked all three Tier 2 rows
  (Gearing, Vacancy Buffer, and Rental Yield's "not enough data" state
  before adding rental income); set Current Age to 35 and confirmed
  Mortgage-Free Age showed 🟢 47 (35 + 11.6 years, rounded); moved the
  Timeline Explorer's slider and confirmed Offset Utilisation tracked
  the selected month (21.4% at month ~70); confirmed an `InfoTooltip`
  opens correctly showing the threshold summary.

- [x] **TODO-86/87: Grupo H - two more "missing text-color class" dark-mode bugs, plus a sweep for others**
  Same root cause as TODO-72/73: a text-bearing element with zero
  `text-*` class at all, missed by TODO-47's regex-based sweep since
  there was nothing for it to attach a `dark:` variant to. Fixed both
  reported instances in `src/App.jsx`: the Total Summary donut's
  "Income"/"Expenses" legend rows (now `text-gray-700 dark:text-gray-200`)
  and the "TO OFFSET (automatic)" card's "Per week"/"Per fortnight" value
  spans (same treatment, matching the sibling "Per year" line's own
  color weight rather than reusing its green, to keep the two rows
  visually distinct from the actual highlighted total).
  Also did the requested broader sweep for any other remaining instances
  (`font-semibold`/`font-bold` classNames without `text-`, bare
  `flex items-center gap-1` divs) - every other candidate found (5
  `font-bold` wrapper divs around lines 2019/2163/2187/2211/2252, the
  Loan Simulation card's two `<p className="font-semibold">` elements,
  and the Timeline Explorer's Loan/Offset/Savings spans) turned out to
  be false positives on inspection: each one's children already carry
  their own explicit color, or correctly inherit one from a colored
  ancestor (e.g. the Timeline Explorer spans sit under a parent `div`
  with `text-gray-500 dark:text-gray-400`). No further fixes needed.
  Re-checked the donut's "65%" center label flagged in TODO-86's own
  write-up - it already has `text-gray-500 dark:text-gray-400`, so this
  was a false alarm (likely just looking dim next to the actually-broken
  Income/Expenses text beside it before this fix).
  `npm test -- --run` (304/304), `npm run lint`, `npm run build` all
  clean. Verified both fixes visually in the browser in dark mode - "Per
  week: $570" / "Per fortnight: $1140" and the "Income"/"Expenses" legend
  now render in light gray instead of near-black.

- [x] **TODO-88: Grupo I - Replace "Your Current Age" 0-means-not-set with an explicit enable/disable checkbox**
  Feedback on TODO-70's own implementation choice. `src/App.jsx`'s
  "Your Current Age (optional)" field used to overload `0` as a
  sentinel for "not provided" - replaced with a new `showMortgageFreeAge`
  boolean (defaults to `false`), restructured the same way as the
  "Foreign Purchaser"/"Pay LMI upfront in cash" checkboxes elsewhere in
  the file: a checkbox that reveals a dependent field when checked.
  Checked, it reveals "Your Current Age" (now a plain `NumberSliderField`,
  `min`/`sliderMin` of 18, no more `formatValue`/`suffix` hacks since
  the value no longer carries a special "not set" meaning) and gates the
  Mortgage-Free Age row in the Purchase Health Check panel; unchecked,
  both stay hidden regardless of whatever `currentAge` happens to hold.
  `currentAge`'s own default changed from `0` to `30` so the field never
  opens on a meaningless "0 years" - old saved scenarios with
  `currentAge: 0` are unaffected since `showMortgageFreeAge` defaults to
  `false` regardless.
  `showMortgageFreeAge` added to `handleSaveScenario` - purely additive,
  no `SCHEMA_VERSION` bump.
  `npm test -- --run` (304/304), `npm run lint`, `npm run build` all
  clean (no existing tests touched this field). Verified in the browser:
  unchecked by default, no "Your Current Age" field and no Mortgage-Free
  Age row; checking it reveals the age slider at 30 and the row appears
  (🟢 41, matching 30 + ~11.6 years' loan simulation); unchecking hides
  both again cleanly.

- [x] **TODO-82/83: Grupo J - custom "Misc" line items in Property Expenses and Upfront Costs**
  Design decision (was left open in both TODOs' original wording): a
  single flat field, not a full addable list like Personal/Other
  Expenses - "Misc" implies one catch-all line, not an open-ended
  category system, and it keeps both sections' existing fixed-field
  shape intact.
  **TODO-82**: new "Misc Property Expense (monthly)" - a
  `SteppedExpenseField` (same schedule-based shape as the other 8
  Property Expenses fields, so it can change mid-simulation like any of
  them), added last in the main grid (applies to every property type,
  unlike Land Tax/Property Management which stay investment-only).
  `calculateMonthlyPropertyExpenses` (`src/calculations/loan.js`) gained
  a `miscPropertyExpense = 0` param; `offsetSimulation.js`'s loop reads
  `expenseFields.miscPropertyExpense` defensively (`? ... : 0`) so
  existing hand-built `expenseFields` objects in tests that omit the key
  keep working unchanged. Also added to the "Monthly Expenses" breakdown
  list in the Property Balance card.
  **TODO-83**: new "Misc Upfront Cost" - a plain `NumberSliderField`
  (matching the rest of Upfront Costs, which are one-time amounts, not
  schedule-based), added last in the closing-costs breakdown and folded
  into `closingCostsSubtotal` via `sumClosingCosts` (already a generic
  sum, so no calculation-layer change needed there).
  Both persisted via `handleSaveScenario` - purely additive, no
  `SCHEMA_VERSION` bump.
  Added 4 new tests (`loan.test.js`: default-to-0 and adds-when-present;
  `offsetSimulation.test.js`: subtracts monthly when present, defaults
  to 0 when the key is absent from `expenseFields`).
  `npm test -- --run` (308/308), `npm run lint`, `npm run build` all
  clean. Verified in the browser: setting Misc Property Expense to $50
  raised the Property Expenses subtotal $543 -> $593/month and correctly
  rippled through to "TO OFFSET"'s per-week/fortnight/year figures and
  "Time to pay off" (129 -> 130 months); setting Misc Upfront Cost to
  $1,000 raised the Closing Costs subtotal $4,750 -> $5,750 and Upfront
  Cost Ratio 1.7% -> 1.8%.

- [x] **TODO-85: Merge Other Expenses into Personal Expenses as one categorized list, and relabel the Amount field**
  Follow-up from TODO-76/77/78's analysis (done). `src/App.jsx`'s
  "Other Expenses" section (category dropdown + Custom, no seeded items)
  and "Personal Expenses" section (free-text name, seeded with Groceries/
  Transport/Phone-Internet) merged into one: `personalExpenseItems`
  absorbs everything, `otherExpenseItems` and its whole draft-state/
  handler pair (`addOtherExpenseItem`/`removeOtherExpenseItem`) deleted
  outright. `OTHER_EXPENSE_CATEGORIES` renamed `PERSONAL_EXPENSE_CATEGORIES`
  and extended: `['Groceries', 'Transport', 'Bills', 'Health',
  'Subscriptions', 'Entertainment', 'Debt Repayment', 'Custom']` (default
  selection now `'Groceries'`, was `'Health'`). The surviving Personal
  Expenses card's free-text "Expense Name" input became the category
  `<select>` + conditional Custom text field (Other Expenses' existing
  pattern), keeping the yellow/orange theme. No per-category Schedule
  defaults, per TODO-76's own recommendation. Item shape is unchanged
  (`{id, name, amount, startMonth, recurrence, endMonth}`) - category is
  an add-time-only concept used to derive `name`, not a stored field
  (matches Income Sources, which has no stored category either).
  `calculateLoanWithOffset` (`src/calculations/offsetSimulation.js`) lost
  its `otherExpenseItems` param entirely (not deprecated - an internal
  function, both call sites updated in the same change); Timeline
  Explorer's `[...personalExpenseItems, ...otherExpenseItems]` spread
  simplified to just `personalExpenseItems`; `handleSaveScenario` drops
  `otherExpenseItems`.
  **Genuine behavior fix, not just a relabeling**: the "right now" Net
  Balance/TO OFFSET figures previously excluded Other-Expenses-style
  items by construction (a known inconsistency per TODO-77's analysis) -
  post-merge, anything added under Health/Subscriptions/etc. now
  correctly counts toward those static figures too. Verified live: adding
  a $50/month "Subscriptions" item raised the subtotal $680 -> $730 and
  dropped TO OFFSET $2470 -> $2420 immediately, not just in the
  simulation.
  **UX behavior change worth flagging**: the blank-name alert is now
  reachable only when `Custom` is selected with an empty custom-name
  field (every other category is a fixed truthy string) - previously
  reachable directly via free text. Intentional, matches how Other
  Expenses already worked.
  `SCHEMA_VERSION` bumped 8 -> 9 in `src/persistence/scenarioStorage.js`
  (comment follows the same template as TODO-36/66's prior bumps) -
  `otherExpenseItems` could hold real user data, so old scenarios are
  discarded cleanly rather than migrated. Removed the now-unused
  `newOtherExpenseAmount` key from `config.default.json`.
  Consolidated tests: `offsetSimulation.test.js` - deleted the
  `otherExpenseItems` recurring-expense test (fully redundant with an
  existing `personalExpenseItems` test), converted the one-time-expense
  test to use `personalExpenseItems` (the only test proving an item is
  absent before/after its exact month, not duplicated elsewhere).
  `App.expensesAndContributions.test.jsx` - merged the separate Personal/
  Other Expenses `describe` blocks into one, keeping the Custom-reveal
  test and both a category-pick and a Custom-name add/remove round-trip.
  `App.collapsiblePanels.test.jsx` - merged the two "+Add reveals..."
  tests into one, updated "gates all three sub-sections" to two.
  `scenarioStorage.test.js` - hardcoded `version: 8` fixtures updated to 9.
  `npm test -- --run` (303/303), `npm run lint`, `npm run build` all
  clean. Verified in the browser: no separate "Other Expenses" card
  exists; the category dropdown defaults to "Groceries", Custom reveals
  the free-text field; adding/removing a "Subscriptions" item works and
  correctly moves the static figures (above); "Monthly Amount ($)" reads
  correctly while Offset Contributions' own "Amount ($)" label is
  untouched; saved a fresh scenario and confirmed via localStorage
  inspection it's `version: 9` with no `otherExpenseItems` key; seeded a
  fake `version: 8` payload (with a fake `otherExpenseItems` array) and
  confirmed it was discarded cleanly on reload (fresh defaults, no crash).

- [x] **TODO-50: Model bank interest on the savings balance (customizable rate)**
  Requested by the user. Hooked into TODO-49's `savingsBalance` (`src/
  calculations/offsetSimulation.js`) - the running total of surplus NOT
  sent to the loan offset, seeded from `cashRemaining` - rather than the
  static `totalSavings`/`cashRemaining` figures directly, since that's
  where money actually "sits" over the simulation timeline.
  New `savingsInterestRate` param (annual %, default **0** - every
  existing scenario/test behaves byte-for-byte identically until the user
  opts in), new green "Savings Interest Rate" `NumberSliderField` in
  Financial Position (`src/App.jsx`, right after "Offset Allocation").
  Reused the already-imported `calculateMonthlyRate` (`src/calculations/
  loan.js`) to convert to a monthly fraction once, outside the loop.
  Inside the loop, interest accrues on last month's ending balance
  *before* this month's deposit is added (matches how a real bank
  statement works - existing balance earns interest, new deposits start
  earning next month), tracked via a new `totalSavingsInterest`
  accumulator (mirrors `totalInterest`'s own pattern, returned unrounded).
  **Real correctness fix along the way, not just new surface**: the
  existing "nothing to offset" early-out guard assumed zero surplus/
  income/contributions meant nothing changes over time - false once a
  nonzero `initialSavingsBalance` earns nonzero interest, since the lump
  sum keeps compounding even with zero ongoing activity. Guard now also
  requires `!(initialSavingsBalance > 0 && savingsInterestRate > 0)` to
  early-out, so that combination correctly falls through to the real loop.
  Both `loanSimulation`/`baselineSimulation` calls in `App.jsx` pass the
  same `savingsInterestRate` (same treatment as `offsetAllocationPct`/
  `initialSavingsBalance`, keeping the "interest saved" comparison
  consistent). New "Savings interest earned" stat in the "⏱️ Loan
  Simulation" card, right after "Total interest paid" - shown only when
  `savingsInterestRate > 0` to avoid a "$0" stat cluttering the card when
  unused. Timeline Explorer needed no changes - its "🐖 Savings" figure
  already just reads the loop's own `savings` field, which now includes
  the compounded interest automatically. Persisted via
  `handleSaveScenario` - purely additive, no `SCHEMA_VERSION` bump.
  Added 3 new tests to `offsetSimulation.test.js`: explicit 0% matches
  omitting the param; a 12%/yr rate (exactly 1%/month) compounds cleanly
  on a $10k lump with no ongoing deposits (`[10100, 10201, 10303]`,
  `totalSavingsInterest` ≈ 303.01); the early-out guard fix itself (zero
  surplus/income/contributions but a nonzero lump + rate still compounds
  instead of hitting the `monthlyData: []` sentinel). Updated one exact
  `toEqual` assertion on the sentinel shape for the new
  `totalSavingsInterest: 0` field.
  `npm test -- --run` (306/306), `npm run lint`, `npm run build` all
  clean. Verified in the browser: at 0% (default) the Loan Simulation
  card shows no "Savings interest earned" stat; set Offset Allocation to
  70% and Savings Interest Rate to 4% - the stat appeared ($55,730 on the
  default scenario), and the Timeline Explorer's Savings figure at month
  139 ($175,953) clearly reflected compounding, not just linear deposits.
  Reset the rate to 0% and confirmed the stat disappeared again. Saved at
  4.5%, reloaded, confirmed it persisted; cleared the saved scenario and
  confirmed it reset cleanly to 0%/100% defaults.

- [x] **TODO-55: Credit Card Benefit (offset-timing + cashback, static estimate)**
  Three prior analysis rounds converged on a much smaller design than
  originally assumed ("hard, similar to Realistic Mode") - a flat,
  non-simulation estimate, not a full billing-cycle simulation. This
  session built exactly that design.
  New pure module `src/calculations/creditCardBenefit.js`:
  `calculateOffsetTimingBenefit(monthlyCardSpend, avgExtraDaysHeld, interestRate)`
  (`monthlyCardSpend * (avgExtraDaysHeld/30) * (interestRate/100)` - the
  validated "average float" formula from the analysis rounds) and
  `calculateCardCashback(monthlyCardSpend, cashbackPct, annualCardFee)`.
  Deliberately reuses the loan's own already-computed `interestRate`
  (`src/App.jsx`) rather than a new rate input - the money in question
  would otherwise leave the offset immediately, so it's the *mortgage*
  rate that matters, not a savings rate (this app's whole value
  proposition), and kept conceptually separate from TODO-50's "Savings
  Interest Rate" (a different pool of money entirely - surplus that
  never reaches the offset).
  New checkbox "Model credit card usage" in Financial Position (right
  after Savings Interest Rate, same "checkbox reveals dependent fields"
  pattern as TODO-88's Mortgage-Free Age), unchecked by default. Checked,
  it reveals 4 inputs - Monthly Card Spend, Average Days Payment Delayed
  (default **27**, a single honest number instead of asking users to
  convert from a marketing figure like "55 days interest-free"), Cashback
  / Rewards Rate (default 0%), Annual Card Fee (default $0) - plus an
  inline (not a new right-column card) result box: "Estimated annual
  benefit: +$X" with a one-line "Offset timing: ~$A · Cashback: ~$B ·
  Fee: -$C" breakdown, in a neutral gray box (not green) so it doesn't
  read as "found money." A `(?)` `InfoTooltip` (the already-generalized
  `LvrBadge` pattern - no new component needed) explains the full-balance
  assumption and warns to keep any expense with a debit-avoidance bank
  fee off this.
  **Zero simulation impact by design**: nothing added to
  `calculateLoanWithOffset`, `monthlyToOffset`, payoff time, or total
  interest paid - purely a static, parallel calculation, same category as
  the Purchase Health Check indicators. All 5 new state vars (`useCreditCard`,
  `monthlyCardSpend`, `avgExtraDaysHeld`, `cashbackPct`, `annualCardFee`)
  persisted via `handleSaveScenario` - purely additive, no
  `SCHEMA_VERSION` bump.
  Added 8 new tests to `creditCardBenefit.test.js` (reproduces the
  ~$57/$124 worked examples, zero-spend/zero-rate edges, linear scaling
  with days held, fee-exceeds-cashback going negative).
  `npm test -- --run` (314/314), `npm run lint`, `npm run build` all
  clean. Verified in the browser: unchecked by default with an
  explanatory subtitle; checked it, defaults ($1,000/27 days/0%/$0)
  produced exactly "+$55" (matches `1000 × 0.9 × 6.13% ≈ $55`) while "Time
  to pay off" (10.8 years/129 months) and "Total interest paid"
  ($196,743) stayed byte-identical to the checkbox-unchecked baseline -
  confirming zero simulation impact; set Cashback to 1% and Annual Fee to
  $50, confirmed the box updated to "+$125" with a correct "$55 · $120 ·
  -$50" breakdown; saved, reloaded, confirmed persistence; cleared the
  saved scenario, confirmed it reset cleanly to unchecked/defaults.

- [x] **TODO-54 (Analysis only, no code): "Realistic Mode" - split into focused sub-tasks**
  Originally "model income tax on salary," flagged hard with priority
  undecided. The user asked to broaden scope (inflation, variable rates,
  "any other variables") and get a second opinion before implementing
  anything. Two analysis rounds, then a split into TODO-89 through
  TODO-95.
  **Round 1 (this session's own analysis)**: reframed "Realistic Mode" as
  three independent problems (tax, inflation, rate variability), not one
  toggle - confirmed variable interest rates are **already solved**
  (TODO-57's `interestRateField`/scheduled rate changes + the Purchase
  Health Check's static Interest Rate Stress Test), confirmed
  `incomeSources` has no gross/net distinction anywhere, confirmed zero
  inflation/CPI code exists. Proposed reframing income tax away from
  "tax on salary" (salary is realistically already post-PAYG take-home
  pay - taxing it again would double-count) toward "tax on non-PAYG
  income" (self-employment/freelance/dividends/bonus, which arrives
  without withholding and creates a real lump-sum cash-flow risk).
  Ranked inflation options by cost: display-only "today's dollars"
  conversion (cheapest) through full income+expense compounding
  (priciest), leaning toward starting cheap.
  **Round 2 (second opinion, external model)**: agreed independent
  modules over one toggle. Disagreed on tax scope - argued most users
  think in net income already, so gross/net support should apply to
  *every* income source (not just non-PAYG), with automatic conversion
  via real AU tax brackets + Medicare Levy + optional HECS/HELP.
  Reordered priorities, ranking **property appreciation and salary
  growth above inflation** - the app tracks `propertyPrice` as fixed
  forever (LVR only ever improves via principal repayment, no
  equity/net-worth figure exists at all), which is a bigger real gap
  than CPI-adjusting a headline number. Also proposed rent growth,
  investment vacancy rate, and a stochastic "unexpected repairs" event
  (e.g. 1%/year chance of a $5,000 repair). Offered a complexity-budget
  heuristic: "if the user has to understand a tax law, don't build it."
  **Synthesis / where this session pushed back**: agreed with elevating
  property appreciation and salary growth, and with rent
  growth/vacancy as genuine gaps. Rejected the real-tax-bracket proposal
  as self-contradictory - full AU brackets + Medicare Levy + HECS *is*
  "a tax law the user has to understand," violating the second opinion's
  own rule. Resolved by keeping gross/net support for every income
  source (adopting that part of round 2) but converting via a single
  user-supplied **effective tax rate %** instead of real brackets (no
  tax data to source or maintain) - this also subsumes round 1's
  narrower "non-PAYG only" framing, since the same mechanism covers both.
  Rejected "unexpected repairs" as its own task: the app is 100%
  deterministic everywhere today, and a literal random event needs
  either Monte Carlo repetition (a genuinely different, bigger kind of
  feature - rerun the simulation many times, show a distribution) or it
  collapses to a deterministic expected-value uplift (0.01 × $5,000 =
  $50/year) - which is just a bigger number in the already-existing
  Misc Property Expense field (TODO-82). No new task queued for it.
  **Resulting split**: TODO-89 (Property Appreciation - builds the
  shared "compounds annually in the loop" mechanism the next three
  reuse), TODO-90 (Salary/Wage Growth), TODO-91 (Rent Growth), TODO-92
  (Expense Inflation), TODO-93 (Purchasing Power / "today's dollars" -
  cheapest, no dependency on anything else), TODO-94 (Gross/Net income
  via flat effective tax rate), TODO-95 (Investment Vacancy Rate).
  Variable interest rates: confirmed already solved, no new task.

- [x] **TODO-93: Purchasing Power / "today's dollars" display**
  Follow-up from TODO-54's split - the cheapest, no-dependency item in
  the whole set, built first. New `src/calculations/inflation.js`:
  `calculatePresentValueOfInterest(monthlyData, inflationRate)` discounts
  **each month's actual interest payment individually** back to today's
  dollars (reusing the loan's own `calculateMonthlyRate` for the
  annual-to-monthly conversion), rather than a single power-of-years
  discount on the aggregate - interest is paid gradually over the loan's
  life, not as one lump sum at the end, so this is meaningfully more
  correct than the simplest possible approach while still being cheap (a
  reduce over `monthlyData`, which the loop already produces).
  New "Inflation Rate" `NumberSliderField` in Financial Position (right
  after Savings Interest Rate, same 0-15%/0.1-step/blue-track shape as
  the other rate inputs), default **0%** - preserves the current display
  exactly until the user opts in. `App.jsx` calls the new function once
  on `loanSimulation.monthlyData` (a pure read of the loop's already-
  computed output - the simulation itself is untouched) and shows a new
  conditional sub-line under the existing "Total interest paid" figure in
  the "⏱️ Loan Simulation" card, only when `inflationRate > 0`: "≈ $X in
  today's dollars (at Y% inflation)".
  Caught one bug before it shipped: `NumberSliderField`'s `color` prop is
  a lookup into a fixed `TRACK_CLASSES` map (`blue`/`green`/`indigo`/
  `orange`/`purple` only, per a Tailwind-purging constraint) - an initial
  `color="gray"` would have silently broken the slider's track styling
  since `gray` isn't a key in that map; switched to `color="blue"`.
  Added 4 new tests to `inflation.test.js` (a clean 1%/month worked
  example, exact match at 0% inflation, empty-`monthlyData` edge case,
  later months discounted more than earlier ones).
  `npm test -- --run` (318/318), `npm run lint`, `npm run build` all
  clean. Verified in the browser: at 0% (default) no sub-line appears;
  set to 2.5% - "Total interest paid: $196,743" gained "≈ $179,349 in
  today's dollars (at 2.5% inflation)" directly below it, while "Time to
  pay off" (10.8 years/129 months) stayed unchanged, confirming zero
  simulation impact. Saved, reloaded, confirmed persistence; cleared the
  saved scenario, confirmed it reset cleanly to 0%.

- [x] **TODO-89: Property Appreciation (Projected Value/Equity)**
  Follow-up from TODO-54's split - the highest-value gap per both
  analysis rounds. `propertyPrice` was confirmed (by exploration) to be
  used everywhere exclusively as a static "at purchase" figure - it never
  appeared in the monthly simulation loop or Timeline Explorer, and no
  equity/net-worth figure existed anywhere. This built the foundational
  piece the rest of the growth-rate family (TODO-90/91/92) will reuse.
  New `propertyGrowthRate` (annual %, default **0** - `propertyValue`
  stays pinned at `propertyPrice` forever until opted in), allows
  **negative** values too (a downturn is a real, useful scenario, not
  just growth) - new "Property Growth Rate" `NumberSliderField` in
  Purchase Details, right after Property Price.
  New shared `src/calculations/growthRate.js`:
  `calculateCompoundedValue(baseValue, annualGrowthRate, month)` -
  monthly compounding via the existing `calculateMonthlyRate` conversion,
  same convention as every other rate in this app. Deliberately a **pure
  function of elapsed time**, not a running accumulator like
  `offsetBalance`/`savingsBalance` - property value doesn't depend on
  monthly deposits, so `calculateLoanWithOffset`
  (`src/calculations/offsetSimulation.js`) just calls it once per push
  using the loop's own `months` counter, no new mutable state needed.
  New `propertyValue` field in `monthlyData`; `getTimelineSnapshot`
  (`src/calculations/timelineSnapshot.js`) gained a matching
  `initialPropertyValue` param to seed it at month 0 (mirrors
  `initialSavingsBalance`/`savings`). Both `loanSimulation`/
  `baselineSimulation` calls in `App.jsx` pass the same `propertyPrice`/
  `propertyGrowthRate`.
  Timeline Explorer, gated on `propertyGrowthRate !== 0` (nothing changes
  for anyone who hasn't opted in): a 4th item added to the existing
  "🏦 Loan | 💰 Offset | 🐖 Savings" breakdown row ("🏠 Value: $X"), plus a
  new line below it, "🏠 Projected Equity: $Y" where
  `Y = propertyValue - balance` (textbook equity - deliberately **not**
  including offset/savings, which are separate liquid money, not tied to
  the property) - colored via the existing `getBalanceColor`/
  `getBalanceBgColor` helpers (`src/calculations/ui.js`, already used for
  Remaining Savings' sign-based green/red), so negative equity renders
  correctly with zero new color logic.
  `propertyGrowthRate` persisted via `handleSaveScenario` - purely
  additive, no `SCHEMA_VERSION` bump.
  **Deliberate scope trim, called out explicitly**: "Projected LVR over
  time" (also named in the analysis) was cut from this task - Equity is
  the more resonant number per both analysis rounds, and shipping value +
  equity + LVR-over-time all at once risked a cluttered first cut. A fast
  follow-up can reuse the same `propertyValue` series later.
  Added 4 new tests to `growthRate.test.js` (clean compounding math, flat
  at 0%, exact base value at month 0, shrinks under negative growth) and
  4 to `offsetSimulation.test.js` (flat when rate is 0/omitted, 0 when
  `propertyPrice` itself is omitted, compounds matching
  `calculateCompoundedValue` directly, shrinks under negative growth) plus
  a `timelineSnapshot.test.js` case for `initialPropertyValue`. Updated
  one exact `toEqual` assertion on the month-0 sentinel shape for the new
  `propertyValue: 0` field.
  `npm test -- --run` (327/327), `npm run lint`, `npm run build` all
  clean. Verified in the browser: at 0% (default) the breakdown row and
  equity line are absent, byte-identical to before. Set to 5% - at month
  125, Value $1,429,368 and Equity $1,102,413 ($1,429,368 − $326,955)
  matched by hand, both in green. Set to -8% - Value dropped to $368,379
  at the same month, Equity fell to $41,424 but stayed positive (this
  scenario's offset paid the loan off too fast to push equity negative
  before the term ended - the shrinking-value math itself is separately
  confirmed correct via `growthRate.test.js`). Reset to 0%, confirmed the
  row/line disappeared again. Saved at 3.5%, reloaded, confirmed
  persistence; cleared the saved scenario, confirmed it reset to 0%.

- [x] **TODO-90: Salary/Wage Growth**
  Follow-up from TODO-54's split - the first to reuse TODO-89's
  compounding mechanism. Scoped narrowly to income sources categorized
  exactly `'Salary/Wages'` (new `SALARY_INCOME_CATEGORY` export,
  `src/calculations/incomeCategories.js`) - not "all personal income" -
  to keep this an accurately-named, tightly-scoped feature distinct from
  Rent Growth (TODO-91) and any future investment-return growth.
  New `getActiveAmountWithGrowth(items, month, annualGrowthRate)`
  (`src/calculations/recurringAmount.js`) - same shape as the existing
  `getActiveAmount`, but multiplies each active item's amount by a growth
  factor from `calculateCompoundedValue(1, annualGrowthRate, month)`
  (TODO-89's shared mechanism). `calculateLoanWithOffset`
  (`src/calculations/offsetSimulation.js`) gained `salaryGrowthRate = 0`,
  splits `incomeSources` into Salary/Wages vs. everything else **once**
  outside the loop (the array itself never changes mid-simulation), and
  sums `getActiveAmountWithGrowth(salaryIncomeSources, months,
  salaryGrowthRate) + getActiveAmount(otherIncomeSources, months)` each
  month - a no-op split at the 0% default, since the growth function
  matches the plain one exactly then.
  New "Salary Growth Rate" `NumberSliderField` in the Income section,
  right after the "💵 Income Sources" header (inside the existing
  breakdown toggle, alongside what it affects) - allows a small negative
  range too (a pay cut/reduced hours), same allowance as TODO-89's
  Property Growth Rate. Deliberately **not** tied to inflation/savings/
  property growth - real wage growth moves on its own (promotions, job
  changes). Growth compounds from simulation month 1, not from each
  income source's own `startMonth` (a deliberate simplification, same
  convention as Property Appreciation). Static "right now" income
  figures (`weeklyIncome`, the Income breakdown subtotal) are correctly
  untouched - this only affects the future simulation.
  `salaryGrowthRate` persisted via `handleSaveScenario` - purely
  additive, no `SCHEMA_VERSION` bump.
  **Bug caught before shipping, not after**: the app's own seeded default
  income source (`config.default.json`) was named `"Salary"` - a legacy
  free-text value predating the category system - which would have
  silently never matched the new `'Salary/Wages'` category filter,
  making the whole feature a no-op on the shipped default scenario
  despite passing every unit test (which all used correctly-named
  fixtures). Caught during browser verification when a nonzero rate
  produced zero change; fixed by renaming the seed to `"Salary/Wages"`
  (matching what the add-form itself already writes when a user picks
  that category) and updating the one test
  (`App.incomeSources.test.jsx`) that asserted the old literal text.
  Added 3 new tests to `recurringAmount.test.js` (matches `getActiveAmount`
  exactly at 0%, compounds correctly, 0 when nothing's active) and 2 to
  `offsetSimulation.test.js` (0%/omitted matches the plain path exactly,
  growth applies only to Salary/Wages while a Dividends entry stays flat).
  `npm test -- --run` (332/332), `npm run lint`, `npm run build` all
  clean. Verified in the browser: after the seed-name fix, setting Salary
  Growth Rate to 8% dropped "Total interest paid" $196,743 -> $138,716
  and raised "You save" $448,646 -> $506,674, while the Income
  breakdown's $1,614/week subtotal stayed exactly the same (confirming
  only the future simulation is affected, not today's snapshot). Reset to
  0%, confirmed it matched the original baseline exactly. Saved at 3%,
  reloaded, confirmed persistence; cleared the saved scenario, confirmed
  it reset to 0%.

- [x] **TODO-92: Expense Inflation**
  Follow-up from TODO-54's split - the third to reuse TODO-89's
  compounding mechanism. Resolved the plan's own open question -
  **one shared rate for both Personal and Property Expenses**, not two
  independent ones, to keep this a single, easily-understood concept
  (matches the TODO's own singular naming).
  Simpler implementation than Salary Growth (TODO-90) turned out to be
  possible: since the growth applies to *every* item in each category
  uniformly (no per-category filtering needed, unlike Salary/Wages vs.
  other income), there was no need for a `getActiveAmountWithGrowth`-
  style per-item function. Instead, `calculateLoanWithOffset`
  (`src/calculations/offsetSimulation.js`) computes one
  `expenseGrowthMultiplier = calculateCompoundedValue(1, expenseGrowthRate, months)`
  per month and multiplies the two already-resolved aggregate figures by
  it: `monthlyPersonalExpensesCost` (the `getActiveAmount` sum) and
  `monthlyExpensesForMonth` (property expenses, resolved as before via
  each `SteppedExpenseField`'s own `getSteppedValue` - the multiplier
  overlays on top of that final sum, so a scheduled step change and
  ongoing growth compose correctly without touching each field's
  resolution logic).
  New `expenseGrowthRate = 0` param - a no-op (multiplier of 1) at the
  default, so every existing test kept passing unchanged with zero
  edits.
  **Naming collision deliberately avoided**: this is *not* the same as
  `inflationRate` (TODO-93) - that one is a pure post-hoc display
  conversion of "Total interest paid" into today's dollars and never
  touches the simulation; `expenseGrowthRate` genuinely changes payoff
  time and total interest by growing the expenses that compete with the
  offset for the same surplus. New "Expense Growth Rate"
  `NumberSliderField` in Financial Position, placed directly between
  Savings Interest Rate and Inflation Rate, with tooltip copy explicitly
  cross-referencing Inflation Rate below it to head off the obvious
  confusion of two similarly-named sliders doing different things.
  Allows a small negative range too (falling costs), same allowance as
  Property/Salary Growth.
  `expenseGrowthRate` persisted via `handleSaveScenario` - purely
  additive, no `SCHEMA_VERSION` bump.
  Added 3 new tests to `offsetSimulation.test.js` (0%/omitted matches the
  plain path exactly - `[850, 1700]` with both expense types present;
  property expenses grow correctly on top of a scheduled base value;
  personal expenses grow correctly), all computed against
  `calculateCompoundedValue` directly rather than hand-derived numbers.
  `npm test -- --run` (335/335), `npm run lint`, `npm run build` all
  clean. Verified in the browser: at 6%, "Total interest paid" rose
  $196,743 -> $216,118 while the static "Property expenses breakdown"
  ($543/month) and "Personal expenses breakdown" ($680/month) subtotals
  stayed exactly the same (confirming only the future simulation is
  affected). Reset to 0%, confirmed it matched the original baseline
  exactly. Saved at 2.5%, reloaded, confirmed persistence; cleared the
  saved scenario, confirmed it reset to 0%.

- [x] **TODO-91: Rent Growth**
  Follow-up from TODO-54's split - a near-exact copy of TODO-90's own
  template, as anticipated when it was scoped. Extended the existing
  Salary/Wages split in `calculateLoanWithOffset`
  (`src/calculations/offsetSimulation.js`) from a two-way split to a
  three-way one: Salary/Wages sources grow at `salaryGrowthRate`, rental
  sources (`RENTAL_INCOME_CATEGORIES` - House Rent/Room Rent) grow at a
  new `rentGrowthRate = 0` independently, and everything else (Dividends,
  Bonus, etc.) resolves plain as before - each still via
  `getActiveAmountWithGrowth` (TODO-90), just filtered differently.
  New "Rent Growth Rate" `NumberSliderField` in the Income section, right
  after Salary Growth Rate - shown unconditionally (not gated on
  `isInvestmentProperty`), since Income Sources already allows House
  Rent/Room Rent regardless of that flag (e.g. renting out a spare room
  while owner-occupying). Same small-negative-range allowance as every
  other growth rate this session.
  `rentGrowthRate` persisted via `handleSaveScenario` - purely additive,
  no `SCHEMA_VERSION` bump.
  Added 2 new tests to `offsetSimulation.test.js` (0%/omitted matches the
  plain path exactly; House Rent + Room Rent grow together while
  Salary/Wages and Dividends stay flat, proving independence from
  `salaryGrowthRate`), computed against `calculateCompoundedValue`
  directly.
  `npm test -- --run` (337/337), `npm run lint`, `npm run build` all
  clean. Verified in the browser: added a $500/week House Rent income
  source (dropping "Total interest paid" to $124,274 from the extra
  surplus alone), then set Rent Growth Rate to 6% and watched it drop
  further to $118,017 - while the static "Monthly Rental Income" figure
  stayed exactly $2,167/month (500 × 52/12), confirming only the future
  simulation is affected. Reset to 0%, confirmed it matched the
  House-Rent-only baseline exactly. Saved at 4%, reloaded, confirmed
  persistence; cleared the saved scenario, confirmed it reset to 0% (and
  the added House Rent source was gone too, as expected).

- [x] **TODO-95: Investment Vacancy Rate**
  Follow-up from TODO-54's split. Modeled as a flat, deterministic
  average haircut on rental income - **not** a random/stochastic event,
  keeping the app's fully-deterministic design intact (per TODO-54's own
  rejection of stochastic modeling for "unexpected repairs," same
  reasoning). New `vacancyWeeksPerYear = 0` param in
  `calculateLoanWithOffset` (`src/calculations/offsetSimulation.js`);
  `vacancyFactor = 1 - (vacancyWeeksPerYear / 52)` computed once for the
  whole simulation (a flat ratio, not a per-month accumulator or a
  compounding rate like every other growth param this session), then
  multiplied directly onto the already-grown rental income figure
  (`getActiveAmountWithGrowth(rentalIncomeSources, months, rentGrowthRate) * vacancyFactor`) -
  composes correctly with TODO-91's Rent Growth Rate (grow first, then
  apply the vacancy haircut).
  New "Vacancy (weeks/year)" `NumberSliderField` in the Income section,
  right after Rent Growth Rate - shown unconditionally (not gated on
  `isInvestmentProperty`), same reasoning as Rent Growth Rate: Income
  Sources already allows House Rent/Room Rent regardless of that flag.
  Range 0-52 weeks, default 0 (no vacancy modeled).
  Explicitly distinct from the Purchase Health Check's existing
  "Vacancy Buffer" indicator (a static "how many months could you
  survive a vacancy right now" snapshot) - this is the first feature to
  actually simulate a vacancy's effect over time.
  `vacancyWeeksPerYear` persisted via `handleSaveScenario` - purely
  additive, no `SCHEMA_VERSION` bump.
  Added 4 new tests to `offsetSimulation.test.js` (0%/omitted matches
  the plain path exactly; a 2-week haircut reduces rental income by the
  expected factor while other income stays untouched; a full 52-week
  edge case zeroes out rental income entirely; composes correctly with
  a nonzero `rentGrowthRate`).
  `npm test -- --run` (341/341), `npm run lint`, `npm run build` all
  clean. Verified in the browser: added a $500/week House Rent source
  (dropping "Total interest paid" to $124,274 from the extra surplus),
  then set Vacancy to 4 weeks/year and watched it rise to $127,891 -
  while "Monthly Rental Income" stayed exactly $2,167/month, confirming
  only the future simulation is affected. Reset to 0, confirmed it
  matched the House-Rent-only baseline exactly. Saved at 3 weeks,
  reloaded, confirmed persistence; cleared the saved scenario, confirmed
  it reset to the original baseline (House Rent removed too, as
  expected).

- [x] **TODO-97: Opportunity Cost comparison (static, no dependency)**
  Resulting split from TODO-52's analysis (see TODO-52's own write-up for
  the full history). Cheapest of the three ETF-related follow-ups - no
  simulation logic touched, ships independently of TODO-96/TODO-98. New
  checkbox "Compare Offset vs ETF Investing" (default unchecked, same
  opt-in pattern as TODO-55's Credit Card Benefit) in Financial Position,
  right after the Credit Card Benefit block. When checked, reveals a new
  "Expected ETF Return" `NumberSliderField` (default 8% p.a., range
  0-20%) and a static side-by-side card: "🏦 Offset: {mortgage rate}%
  guaranteed, tax-free, no market risk" vs. "📈 ETF: {expected return}%
  expected, taxable, market risk - not guaranteed" - reuses the
  already-computed `interestRate` value directly, no new calculation
  module needed. Explains the trade-off without requiring the user to
  understand finance, per the same "if the user needs to understand it
  to trust it, don't build it that way" rule used elsewhere in TODO-52's
  analysis.
  `showOpportunityCost`/`expectedEtfReturn` persisted via
  `handleSaveScenario` - purely additive, no `SCHEMA_VERSION` bump.
  No calculation-layer changes at all (341 existing tests pass
  unchanged); verified in the browser that "Time to pay off" and "Total
  interest paid" stay byte-identical whether the checkbox is on or off,
  confirming zero simulation impact. Also verified save/reload
  persistence and reset-to-defaults (unchecked, hidden) behavior.

- [x] **TODO-94: Gross/Net income via a flat effective tax rate (not real AU tax brackets)**
  Follow-up from TODO-54's split. Real progressive AU tax brackets +
  Medicare Levy + HECS/HELP would need users to understand tax law to
  trust the number - the same complexity-budget objection that killed
  TODO-52's weighted "Overall Score." Instead, any income source can
  optionally be marked "Gross (pre-tax)" and a single global **Effective
  Tax Rate %** converts every item so marked into net, everywhere income
  is read - covers salaried people who only know their gross figure AND
  non-PAYG income (self-employment/dividends/bonus) via the same
  mechanism, no tax-bracket data to source or maintain.
  Income items have no edit capability at all (only add/remove), so
  `isGross` is an add-time-only field, same limitation every other income
  field already has.
  Conversion choke point: `getActiveAmount`/`getActiveAmountWithGrowth`
  (`src/calculations/recurringAmount.js`) gained a trailing optional
  `effectiveTaxRate = 0` param - every consumer of income amounts (the
  static "right now" figures in `App.jsx`, feeding Housing Cost Ratio,
  Stress Test, Rental Yield, Gearing Cashflow; the Timeline Explorer's
  Income Context column; and the `calculateLoanWithOffset` simulation
  loop) goes through one of these two functions, so extending them was
  the single place needed. A no-op for expense items (Exceptional/
  Personal Expenses never set `isGross`) and for every income item
  without `isGross` regardless of the rate.
  New always-visible "Effective Tax Rate" `NumberSliderField` in the
  Income section, right after Vacancy - not gated on any derived
  condition, matching the `inflationRate`/`expenseGrowthRate` convention
  of "0% default is an inert no-op." New "This is a gross (pre-tax)
  amount" checkbox in the add-income form (any category, not just
  Room/House Rent), with an inline "Net at X% tax: $Y/week" preview.
  List rows show a "(Gross → net $Y/week)" marker.
  `effectiveTaxRate` persisted via `handleSaveScenario` - purely
  additive, no `SCHEMA_VERSION` bump. `isGross` needs no separate
  persistence, it's part of the `incomeSources` array saved wholesale.
  Now available for **TODO-96** to consume as its tax-rate input - the
  original reason this task was split out from TODO-52's analysis.
  Added tax-conversion tests to `recurringAmount.test.js` (Gross/non-Gross
  items, 0% no-op, composes with the growth multiplier) and a new
  describe block to `offsetSimulation.test.js` (0%/omitted matches the
  plain path; a Gross salary item shrinks while a non-Gross item in the
  same simulation is untouched; composes with `rentGrowthRate` and
  `vacancyWeeksPerYear` together; converts a Gross item in the catch-all
  "other" bucket too).
  `npm test -- --run` (350/350), `npm run lint`, `npm run build` all
  clean. Verified in the browser: added a $1000/week Gross Salary/Wages
  item at 30% Effective Tax Rate - the list row showed "(Gross → net
  $700/week)", the Income breakdown subtotal rose by exactly $700 (not
  $1000), and "Time to pay off"/"Total interest paid" dropped from
  10.8yrs/$196,743 to 6.2yrs/$108,332, confirming the net (not gross)
  figure flows into the simulation. Removed the item and reset the rate,
  confirmed an exact return to baseline. Saved at 15% with a Gross item,
  reloaded, confirmed persistence; cleared the saved scenario, confirmed
  reset to 0% with no Gross items.

- [x] **TODO-96: ETF Simulation Core (foundational, gated behind TODO-94's tax rate)**
  Resulting split from TODO-52's analysis (4 rounds, done - see TODO-52's
  own write-up below for the full history). The foundational piece
  TODO-98's search will build on top of - a single, manually-set
  allocation strategy, simulated deterministically, no search yet.
  **Important correction made mid-implementation**: the first pass
  carved the ETF share out of the "non-offset" (savings) portion of the
  surplus, reasoning it would leave `offsetAllocationPct`'s existing
  semantics untouched. That was wrong - it meant "Invest in ETFs" had
  zero effect on payoff time whenever `offsetAllocationPct` was 100%
  (the app's own default), silently defeating the actual point of
  TODO-52's analysis (offset-repayment-speed vs. ETF-growth, not
  savings-vs-ETF). Caught by browser-testing at the default 100%
  allocation and seeing "Total interest paid" not move at all. Fixed:
  `etfAllocationPct` now diverts a share of the **offset's own** portion
  into the ETF balance instead (`etfShare = offsetShare *
  (etfAllocationPct / 100); offsetBalance += offsetShare - etfShare`) -
  matches TODO.md's own original wording ("instead of the offset") and
  now genuinely trades slower payoff for potential ETF growth regardless
  of `offsetAllocationPct`'s value. 0% (default) stays byte-for-byte
  unchanged either way.
  ETF growth is taxed by `effectiveTaxRate` before being applied
  (`calculateMonthlyRate(expectedEtfReturn * (1 - effectiveTaxRate / 100))`)
  - not just gating UX, mathematically load-bearing: TODO-94 only taxes
  income sources, not investment gains, so without this the ETF would
  grow at its full pre-tax rate, exactly the dishonest comparison
  TODO-94 exists to prevent.
  New "Invest in ETFs" checkbox in Financial Position, right after
  "Compare Offset vs ETF Investing" - **disabled** (dimmed, `disabled`
  attr) at `effectiveTaxRate === 0`, reusing the exact First Home
  Buyer/Investment Property disabled-checkbox pattern (`App.jsx`) rather
  than hiding it outright, with an explanatory line for why. The
  existing `expectedEtfReturn` slider (TODO-97) is now shared - its
  reveal condition changed from `showOpportunityCost` alone to
  `showOpportunityCost || useEtfInvesting`, a single source of truth for
  "what ETF return am I assuming," rather than a duplicate second input.
  New "ETF Allocation" slider (0-100%, default 20% for a visible effect
  once checked) only rendered when ETF investing is actually active.
  A derived `etfInvestingActive = useEtfInvesting && effectiveTaxRate > 0`
  (not the raw checkbox state) is what's actually passed into both
  `calculateLoanWithOffset` calls - so un-setting the tax rate after
  enabling ETF investing zeroes its effect immediately, not just its
  visibility.
  New "Net Worth" aggregate (`propertyValue - balance + offset + savings
  + etf`) - deliberately broader than TODO-89's own "Projected Equity"
  (which excludes offset/savings/ETF by design) - and a new "📈 ETF"
  breakdown item, both added to the Timeline Explorer's "Net Effective
  Balance" card, gated on `etfInvestingActive` rather than
  `propertyGrowthRate !== 0` (Net Worth is meaningful even with a flat
  property value).
  `etfAllocationPct`/`useEtfInvesting` persisted via `handleSaveScenario`
  - purely additive, no `SCHEMA_VERSION` bump.
  Added 5 tests to `offsetSimulation.test.js` (0%/omitted matches the
  plain path; diverts the correct share out of the offset's own portion
  while the savings share stays untouched; ETF balance compounds at the
  tax-adjusted rate on the running balance before each month's deposit;
  the calc layer doesn't itself block `effectiveTaxRate: 0` - the UI
  gates it; offset + savings + etf sums back to the full surplus).
  `npm test -- --run` (355/355), `npm run lint`, `npm run build` all
  clean. Verified in the browser at the default 100% Offset Allocation:
  the checkbox was disabled with an explanatory line until Effective Tax
  Rate was set to 30%; checking it at 20% ETF Allocation moved "Time to
  pay off"/"Total interest paid" from 10.8yrs/$196,743 to
  12.2yrs/$227,170 (the real trade-off); the Timeline Explorer's ETF and
  Net Worth figures matched the hand-computed math exactly at two
  different months (e.g. Net Worth = $850,000 − $383,243 + $223,326 +
  $28,453 + $73,301 = $791,837). Unchecked it and confirmed an exact
  return to the $196,743 baseline. Saved, reloaded, confirmed
  persistence; cleared the saved scenario, confirmed the checkbox reset
  to unchecked/disabled and figures returned to baseline.

- [x] **TODO-98: Pareto Front Strategy Comparison**
  Resulting split from TODO-52's analysis, depending on TODO-96 (done).
  Generalizes TODO-96's single constant allocation into a search over
  many (switch-trigger, allocation) combinations - explicitly **no**
  weighted "Overall Score" and **no** single "best" recommendation, per
  two independent second opinions and this session's own analysis.
  **Resolved with the user before implementing**: strategies that pay
  off faster stop simulating the instant the loan hits $0 - nothing
  continues accumulating savings/ETF for the remaining months, so
  comparing "final ETF balance" across strategies isn't perfectly
  apples-to-apples (a fast-payoff strategy doesn't get credit for
  investing the freed-up repayment afterward). Chose to keep this
  simple rather than extend the core loop to a shared post-payoff
  horizon: compare on **Total Interest Paid** (already fully fair -
  unaffected by when the loop stops) and **ETF Balance at each
  strategy's own stopping point**, with an explicit caveat tooltip.
  **Key insight**: TODO-96's existing behavior (constant `etfAllocationPct`
  from month 1) is mathematically identical to a new `switchThresholdPct
  = 0` ("switch on immediately") - so this generalizes TODO-96 rather
  than replacing it, with a default that reproduces its exact behavior.
  New `switchThresholdPct` param (`offsetSimulation.js`) - since
  `offsetBalance` only grows and `balance` only shrinks each month
  (standard amortization), the ratio between them is monotonically
  non-decreasing, so "once triggered, stays triggered" needed **no
  persistent state**, just a stateless per-month check:
  `etfSwitchActive = (offsetBalance / balance) * 100 >= switchThresholdPct`.
  New `src/calculations/strategyComparison.js`: `runStrategyGrid` runs
  a 21×21 (5% step) grid = 441 simulations, holding every other input
  fixed, reading only `totalInterest` and the last `monthlyData` entry
  per cell (never retains 441 full `monthlyData` arrays). No `useMemo`
  - 441 sims × ~360 iterations is trivial for JS (sub-100ms), and this
  file has no existing memoization pattern to extend; computed via a
  plain IIFE inside the `etfInvestingActive`-gated JSX, same pattern as
  the Timeline Explorer's own snapshot IIFE. `selectParetoFront` finds
  the non-dominated set (no other strategy has both ≤ interest AND ≥ ETF
  balance), dedupes identical outcomes (every `etfAllocationPct: 0` cell
  is equivalent regardless of threshold), and samples down to 5
  evenly-spaced-by-risk rows if the front is larger - "show the spread,"
  not "pick a winner." A purely descriptive `riskScore` (0-100,
  Offset=0/ETF=100 realized exposure) is computed per row but never fed
  back into the search. New "Worst Market Crash" stress test
  (`calculateEtfCrashSurvivedPct`/`ETF_CRASH_BANDS`) mirrors
  `purchaseHealthCheck.js`'s Interest Rate Stress Test pattern exactly -
  "survived" means the crashed ETF balance still covers the extra
  interest that strategy cost versus the offset-only baseline.
  New "Switch Trigger" slider added to the existing "Invest in ETFs"
  block (`switchThresholdPct`, default 0 - byte-identical to TODO-96's
  original behavior). New "🔍 Strategy Comparison" card - this app's
  first table over *computed* results rather than static reference data
  or raw input rows - with an "Apply" button per row that sets
  `switchThresholdPct`/`etfAllocationPct` to that row's values, updating
  the whole app immediately; the currently-applied row is highlighted
  (same convention as `LvrBadge`'s reference table).
  `switchThresholdPct` persisted via `handleSaveScenario` - purely
  additive, no `SCHEMA_VERSION` bump.
  Added 2 tests to `offsetSimulation.test.js` (omitted/0% matches every
  existing TODO-96 result exactly - no regression; a nonzero threshold
  with hand-computed round numbers confirms the switch fires at the
  exact month the ratio crosses it and stays triggered afterward) and a
  new `strategyComparison.test.js` (441 rows; Pareto front is
  non-dominated, deduplicated, ≤5 rows, always anchored by the
  `etfAllocationPct: 0` baseline; crash-survival ladder matches the
  stress-test pattern).
  `npm test -- --run` (369/369), `npm run lint`, `npm run build` all
  clean. Verified in the browser: with the default 100% Offset
  Allocation and Effective Tax Rate set to 30%, the Strategy Comparison
  table rendered 5 rows from $0/0-risk (the baseline) to $2,299,940/
  100-risk; clicked "Apply" on an 80%-switch/100%-allocation row,
  confirmed the sliders updated and "Total interest paid" moved to
  exactly $198,631 matching the row, with that row now highlighted.
  Scrubbed the Timeline Explorer and confirmed ETF stayed exactly $0
  while the offset/balance ratio was below 80% (e.g. 51.8% at month 89),
  then started growing once it crossed 80% (82.9% at month 119, ETF
  $7,446, Net Worth $826,713 - matched the hand-computed sum exactly).
  Unchecked "Invest in ETFs" and confirmed the whole Strategy Comparison
  card disappeared with figures back at the $196,743 baseline. Saved,
  reloaded, confirmed persistence; cleared the saved scenario, confirmed
  reset to unchecked/0%.

- [x] **TODO-99 (Analysis only, no code): Simplify the UI/information architecture**
  Requested by the user - explicitly not about removing content, about
  reducing how overwhelming the page feels. Deliberately deferred until
  TODO-96/TODO-98 shipped (both now done) so the analysis could be based
  on the real, final UI surface rather than a guess - and that surface
  turned out to be the single biggest contributor: "Invest in ETFs" now
  brings 3 sliders plus a 5-row Strategy Comparison table with its own
  header/tooltips, easily the heaviest block on the page.
  **Finalized basic/advanced split, per card**:
  - Purchase Details: basic = Property Type, First Home Buyer/Investment
    Property/Foreign Purchaser, Property Price, Deposit Contribution,
    Loan Amount. Property Growth Rate is the one exception left inline,
    not worth its own collapsible for a single slider.
  - Financial Position: basic = Available Savings, Offset Allocation
    (core mechanic, not an "assumption"), Interest Rate, Loan Term.
    Advanced = Savings Interest Rate, Expense Growth Rate, Inflation
    Rate, Model Credit Card usage, Compare Offset vs ETF Investing,
    Invest in ETFs (its whole sub-tree including Strategy Comparison),
    Show my Mortgage-Free Age.
  - Income: basic = the Income Sources list itself (add/remove). Advanced
    = Salary Growth Rate, Rent Growth Rate, Vacancy, Effective Tax Rate.
  **Recommended mechanism**: a per-card collapsible "⚙️ Advanced
  Assumptions" sub-section, reusing the exact `showX`/`▸`/`▾` toggle
  pattern already used throughout this file (Income breakdown, Property
  expenses breakdown, etc.) - purely a presentation change, no state
  model changes. Defaults collapsed UNLESS any value inside has already
  been customized away from its inert default (e.g. loading a saved
  scenario with a nonzero growth rate) - so returning users never lose
  visibility into settings they've actually set.
  **Resolves cleanly with TODO-100** (built next, see below): the master
  "Realistic Mode" toggle naturally lives at the top of Financial
  Position's Advanced Assumptions collapsible, since that's exactly
  where a user would look for it and exactly the set of items it
  controls (the growth/inflation-rate family). It doesn't add a SEPARATE
  gate over Credit Card/Compare Offset vs ETF/Mortgage-Free Age - those
  keep their own individual checkboxes untouched. **Correction made
  during TODO-100's implementation**: Invest in ETFs turned out to be a
  genuine exception, not a clean exclusion - its own honesty requirement
  (TODO-96) already depends on Effective Tax Rate being nonzero, and
  Effective Tax Rate IS part of the family, so turning Realistic Mode off
  necessarily neutralizes ETF investing too as a side effect (the
  checkbox stays checked, but goes disabled/inert - see TODO-100's own
  write-up for the exact mechanism and the smart disabled-message that
  explains why).
  **Split into a new implementation ticket, TODO-102**, rather than
  built here - this ticket's own title is "analysis only, no code," and
  the actual restructuring (touching rendering across three cards) is a
  real enough change to deserve its own review/test pass, same reasoning
  TODO-52's analysis used when splitting into TODO-96/97/98.

- [x] **TODO-100: Master "Realistic Mode" enable/disable toggle**
  Raised by the user mid-session, independently of TODO-99 (analysis
  done - see above): expected a single checkbox to turn "Realistic Mode"
  on/off as a whole - explicitly **functional**, not just visual:
  switching it off forces every factor in the family inert (0%/no-op)
  regardless of whatever each individual slider is currently set to, not
  merely hiding them. Switching back on restores each slider's own
  stored value (never resets them to 0 on toggle-off - that would be
  surprising and lose the user's own inputs).
  **Scope of "the family"**: Property Growth Rate, Salary Growth Rate,
  Rent Growth Rate, Expense Growth Rate, Vacancy (weeks/year), Inflation
  Rate, Effective Tax Rate - the growth/inflation assumptions from
  TODO-54's original split.
  Judged mechanical enough (a direct extension of the
  `etfInvestingActive`-style derived-gating pattern already used 3 times
  this session) to build directly without Plan Mode.
  New `realisticModeEnabled` state (default `true` - every existing
  scenario behaves byte-for-byte identically, since disabling is the NEW
  behavior). Seven `realistic*`-prefixed derived consts
  (`realisticPropertyGrowthRate`, `realisticSalaryGrowthRate`, etc.), each
  `realisticModeEnabled ? rawValue : 0` - every calculation/display READ
  of the family (both `calculateLoanWithOffset` calls, the Strategy
  Comparison grid's base params, static income figures, the Gross-income
  preview/marker, the Timeline Explorer's property-value gate and income
  context, the inflation-adjusted display) was rethreaded to read the
  `realistic*` version instead of the raw state - the sliders' own
  `value=`/`onChange=` bindings still read/write the RAW state
  unchanged, so nothing is lost while the mode is off.
  **Correction made during implementation** (see TODO-99's own write-up
  for the full reasoning): "Invest in ETFs" (TODO-96) turned out to be a
  genuine exception, not cleanly excludable - its own honesty requirement
  already depends on Effective Tax Rate being nonzero, and Effective Tax
  Rate is part of the family, so `etfInvestingActive` now reads
  `realisticEffectiveTaxRate` too. This means turning Realistic Mode off
  also disables ETF investing as a side effect (checkbox stays checked,
  goes disabled/dimmed) - a smart 3-way disabled message distinguishes
  "Realistic Mode is off" from "no tax rate set" from "already enabled,"
  so the reason is never ambiguous.
  `realisticModeEnabled` persisted via `handleSaveScenario` - purely
  additive, no `SCHEMA_VERSION` bump.
  No calculation-layer changes at all (369 existing tests pass
  unchanged, since the gating lives entirely in `App.jsx`).
  `npm test -- --run` (369/369), `npm run lint`, `npm run build` all
  clean. Verified in the browser: set Property Growth Rate to 5%,
  confirmed the Timeline Explorer's Value/Projected Equity rows appeared
  ($1,429,368/$1,102,413 at month 125); toggled Realistic Mode off,
  confirmed those rows disappeared entirely (propertyValue held flat)
  while the slider still showed 5% untouched; toggled back on, confirmed
  an exact restoration ($1,429,368/$1,102,413 again). Separately, set
  Effective Tax Rate to 30% and enabled "Invest in ETFs" at 20%
  allocation (Total interest paid: $227,170); toggled Realistic Mode
  off, confirmed the checkbox stayed checked but went disabled with
  "Realistic Mode is off... turn it back on to use this," and "Total
  interest paid" reverted exactly to the $196,743 baseline. Saved,
  reloaded, confirmed persistence; cleared the saved scenario, confirmed
  reset to enabled/default.

- [x] **TODO-101: Light mode styling bug - inner cards showing solid backgrounds instead of transparent**
  Raised by the user mid-session (two follow-up messages, likely the same
  root cause): in light mode, nested/inner cards - the example given was
  the Loan Simulation card's inner stat boxes - rendered with a solid
  white background instead of transparent, unlike dark mode.
  Root cause confirmed and isolated to exactly one card: the outer Loan
  Simulation card (`App.jsx`) has a vivid `bg-gradient-to-br
  from-indigo-500 to-purple-600` background, but its four inner boxes
  ("Time to pay off", "Total interest paid", "Savings interest earned",
  "Savings vs no offset") all used `bg-white dark:bg-gray-800/20` -
  `bg-white` is fully opaque, painting a solid white rectangle over the
  gradient in light mode; `dark:bg-gray-800/20` is 20%-opacity, so it
  blends into the dark gradient by coincidence, which is why this went
  unnoticed until now.
  A codebase-wide audit found this was NOT systemic: every other
  gradient/colored card (e.g. the green "TO OFFSET" card) already used
  the correct pattern, `bg-white/60 dark:bg-black/20` - semi-transparent
  in both themes. Fixed by applying that exact same proven pattern to
  the four Loan Simulation boxes, rather than inventing a new one. The
  user's separate, vaguer "colors look washed out" impression wasn't a
  second issue - the audit found no other `bg-white` without a matching
  `dark:` variant anywhere in `src/`, so this one fix is the full
  explanation.
  A very minor, unrelated cosmetic mismatch was noticed but left out of
  scope (the Total Summary donut chart's center "hole" uses a slightly
  different tone than its parent card - barely perceptible, not what was
  reported).
  No calculation-layer changes - `npm test -- --run` (369/369) unaffected
  by design; `npm run lint`/`npm run build` clean.
  Verified in the browser in both themes: light mode now shows the
  purple gradient softly through all four boxes instead of solid white
  rectangles; switched back to dark mode and confirmed no visual
  regression (identical to before the fix).

- [x] **TODO-102: Build the Advanced Assumptions collapsible restructuring**
  Implementation follow-up from TODO-99's analysis (done) and enabled by
  TODO-100 (Realistic Mode toggle, done). Purely a presentation change -
  no state-model or calculation changes.
  Confirmed by exploration before implementing: the "advanced" fields
  TODO-99 identified were already perfectly contiguous in both cards'
  JSX - no reordering of unrelated content needed, just wrapping existing
  spans and relocating one block. In Financial Position, the span from
  "Savings Interest Rate" through the "Show my Mortgage-Free Age" age
  slider was one unbroken run covering exactly TODO-99's "advanced" set
  (Savings Interest Rate, Expense Growth Rate, Inflation Rate, Credit
  Card block, Compare Offset vs ETF block, Invest in ETFs + its whole
  sub-tree including Strategy Comparison, Mortgage-Free Age block),
  sitting between "Offset Allocation" (basic) and Interest Rate/Loan
  Term/Repayments (basic, stays after). "Realistic Mode" (previously the
  very first item in the card) moved to become the first item INSIDE
  this new collapsible, per TODO-99's own recommendation. In Income, the
  4 sliders (Salary Growth Rate, Rent Growth Rate, Vacancy, Effective Tax
  Rate) were contiguous between the "💵 Income Sources / + Add" header and
  the add-income form - wrapped in a toggle NESTED inside the card's
  existing `showIncome` collapsible, using the indented `pl-3
  border-l-2` treatment (the existing `showClosingCostsBreakdown`
  pattern) rather than the bare `mt-4` treatment `showIncome` itself
  uses, since it reads as a sub-section, not a sibling section.
  New `showFinancialPositionAdvanced`/`showIncomeAdvanced` state, plain
  `useState(config.x ?? false)` matching every other `showX` in this
  file. **Auto-expand when customized**, per TODO-99's own spec ("returning
  users never lose visibility into settings they've actually set"): no
  precedent anywhere in this file for a `useState` initializer reading
  sibling state, so this is two plain derived `const`s computed after the
  relevant states (`financialPositionAdvancedCustomized`/
  `incomeAdvancedCustomized`, checking each contained value against its
  inert default, including `!realisticModeEnabled`), OR'd with the raw
  toggle into `*Expanded` consts that drive both the toggle arrow and the
  gated content - so a customized section can never be accidentally
  hidden, while the raw `useState` is still what `onClick` flips and what
  persists via `handleSaveScenario`.
  Both new flags added to `handleSaveScenario`'s existing `showX` list -
  purely additive, no `SCHEMA_VERSION` bump.
  No calculation-layer changes at all - `npm test -- --run` (369/369)
  passed unchanged, confirming the large JSX relocation didn't break
  anything; `npm run lint`/`npm run build` clean.
  Verified in the browser: both cards default to collapsed (Available
  Savings/Offset Allocation/Interest Rate/Loan Term visible in Financial
  Position; Income Sources list visible in Income, no growth-rate
  sliders shown). Expanded Financial Position's section and confirmed
  Realistic Mode is the first item inside, working exactly as before.
  Expanded Income's nested section and confirmed all 4 sliders render
  correctly with the indented treatment. Set Salary Growth Rate to 3%,
  saved, reloaded, confirmed Income's Advanced Assumptions auto-expanded
  (arrow showed "▾") even though the underlying toggle itself defaults
  collapsed. Cleared the saved scenario and confirmed both sections reset
  to collapsed and "Total interest paid" returned to the exact $196,743
  baseline.

- [x] **TODO-103: Default Realistic Mode to OFF**
  One-line change: `useState(config.realisticModeEnabled ?? true)` (`App.jsx:112`)
  -> `?? false`. Safe as designed - every scenario saved since TODO-100
  already stores its own explicit `realisticModeEnabled` value
  (`handleSaveScenario`), so this only changes brand-new sessions with
  nothing saved yet; no schema bump needed, no behavior change for anyone
  with existing saved data.

- [x] **TODO-104: Hide the realistic-factor sliders when Realistic Mode is off, instead of leaving them inert**
  Wrapped "Expense Growth Rate"/"Inflation Rate" (Financial Position
  Advanced Assumptions) and the whole "Salary Growth Rate/Rent Growth Rate/
  Vacancy/Effective Tax Rate" block (Income Advanced Assumptions) in
  `{realisticModeEnabled && (...)}`, each replaced by a one-line
  explanatory note when hidden - "Savings Interest Rate" stays always
  visible since it's unrelated to Realistic Mode. Updated the existing
  Financial Position off-state note to describe hiding instead of "held at
  0%, regardless of what each slider shows."
  **Real bug found and fixed while verifying in the browser** (directly
  matches the user's own separate "no puedo colapsar Advanced Assumptions"
  report): `financialPositionAdvancedCustomized` still included
  `!realisticModeEnabled` from TODO-102/100, when Realistic Mode's own
  default was `true` (so "off" was the noteworthy customization worth
  auto-surfacing). TODO-103 flipped that default to `false` without
  flipping this check's polarity - since "off" became the new default,
  `!realisticModeEnabled` was now true FROM THE START, permanently forcing
  the whole Advanced Assumptions section open with no way to collapse it,
  defeating TODO-104's entire purpose. Fixed by inverting to plain
  `realisticModeEnabled` (turning it ON is now the customization worth
  auto-surfacing, matching how `useCreditCard`/`useEtfInvesting`/etc.
  already work in the same check). Verified: fresh session now starts
  collapsed, expands/collapses freely by default, still auto-expands (and
  stays open) once Realistic Mode is switched on - matching every other
  opt-in checkbox in the same list.
  Verified in the browser: changing Expense Growth Rate to 5% while
  Realistic Mode is on moved "Total interest paid" from $196,743 to
  $211,665 and "Time to pay off" from 129 to 142 months - confirms the
  factors still have real effect, addressing the user's separate "doesn't
  seem to affect anything" report (see TODO-107, queued for re-testing now
  that the collapse bug above is fixed).

- [x] **TODO-105: Gate Property Growth Rate the same way**
  Wrapped the "Property Growth Rate" `NumberSliderField` (Purchase Details,
  outside either Advanced Assumptions collapsible) in
  `{realisticModeEnabled ? (...) : (<p>...)}`, hiding in place per the
  user's explicit preference (chosen over relocating it into a different
  card's collapsible, to avoid disrupting Purchase Details' existing
  layout) - same mechanical pattern as TODO-104, no relocation.
  All three (TODO-103/104/105): `npm test -- --run` (482/482 unchanged),
  `npm run lint`, `npm run build` clean - no calculation logic touched.

- [x] **TODO-109: Consolidate "Realistic Mode" into its own dedicated card**
  Follow-up from the user's feedback right after TODO-103/104/105 shipped:
  the master toggle lived in Financial Position, but its 7 gated sliders
  were scattered across 3 different cards (Property Growth Rate in
  Purchase Details; Expense Growth Rate/Inflation Rate in Financial
  Position; Salary/Rent Growth, Vacancy, Effective Tax Rate in Income's
  own separate Advanced Assumptions) - confirmed by exploration to be the
  only feature in this file where one control's toggle and its gated
  inputs lived in physically different cards, awkward enough that the code
  itself had to explain it via cross-card "see the toggle in Financial
  Position" notes.
  Resolved via AskUserQuestion (card position): new **"🌱 Realistic Mode"**
  card, inserted right after Purchase Details and before Financial
  Position - property basics first, then the assumptions family that
  affects everything after it. Pure JSX relocation, no state/calculation/
  persistence changes - every field kept its existing `useState`/`onChange`
  wiring, only where each `NumberSliderField` renders moved. Contains the
  master toggle + tooltip, then all 7 factors gated as a single
  `{realisticModeEnabled ? (<>...7 sliders...</>) : (<p>one combined
  note</p>)}` (replacing the 3 separate per-field/per-card notes TODO-104/
  105 had introduced).
  **Consequences elsewhere**: Purchase Details lost Property Growth Rate
  entirely (no stub left behind). Financial Position's own "Advanced
  Assumptions" lost the toggle/Expense Growth Rate/Inflation Rate but kept
  Savings Interest Rate/Credit Card/Compare Offset vs ETF/Invest in ETFs/
  Mortgage-Free Age - still has 5 legitimate FP-specific items, stays as
  its own collapsible; `financialPositionAdvancedCustomized` trimmed to
  just those 5. Income's "Advanced Assumptions" became completely empty
  once its 4 items moved out, so it was removed wholesale - the toggle
  button, `showIncomeAdvanced` state, and `incomeAdvancedCustomized`/
  `incomeAdvancedExpanded` derived consts are all gone; Income now goes
  straight from "+ Add" to the add-income form. Dropped `showIncomeAdvanced`
  from `handleSaveScenario`'s list - subtractive only, old saved scenarios
  just carry one harmless unused key.
  **Fixed a latent bug found while touching this area**: "Invest in ETFs"'s
  off-state note checked the raw `effectiveTaxRate` (inconsistent with its
  own `disabled` check, which already used the derived
  `realisticEffectiveTaxRate`) and its copy said "in the Income section,"
  which would've gone stale the moment Effective Tax Rate moved - fixed
  both, now reads `realisticEffectiveTaxRate` and says "in the Realistic
  Mode card above."
  Confirmed safe before moving anything: grepped all `App.*.test.jsx` files
  for every affected label/section name - zero hits, so no existing
  integration test could break; `effectiveTaxRate`'s other consumers (the
  "Net at X% tax" hint, the income-list gross/net annotation, the
  simulation-parameter objects, persistence) all read the state/derived
  value directly rather than by DOM proximity, confirmed unaffected.
  `npm test -- --run` (482/482 unchanged), `npm run lint`, `npm run build`
  clean.
  Verified in the browser: fresh session shows the new card between
  Purchase Details and Financial Position, off by default with the combined
  note; toggling on reveals all 7 sliders in order (Property/Salary/Rent
  Growth, Vacancy, Expense Growth, Inflation, Effective Tax Rate); Purchase
  Details no longer shows Property Growth Rate at all; Financial Position's
  Advanced Assumptions still opens/closes normally with its remaining 5
  items; Income goes straight from "+ Add" to the income list with no
  Advanced Assumptions toggle at all; re-ran the Expense Growth Rate 5%
  regression check from TODO-104's verification and got the identical
  result ($196,743 -> $211,665, 129 -> 142 months), confirming the move
  didn't change any calculation; "Invest in ETFs" note now correctly reads
  "Set an Effective Tax Rate in the Realistic Mode card above first."
  **Supersedes TODO-107/108** (queued last turn about the old scattered
  layout being confusing) - both were about *finding* the scattered
  controls; now that they're consolidated into one card, the confusion
  those two describe no longer applies. Left both `[ ]` rather than
  deleting them outright, in case the user wants to revisit the specific
  wording/investigation either raised.

- [x] **TODO-106: Sensible non-zero default values for the Realistic Mode factors**
  All 7 factors defaulted to `0` via a plain `useState(config.x ?? 0)` -
  correct as a no-op when each was first built, but not representative of
  what a typical user would actually plug in. User asked for common/
  realistic defaults instead, explicitly leaving room to flag back if a
  factor needed more analysis first (e.g. deriving it from data already
  entered, rather than a fixed constant).
  Resolved via AskUserQuestion, specifically for Effective Tax Rate (the
  one factor that could plausibly be derived from already-entered total
  income - the other 6 are generic macro assumptions with nothing in the
  app to derive them from anyway): **fixed constants for all 7**. Deriving
  Effective Tax Rate from income would reintroduce the exact complexity-
  budget problem TODO-94's own analysis already rejected for real AU tax
  brackets ("if the user needs to understand it to trust it, don't build
  it that way").
  New defaults (each within the slider's own existing min/max, no bound
  changes): Property Growth Rate 5% p.a. (conservative end of long-run AU
  housing growth), Salary Growth Rate 3% p.a. and Rent Growth Rate 3% p.a.
  (track AU wage/income trends), Vacancy 2 weeks/year (a common "healthy
  market" planning assumption), Expense Growth Rate 2.5% p.a. and
  Inflation Rate 2.5% p.a. (RBA's 2-3% target-band midpoint), Effective
  Tax Rate 20% (a rounded typical *average*, not marginal, rate).
  Purely 7 one-line `useState` initializer changes (`?? 0` -> `?? N`) -
  confirmed via grep that `config.default.json` never sets these keys, so
  the JS fallback was the sole source of the old 0 default. Every scenario
  saved since these fields existed already stores its own explicit value,
  so this only affects brand-new sessions with nothing saved yet. Since
  `realisticModeEnabled` itself defaults to `false` (TODO-103) and these
  values stay invisible/inert until the user opts in (TODO-104/109), this
  has zero effect on anyone who never turns Realistic Mode on.
  `npm test -- --run` (482/482 unchanged), `npm run lint`, `npm run build`
  clean - no calculation logic touched.
  Verified in the browser: cleared the saved scenario, reloaded, turned
  Realistic Mode on in its dedicated card - all 7 sliders now show their
  new defaults instead of 0 (5/3/3/2/2.5/2.5/20), and "Time to pay off"
  moved from the flat 10.8y/129mo baseline to 9.0y/108mo (salary/rent
  growth compounding on the dominant income flow outpaces expense growth
  at these settings - a real, sensible effect, not a bug). Turned
  Realistic Mode back off and confirmed it returns to the exact
  $196,743/129-month baseline, unaffected by the new defaults - same
  "holds effect at 0, doesn't reset the slider" behavior as before.

- [x] **TODO-52 (Analysis only, no code): When does it make sense to invest in ETFs instead of paying down the offset?**
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
  **Follow-up context added by the user, still analysis-only - intended
  to be handed to another model for a second opinion before any design
  work, same pattern as TODO-54's split**: the core argument is that the
  offset's "return" is exactly the mortgage rate (6.13% in the shipped
  scenario), guaranteed and tax-free - not because it earns interest, but
  because the bank simply stops charging interest on that portion of the
  loan. Matching that guaranteed, tax-free rate with an ETF or savings
  account would require an even higher *pre-tax* return, since capital
  gains/dividends are taxable. A diversified ETF has historically
  returned ~7-10%/year long-term, but with real volatility (a single year
  might be +25%, -18%, +5%, -10%, etc.) - no certainty, unlike the
  offset.
  Proposed a **4-stage framework** for when ETFs start making sense: (1)
  buying the house - everything to the offset, liquidity matters most;
  (2) building a buffer (6-12 months of expenses) - keep prioritizing the
  offset; (3) the offset is already "large" relative to the loan (e.g.
  $300k offset against a $500k loan, so interest is only charged on
  $200k) - the debate starts here; (4) the offset is fully funded (offset
  balance ≈ loan balance, interest ≈ $0) - every extra dollar stops
  improving the offset, so investing starts to make more sense. Also
  noted many people don't choose one or the other - they split (e.g.
  first $200k to the offset, all new savings to ETFs after; or a fixed
  70/30 split of monthly surplus).
  Personal rule of thumb offered: mortgage rate ≥6% → almost always
  prioritize the offset; 4-5% → start considering a mixed strategy;
  ≤3-4% → lean more toward ETFs (assuming a solid emergency fund already
  exists) - not because ETFs are "better," just because the offset's
  guaranteed return stops being competitive once the cost of debt is low.
  **Concrete feature idea proposed** (still just an idea, not a design):
  an "Offset vs Investing" comparison - inputs: mortgage rate, expected
  ETF return, investment horizon, tax rate (optional), monthly surplus;
  output: three side-by-side strategies (100% Offset / 50% Offset+50%
  ETF / 100% ETF) comparing projected outcomes AND risk, explicitly
  **not** a single absolute recommendation - matches this app's own
  "illustrative, not advice" philosophy (TODO-25's disclaimer). Noted as
  a natural extension of what's already shipped (Offset simulation,
  Savings Interest, Credit Card Benefit) and as a genuinely differentiated
  feature most mortgage calculators don't offer.
  Still needs: a second-opinion consultation (per the user's own plan)
  before any design/implementation - open questions likely include how
  to model ETF volatility/risk without turning this into a Monte Carlo
  feature (see TODO-55's own rejection of stochastic modeling for
  "unexpected repairs," for the same reasoning), and how to keep the
  three-strategy comparison honest without implying a "right answer."
  **Round 2 (this session), reframing the question**: the user explicitly
  rejected arbitrary rule-of-thumb thresholds (e.g. "switch at 50% of the
  loan paid off") in favor of finding a mathematically-grounded optimum
  via simulation - "what variables actually drive this decision, ranked
  by importance, which ones the calculator already tracks vs. needs to
  add, which should be user inputs vs. sensible defaults, and finally a
  strategy for the calculator to search for the best switch-over point
  itself rather than asking the user to guess a percentage."
  User's own candidate variable list (mortgage rate, expected ETF return,
  marginal tax rate, investment horizon, remaining loan balance, current
  offset balance, emergency buffer, monthly surplus available to invest,
  risk tolerance - flagged as maybe omittable). Candidate switch-trigger
  metrics to evaluate instead of "% of loan paid off": offset as % of
  loan balance, LVR, and the spread between mortgage rate and expected
  ETF return. Also asked whether the optimizer should maximize final net
  worth alone, or a risk-adjusted score combining final net worth,
  interest saved, available liquidity (offset), and portfolio volatility -
  and proposed the optimizer mechanically brute-force many fixed
  switch-over thresholds (offset reaches 10%, 20%, ... 100% of the loan)
  and report which one wins.
  **Cross-checked against the actual codebase** (corrects a few of the
  user's own "already have this" assumptions): `monthlyData` already
  tracks loan balance, offset balance, savings, property value (TODO-89),
  and (via `interestRateField`, TODO-57) a variable rate schedule -
  confirmed. **But LVR and Emergency Buffer are NOT tracked over time** -
  both are static, month-1/settlement-only figures today (`lvr` in
  `App.jsx`, `calculateEmergencyBufferMonths` in the Purchase Health
  Check) - a genuine gap if either becomes the chosen switch-trigger
  metric. **Equity (TODO-89) is deliberately narrow** - `propertyValue -
  balance` only, excluding offset/savings by design - so "final net
  worth" as the optimizer's objective would need a new, broader aggregate
  (equity + offset + savings), not a reuse of the existing Equity figure
  as-is. **Marginal Tax Rate and Expected ETF Return don't exist
  anywhere** - the closest existing thing is TODO-94 (still unimplemented,
  a flat effective tax rate on income, not specifically an ETF-gains
  rate). **The most relevant existing mechanism is `offsetAllocationPct`**
  (TODO-49) - it already splits monthly surplus between the offset and a
  separately-tracked `savingsBalance`; an ETF-investing strategy is
  architecturally the same shape (split surplus between offset and a
  second growing balance), so this may be extendable rather than needing
  a wholly parallel system.
  **Sequencing, per the user's own explicit request**: produce a
  consultation prompt for a second opinion FIRST; only break this down
  into concrete implementation TODOs AFTER that second opinion comes
  back - do not skip ahead to a task split yet (unlike TODO-54, which
  went through this same two-round pattern before splitting into
  TODO-89-95).
  **Round 3 (user + second opinion + this session's synthesis)**: the
  user refined their own consultation prompt before sending it, adding
  two requirements the first draft lacked - explicitly define what
  "better" means, and request formulas/numeric examples, not just
  concepts. Also introduced a new dependency: ETFs should only be
  visible once tax modeling is enabled (see the cross-reference added to
  TODO-94 above), plus a broader idea that "Realistic Mode" might want
  more such optional pieces beyond what's already shipped (not yet
  enumerated by the user beyond taxes+ETFs).
  **Second opinion's answer**: "better" isn't one answer - two people
  with the same numbers can rationally choose different strategies based
  on different goals (debt-free ASAP vs. maximize net worth at 60).
  Proposed the app answer "what's optimal *for the goal you pick*"
  instead of deciding for the user - via four **Optimization Goal**
  profiles (Conservative/Balanced/Growth/Aggressive), each a different
  weighted blend of five metrics (Final Net Worth = property + ETF
  portfolio + cash - loan; Mortgage Freedom date; Total Interest Paid;
  Investment Value; Offset Balance/liquidity), plus a "Worst Market
  Crash" stress test (what if ETFs fall 30%?) mirroring the app's
  existing rate-stress-test pattern. Proposed two more-intuitive metrics
  than raw %/LVR: an "Investment Risk Score" (0-100, Offset=0/ETF=100)
  and "Debt Dependency" (loan vs. offset, in plain dollars). For the
  optimizer: search **two** variables, not one - when to start (offset
  reaches 10/20/.../100% of the loan) × how much to invest (0/25/50/75/
  100% of surplus) - a few dozen fully-deterministic simulations, trivial
  for this app's architecture. Its own strongest idea, offered almost as
  an aside at the end: instead of one recommended strategy, show a
  **simplified Pareto front** (3-5 non-dominated strategies - e.g.
  "Offset First: $2.55M net worth, 2048 payoff, risk 10/100" vs.
  "Growth: $2.91M, 2055, risk 72/100") so the user sees the actual
  trade-off instead of a single number that could read as advice.
  **This session's synthesis - one clear disagreement**: agree with the
  goal-dependent framing and the two-variable grid search. Disagree with
  the weighted-composite-score mechanism itself - 4 profiles × 5 weights
  each is ~20 arbitrary numbers a user can't audit or explain, the same
  complexity-budget problem already rejected for real AU tax brackets in
  TODO-94 ("if the user needs to understand it to trust it, don't build
  it that way"). The model's own Pareto-front idea already makes the
  weighted score largely redundant - if 3-5 non-dominated strategies are
  shown side-by-side, the user can read the risk/return trade-off
  directly without the app collapsing 5 metrics into one opaque number.
  Recommend: **Pareto front as the primary/only output**; the "Risk
  Score" (0-100) becomes a simple slider used to *highlight* the nearest
  row in that table, not the input to a weighted formula. Keep the
  "Worst Market Crash" stress test - cheap, reuses an existing pattern,
  genuinely clarifies risk.
  **Growing scope, flagged explicitly**: between the optimizer, the
  Pareto table, the two new intuitive metrics, and the stress test, this
  has grown well past a single feature - expect TODO-52 to need its own
  split into several implementation TODOs later, the same way TODO-54
  split into TODO-89-95, once analysis concludes.
  **Round 4 (final second-opinion response, per the user)**: fully
  agreed with dropping the weighted Overall Score, for the same reason
  raised in this session's own synthesis - "why 40% net worth, why 25%
  risk, who decided" reads as the app making a financial decision rather
  than presenting a simulation. Confirmed the Pareto front as the
  primary output, and clarified Risk Score should be purely descriptive
  (market exposure, e.g. "28/100 - Low Risk"), never an input to a
  formula - a user-facing slider can pick a preferred risk level and the
  UI highlights the nearest Pareto row, but the score itself never
  decides anything. Two genuinely new ideas: (1) an **Opportunity Cost**
  comparison - "one extra dollar → Offset: 6.13% guaranteed, tax-free,
  no risk" vs. "one extra dollar → ETF: 8.2% expected, taxable, market
  risk, not guaranteed" - a static, no-simulation-needed side-by-side
  that explains the trade-off without requiring the user to understand
  finance; (2) don't assume the trigger is "offset as % of loan" -
  let several candidate trigger types compete (offset %, LVR, remaining
  balance, rate-vs-ETF-return spread, years remaining, emergency buffer)
  and have the optimizer report which one actually produces the best
  outcomes, potentially surfacing a more meaningful rule like "start
  investing once your offset covers 12 months of expenses" instead of an
  arbitrary percentage. Also widened the suggested grid resolution to
  ~2,100 simulations (0-100% trigger × 0-100% allocation, in fine steps)
  rather than a coarse few dozen.
  **Final synthesis before splitting into implementation TODOs**: agree
  with dropping the score and keeping the Pareto front + descriptive Risk
  Score - this is now settled across two independent second opinions and
  this session's own analysis, no further consultation needed on that
  point. Agree the Opportunity Cost comparison is worth building - it's
  cheap (no simulation, just two rates displayed side by side) and high
  clarity, the same shape as the Credit Card Benefit's static card.
  **Pushing back on two things to keep the first version shippable**:
  (a) ~2,100 simulations at 1% granularity is finer than this illustrative
  tool needs - a 5% grid (21 × 21 = 441 runs) already produces a smooth
  enough Pareto front and stays comfortably fast; start there, finer
  resolution is a cheap dial to turn up later if it's ever not enough.
  (b) multi-trigger-type competition is the single most ambitious piece
  discussed across all 4 rounds - it multiplies the grid search by the
  number of trigger types AND reintroduces its own "how do we decide
  which trigger wins" question one level up. Recommend shipping with
  ONE trigger type first (offset as % of loan - the most intuitive, and
  the one every round of analysis kept returning to), and treating
  multi-trigger competition as a named-but-deferred enhancement, not
  part of the first build - also note LVR and Emergency Buffer would
  need to become real time-series (they're static snapshots today) before
  they could ever be candidate triggers, a real prerequisite this defers.
  **Resulting split**: TODO-96 (ETF Simulation Core - the foundational
  parallel balance + Net Worth aggregate, gated behind TODO-94's tax
  rate), TODO-97 (Opportunity Cost comparison - cheapest, no dependency,
  ships independently of TODO-96), TODO-98 (Pareto Front Strategy
  Comparison - the grid search + non-dominated filtering + comparison
  table, depends on TODO-96).

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
  (TODO-110: moved here from the MEDIUM PRIORITY section, where this had
  sat marked `[x]` but unmoved since it was first completed.)

- [x] **TODO-110: Housekeeping - move TODO-43 to Completed, dedupe classifyLvr.js against classifyByBands**
  Two tiny, unrelated, zero-risk cleanups from the same audit pass, bundled
  since neither was worth its own ticket: (a) TODO-43 above - moved from the
  MEDIUM PRIORITY section, where it had sat marked `[x]` but unmoved since
  first completed. (b) `classifyLvr.js` reimplemented the exact
  band-matching logic (`.find(band => value >= band.min) ?? fallback`) that
  `purchaseHealthCheck.js`'s `classifyByBands` already generalizes - its own
  header comment literally said it "Generalizes classifyLvr.js's own
  mechanism," but `classifyLvr.js` was never refactored to call it back.
  Changed `classifyLvr` to `return classifyByBands(lvr, LVR_BANDS)` instead
  of duplicating the one-liner - both were correct and equivalent, purely a
  DRY cleanup, `LVR_BANDS` itself untouched.
  `npm test -- --run` (482/482 unchanged, including `classifyLvr.test.js`'s
  own reference-identity and NaN-fallback assertions, which exercise the
  exact behavior now delegated to `classifyByBands`), `npm run lint`,
  `npm run build` clean.

- [x] **TODO-111: Accessibility - aria-expanded on collapsible toggles, htmlFor/id on raw sliders**
  `App.jsx` had 12 collapsible toggle buttons (+Add/Show.../Advanced
  Assumptions, etc.) with no `aria-expanded` attribute, so screen readers got
  no signal they controlled hidden content - added `aria-expanded={expanded}`
  to each, mirroring the same boolean already used to pick the ▸/▾ glyph
  (e.g. `financialPositionAdvancedExpanded`, `showIncome`, `showHealthCheck`,
  `showProgressCharts`, and 8 others).
  Separately, 8 raw `<input type="range">` sliders had a visually-adjacent
  `<label>` with no `htmlFor`/`id` pairing, unlike `NumberSliderField.jsx`
  which already does this correctly via `useId()` - added matching static
  `id`/`htmlFor` pairs to the 7 that have an adjacent `<label>` (Number of
  People; Start/End Month for each of the 3 duplicated add-forms - Income,
  Offset Contributions, Personal Expenses). The Timeline Explorer's
  "Viewing Month" slider has no adjacent `<label>` element at all (just a
  `<span>` heading above it) - gave it a plain `aria-label="Viewing month"`
  instead of inventing a label/htmlFor pair for a heading that isn't one.
  `npm test -- --run` (482/482 unchanged), `npm run lint`, `npm run build`
  clean - purely additive JSX attributes, no behavior change.

- [x] **TODO-112: Code-split recharts behind a lazy-loaded boundary**
  recharts (plus the redux-toolkit/immer/d3 stack it vendors) was statically
  imported at the top of `App.jsx` and shipped inside the single 673KB
  production bundle for every visitor, even though `LoanBalanceChart`/
  `PrincipalInterestChart` only ever mount once `showProgressCharts` is
  toggled on. Changed both imports to `const LoanBalanceChart =
  lazy(() => import('./components/LoanBalanceChart'))` (same for
  `PrincipalInterestChart`), and wrapped their existing
  `{showProgressCharts && (...)}` render block in a `<Suspense fallback=
  {<p>Loading charts...</p>}>` boundary - no change to the gating condition
  itself, purely deferring the import.
  **Measured result**: `npm run build`'s single 673KB/195KB-gzip chunk
  split into a 320KB/91KB-gzip main bundle plus two small lazy chunks
  (`LoanBalanceChart` ~17KB, `PrincipalInterestChart` ~13KB) and a shared
  ~325KB/98KB-gzip `chartData` chunk (recharts + its vendored d3/redux
  stack) that now only downloads once a visitor actually opens "Progress
  Over Time." Vite's ">500kB chunk" build warning is gone entirely. This
  was the one performance finding from the audit that was actually
  user-facing (every page load's initial download/parse time), unlike the
  CPU-bound findings which measured sub-16ms and were already accepted as
  trivial per TODO-98.
  `npm test -- --run` (482/482 unchanged), `npm run lint` clean. Verified
  in the browser: opened "Progress Over Time," both charts rendered
  correctly with no console errors, confirming the lazy boundary works.

- [x] **TODO-113: App-level integration tests for Realistic Mode and Strategy Comparison**
  Neither of the two newest major features had any `App.*.test.jsx`
  coverage - confirmed via grep, zero hits for "Realistic Mode", "Strategy
  Comparison," or any of the 7 factor labels across all 6 existing
  integration test files. The underlying calculation logic was already
  well unit-tested (`strategyComparison.test.js`); this closes the React
  wiring gap. New file `src/App.realisticMode.test.jsx`, 6 tests across 2
  `describe` blocks: **Realistic Mode card** - sliders hidden by default
  with sensible new defaults (5/3/3/2/2.5/2.5/20) revealed on check;
  unchecking hides them again without resetting the underlying values;
  toggling on measurably changes "Time to pay off:"/"Total interest paid:"
  away from their off-state text (captured before/after, not hardcoded -
  robust to future default changes). **Invest in ETFs / Strategy
  Comparison** - the checkbox is disabled while Realistic Mode is off,
  enabled once it's checked; checking it reveals the table with its column
  headers and at least one row; clicking a row's "Apply" button updates
  the "ETF Allocation"/"Switch Trigger" sliders elsewhere in the panel to
  match that row's values.
  **Two testing gotchas found and designed around, worth knowing for future
  App-level tests in this file**: (1) `InfoTooltip` is nested *inside* the
  `<label>` for both "Realistic Mode" and "Invest in ETFs" checkboxes
  (unlike "First Home Buyer", which deliberately keeps its tooltip as a
  sibling *after* `</label>` for exactly this reason) - `getByLabelText`/
  `getByRole('checkbox', {name})` with an EXACT string throws "no match"
  since the accessible name picks up the whole hidden tooltip paragraph
  too; a regex (`/^Realistic Mode/`) is required instead. (2)
  `getByRole('table')` alone is ambiguous - `LvrBadge`'s tooltip also
  renders a (visually hidden but DOM-present) `<table>` on every page load;
  scoped queries to the Strategy Comparison section specifically instead.
  `npm test -- --run`, `npm run lint`, `npm run build` clean when this file
  is run in isolation (6/6 passing, confirmed repeatedly). **Environmental
  note, not a regression**: the FULL suite (488 tests) is intermittently
  flaky right now under a very high system load average (37-64, from
  unrelated running apps) - random pre-existing App-level test files
  (never the calculation-layer ones, never the same files twice) hit
  "Test timed out in 5000ms," including files untouched this session.
  Every failing test, including this new file's, passes cleanly 100% of
  the time when run in isolation or as part of a lighter run - confirmed
  this is CPU contention on this machine right now, not a logic bug.

- [x] **TODO-114: Fix tooltip/badge touch fallback on mobile**
  Every `InfoTooltip` (~12+ instances) and `LvrBadge` relied exclusively on
  CSS `:hover`/`:focus-within` to reveal their popover - plain `<button>`
  elements don't reliably receive focus on tap in iOS Safari (only real
  form controls like `<input>`/`<select>` do), so a meaningful fraction of
  the app's explanatory tooltips (and the LVR risk badge) may have been
  unopenable on a phone. Desktop hover/keyboard-focus needed to stay
  exactly as-is - this only had to add the missing tap path.
  New shared hook `src/hooks/useTooltipToggle.js` (`useState` + `useRef` +
  a `document` click listener that closes the popover when the click
  target is outside the ref'd wrapper) - both components were already
  structurally identical (`InfoTooltip.jsx`'s own header comment: "Generic
  version of LvrBadge's hover/focus tooltip pattern"), so this is a real,
  current duplication need rather than a speculative one. Both components
  got the same mechanical change: `ref` on the outer `<span>`, `onClick=
  {toggle}` + `cursor-pointer` (was `cursor-default`) on the trigger
  `<button>`, and the tooltip `<div>`'s hardcoded `invisible opacity-0`
  became `` `${isOpen ? 'visible opacity-100' : 'invisible opacity-0'}` ``
  - the existing `group-hover:`/`group-focus-within:` classes are
  untouched and continue to independently override this on hover/focus,
  exactly as before. No prop/API change to either component, so none of
  the ~12+ call sites in `App.jsx` needed any changes.
  New tests: `useTooltipToggle.test.js` (starts closed, toggle flips
  open/closed, exposes a ref), `InfoTooltip.test.jsx` (new file - it had no
  test before since it had no logic worth testing; now it does: renders,
  opens on click, closes on outside click, re-closes on a second click of
  the trigger itself without the outside-click handler fighting it), and
  one new case added to the existing `LvrBadge.test.jsx` (same open/close-
  on-outside-click behavior).
  `npm test -- --run` (496/496), `npm run lint`, `npm run build` clean.
  Verified in the browser: clicking the LVR badge and a regular
  `InfoTooltip` (e.g. "Realistic Mode"'s) both open the popover on tap and
  close when clicking elsewhere on the page; hover still works
  independently on desktop.

- [x] **TODO-115: Reorganize "Your Personal Expenses" - pull Offset Contributions out**
  "Your Personal Expenses" contained, once expanded, two unrelated things
  back to back: an unstyled "💰 Offset Contributions Schedule" section (a
  mortgage-offset feature - confirmed via exploration that
  `offsetContributions` is only ever read by `calculateLoanWithOffset` calls
  and the separate "TO OFFSET" results card, never by anything Personal-
  Expenses-related) followed by a second, separately-card-styled "Personal
  Expenses" sub-section duplicating the outer card's own heading text at the
  wrong heading level (`<h2>` nested inside another `<h2>`-headed card).
  Resolved via AskUserQuestion: Offset Contributions got **its own new
  top-level card** (icon: `PiggyBank`), positioned right after Financial
  Position - same reasoning as TODO-109's Realistic Mode card (substantial
  enough - add-form + list + interest-saved summary - to deserve its own
  space). New state `showOffsetContributions`, same collapsed-by-default
  "breakdown (subtotal: $X)" toggle convention already used by Income/
  Property Expenses/Personal Expenses; added to `handleSaveScenario`.
  "Your Personal Expenses" simplified to match the "Income" card's own
  template exactly (h2 + breakdown toggle + a plain `<h3>` sub-heading row
  with its own "+Add" button, no nested card chrome) - removed the redundant
  wrapper div and demoted the inner `<h2>` (dropping its `TrendingDown`
  icon, now unused and removed from the lucide import) to a plain
  `<h3>Personal Expenses</h3>`, keeping the exact same text so every
  existing `getByText('Personal Expenses')` test query kept matching
  unchanged.
  Test updates: `App.collapsiblePanels.test.jsx`'s `TOGGLE_CASES` "Personal
  expenses breakdown" row now checks for the simplified `<h3>` instead of
  the (now relocated) Offset Contributions heading, plus a new row for
  "Offset contributions breakdown"; the obsolete `describe('showPersonalExpenses
  gates both sub-sections at once')` block was deleted outright (the
  invariant it tested is exactly what changed). `App.expensesAndContributions.test.jsx`
  got a new `openOffsetContributions(user)` helper, swapped in for the 6
  call sites that used to open Offset Contributions via the (now-unrelated)
  "Personal expenses breakdown" toggle.
  `npm test -- --run` (495/495), `npm run lint`, `npm run build` clean - pure
  JSX relocation, no calculation logic touched.
  Verified in the browser: the new "Offset Contributions" card appears right
  after Financial Position, collapsed by default with the correct $0
  subtotal; expanding it shows the add-form/list/summary exactly as before.
  "Your Personal Expenses" now shows a single clean "Personal Expenses"
  sub-heading with no more nested card-within-a-card look.
  **Flagged but deliberately out of scope**: the analogous "Total Summary"
  `<h2>` nested inside "Property Balance"'s own `<h2>` is the same class of
  issue, but a different, unrelated card - queued separately as TODO-120
  rather than silently bundled into this task.

- [x] **TODO-119: Removed the unused `import React` from App.jsx**
  `import React, { useState, lazy, Suspense } from 'react';` → `import {
  useState, lazy, Suspense } from 'react';` - confirmed via grep zero
  `React.` usage anywhere in the file before removing. One-line change.

- [x] **TODO-120: Demoted "Total Summary"'s `<h2>` to `<h3>` inside "Property Balance"**
  Same fix shape as TODO-115's Personal Expenses heading - no text/visual
  change, just the correct semantic nesting level under Property Balance's
  own `<h2>`. Verified in the browser via DOM query: `H2: Property Balance`
  / `H3: Total Summary`.

- [x] **TODO-117: Raised Vitest's `testTimeout` to 15000ms to reduce flaky full-suite failures**
  Added `testTimeout: 15000` to `vite.config.js`'s `test: {}` block (was
  unset, i.e. Vitest's 5000ms default). Only affects how long a hung/slow
  test is given before failing - doesn't mask a genuinely broken test.

- [x] **TODO-118: Moved InfoTooltip outside the `<label>` on 4 checkboxes to fix accessible-name pollution**
  "Realistic Mode", "Model credit card usage", "Compare Offset vs ETF
  Investing", and "Invest in ETFs" all had their `InfoTooltip` nested
  INSIDE the `<label>`, same issue "First Home Buyer" already avoided (its
  own code comment explains why - nesting pulls the tooltip button's own
  aria-label into the checkbox's computed accessible name). Moved each
  `InfoTooltip` to a sibling position immediately after `</label>`, same
  pattern as "First Home Buyer", with the same explanatory comment.
  Verified via a DOM query in the browser: all 4 checkboxes' `<label>`
  elements now have `hasNestedButton: false` and clean label text (e.g.
  "Realistic Mode" instead of "Realistic Mode" + the entire tooltip
  paragraph). Confirmed the tooltip still opens/closes correctly on click
  in its new position, no visual change.
  `npm test -- --run` (495/495), `npm run lint`, `npm run build` clean -
  pure JSX repositioning, no logic touched.

- [x] **TODO-131: ETF growth's tax drag now uses the AU 50% CGT discount instead of the full effectiveTaxRate**
  Changed `offsetSimulation.js:166` from `expectedEtfReturn * (1 -
  effectiveTaxRate / 100)` to `expectedEtfReturn * (1 - (effectiveTaxRate *
  0.5) / 100)`, assuming a >12-month holding throughout (ETF investing is
  already framed everywhere in this app as a long-term commitment).
  Explicitly did NOT add realization-timing/deferral modeling (tracking a
  "sale" event) - out of scope, matches the user's own preference to avoid
  added complexity. Added a sentence to the existing "Compare Offset vs ETF
  Investing" tooltip (`App.jsx`) naming the CGT discount specifically, so
  the wording doesn't lead a user to overestimate the tax drag when doing
  their own breakeven math.
  Updated the two `offsetSimulation.test.js` tests whose expected ETF
  balances baked in the old full-rate formula (`effectiveTaxRate: 50,
  expectedEtfReturn: 24` -> net rate is now 18% p.a./1.5%/month, not 12%/1%)
  - `[1000, 2010, 3030]` became `[1000, 2015, 3045]` in both.
  `npm test -- --run` (495/495), `npm run lint`, `npm run build` clean.
  Verified the updated tooltip text in the browser.

- [x] **TODO-132: Clarified that "Expected ETF Return" means TOTAL return (price growth + dividends/distributions reinvested)**
  Added one sentence to the "Expected ETF Return" slider's helper text
  (`App.jsx`): "This should be TOTAL return (price growth plus dividends/
  distributions reinvested), not just price growth." No calculation
  change. Verified in the browser.

- [x] **TODO-121: Added a tooltip/note explaining Realistic Mode vs. Optimistic (off) mode**
  Two additions, both only text/copy: (1) the existing "Realistic Mode off"
  note (in the Realistic Mode card) now explains it's an optimistic
  baseline ("what the numbers would look like if you paid no tax and
  nothing ever grew"), not an improved calculation; (2) a new one-line note
  at the top of the "⏱️ Loan Simulation" results card, shown only when
  Realistic Mode is off, reiterating that "Time to pay off"/"Total interest
  paid" are an optimistic baseline. Verified both in the browser.

- [x] **TODO-123: Clarified that tax is modeled as smooth/PAYG-style withholding, not an annual lump sum**
  Added a sentence to the Effective Tax Rate slider's helper text
  (`App.jsx`, only ever shown while Realistic Mode is on): "Simplification:
  applied smoothly every month (PAYG-style), not as an annual tax return -
  typically well under 5% off for salary-only income, more with substantial
  Gross rental/investment income on top." No simulation change - matches
  the analysis's conclusion that this is a timing/float effect only (same
  class as the existing Credit Card Timing Benefit), not worth a calendar/
  financial-year concept in the core loop. Verified in the browser.

- [x] **TODO-125: Clarified that income amounts are assumed NET (take-home) unless "Gross" is checked**
  The shared "This is a gross (pre-tax) amount" checkbox label (used by all
  3 income amount-field variants: generic Weekly Amount, House Rent, Room
  Rent) now reads "This is a gross (pre-tax) amount (otherwise assumed
  net/take-home)" - a one-line change, always visible regardless of the
  checkbox's state, right where the user is already entering the amount.
  Verified in the browser.

  All 5 of the above (`npm test -- --run` 495/495, `npm run lint`, `npm run
  build` clean, Spanish-text sweep clean): pure copy/tooltip additions plus
  TODO-131's one-line formula change - no other calculation logic touched.

- [x] **TODO-129: Modeled negative gearing (investment property losses offsetting other taxable income)**
  Fully automatic, no new checkbox (confirmed with the user) - applies
  whenever `isInvestmentProperty` is true and the property is cash-flow
  negative that month; naturally zero otherwise (no rental income, no
  loss, or `effectiveTaxRate: 0`).
  `offsetSimulation.js`: new `isInvestmentProperty = false` param. Each
  month, right after `monthlyInterest` is computed: a SECOND, independent
  computation of `rentalIncomeThisMonth` (the same sub-expression already
  inlined into the existing combined `monthlyIncomeThisMonth` sum - not
  extracted from it, to avoid floating-point drift across every other test
  in the file) is compared against `monthlyExpensesForMonth +
  monthlyInterest`. If negative, the loss × the FULL `effectiveTaxRate`
  (not TODO-131's 50%-CGT-discounted rate - this is ordinary-income relief,
  not a capital gain) is credited directly into `offsetBalance`, bypassing
  `offsetAllocationPct`/`etfAllocationPct` entirely (same bypass pattern as
  one-time Offset Contributions). Applied AFTER this month's own
  `monthlyInterest`/`effectiveOffset` are already fixed, so the benefit
  affects next month's offset onward, never retroactively this month's -
  avoids circularity, matches the same "one-month lag" idiom already used
  for savings-interest/ETF-growth accrual. New `totalNegativeGearingBenefit`
  return field (also added to the early-out sentinel).
  `App.jsx`: `isInvestmentProperty` added to all THREE
  `calculateLoanWithOffset`/`runStrategyGrid` call sites (`loanSimulation`,
  `baselineSimulation`, and the Strategy Comparison grid's `gridBaseParams`
  - the third one is easy to miss and matters, otherwise the Pareto-front
  table would silently exclude the benefit while the main results include
  it).
  Tests: new `describe('negative gearing tax benefit (isInvestmentProperty,
  TODO-129)', ...)` in `offsetSimulation.test.js` - parity when
  false/omitted even with a real loss, hand-computed benefit landing in
  `offsetBalance` starting the FOLLOWING month (not the loss month itself),
  no benefit when cash-flow positive, zero benefit at `effectiveTaxRate: 0`
  despite a real loss. Also fixed one pre-existing test's hardcoded sentinel
  object (`toEqual({ years: 999, ... })`) to include the new
  `totalNegativeGearingBenefit: 0` field.
  Design validated via a Plan-Mode sub-agent that read the full simulation
  file before implementation - it caught two things worth noting: (1) the
  floating-point-drift risk of naively splitting the existing combined
  income sum (avoided by duplicating the computation instead), (2) the
  third `gridBaseParams` call site, which the original TODO write-up hadn't
  mentioned.
  `npm test -- --run` (499/499), `npm run lint`, `npm run build` clean.
  Spanish-text sweep clean.

- [x] **TODO-141: Removed the "Realistic Mode" on/off gate - projection assumptions are now always active**
  The prerequisite for TODO-135. `realisticModeEnabled` gated seven
  assumptions (property/salary/rent/expense growth, vacancy, inflation,
  effective tax rate), which meant a UI toggle silently switched the
  FINANCIAL MODEL, not just what was on screen - directly contradicting
  TODO-135's "one model, two presentations" promise. The name was a second
  problem: it implied turning it off produced a worse calculation, when it
  produced an unrealistic one.
  Deleted the `realisticModeEnabled` state and all seven `realistic*`
  derived consts (`realisticModeEnabled ? x : 0`); every one of the ~31
  consumption sites now reads the raw state directly. The card is renamed
  **Projection Assumptions** - "Advanced Assumptions" was rejected because
  Financial Position already has an expander by exactly that name, which
  `getByRole('button', { name: /Advanced Assumptions/ })` in the test suite
  relies on.
  **Three decisions locked with the user before implementing:**
  (1) *Legacy scenarios* - a scenario saved with the mode OFF still stored
  live non-zero rates that were inert at the time, so loading them as-is
  would have silently changed a projection the user had already seen. New
  module-scope `legacyFlatBaseline` (`config.realisticModeEnabled === false`,
  strict `===` so a fresh session's `undefined` is unaffected) makes the
  seven rate initializers fall back to 0 for exactly those scenarios. NO
  `SCHEMA_VERSION` bump: the payload shape isn't changing, only one boolean
  stops being written, and bumping would have discarded users' entire
  scenarios (price, expenses, income) over one field. The branch decays on
  its own - a re-saved scenario no longer carries the flag - and can be
  deleted whenever TODO-136 bumps the version for its own reasons.
  (2) *New-session defaults* - the TODO-106 values (5/3/3/2.5/2.5/2wk/20)
  are now active from the first render. Default results are slower and more
  expensive than before, and honest.
  (3) *Card naming* - Projection Assumptions, as above.
  **Copy replaced rather than deleted.** The Loan Simulation banner used to
  fire on `!realisticModeEnabled`; it now fires on a new
  `projectionIsFlatBaseline` derived const and describes what the numbers
  ARE ("Every growth, vacancy and tax assumption is set to 0 - these figures
  are a flat baseline...") instead of which switch is off. That const
  deliberately excludes `propertyGrowthRate` and `inflationRate`: neither
  changes payoff time or total interest (property growth only feeds
  `propertyValue` inside `offsetSimulation.js`; inflation is applied after
  the simulation per TODO-93), so including them would make the claim wrong
  in both directions. This is what makes TODO-141's "a zero value can be a
  valid flat baseline, but it must be labeled as such" true in the UI.
  Also dropped the now-impossible first branch of the "Invest in ETFs"
  helper ladder and re-pointed the remaining one at the renamed card. The
  ETF checkbox keeps its `effectiveTaxRate > 0` condition - comparing a
  pre-tax ETF return against the offset's tax-free return is dishonest
  whatever put the rate at 0 - it just fires rarely now.
  **Made the card collapsible (default collapsed), which TODO-141 didn't
  ask for**: removing the gate turned a one-checkbox card into seven
  always-visible sliders, a real density regression against this project's
  repeatedly-affirmed collapse-by-default pattern (TODO-20/24/132, and
  TODO-140 for Health Check). Uses the same `show*` + `▸/▾` idiom, with
  `showProjectionAssumptions` persisted alongside its siblings (additive,
  so still no version bump).
  **Fixed pre-existing stale copy found en route**: all six slider
  descriptions claimed "0% (default)" while the real defaults were
  5/3/3/2/2.5/2.5, and a comment claimed the mode defaulted to `true` when
  it was `false`.
  Tests: `App.realisticMode.test.jsx` renamed to
  `App.projectionAssumptions.test.jsx` and reworked - the two tests that
  encoded the on/off concept were replaced by ones that matter more under
  the new design: **expanding/collapsing the card leaves every result
  byte-identical** (the core "presentation only" promise), and the flat-
  baseline banner appears only once all five simulation-affecting
  assumptions are 0. Four new legacy/migration tests in
  `App.persistence.test.jsx` cover the mode-OFF flat-baseline load, the
  mode-ON intact load, a fresh session's non-zero defaults, and that
  re-saving stops writing the dead flag. Added the new card to
  `App.collapsiblePanels.test.jsx`'s shared toggle table.
  Also corrected two now-stale plans elsewhere in this file: TODO-122's
  auto-fill trigger (it hung off the Realistic Mode on/off transition, which
  no longer exists - flagged as needing a new trigger decision rather than
  silently inventing one) and TODO-133's framing (the gap now affects every
  user by default, not only those who opted in).
  `npm test -- --run` (509/509), `npm run lint`, `npm run build` clean.
  Spanish-text sweep clean. Verified no `realistic*` identifier and no
  user-visible "Realistic Mode" string remains in `src/`.

- [x] **TODO-136: Direct Offset-vs-ETF monthly split (replaces the two-step Offset/Savings/ETF model)**
  Supersedes TODO-124 and TODO-130. The monthly surplus now splits DIRECTLY
  between the offset and ETF investing via `etfAllocationPct`; the ongoing
  "Savings" destination and its `offsetAllocationPct` slider are gone. The
  settled reasoning: an offset already gives you everything a savings
  account does (fully liquid) PLUS it reduces guaranteed, effectively
  tax-free loan interest, so "offset vs savings vs ETF" was never a real
  decision - "offset vs ETF" is.
  **The de-risking discovery, made before writing any code:** at
  `offsetAllocationPct: 100` (the default) the new model is *mathematically
  identical* to the old one - old `etfShare = (net x 100/100) x etfPct/100`,
  new `etfShare = net x etfPct/100`. Verified empirically by capturing four
  scenarios (default, ETF 30%, ETF 30% + 25% threshold, ETF 100%) before the
  change and diffing after: byte-identical months/interest/offset/etf/
  savings. So nobody who left the slider alone sees any change at all, and
  every test passing 100 or omitting it kept its exact numbers.
  **Signed cash flow - the real behaviour change.** `netMonthlyDeposit` was
  wrapped in `Math.max(0, ...)`, so a deficit month silently cost nothing.
  It's now `netMonthlyCashFlow`, signed: a deficit draws down the offset
  and, once that's empty, the remainder is recorded as a real cash
  shortfall (`cashShortfall` per month, `totalCashShortfall` /
  `monthsWithShortfall` on the result). The zero floor on the drawdown is
  load-bearing, not defensive - a negative offset would make
  `effectiveBalance` exceed `balance`, inflating interest and breaking the
  TODO-57 guarantee that a re-amortized loan still pays off exactly at term
  end. Two existing multi-rate-change tests silently depended on that and
  are now the regression canary for it. A deficit month also makes no ETF
  contribution: you can't invest money you don't have.
  **Surfacing (decided with the user):** a per-month `⚠️ Short: $X` row in
  the Timeline Explorer plus a summary warning in the Loan Simulation card.
  That warning deliberately complements rather than duplicates the existing
  "❌ Need $X/month extra" status in Total Summary - that one catches a
  month-1 shortfall from static figures, this one catches shortfalls that
  only emerge DURING the projection (scheduled expenses, a rate change,
  expense growth outpacing income), which nothing surfaced before.
  **Persistence:** `SCHEMA_VERSION` 9 -> 10. Old scenarios carrying
  `offsetAllocationPct` fail the version check and reset to defaults - the
  established discard-not-migrate precedent, and TODO-136 Phase 2's own
  decision. While there, rewrote the two `scenarioStorage.test.js` cases
  that hardcoded the version literal to use the injectable `expectedVersion`
  instead, so they stay meaningful across future bumps; one of them would
  otherwise have started passing for the wrong reason (version mismatch
  rather than the missing key it claims to test).
  **Copy rewritten, not just unhooked** - six places described the
  offset-vs-savings split and had become factually wrong: the page subtitle,
  the Savings Interest Rate helper ("plus whatever isn't sent to the offset
  each month"), the ETF Allocation helper, the results heading ternary, the
  "To Offset / To Savings" panel (now "To Offset / To ETF", gated on ETF
  being active), and the Timeline savings-row comment.
  **The card move to "Extra Investments & Strategies" was deliberately
  deferred to TODO-137**, where it gains its second occupant - moving the
  ETF block now would have been a pure relocation with no user-visible
  benefit, doubling an already-large diff.
  Tests: rewrote the whole `offset vs. savings split (TODO-49)` describe
  block and eight semantics-dependent ETF/switch-trigger cases; added five
  new cash-shortfall tests (no shortfall in surplus, offset absorbs a
  deficit, remainder reported once the offset is dry, never goes negative,
  no ETF contribution in a deficit month) and three App-level ones. The
  TODO-129 negative-gearing lag test changed meaning honestly: the deficit
  that caused the loss now also consumes the gearing credit it earned, so
  the lag is re-proven in a separate test where the household actually
  covers the property's deficit (the realistic negative-gearing case).
  `npm test -- --run` (515/515), `npm run lint`, `npm run build` clean.
  Spanish-text sweep clean. Verified no `offsetAllocationPct` identifier and
  no "Offset Allocation" string remains in `src/`.

- [x] **TODO-137: "Extra Investments & Strategies" card + Offset-vs-ETF side-by-side comparison**
  Two pieces shipped together, because the second is the first one's reason
  to exist - TODO-136 deliberately deferred the card here rather than ship a
  pure relocation with nothing new in it.
  **The card.** The whole ETF block (218 contiguous lines) and the TODO-126
  master toggle moved out of Financial Position's "Advanced Assumptions"
  expander, which had become an unrelated grab-bag (savings rate, credit
  card, mortgage-free age, ETF). New top-level card between Financial
  Position and Offset Contributions, `TrendingUp` icon, matching the
  Projection Assumptions skeleton from TODO-141.
  **Two controls on purpose, not merged.** The checkbox is an opt-in that
  genuinely pauses the ETF effect on the simulation; the new
  `showExtraInvestments` collapse is presentation only and is rendered only
  once the checkbox is on (nothing bulky to collapse otherwise). Conflating
  them would have re-introduced exactly the bug TODO-141 removed. Also
  dropped the now-dead ETF clause from `financialPositionAdvancedCustomized`
  and fixed the Projection Assumptions tooltip that name-checked the ETF
  controls' old location.
  **Proved the move changed nothing**: captured "Time to pay off" / "Total
  interest paid" from a rendered App before and after - byte-identical. A
  relocation must not move a figure.
  **The comparison panel.** New `src/calculations/strategyScenarios.js` runs
  `calculateLoanWithOffset` three times against identical inputs, varying
  only the allocation: Offset only (0%), Your split (the configured %), All
  to ETF (100%). Deliberately NOT a ranking - 100% ETF is a boundary marker,
  never a recommendation, same principle as the Pareto front's "show the
  spread, not a winner". Distinct from `strategyComparison.js`, which
  grid-searches 441 pairs; this answers the narrower, more legible question
  of where YOUR chosen split sits between the extremes.
  Rendered by a new `StrategyScenarioComparison` component as two tables,
  per the locked decision: an end-state summary (metrics as rows, the three
  strategies as columns) plus a year-by-year table of one selectable metric
  (net worth by default - it's where the lines actually cross). One ~21-column
  grid was rejected as unreadable.
  **Three findings from exploration that changed the design:**
  (1) TODO-137's requested "Emergency Buffer" per strategy is **impossible as
  specified** - it derives from `cashRemaining`, a settlement-time constant,
  so it is identical across all three. Replaced with **Accessible cash =
  offset + savings**, which genuinely varies. The ETF balance is excluded on
  purpose: needing to sell units, possibly at a loss, is the exact trade-off
  the panel exists to show.
  (2) The month axis is driven by the LONGEST-running strategy, since
  diverting surplus slows the payoff and the three finish at different times.
  `getTimelineSnapshot`'s existing clamp handles a finished strategy
  correctly - it freezes, because its loan was covered.
  (3) Writing the tests surfaced a genuinely counter-intuitive existing
  convention: the simulation treats a loan as paid off once the OFFSET COVERS
  the balance, so an offset-only run's final `monthlyData` entry reports
  `balance: 167,585`, not 0. A first test assumed otherwise and failed; it
  now asserts the real property (the figure freezes from the payoff month
  onward) and documents the convention so the next person doesn't trip on it.
  Tests: 18 new in `strategyScenarios.test.js` (0%/100% custom are
  byte-identical to the boundaries, switchThresholdPct is honoured rather
  than assumed 0, the sentinel guard, the monthly-stepping fallback for a
  sub-2-year projection, accessible cash excludes ETF), 4 new App-level ones
  including a **cross-check that the panel and the Timeline Explorer report
  the same final offset balance** - they read the same simulation through the
  same helpers, so a mismatch would mean one of them is lying. Reworked the
  ETF setup helpers in `App.projectionAssumptions.test.jsx` (the old
  `expandFinancialPositionAdvanced` no longer reaches ETF) and added the new
  card to `App.collapsiblePanels.test.jsx` as its own describe, since its
  expander only exists after the master toggle is on.
  **Deferred to TODO-143** (split agreed before implementing): the
  `riskScore`/cash-shortfall problems in the *existing* Pareto table. They
  touch a different, already-shipped feature and would have tripled an
  already-large diff.
  `npm test -- --run` (538/538), `npm run lint`, `npm run build` clean.
  Spanish-text sweep clean.

- [x] **TODO-143: Surfaced cash shortfall in the Pareto Strategy Comparison**
  Split out of TODO-137 (2026-08-16) before implementing it - a correctness/
  honesty fix in already-shipped UI, not a new feature. Since TODO-136 made
  deficit months real (a shortfall drains the offset instead of being
  silently floored to zero), `selectParetoFront` had a real gap: it optimises
  only two objectives (total interest paid, ETF balance), so a grid cell that
  achieves both **by running out of cash** was selected as Pareto-optimal and
  presented as attractive, with nothing indicating it wasn't actually
  affordable. Compounding it, `riskScore = 100*etf/(etf+offset)` read
  identically whether the offset was low from a deliberate high ETF
  allocation or from a shortfall draining it.
  **Decided (already settled when TODO-143 was written): flag, don't
  exclude.** A shortfall-affected strategy stays in the comparison - its
  numbers are still real - but now gets a visible warning. Deliberately did
  NOT touch the `riskScore` formula itself: the new column explains *why* a
  row's riskScore might be misleadingly high, which is what actually
  resolves the complaint, with far less risk than changing a formula every
  existing test already asserts exact values for.
  `runStrategyGrid` (`strategyComparison.js`) now captures
  `totalCashShortfall`/`monthsWithShortfall` from `calculateLoanWithOffset`'s
  result (already returned since TODO-136 - no new simulation work needed).
  `selectParetoFront`'s dedupe key gained a `hasShortfall` boolean
  (`` `${totalInterestPaid}-${etfBalance}-${shortfall>0}` ``) so two cells
  sharing interest/ETF balance no longer silently collapse into whichever one
  happened to sort first when one of them only got there by running dry -
  dominance itself stays 2-objective, unchanged.
  New "Cash Shortfall" column in `App.jsx`'s Pareto table, **appended** after
  "Crash Test" (never inserted before "Allocation" - the Apply-button test
  reads cells positionally). Reuses the exact `⚠️ $X over N mo` wording and
  `text-red-600 dark:text-red-400` styling TODO-136/137 already shipped in
  three other places, so a user who sees more than one of these panels reads
  the same convention every time.
  Tests: extended `toMatchObject`/sentinel assertions for the two new fields;
  a new test proving a shortfall cell and an otherwise-identical healthy cell
  both survive the dedupe fix (they used to collapse to one); a new
  end-to-end `runStrategyGrid` test with a real scheduled expense proving the
  fields actually flow through, not just discarded-then-zeroed; the App-level
  header loop and Apply-button test updated for the new column; one new smoke
  test confirming the default (no-deficit) scenario reads "None" everywhere.
  `npm test -- --run` (541/541), `npm run lint`, `npm run build` clean.
  Spanish-text sweep clean.

- [x] **TODO-138 (part 1): ETF return sensitivity + break-even return**
  The original TODO-138 asked for five sub-features. Exploration found their
  costs were radically different, so the two needing NO simulation-engine
  change shipped here and the rest were split out (TODO-144/145 below).
  These two belong together because they sit on the same axis
  (`expectedEtfReturn`): one shows three points on it, the other finds the
  crossing point.
  **Return sensitivity.** New `runReturnScenarios` in `strategyScenarios.js` -
  a sibling to `runStrategyScenarios`, not a change to it (that one's exact
  3-element shape and signature are pinned by its own tests). Holds the
  allocation fixed and varies the return, banding ±3 points around the user's
  OWN Expected ETF Return rather than absolute figures this app declares
  "conservative" - the point is showing how much the answer rests on a guess,
  not asserting what the guess should be. The conservative case clamps at 0,
  since a negative return models a permanent decline, which is a different
  claim than "lower than you hoped". Every downstream helper
  (`hasUsableData`/`summariseStrategy`/`getComparisonMonths`/
  `buildComparisonRows`) was already agnostic about which knob varied and was
  reused untouched.
  **Break-even return.** New `etfBreakEven.js` - the first root-finding helper
  in `src/calculations/` (everything else there is a forward calculation), so
  it's deliberately plain bisection rather than anything clever.
  **Why bisection is provably valid here, not just convenient:** `etfBalance`
  is written in exactly three places in `offsetSimulation.js` and never READ
  by the loan side. So the expected return moves the ETF balance and nothing
  else - it cannot shift the payoff month, the offset, or the interest paid.
  That makes net worth strictly monotonic in the return (one crossing point),
  fixes the comparison horizon (no moving target), and means the offset-only
  arm is simulated once outside the loop. A test pins the payoff-month
  invariance explicitly so a future engine change breaks a test rather than
  silently invalidating the solver.
  **The modelling trap this avoided, found by a failing test.** The plan said
  to compare both arms at the LATER of the two payoff months. That produced
  "no return needed at all", which was nonsense. Cause: past its own payoff a
  run has no more `monthlyData`, so `getTimelineSnapshot` clamps it to its
  final row - freezing not just its balances but its PROPERTY VALUE. On a real
  fixture the offset-only arm froze at ~797k while the still-running arm showed
  ~964k at the same date: a ~168k phantom gap with nothing to do with either
  strategy, since the property appreciates identically either way. Switched to
  the EARLIER payoff month, where both arms are genuinely live and mid-flight
  and nothing is frozen or invented. The question it now answers is crisp: at
  the moment the safe path would have cleared your loan, what return would the
  ETF have needed to leave you equally well off? Both the reasoning and a
  regression test for the frozen-property artifact are in the code.
  Also deliberately NOT the naive `return × (1 - tax) - mortgage rate` formula
  from popular financial-planning material - it ignores the payoff-date shift,
  the negative-gearing feedback, and the AU 50% CGT discount the engine already
  models properly (previously recorded in this file, honoured here).
  Reports three distinct outcomes rather than a bare number - a rate was found,
  no plausible return catches up, or there's no threshold to clear at all -
  because quoting "0%" for the third case would imply a threshold exists.
  **UI:** new `EtfReturnSensitivity` component, its own rather than a
  parameterisation of `StrategyScenarioComparison` - that one hardcodes its
  copy, a `CUSTOM`-key check, seven literal rows, and a fixed `<select>` DOM
  id. Notably this panel has NO metric-over-time selector, which sidesteps
  that id collision entirely (existing tests query it un-scoped and would break
  on a duplicate); a test now pins that there's still exactly one such control.
  Tests: 12 new in `etfBreakEven.test.js` - including a **round-trip** (feed
  the reported rate back into a fresh simulation and assert net-worth parity,
  the check that would actually catch a wrong answer), a genuine-threshold
  check (just below loses, just above wins), monotonicity, the frozen-property
  regression, both edge outcomes with fixtures found empirically rather than
  guessed, and a plausibility anchor so a refactor producing an absurd figure
  fails even if the pure round-trip still passes. 7 new in
  `strategyScenarios.test.js`, 5 new App-level.
  `npm test -- --run` (565/565), `npm run lint`, `npm run build` clean.
  Spanish-text sweep clean.

- [x] **TODO-142: Risk-tolerance profile reference points (Conservative/Moderate/Aggressive) - educational only, not an auto-apply preset**
  Surfaced from external financial-planning material the user researched
  (2026-08-13): planners commonly frame the Offset-vs-ETF decision using a
  risk-tolerance profile (Conservative/Moderate/Aggressive) mapped to a
  typical starting split (e.g. roughly 80/20, 50/50, 20/80), plus a "safety
  floor" (emergency-fund months that must stay in Offset regardless of
  profile) and a tax-bracket input. **Decided (2026-08-13): add this as pure
  educational reference content, not a feature that sets anything for the
  user** - it does not get its own quiz, button, or "apply my %" action that
  writes to the ETF Allocation slider.

  **Why the careful boundary:** the whole ETF comparison family (TODO-137,
  TODO-138 part 1, and the pending TODO-144/145) rules out "an optimizer that
  tells the user the exact best ETF percentage" as out of
  scope, consistent with this app's TODO-94 design philosophy (no feature
  that could read as personalized financial advice). A profile-driven
  auto-set control would cross that line; a labeled reference table does
  not, provided the copy stays in the register of "investors who describe
  themselves as X typically consider a range around Y" rather than "you
  should do Y."

  **Scope:**
  - A small reference block (inside the Extra Investments & Strategies card,
    which now hosts three comparison panels it would sit alongside) -
    three rows/cards (Conservative/Moderate/Aggressive) each showing an
    illustrative starting-point RANGE (not a single precise number) and a
    one-line rationale (time horizon, tolerance for a market drop, reliance
    on the mortgage rate environment).
  - Explicit, visible disclaimer that these are illustrative starting
    points from general financial-planning practice, not personal advice,
    and that the user's own ETF Allocation slider (TODO-136) is unaffected
    by anything shown here - no auto-fill, no "Apply" button.
  - The "safety floor" concept (minimum months of expenses that should stay
    in Offset before any ETF allocation) overlaps with the Health Check's
    existing Emergency Buffer indicator (TODO-133/134) - reuse that
    figure/language rather than inventing a second "safety floor" number
    with different math.
  - Does not require new simulation logic - this is a static reference
    panel, not a calculator. If it later needs to *react* to the user's own
    numbers (e.g. "your current Emergency Buffer already covers your
    Conservative floor"), that upgrade should be considered as a distinct,
    later follow-up decision, not assumed as part of this scope.

  **Out of scope (the standing boundary across this whole ETF family):** no
  button that sets the ETF Allocation slider, no quiz that computes "your
  profile is X", no claim that any percentage is optimal for the specific
  user's situation.

  **Shipped (2026-08-17):** new `RiskToleranceProfiles.jsx` - presentational,
  no internal state, no calculation. Three colour-coded cards
  (Conservative ~10-30% / Moderate ~30-60% / Aggressive ~60-90%), each an
  illustrative range plus a one-line rationale in the required register
  ("investors who describe themselves as X typically consider a range around
  Y"), never a single precise percentage. A safety-floor callout reuses the
  EXACT `emergencyBufferMonths`/`classifyEmergencyBuffer` values Purchase
  Health Check already computes and renders (`App.jsx:677-678`) - read once,
  not recomputed or reclassified a second way, so the two readings cannot
  drift apart. The visible not-advice disclaimer uses the app's own
  established amber-box idiom (`App.jsx`'s top-of-page banner) rather than
  new styling. Gated on `etfInvestingActive`, same as its two sibling panels
  (`StrategyScenarioComparison`, `EtfReturnSensitivity`) - only shows once
  ETF investing is genuinely active, not merely once the card is open.
  Tests: 5 new component-level (all three profiles render as ranges never a
  bare number; the disclaimer text; the safety-floor line reflects whatever
  is passed in rather than a hardcoded figure; the `∞` case; zero interactive
  controls anywhere in the panel) and 5 new App-level, including a
  cross-check that the figure shown here textually matches what Purchase
  Health Check renders elsewhere on the same page - the check that would
  actually catch the two readings drifting apart. One implementation
  mistake caught by that same test suite before shipping: the panel was
  initially wired unconditionally (no `etfInvestingActive` gate at all), so
  it appeared even with "Invest in ETFs" unchecked - the "appears only once
  ETF investing is on" test failed immediately and caught it.
  `npm test -- --run` (575/575), `npm run lint`, `npm run build` clean.
  Spanish-text sweep clean.

- [x] **TODO-133: Decided - Health Check should reflect projection assumptions, unified with TODO-134's Day1/Stabilized framework**
  The Health Check indicators (Emergency Buffer, Housing Cost Ratio,
  Stress Test, Upfront Cost Ratio, Gearing, Vacancy Buffer, Rental
  Yield, Mortgage-Free Age) all use "month 1 / right now" static
  snapshots — they are computed from the base `cashRemaining`,
  `totalPropertyCost`, `monthlyIncome`, etc. They apply the Effective Tax
  Rate (via `weeklyIncome`/`weeklyRentalIncome`) but ignore every
  **growth** assumption — property/salary/rent/expense growth and vacancy
  never enter them. Since TODO-141 those assumptions are always active and
  default to non-zero, so this gap now affects every user by default rather
  than only those who had opted into the old Realistic Mode:
  - A user projecting salary growing 3%/yr, rent 3%/yr and property 5%/yr
    still sees Health Check badges that ignore all of it — the Emergency
    Buffer might read "High risk" today even though income will outpace
    expenses within 2 years.
  - The Loan Simulation and Timeline Explorer beside it DO reflect that
    growth, so the two panels can tell visibly different stories about the
    same scenario with no explanation of why.

  **Decided (2026-08-17):**
  1. **Unify with TODO-134, one Day1+Stabilized framework, not two patches.**
     TODO-134 already recommended a two-value approach (Day 1 / Stabilized)
     for indicators affected by future SCHEDULED income - this TODO's
     growth-compounding concern is the same underlying question about one
     consistent model, not a second mode. The same mechanism now covers
     both causes together: Housing Cost Ratio, Stress Test, Gearing, and
     Rental Yield show Day 1 + Stabilized reflecting BOTH scheduled income/
     expense changes AND compounding growth; Emergency Buffer and Vacancy
     Buffer gain the Stabilized view too (their Day 1 reading is unchanged -
     `cashRemaining` is inherently a settlement-day figure).
  2. **What "Stabilized" means under continuous growth** (the open problem
     TODO-134's original write-up didn't anticipate - it assumed a single
     schedule-change event to wait for, but a growth rate compounds forever,
     with no natural "fully kicked in" month): use the month the LAST
     scheduled income/expense change fires as the stabilization point, and
     read that month's already growth-adjusted values there - reusing the
     existing simulation (`monthlyData`), no new calculation engine. If a
     scenario has no scheduled changes at all, fall back to a fixed default
     horizon (year 5) so "Stabilized" is never undefined.
  3. **"Offset Utilisation (this month)"** (`App.jsx:3543-3554`, TODO-70) -
     confirmed this one is DIFFERENT from the rest: it already reads
     whichever month the Timeline Explorer's own slider is on, not a fixed
     "month 1" figure, so the Day1/Stabilized question doesn't apply to it.
     Its real problem is narrower: `OFFSET_UTILISATION_BANDS`
     (`purchaseHealthCheck.js:168-173`) labels its middle tiers "Building"/
     "Early days", implying guaranteed forward progress that stopped being
     true at TODO-136 (a deficit month can drain the offset). Decided:
     relabel only (e.g. neutral tier names that don't imply a trend) -
     no new trend arrow/indicator, no change to the numeric thresholds or
     `calculateOffsetUtilisation`'s math.

  Implementation of all of the above now lives in TODO-134, which already
  had the two-value display design and the worse-of-two classification rule
  - see that entry for the full mechanism.

- [x] **TODO-134: Health Check indicators - Day1/Stabilized dual-value display, unified with TODO-133**
  Emergency Buffer, Housing Cost Ratio, Interest Rate Stress Test, Gearing,
  Vacancy Buffer, and Rental Yield now show a "Day 1" value plus a
  "Stabilized" annotation (e.g. "↗ stabilizes to 5.8 months"), classified by
  whichever of the two is worse. New `src/calculations/projectedHealthCheck.js`
  module (fully independent of `offsetSimulation.js` - `monthlyData` doesn't
  carry per-month income/expense figures, and none of these six indicators
  actually need the loan simulation's own bookkeeping) exports:
  - `findStabilizationMonth` - the month the last RECURRING income/expense
    item's schedule boundary or property-expense/interest-rate `changes[]`
    entry fires, or month 60 (year 5) if nothing is scheduled. One-time
    items are excluded (a lump sum isn't a new steady state).
  - `resolveProjectedFinancials` - re-evaluates income/expenses at an
    arbitrary month with growth applied, mirroring the Day-1 calculation.
    Emergency/Vacancy Buffer's numerator (`cashRemaining`) stays fixed at
    Day 1 for both readings - only the denominator moves. Stress Test/
    Gearing use the ORIGINAL `loanAmount` (never the offset-reduced
    balance), only re-amortizing if a scheduled rate change applies by then.
  - `worseOf` - resolves "worse" on the raw value via an explicit
    `higherIsBetter`/`higherIsWorse` direction, since `classifyByBands`'
    band arrays aren't consistently ordered by severity across indicators.
  Separately relabeled `OFFSET_UTILISATION_BANDS`' "Building"/"Early days"
  tiers to "Moderate"/"Low" (`purchaseHealthCheck.js`) - those names implied
  guaranteed forward progress that stopped being true once TODO-136 let a
  deficit month drain the offset. No signature/return-value changes to any
  existing `calculate*`/`classify*` function - every one is pinned by
  exact-value tests. 24 new tests (`projectedHealthCheck.test.js`,
  `HealthCheckIndicator.test.jsx`'s `secondaryValueDisplay` case,
  `App.healthCheckStabilized.test.jsx`'s year-5-fallback and
  scheduled-salary-raise cases) plus updated `OFFSET_UTILISATION_BANDS`
  label assertions; full suite (594 tests), lint, and build all clean.

- [x] **TODO-116: Extract the 3x-duplicated "add item" recurrence-picker form**
  The One-Time checkbox -> Start-Month slider -> Monthly/Quarterly/Yearly
  button trio -> End-Month slider sub-form was copy-pasted three times, each
  with its own private set of 4 `useState` vars (12 in `App.jsx` for one
  repeated concept). Real locations were `App.jsx:2037-2085` (Offset
  Contributions), `2601-2649` (Income Sources), `2765-2813` (Personal
  Expenses) - the line numbers in the original entry were stale, predating
  TODO-115.
  Split into a hook + a component, following the existing `useSteppedValue` /
  `SteppedExpenseField` precedent:
  - **`src/hooks/useScheduleForm.js`** owns the four fields and the three
    operations all three forms performed on them: a derived `schedule` object
    (the schedule half of a list item - `recurrence: 'none'` and NO `endMonth`
    key for a one-time item), `validateRange()` (owns the shared alert, same
    as `useSteppedValue.addChange` owns its own), `reset(overrides)`, and
    `applyDefaults(defaults)` for the `INCOME_CATEGORY_DEFAULTS` path.
  - **`src/components/ScheduleFields.jsx`** renders the markup once. Returns a
    **fragment, not a wrapper div** - all three call sites space these fields
    with `space-y-3`/`grid gap-3`, which only apply to direct children, so a
    wrapper would have silently collapsed the vertical rhythm. Colours stay
    per-form via literal-class lookup maps (`bg-${color}-200` is invisible to
    Tailwind), and the six hardcoded slider ids became `useId()`-derived,
    since one component rendered 3x can't ship duplicate ids.
  Asymmetries deliberately left in `App.jsx` because they're about the *list*
  or the *amount*, not the schedule: the duplicate-one-time-month guard, the
  silent-vs-alerting invalid-amount paths, the post-insert sort, and
  Contributions' `getNextSuggestion`-based reset (passed in via
  `reset({ startMonth })`, since the hook has no business knowing the list).
  The one real trap: `removeOffsetContribution` must call `setStartMonth`, not
  `reset()` - a full reset would wipe recurrence/End Month out from under an
  add-form the user has open.
  Also fixed a pre-existing inconsistency: Personal Expenses' Start Month
  label was missing `text-xs`, so it rendered at 14px while the other five
  equivalent labels (including its own End Month sibling) rendered at 12px.
  `App.jsx` 3800 -> 3621 lines (-179). 18 new tests (11 hook, 7 component,
  including a `container.children` fragment guard and a colour-map guard that
  nothing else would catch); **not one character changed in any existing
  `App.*.test.jsx`** - they were the acceptance criterion, since they pin the
  checkbox's accessible name, the label+slider sibling shape, and the
  `Start Month:`/`Occurs at Month:`/`End Month: Forever` text swaps. Full
  suite 612 passing, lint and build clean, and the 24 moved Tailwind classes
  verified present in the built CSS (byte-identical 35.38 kB bundle).

- [x] **TODO-146 (bug, reported by the user): Emergency/Vacancy Buffer wrongly treated offset commitments as spent money**
  Reported symptom: Emergency Buffer showed 6.3 months (green), then adding a
  single $10,000 one-time Offset Contribution dropped it to 4.1 months and
  flipped it to orange. Confirmed a real bug, not just confusing framing.
  **Cause**: both buffers divided `cashRemaining`
  (`calculateCashRemaining` = `totalSavings - totalCashRequired -
  totalScheduledOffset`), so every dollar earmarked for the offset came
  straight off the numerator.
  **Why that's wrong** - the app contradicted itself in two places:
  1. `offsetSimulation.js:340-343` already drains the offset FIRST to cover a
     deficit month (`drawnFromOffset = Math.min(deficit, offsetBalance)`), so
     the engine treats offset money as exactly the emergency fund the
     indicator claimed it wasn't.
  2. `calculateTotalScheduledOffset` only sums `recurrence === 'none'`, so
     $10k once shrank the buffer while $500/month forever ($180k) left it
     untouched. No coherent risk model orders those that way.
  An offset account is fully liquid - it's arguably the best place to hold an
  emergency fund, since it's reachable AND saves interest. The tooltip
  promised "how many months you could cover if income stopped entirely", and
  in that scenario the buyer simply doesn't make the transfer, or withdraws
  it.
  **Fix**: new `calculateLiquidSavings({ totalSavings, totalCashRequired })`
  in `src/calculations/totalCashRequired.js` - everything still owned and
  reachable at settlement, bank + offset. Emergency Buffer and Vacancy Buffer
  (Day 1 and Stabilized readings alike) now divide that instead.
  **Deliberately unchanged**: `cashRemaining` itself, which is correct for the
  two other things it does - the "Cash Remaining" upfront-costs figure
  (uncommitted cash on hand, where subtracting the commitment is right, and
  which still shows the `-$10,000` line) and `initialSavingsBalance` for the
  simulation, which credits each contribution into the offset as its month
  arrives, so counting it in savings too would double it.
  Both tooltips rewrote their "Remaining Savings" wording and Emergency Buffer
  gained a paragraph explaining why its figure exceeds "Cash Remaining" above.
  New `src/App.offsetLiquidity.test.jsx` pins the behaviour; verified it
  genuinely catches the regression by temporarily restoring the old numerator
  (`expected '🟠 4.1 months' to be '🟢 6.3 months'` - the exact reported
  symptom). 5 new tests, suite 617 passing, lint and build clean.

- [x] **TODO-122: ATO-bracket suggestion for Effective Tax Rate (hybrid - the flat slider stays authoritative)**
  Shipped the hybrid the entry itself asked for, not full bracket modelling:
  the flat `effectiveTaxRate` slider remains the ONLY thing the simulation
  reads, and a suggestion computed from real ATO brackets now sits beneath it
  with a "Use this rate" button. The bracket math runs once for display, never
  inside the simulation loop - which is what let this sidestep the
  complexity-budget objection TODO-94/106 had rejected twice.
  Two new pure modules:
  - **`src/calculations/auTaxBrackets.js`** - `AU_TAX_BRACKETS` in the exact
    `{max, base, rate, over}` tier shape as `NSW_STAMP_DUTY_TIERS`, with the
    same `.find(t => v <= t.max)` + `base + (v - over) * rate` lookup, plus
    `calculateIncomeTax`, `calculateMedicareLevy` and
    `calculateEffectiveTaxRate` (the blended AVERAGE rate).
  - **`src/calculations/taxRateSuggestion.js`** - `sumGrossAnnualIncome` and
    `getSuggestedTaxRate`, kept separate so the data file above stays free of
    this app's income shape (TODO-127 can import the brackets directly).
  **Verifying the bracket figures against the published tables caught a stale
  memory and changed the data**: the rates are the **2026-27** ones, where the
  16% bracket on $18,201-$45,000 dropped to **15%**, lowering every cumulative
  base above it (4,288 -> 4,020, 31,288 -> 31,020, 51,638 -> 51,370). Two
  independent sources agree and the bases self-check
  ((45,000-18,200) x 15% = 4,020, etc.). A test asserts that self-consistency
  by walking `AU_TAX_BRACKETS` itself, so a future typo in the table fails loudly
  instead of producing a silent discontinuity at a threshold.
  Medicare levy modelled properly rather than approximated, since the real rule
  turned out to be two lines: nil below $28,011, 10c/$1 shade-in to $35,013,
  then a flat 2% - and the shade-in converges on the full 2% at the upper
  threshold by construction, which a test pins.
  **Annualisation was the one real trap.** A naive `amount * 52` would inflate a
  one-time gross bonus 52x, since it's active in exactly one month. Instead the
  annual figure sums the app's OWN monthly income across twelve months
  (`getActiveAmount` + `calculateMonthlyFromWeekly`), which is correct for every
  recurrence by construction and reuses already-tested code. Tests cover the
  one-time, quarterly, starts-later and ends-mid-year cases.
  **Decisions taken during planning** (the entry left both open): (1) an
  explicit "Use this rate" button rather than auto-seeding - auto-seeding was
  ruled out on evidence, since no income is Gross-marked by default, so a
  first-render seed would have had nothing to compute from and been inert
  exactly when it was meant to fire; the button also needs no new state and no
  `SCHEMA_VERSION` bump, because `effectiveTaxRate` is already persisted and the
  button just calls its setter. (2) brackets + Medicare levy, no LITO (which
  only reaches ~$67k and costs a two-stage taper).
  `getSuggestedTaxRate` returns `null`, not 0, when nothing is Gross-marked, so
  the UI distinguishes "nothing to suggest from" (the default scenario, which
  gets copy explaining how to enable it) from a genuine 0% suggestion for income
  under the tax-free threshold. Disclaimer matches the house voice: illustrative,
  not tax advice, an average not a marginal rate, and ignores deductions,
  offsets and negative gearing.
  `NumberSliderField` deliberately untouched: its `children` renders inside a
  single `<p>`, so the hint would have been invalid nested markup - the slider
  and hint are wrapped in a `<div>` together instead, leaving a component used
  ~40 times alone.
  **TODO-127 is now nearly free**: `AU_TAX_BRACKETS` is exported, and a matched
  tier's own `rate` field IS the marginal rate.
  33 new tests (15 brackets, 12 suggestion, 6 App-level), suite 650 passing,
  lint and build clean, and `git diff` confirms no change to
  `offsetSimulation.js`, `recurringAmount.js` or `projectedHealthCheck.js` - the
  simulation gained no new coupling.

- [x] **TODO-127: Marginal tax rate for rental/investment income, shown alongside TODO-122's average suggestion**
  Confirmed the entry's own claim: nearly free once TODO-122 existed.
  New `getMarginalRentalTaxRate(incomeSources)` in
  `src/calculations/taxRateSuggestion.js` stacks rental income
  (`RENTAL_INCOME_CATEGORIES`) on top of everything else Gross-marked, finds
  which `AU_TAX_BRACKETS` tier the combined total lands in, and adds that
  tier's own `rate` field to a new `calculateMarginalMedicareLevyRate`
  (`auTaxBrackets.js`) - the levy's own marginal contribution, which is 10%
  inside the $28,011-$35,013 shade-in band, not the flat 2% the existing
  `calculateMedicareLevy` blends in above it. Needed for the marginal figure to
  stay internally consistent with the average, which already includes blended
  Medicare.
  Renders as a second, separate hint under the Effective Tax Rate slider
  (`App.jsx`), only when at least one rental income source is Gross-marked -
  same `null`-when-nothing-to-show pattern as TODO-122's own suggestion.
  **Two decisions taken with the user, both changing what the entry's own
  "which number to surface" open question meant**: (1) **no "apply" button** -
  the app has a single global `effectiveTaxRate`, so there is no control this
  figure could ever be applied to without overstating tax on the rest of the
  user's income; the block is purely informational, styled amber (fact
  readout) rather than the average suggestion's purple (fact + action) to make
  that distinction visible. (2) shown only when rental is itself Gross-marked,
  not as an always-visible "doesn't apply" block.
  Reworded the existing average-suggestion disclaimer, which used to say "not
  the marginal rate on your top dollar" as a blanket, unaddressed caveat - it
  now points at the new rental block specifically while staying honest that
  freelance/dividends/other non-rental extra income still only gets the
  average.
  `sumGrossAnnualIncome`/`getSuggestedTaxRate` unchanged (verified via
  `git diff` - only the import line moved); the new function is additive.
  16 new tests (3 Medicare-marginal, 5 rental-marginal, 3 App-level: no rental,
  rental-but-not-Gross, and the rendered hint has no apply button while the
  page's other "Use this rate" button still does). Suite 661 passing, lint and
  build clean.

---

## 🟡 MEDIUM PRIORITY (Important, but not blocking)

- [ ] **TODO-124 (Superseded by TODO-136/137/138 — do not implement independently): Should "Invest in ETFs" divert from Savings instead of from the Offset's own share?**
  User's proposal: instead of `etfAllocationPct` diverting a % of the
  OFFSET's own share (current design, `offsetSimulation.js` - `etfShare =
  offsetShare * (etfAllocationPct/100)`), it should divert a % of the
  SAVINGS/non-offset share instead (`etfShare = nonOffsetShare *
  (etfAllocationPct/100)`) - meaning at `offsetAllocationPct: 100%` (the
  app's own default), ETF investing would be impossible (nothing in the
  savings pool to draw from), which the user considers correct/expected
  behavior, not a bug.
  **Technical complexity: low, not high.** The formula is the same shape,
  just sourcing `etfShare` from `nonOffsetShare` instead of `offsetShare` -
  a small, contained change to the core loop, no new state, no new
  simulation concept. No "simplified version" is needed - the full version
  is already simple.
  **The real issue is conceptual, not computational - flagging clearly
  before this goes any further**: this is the EXACT formula that was
  implemented FIRST during TODO-96 this same session, then caught and
  fixed as a bug specifically because at the app's default
  `offsetAllocationPct: 100%`, it made "Invest in ETFs" silently do nothing
  (see TODO-96's write-up above: "Important correction made mid-
  implementation"). More importantly, it changes WHAT QUESTION the whole
  feature answers: TODO-52's original analysis (which TODO-96/97/98 were
  built to answer) was specifically about the offset-vs-ETF trade-off -
  "should money that would otherwise reduce guaranteed, tax-free loan
  interest instead chase a risky-but-higher ETF return." If ETF money comes
  from savings instead, the feature stops being about that trade-off
  entirely and becomes a much narrower "should my already-set-aside cash
  sit idle or in an ETF" question - unrelated to the mortgage. Not
  necessarily wrong to want that instead, but it's a different feature with
  a different premise, not a tweak to the existing one - needs an explicit
  decision on which question the feature should actually answer before any
  implementation, not just a formula swap.
  **User's follow-up**: downgraded to nice-to-have - they haven't actually
  tested the app's current ETF behavior yet, so aren't sure this analysis
  matches what they'll actually want once they see it in action; asked
  directly whether a better way to model "Offset vs. Savings+ETF" already
  exists. **Answer: yes** - the CURRENT implementation (ETF diverts from
  the offset's own share) already is that better way; it's specifically
  what makes the Strategy Comparison/Pareto-front analysis (TODO-98)
  meaningful at all.  Recommend leaving this as-is unless/until testing the
  current behavior surfaces a concrete problem with it - don't implement the
  savings-sourced variant preemptively.
  **Status:** superseded by TODO-136/137/138 below. The savings-sourced
  formula should not be implemented independently; the next ETF change
  should use the direct Offset-vs-ETF model and risk-aware comparison
  defined there.
  Separately, the user raised a bigger, distinct point worth its own item:

  see new TODO-126 (a master way to fully hide ETF investing from the UI,
  for users who only care about the property/offset side).

- [x] **TODO-126: A master toggle to fully hide ETF investing from the UI**
  Added a persistent "Show ETF investing options" master toggle in Financial
  Position. It defaults off for new sessions and gates every ETF-specific
  control, tooltip, comparison table, timeline output, and simulation effect.
  Turning it off preserves the individual ETF settings but pauses their effect;
  turning it back on restores them. Older saved scenarios that already had
  `useEtfInvesting` or `showOpportunityCost` enabled automatically reveal the
  master for backward compatibility, while an explicit saved master-off value
  still wins. Added App and persistence coverage for all of these cases.

- [x] **TODO-128: Two-color slider track for "ETF Allocation"**
  Implemented as an opt-in `splitColor="etf"` mode on `NumberSliderField`.
  The track now uses a value-positioned inline `linear-gradient`: the left
  side represents the offset-bound share and the right side represents the
  amount diverted to ETFs. CSS custom properties provide light/dark theme
  colors, and a text legend keeps the meaning accessible without relying on
  color alone. Existing sliders retain their original flat track styling.

- [ ] **TODO-130 (Superseded by TODO-136/137/138 — do not implement independently): Remove the ongoing "Savings" allocation concept - repurpose Offset Allocation as a direct Offset-vs-ETF split**
  Evolves/supersedes TODO-124's narrower framing. User's reasoning: taking
  ETF money FROM a separate non-offset "Savings" pool doesn't make sense as
  a permanent feature, because the offset account already gives you
  everything a generic savings account gives you (fully liquid, withdraw
  any time) PLUS it reduces guaranteed loan interest - a plain savings
  balance sitting outside the offset is strictly dominated in the common
  case. ETF, by contrast, is a genuinely different kind of commitment
  (illiquid, hard to reverse, real market risk) - so the meaningful
  decision isn't "offset vs. savings vs. ETF," it's just "offset vs. ETF."
  Proposal: delete the ongoing monthly diversion role of `offsetAllocationPct`
  entirely, and let that same slider directly control what fraction of
  surplus goes to ETF instead (the complement goes to offset) - collapsing
  today's two-slider, two-step split (Offset Allocation → then ETF
  Allocation carves a slice out of the offset's own share) into one slider,
  one step.
  **Decided: agree with the core reasoning - the original caveat turned out
  to be even weaker than stated.** Initial concern was that a savings/term-
  deposit rate could occasionally exceed the mortgage rate. User quantified
  it with real AU rates: comparing after-tax, a savings account needs
  roughly `mortgageRate / (1 - marginalRate)` pre-tax to match a 100%
  offset (e.g. at a 6.14% mortgage and 39% marginal rate, that's
  6.14/0.61 ≈ 10.07% pre-tax) - because offset "interest saved" is
  effectively tax-free (it's a reduction in an already-taxed obligation,
  not taxable income) while savings-account interest is fully taxable. Even
  today's more attractive advertised AU savings rates (~5.5%, conditional)
  sit well under that bar for anyone with a normal owner-occupier mortgage
  and meaningful marginal tax rate. So this isn't just "uncommon," it's
  "essentially never worth it for the mainstream case this app targets" -
  removing the ongoing Savings diversion is the right simplification.
  Recommend keeping `initialSavingsBalance` (seeded from "Remaining
  Savings," i.e. real pre-existing cash at settlement) and its own
  `savingsInterestRate` compounding exactly as-is - that's a one-time
  starting position, not an ongoing allocation choice, and is unaffected by
  this change either way (confirmed in `offsetSimulation.js`: its interest
  accrual, lines 288-290, already runs independently of any ongoing
  `offsetShare`/`savingsBalance` contribution logic). What goes away is
  only the ONGOING monthly diversion path (line 297-298: `offsetShare`/
  `savingsBalance += netMonthlyDeposit - offsetShare`).
  **Does the app currently propose WHEN/HOW MUCH to invest in ETF, or is it
  purely user-set?** Purely user-set, with one assist: Strategy Comparison
  (TODO-98) runs a 21x21 grid search over `(switchThresholdPct,
  etfAllocationPct)` and surfaces up to 5 Pareto-optimal combinations with
  an "Apply" button - so the app DOES propose good candidate combinations
  to pick from. But it's a single FIXED pair applied as a step function
  (once `switchThresholdPct` is crossed, `etfAllocationPct` applies at its
  full set value for the rest of the simulation) - not a gradually
  increasing/ramping schedule like the "start at 20%, increase over time"
  example. A ramping schedule is a materially bigger feature (needs a rate-
  of-increase parameter, not just two numbers) and isn't proposed here -
  flagging as a possible future idea only if there's real interest, not
  recommending it now.
  **Concrete changes this would need, if pursued:**
  - `offsetSimulation.js`: remove the `offsetAllocationPct`/ongoing-savings-
    diversion lines (296-298) entirely; `etfShare` computes directly off
    `netMonthlyDeposit` instead of off `offsetShare`; `initialSavingsBalance`/
    `savingsInterestRate` and their own compounding (lines 284-290) stay
    untouched.
  - `strategyComparison.js`: no change needed - confirmed `offsetAllocationPct`
    was never a grid axis (only `switchThresholdPct`/`etfAllocationPct` are),
    it was just passed through fixed in `baseParams`.
  - `App.jsx`: remove the "Offset Allocation" slider/state/tooltip from
    Financial Position; "ETF Allocation"'s existing tooltip copy needs
    rewording (currently describes diverting "the offset's own share" -
    would become "your monthly surplus" directly); `handleSaveScenario`
    drops `offsetAllocationPct` from saved config (keeps
    `initialSavingsBalance`/`savingsInterestRate`).
  - Timeline Explorer: the `savings` column stops growing from ongoing
    contributions - only the initial seed's own interest, a smaller/flatter
    line than before.
  - Test suite: this touches the TODO-49/50/96/98 test blocks across
    `offsetSimulation.test.js`/`strategyComparison.test.js`/
    `timelineSnapshot.test.js` most directly - a real but bounded rewrite,
    not a full-suite risk.
  Meaningful enough surface area (deletes a shipped feature, not just UI
  cleanup) to warrant its own Plan Mode session if/when the user decides to
  proceed -  not implemented here.
  **Status:** superseded by TODO-136/137/138 below. TODO-130's direct
  Offset-vs-ETF direction remains the right foundation (now TODO-136's Phase
  1), but the timeline/scenario comparison (TODO-137) and risk-analysis scope
  (TODO-138) were split into their own entries rather than bundled as one
  isolated slider refactor.

- [x] **TODO-140: Purchase Health Check should default to collapsed**
  Changed the fallback to `config.showHealthCheck ?? false`, so the panel
  starts collapsed while an explicit config/saved-scenario value of `true`
  still opens it for power users. Added App-level coverage for the default
  collapsed state and expand/collapse interaction.

- [ ] **TODO-148 (small, contained): Stress Test claims "Fails at +1%" when the scenario is ALREADY in deficit at today's rate**
  Found in the same audit. `calculateStressTestSurvivedDelta`
  (`src/calculations/purchaseHealthCheck.js:67-79`) only probes +3/+2/+1 and
  returns 0 when none survive. It never checks +0, so "already underwater"
  and "underwater as soon as rates move a point" collapse into the same
  answer. The UI then reports `'Fails at +1%'` (`App.jsx`'s Stress Test
  `valueDisplay`) with the band action "Even a 1-point rate rise would put you
  in deficit" (`STRESS_TEST_BANDS`' last entry) - both of which state a
  hypothetical that has already happened.
  Reproduce: set the single salary income source to $800/week. Monthly net
  balance is -$1,057 at the current 6.13%, yet the indicator says the problem
  begins at +1%.
  **Fix**: distinguish the two. Cheapest shape that doesn't disturb the
  existing exact-value tests is a separate boolean rather than a new sentinel
  return value (a -1 would silently reorder `classifyByBands`) - e.g. compute
  `monthlyNetBalance >= 0` at the current rate in `App.jsx` (the value is
  already sitting there as `monthlyNetBalance`) and use it to pick the
  `valueDisplay` string and a distinct band action. `calculateStressTestSurvivedDelta`'s
  own signature and return values should not change.
  Copy suggestion: `'Already in deficit'` rather than `'Fails at +1%'`, and an
  action saying the shortfall exists at today's rate, not after a rise.
  **Tests**: extend TODO-147's matrix with the salary-800 and salary-500 rows
  asserting the new display/action, plus a `purchaseHealthCheck.test.js` case
  pinning that the delta itself is still 0 in that state (i.e. the fix lives in
  presentation, not in the calculation).

- [ ] **TODO-149 (small, contained): Emergency Buffer renders a negative month count when settlement itself is unaffordable**
  Found in the same audit. `calculateEmergencyBufferMonths`
  (`purchaseHealthCheck.js:24-27`) divides `liquidSavings` by monthly
  outgoings with no floor, so once the deposit plus upfront costs exceed
  savings the indicator shows e.g. **"-1.5 months"**. The 🔴 High risk band is
  right, but negative months are not a meaningful quantity - the real
  statement is "you cannot fund the purchase at all", which is a different
  (and more serious) message than a thin buffer.
  Reproduce: Property Price 1,200,000 with the default $307,000 deposit and
  $350,000 savings - liquid savings land at -$9,937 and the buffer reads
  -1.5 months.
  **Fix**: keep the calculation honest (do not clamp the returned number to 0
  and hide the problem) but change the *display* when `liquidSavings < 0` to
  something like "Can't cover settlement", with an action pointing at the
  shortfall amount. Note the page already shows a red "You've committed $X
  more than your savings" warning for `cashRemaining < 0` - the copy here
  should agree with it rather than invent a second framing. Vacancy Buffer
  shares the numerator and needs the same treatment.
  **Tests**: TODO-147's `propertyPrice: 1200000` row asserts the new display;
  add a boundary case at exactly `liquidSavings === 0` (should read 0.0 months,
  not the negative branch).

- [ ] **TODO-150: Day-1 rental income skips the vacancy factor but the Stabilized reading applies it**
  Found in the same audit. `App.jsx:550-552` builds the Day-1
  `monthlyRentalIncome` straight from `getActiveAmount(...)` with no vacancy
  adjustment, while `resolveProjectedFinancials`
  (`src/calculations/projectedHealthCheck.js`) multiplies rental income by
  `1 - vacancyWeeksPerYear/52`. So for an investment property, part of every
  Day1 -> Stabilized movement in Housing Cost Ratio, Gearing and Rental Yield
  is a change in *definition*, not a projection - the two readings are not
  apples to apples.
  **The tie-breaker is already settled by the engine**: verified
  `offsetSimulation.js:246` applies `vacancyFactor` inside the monthly loop
  unconditionally, and that loop's `months` counter is 1 on its first
  iteration - so the simulation vacancy-adjusts from month 1. It is the Day-1
  Health Check figure that is the outlier, disagreeing with the simulation that
  drives every other panel on the page.
  **Fix**: apply the vacancy factor to the Day-1 `monthlyRentalIncome` too, so
  all three consumers agree. Note this is not a purely cosmetic change - Day-1
  `monthlyRentalIncome` also feeds `monthlyNetBalance`, `monthlyToOffset` and
  the weekly/fortnightly cash-flow cards, so the blast radius is wider than the
  Health Check and every affected figure should be re-checked. Consider whether
  the "TO OFFSET (automatic)" figure should be vacancy-adjusted as well or
  deliberately kept optimistic; if they must differ, say why in a comment.
  **Tests**: an investment-property scenario in TODO-147's matrix with
  `vacancyWeeksPerYear` at 0 vs 4, asserting Day-1 and Stabilized move
  together; plus a check that the Day-1 rental figure matches what
  `offsetSimulation.js` computes for month 1.

- [ ] **TODO-151 (needs a product call before coding - biggest blast radius): Housing Cost Ratio applies gross-income bands to a net-income figure**
  Found in the same audit, and it is the reason the indicator feels stuck on
  red. `HOUSING_COST_RATIO_BANDS` uses the standard 30/40/50% thresholds, and
  that rule of thumb (the "30% rule", and the housing-stress "30/40 rule") is
  defined on **gross** household income - as is any lender's serviceability
  assessment. But the app's income sources default to net/take-home (the
  "This is a gross (pre-tax) amount" checkbox is off by default), so the
  denominator is net while the thresholds assume gross. At a 20% effective
  rate, 30% of gross is about 37.5% of net, making the bands roughly a quarter
  stricter than the benchmark they cite.
  Concrete evidence of the distortion: the **shipped default scenario** reads
  55% -> "High risk" 🔴 while simultaneously running a **+$2,470/month
  surplus**. It takes a $3,000/week salary to reach "Excellent". An indicator
  whose out-of-the-box state is a false alarm trains users to ignore it.
  Three ways out, to choose between explicitly:
  1. **Gross up the denominator for this indicator only** (recommended). The
     inputs already exist - each income item carries `isGross`, and
     `effectiveTaxRate` is a user-set flat rate, so `gross = net / (1 - rate)`
     is recoverable rather than circular (unlike the case TODO-122 rejected,
     which had no rate to work from). Bands keep their standard meaning and
     the tooltip's "30% rule" reference stays true. Caveat to state in the
     tooltip: the grossed-up figure is only as good as the flat rate.
     Note this makes the indicator move with Effective Tax Rate for the first
     time, which is a visible behaviour change in its own right.
  2. **Recalibrate the bands for net income.** Avoids synthesising a gross
     figure, but the thresholds stop matching any published benchmark and
     would arguably have to shift with the tax rate, which is worse.
  3. **Leave the maths, fix the copy** - relabel it as a net-income ratio and
     drop the "30% rule" framing. Cheapest, but keeps shipping a default
     scenario that reads High risk at a healthy surplus.
  Whichever wins, the Stabilized reading (TODO-134) must use the same
  convention as Day 1.
  **Tests**: every HCR expectation in TODO-147's matrix changes, so update
  them deliberately as part of this item rather than in bulk; add cases at
  `effectiveTaxRate` 0 (gross == net, so option 1 must be a no-op) and at a
  high rate; and add a case asserting the shipped default scenario no longer
  classifies as High risk while in surplus - the symptom that opened this.

- [x] **TODO-139: Meaningful slider colors based on financial impact**
  Added a new `impact` prop to `NumberSliderField` (`'negative'|'positive'|
  'neutral'`), additive to the existing decorative `color` - `color` still
  governs the ~5 fields this scheme deliberately excludes (see below).
  `impact` recolors the track (orange/green/violet, matching the app-wide
  green=good/orange=caution convention already in `ui.js`/
  `purchaseHealthCheck.js`), adds an `aria-hidden` ⬇/⬆/↔ icon next to the
  label for colorblind sighted users, and extends the slider's own
  `aria-label` with a text hint ("... slider (higher increases cost)") for
  screen-reader users - the TODO's own accessibility paragraph only asked for
  icon-pairing, which does nothing for blind users; the aria-label suffix
  covers the half it didn't spell out.
  **Classification rule, applied to all ~46 call sites, not just the "obvious"
  ones**: does increasing this field's value move the model's own real
  outcomes (verified against `offsetSimulation.js`, not assumed from the
  field's name), specifically the three the TODO itself names - total
  interest, payoff time, cash remaining? This caught two real pre-existing
  bugs: **Vacancy** was colored green despite reducing rental income when
  raised, and **Effective Tax Rate** was purple despite unambiguously
  reducing net cash flow when raised - both now correctly negative.
  **Two fields confirmed genuinely mixed, not merely unclear, and colored
  neutral**: Loan Term (verified numerically against the actual offset loop,
  not the textbook formula, that a longer term doesn't monotonically raise
  total interest once there's monthly surplus - freeing cash by extending the
  term just routes more into the offset) and, per the TODO's own listed
  examples, ETF Allocation/Switch Trigger (real trade-offs between total
  interest and ETF balance/compounding time).
  **Five fields excluded from the scheme entirely** (kept on their existing
  decorative `color`, not forced into a synthetic label) because they never
  reach any of the three named outcomes, confirmed line-by-line: Property
  Growth Rate and Savings Interest Rate only feed a parallel Net Worth/equity
  display; Inflation Rate is display-only by its own tooltip's admission;
  Your Current Age isn't a financial input at all, just relabels an existing
  output; and Expected ETF Return only compounds `etfBalance`, never fed back
  into interest/payoff/cash remaining - excluding it also sidesteps painting
  a risky market assumption green, but that wasn't a special case, it fell
  out of the same rule as the other four.
  New `src/components/ImpactColorLegend.jsx` (modeled on
  `RiskToleranceProfiles.jsx`'s static-reference-panel convention) explains
  the scheme once near the top of the page, including a line noting that some
  sliders are intentionally left uncolored.
  Pure presentation change - no `calculations/` module touched.
  19 new tests (7 component-level covering track/icon/aria-label per impact
  value and precedence over `color`; 3 for the legend; 6 App-level pinning
  the two bug fixes, the Property Growth Rate exclusion, and the legend's
  presence); verified the App-level regression tests actually catch the bugs
  by temporarily reverting Vacancy's classification and confirming the test
  fails, then restoring it. Suite 676 passing, lint and build clean.

- [x] **TODO-135: Simple vs Advanced UI mode - first functional slice**
  Shipped as a working mode toggle, not analysis. The entry was tagged
  "(Analysis only)... does not authorize code changes", but its own scope
  clause was the real gate - "implement the actual shell after TODO-136/137/138
  and TODO-133/134... TODO-141 must be resolved first" - and all five are now
  complete, so the tag was a leftover. Deliberately a first slice, since the
  entry equally warns this must not become "an unplanned final rewrite".
  **Advanced is the default**, so today's whole interface is what an existing
  user and every saved scenario still get; Simple is one click away.
  - **`src/hooks/useUiMode.js`** - own localStorage key
    (`propertyCalculator.uiMode`), modelled on `useDarkMode`. Deliberately NOT
    in the scenario payload (entry item 4: loading a scenario must never change
    interface complexity), which means **no `SCHEMA_VERSION` bump** - confirmed
    still 10. Worth recording that this diverges from the *larger* half of an
    inconsistent precedent on purpose: 15 `show*` collapse flags ARE saved into
    the payload, contradicting that payload's own comment claiming collapsed
    sections aren't. This follows the dark-mode / `comparisonMetric` side
    instead, and says so in a comment so nobody "fixes" it into the payload.
    An unrecognised stored value falls back to advanced rather than rendering
    neither view.
  - **`src/calculations/affordabilitySummary.js`** - the "where do I stand"
    roll-up. The entry asked for "a contextual affordability answer" while
    warning against "a falsely precise yes/no verdict", and the app's house
    rule is no optimizer/no personalized advice. Resolved by inventing **no new
    threshold**: it picks whichever signal is already binding, hardest-first
    (settlement unaffordable -> monthly shortfall -> the worse of the two
    Health Check classifications Simple already displays underneath it), and
    borrows that indicator's own symbol/textClass rather than minting a colour.
  - **`src/components/SimpleModeView.jsx`** - the guided view: the purchase,
    cash to settle, the monthly chain, a three-indicator Health Check subset
    (through the existing `HealthCheckIndicator`, TODO-134 annotations intact),
    and a disclosure block listing what's still counted but not editable there.
  - **`src/components/coreFieldConfigs.js`** - the static props of the six core
    fields Simple re-renders, extracted so Advanced and Simple can't drift.
    Advanced's six call sites were refactored onto the same constants in the
    same change; leaving them copied would have re-created exactly the
    duplication TODO-116 had just removed. Deposit/Loan Amount are functions of
    `propertyPrice` since their ranges depend on it at runtime.
  - **Active-advanced notice**: the entry required a clear notice when an
    Advanced strategy materially affects the result. Lists only features that
    genuinely move a figure Simple *shows* (ETF investing, scheduled offset
    contributions, scheduled rate/expense changes, credit-card modelling)
    rather than a vague catch-all.
  **Presentation-only, verified three ways**: no `src/calculations/` module
  modified; `uiMode` absent from the scenario payload with `SCHEMA_VERSION`
  unchanged; and **all 105 pre-existing App-level tests pass with zero edits** -
  the criterion that proves the gate never leaked into the default path.
  Also fixed a small formatting defect found while writing the view rather than
  enshrining it in a test: a negative figure now renders `-$9,937`, not
  `$-9,937`.
  34 new tests (6 hook, 10 affordability, 10 component, 8 App-level). The
  load-bearing App-level test asserts the same scenario reads identically in
  both modes; verified it actually catches a leak by temporarily feeding Simple
  a scaled `monthlyPayment` and confirming it failed, then restoring.
  Suite 710 passing, lint and build clean.
  **Answers four of the entry's six open questions**: (1) persistent header
  toggle, Advanced default; (3) binary modes with a purpose-built guided Simple
  view, not per-section expanders - its own item 6 already decided against "a
  pile of permanently hidden existing cards"; (4) mode is a device preference,
  not scenario data; (6) guided summary with an explicit "View details in
  Advanced" transition. **Still open for later work**: (2) how much of the
  projection-assumption disclosure Simple should show beyond the current
  one-liner, and (5) reorganizing Advanced itself into focused components -
  the entry explicitly leaves that as "not the final Advanced architecture".

- [x] **TODO-144: "When to start" ETF contributions - delayed start and reserve-gated start**
  Both parts shipped, plus a UX decision that collapsed what would have been
  three overlapping knobs into one.
  **Engine** (`offsetSimulation.js`): two new params, each a no-op at its
  default so every existing caller/test is byte-for-byte unaffected -
  `etfStartMonth = 1` (a) and `etfReserveMonths = 0` (b). The gate is now
  `etfRatioReached && etfStartMonthReached && etfReserveReached`, which keeps
  the engine dumb about which criterion the user picked.
  **UI decision taken with the user**: rather than a third independent gate
  AND-ed with the existing `switchThresholdPct`, a single "Start ETF investing
  when" selector - right away / after month N / offset reaches X% of the loan /
  offset covers N months of expenses. Three overlapping "when to start" knobs
  would have meant the user reasoning about the intersection of three
  conditions, and it's easy to leave one at a value that silently blocks
  everything. Only the selected criterion is passed a non-default value
  (`effectiveEtfStartMonth`/`effectiveEtfReserveMonths`/
  `effectiveSwitchThresholdPct`), so switching criteria can never leave a stale
  gate applied.
  **The open product decision the entry flagged, resolved**: one "month of
  expenses" is defined exactly as the Emergency Buffer indicator defines it -
  loan installment + property expenses + personal expenses. The app already had
  an answer to "how many months of expenses is that", so inventing a second
  definition would have made the slider and that indicator disagree. The
  entry's double-counting hazard is avoided by building the figure from the
  loop's own per-month values (`currentMonthlyPayment + monthlyExpensesForMonth
  + monthlyPersonalExpensesCost`) rather than from `monthlyToOffset`, which
  already has the month-1 installment baked in.
  **Fixed the stale comment TODO-145's entry flagged**, in both places it
  appeared (the `switchThresholdPct` param doc and the gate itself): the claim
  that "the ratio only ever grows, so this can't un-trigger" stopped being true
  at TODO-136, when a deficit month began drawing the offset down. Behaviour is
  unchanged - only the reasoning was wrong - and the stateless re-evaluation is
  now documented as deliberate rather than merely tolerated: if the offset falls
  back below the reserve you wanted banked, pausing new contributions until it
  recovers is what a reserve is for.
  **Caught a real regression the single-selector design introduced**: the
  Strategy Comparison grid varies the loan-ratio threshold, so its "Apply"
  button had to also select that criterion - otherwise the applied value never
  reached the engine and Apply silently did nothing. Fixed, and pinned by a test
  verified to fail when the fix is reverted.
  Purely additive persistence, so **no `SCHEMA_VERSION` bump** (still 10):
  `etfStartTrigger` is re-derived from the saved params on load, the same way
  `legacyFlatBaseline` reads intent out of existing fields, so a scenario saved
  before this feature lands on the right radio automatically.
  13 new tests (4 delayed-start, 5 reserve-gated, 4 App-level). Three of my own
  reserve-gate tests failed first with wrong arithmetic, which surfaced a
  property worth documenting: the gate reads the offset BEFORE the month's
  surplus lands, so month 1 always sees an empty offset and a non-zero reserve
  always delays by at least one month. Suite 723 passing, lint and build clean.
  **Deliberately deferred**: a start-timing scenario COMPARISON table. The entry
  mentions comparing "immediately vs after 12/24/60 months", and
  `runReturnScenarios` proves the `strategyScenarios.js` helpers are generic
  enough to make `runStartMonthScenarios` cheap - but TODO-142 already drew the
  line at three ETF comparison panels, and the user chose a selector rather than
  a comparison. Worth its own item if wanted.

  **CORRECTION (2026-08-18) - two real bugs this shipped with, found when the
  user asked for it to be re-checked.** `App.jsx` builds SIX parameter bundles
  for `calculateLoanWithOffset`; this change only wired three of them.
  1. **Stale-gate leak.** `scenarioBaseParams` and `sensitivityBaseParams` passed
     the RAW `switchThresholdPct`, so selecting "after month N" while a non-zero
     Switch Trigger was still stored left those panels applying a threshold the
     user had switched away from. The comment written at the `effective*`
     derivation - "switching criteria can never leave a stale gate applied" -
     was false for exactly those panels, which was the whole point of the
     single-selector design.
  2. **Gates never reached three panels.** Strategy Comparison, Return
     Sensitivity and the Pareto grid simulated ETF investing from month 1
     regardless of the delay or reserve the user chose, so they quietly
     contradicted the headline projection. `findBreakEvenEtfReturn` was affected
     too, since it consumes `sensitivityBaseParams`.
  **Why the original tests missed it**: every one of them either exercised the
  engine directly (where the params were correct) or checked the selector's DOM
  behaviour. None asserted that the PANELS agree with the PROJECTION. The fix
  therefore closes the class rather than the instance - new App-level tests
  assert panel/projection agreement, plus a unit guard that each scenario factory
  passes the gates through to every run. Both were verified to fail against the
  broken code first (the panels reported byte-identical figures across different
  start criteria).
  The Pareto grid keeps varying `switchThresholdPct` as its search axis - that is
  its purpose - and now passes `etfStartMonth: 1, etfReserveMonths: 0` explicitly
  plus an on-screen line saying it explores the "% of the loan" criterion, and
  that applying a row will switch the user to it. Layering the user's own
  month/reserve gate on top would have made every row a combination the selector
  declares impossible.
  No engine change: `offsetSimulation.js` was correct throughout. Suite 756
  passing.

- [x] **TODO-145: ETF market-drop stress test**
  Unblocked by re-diagnosing the blocker, then shipped narrowly.
  **The stated blocker was a misdiagnosis.** The entry said modelling ETF
  liquidation would bring "its own CGT consequences". It wouldn't:
  `etfMonthlyRate` already applies the CGT-discounted tax as a continuous drag
  on the return (`offsetSimulation.js`), so `etfBalance` is already an
  after-tax balance and taxing a sale again would double-count. **The real
  objection is different**: letting a deficit sell ETF units makes the model
  MORE optimistic than today (it currently reports a shortfall even when ETF
  assets exist), silently changing every existing scenario. So liquidation was
  declined - see Out of scope below.
  **Shipped**: `etfCrashMonth`/`etfCrashPct` engine params (both no-ops at their
  defaults, so every existing caller/test is byte-for-byte unaffected), a
  `runCrashScenarios` sibling factory alongside `runReturnScenarios`, and an
  `EtfCrashStressTest` panel modelled on `EtfReturnSensitivity` - one crash-month
  slider, fixed -20/-30/-40% columns, and a "vs no crash" row measured against
  the user's own current projection.
  The crash lands after that month's growth but BEFORE its contribution,
  matching the existing "growth accrues before the deposit" convention, so it
  hits standing holdings and leaves the crash month's own contribution intact.
  Documented at the code, since the other ordering models something different.
  **The panel's honest headline is the finding, not a caveat**: payoff time and
  total interest are identical in every column, because this model never sells
  ETF units to service the mortgage. That tells the reader the ETF balance is
  not their emergency buffer - which is the offset-vs-ETF trade-off this whole
  family of panels exists to surface. Pinned by a test asserting `months`,
  `totalInterest`, `totalCashShortfall` and `monthsWithShortfall` are unchanged
  with and without a crash; verified that test actually catches a violation by
  temporarily adding ETF liquidation to the deficit branch and confirming it
  failed.
  **Corrected a factual error in my own first draft of the user-facing copy.**
  I wrote that an earlier crash costs more (the removed capital compounds for
  longer). Measuring the engine showed the opposite: the loss rises
  monotonically with crash month ($3.6k at month 6 -> $63k at month 120 for the
  test scenario), because ongoing contributions grow the balance faster than the
  lost compounding time costs. Worse, my unit test asserting the wrong direction
  PASSED for a spurious reason - it compared against month 240, past that
  scenario's month-158 payoff, so that run had no crash at all. Both the copy
  and the test are fixed, and the past-payoff case is now pinned as its own test.
  **`ETF_CRASH_BANDS` deliberately NOT reused**, contrary to the entry's claim
  that the banding layer "is genuinely reusable". It's already in live use in the
  Pareto table's "Crash Test" column answering a different question (did the
  final ETF balance still beat the offset-only baseline), and its 50/30/10
  thresholds are calibrated to that search. Reusing them would give one label two
  meanings in the same app; this panel reports dollars and needs no band.
  `strategyComparison.js` is untouched.
  The entry's "unrelated stale comment" sub-item was already done in TODO-144.
  Purely additive persistence, so **no `SCHEMA_VERSION` bump** (still 10).
  25 new tests (6 engine, 6 scenario-factory, 7 component, 5 App-level, plus the
  past-payoff case). `EtfReturnSensitivity` has no test file; this panel got one
  rather than copying that gap. Suite 748 passing, lint and build clean.

- [x] **TODO-147: Scenario-matrix regression test for the four Tier-1 Health Check indicators**
  New `src/calculations/purchaseHealthCheck.scenarios.test.js`. Replicates
  `App.jsx`'s own Day-1 wiring in a `runScenario()` helper that calls the real
  modules (`loan.js`, `recurringAmount.js`, `lmi.js`, `closingCosts.js`,
  `states/`, `totalCashRequired.js`, `purchaseHealthCheck.js`) directly - no
  `<App/>` render, no re-derived formula, per the entry's own instruction.
  **Re-verified the entry's pinned matrix against current code before trusting
  it**, since it was audited on 2026-08-17 and TODO-146 (offset-liquidity fix)
  landed since - all 12 rows still match exactly. They do because every row's
  scenario has zero scheduled offset contributions, so `liquidSavings` and the
  pre-TODO-146 `cashRemaining` coincide; a row that added a contribution would
  have needed a new expected value.
  Verified the test actually closes the gap the audit script left: temporarily
  broke `calculateEmergencyBufferMonths` (`+1` to the return value) and
  confirmed 13 of 14 cases failed, then restored it.
  14 tests (12 matrix rows via `it.each`, plus the two "surprising but
  correct" properties the entry calls out by name: Emergency Buffer is
  completely income-independent, and `effectiveTaxRate` is inert with no
  income item Gross-marked). Suite 770 passing, lint and build clean, and this
  is a pure test addition - no production file touched.

---

## ⚪ LOW PRIORITY (Deprioritized - excluded from default TODO listings)

