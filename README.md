# 🏠 Property Investment Cash Flow Calculator

<div align="center">

![Property Calculator Banner](https://img.shields.io/badge/Property-Investment_Calculator-blue?style=for-the-badge&logo=react)

[![Live Demo](https://img.shields.io/badge/Live-Demo-success?style=for-the-badge&logo=github)](https://cmodernel.github.io/property-calculator/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

**An interactive calculator to analyze property investments with offset accounts in Australia**

[✨ Features](#-features) • [🚀 Demo](#-live-demo) • [💻 Installation](#-installation) • [📖 Usage](#-how-to-use) • [🤝 Contributing](#-contributing)

</div>

---

## 📊 Overview

This calculator helps you make **informed decisions** about property investments by simulating real cash flow scenarios with offset accounts. Perfect for first-time buyers or investors looking to optimize their mortgage strategy in Australia.

### Why This Calculator?

- 💰 **Real Cash Flow Analysis**: See exactly how much you need from your pocket after rent and expenses
- 🏦 **Offset Account Simulation**: Calculate how quickly you'll pay off your loan with offset deposits
- 📈 **Interest Savings**: Compare total interest paid vs traditional mortgage
- ⚡ **Interactive**: Type an exact figure or drag a slider, and see results instantly
- 🎯 **Comprehensive**: Includes property expenses, personal expenses, and rental income

---

## ✨ Features

### 🏡 Property & Loan Configuration
- **Property price**: type any exact figure (the slider covers 200k - 3M AUD)
- **Down payment**: anything from 0 up to the full purchase price
- **Interest rate**: 2 decimal places, e.g. 5.85%
- **Loan term**: configurable, 1-30 years (default 30)

Every money field is a number box paired with a slider: drag to explore a typical
range, or type an exact value such as `742,500` when the slider is too coarse.

### 🏛️ Upfront Costs (NSW)
- **Stamp Duty**: NSW 2026-27 progressive tiers, with a First Home Buyer
  concession (full exemption up to $800k, tapering off by $1M)
- **LMI (Lenders Mortgage Insurance)**: estimated automatically once the LVR
  exceeds 80%, with an option to pay it upfront in cash instead of financing
  it into the loan
- **Closing costs**: conveyancing, building/pest inspections, registration,
  searches, loan fees, valuation, insurance and rate adjustments — each
  editable, with sensible NSW-average defaults (~$4,750 combined)
- **Total Cash Required** and **Cash Remaining**: see at a glance whether your
  savings cover the deposit *and* every cost of settling, not just the deposit

### 💵 Property Expenses
- **Strata fees** (quarterly)
- **Council rates** (quarterly)
- **Utilities** (electricity, water, internet)
- **Insurance** (monthly)

### 🏠 Rental Income Options
- **No rental**: Live in the property yourself
- **1 Room**: Rent out a single room
- **2 Rooms**: Rent out two rooms (shared accommodation)
- Adjustable weekly rent rates

### 👤 Personal Finances
- **Income sources**: salary, other income, or one-off payments - each optionally recurring, date-ranged, or a single one-time amount, entered as a weekly figure
- **Food expenses** (weekly)
- **Transport costs** (weekly)
- **Other expenses** (weekly)

### 🎯 Offset Account Features
- **Scheduled contributions**: Add lump sum deposits at specific months
- **Exceptional expenses**: One-off or recurring costs that eat into the surplus
- **Automatic calculation**: Whatever is left after expenses goes to offset

### 📊 Real-Time Results
- ⏱️ **Time to pay off loan**: Years, months, and human-readable format
- 💰 **Total interest paid**: Complete interest calculation
- 📉 **Savings comparison**: vs a traditional mortgage with no offset, over your chosen term
- 💵 **Weekly/fortnightly cash flow**: Know exactly what you need

---

## 🚀 Live Demo

👉 **[Try it now!](https://cmodernel.github.io/property-calculator/)**

---

## 💻 Installation

### Prerequisites

- **Node.js** 16+ ([Download](https://nodejs.org/))
- **npm** or **yarn**

### Quick Start

```bash
# Clone the repository
git clone https://github.com/CModernel/property-calculator.git

# Navigate to project directory
cd property-calculator

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Configuration

Every default value shown on first load (property price, down payment, expenses,
income, NSW closing costs, etc.) lives in [`config.default.json`](config.default.json)
at the repo root, instead of being hardcoded in the source.

To use your own defaults without touching the code:

```bash
# Copy the defaults and edit the values you want to change
cp config.default.json config.local.json
```

`config.local.json` is git-ignored and overrides `config.default.json` on a
per-key basis (you only need to include the keys you want to change). It's
resolved at build time, so restart `npm run dev` (or re-run `npm run build`)
after editing it for the new values to take effect.

### Build for Production

```bash
# Create optimized production build
npm run build

# Preview production build locally
npm run preview
```

### Testing

Unit tests cover the pure financial calculations (loan amount, monthly payment, net balance, offset/amortization simulation) under `src/calculations/`.

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| ![React](https://img.shields.io/badge/React-18-61DAFB?logo=react) | UI Framework |
| ![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite) | Build Tool |
| ![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC?logo=tailwind-css) | Styling |
| ![Recharts](https://img.shields.io/badge/Recharts-2-8884D8) | Charts (future) |
| ![Lucide React](https://img.shields.io/badge/Lucide-Icons-F56565) | Icons |
| ![Vitest](https://img.shields.io/badge/Vitest-Testing-6E9F18?logo=vitest) | Unit Testing |

---

## 📖 How to Use

### Step 1: Configure Your Property
1. Set the **property price** (e.g., $500,000)
2. Enter your **down payment** (e.g., $250,000)
3. Adjust the **interest rate** to match your loan offer

### Step 2: Add Property Expenses
1. Input **strata fees** (quarterly amount)
2. Set **council rates** (quarterly)
3. Estimate **utilities** (monthly)
4. Add **insurance** cost (monthly)

### Step 3: Set Up Rental Income
1. Choose rental strategy:
   - **No rental**: You live alone
   - **1 Room**: Rent one bedroom
   - **2 Rooms**: Share with two tenants
2. Adjust weekly rent to match market rates

### Step 4: Enter Your Personal Finances
1. Add your **income sources** (salary, other income, or one-off payments), each as a weekly amount
2. Estimate **food expenses** (weekly)
3. Add **transport costs** (weekly)
4. Include **other expenses** (weekly)

### Step 5: Configure Offset Account
1. Add **scheduled contributions** (lump sums at specific months, if you have savings)
2. Add any **exceptional expenses** (one-off or recurring) that reduce your surplus

### Step 6: Analyze Results
The calculator instantly shows:
- 💰 **Monthly out-of-pocket**: What you pay after rent covers costs
- 📊 **Time to pay off**: How long until the loan is paid
- 💸 **Total interest**: Complete interest over loan lifetime
- 🎯 **Savings**: Compared to traditional mortgage

---

## 🧮 How It Works

### The Math Behind It

```
Monthly Cash Flow:
├─ Income (weekly × 52 / 12)
├─ Personal Expenses (weekly × 52 / 12)
├─ Property Costs (loan payment + strata + utilities + council + insurance)
├─ Rental Income (weekly × 52 / 12)
└─ = Amount to Offset

Loan Calculation with Offset:
├─ Each month: Balance - Offset = Effective Balance
├─ Interest calculated on: Effective Balance × Monthly Rate
├─ Payment: Always same amount (P&I)
├─ More offset → Less interest → More principal paid
└─ Result: Loan paid off faster
```

### Example Scenario

```
Property Price:     $500,000
Down Payment:       $250,000
Loan Amount:        $250,000
Interest Rate:      5.38%
Monthly Payment:    $1,401

With Offset Strategy (30-year term):
├─ Deposit $1,200/month to offset
├─ Time to pay off: ~10.5 years
├─ Total interest:  ~$77,000
└─ Savings vs no offset: ~$177,000 ✨

(Without any offset, the same loan costs ~$254,000 in interest over its
30-year term. Loan term is configurable - these figures assume the default.)
```

---

## 🎯 Use Cases

### 🏠 First Home Buyer
*"Should I buy now or wait?"*
- Compare different property prices
- See if rent from a room makes it affordable
- Calculate time to financial freedom

### 💼 Property Investor
*"Which property gives better cash flow?"*
- Compare multiple properties side-by-side
- Optimize rental strategy (1 room vs 2 rooms)
- Calculate ROI with offset account

### 📈 Mortgage Optimizer
*"How fast can I pay off my loan?"*
- See impact of extra deposits
- Compare different interest rates
- Visualize time savings with offset

---

## 🗺️ Roadmap

- [x] Basic calculator functionality
- [x] Offset account simulation
- [x] Rental income options
- [x] Responsive design
- [ ] Charts and graphs visualization
- [ ] Multiple property comparison
- [ ] Save scenarios to browser
- [ ] Export results to PDF
- [ ] Mobile app version
- [ ] Integration with real estate APIs

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add some AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

### Development Guidelines

- Follow existing code style
- Write meaningful commit messages
- Test your changes thoroughly
- Update documentation if needed

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Christian Modernel**

- GitHub: [@CModernel](https://github.com/CModernel)
- Email: chrismmodernel@gmail.com

---

## 🙏 Acknowledgments

- Inspired by the need for better property investment tools in Australia
- Built with modern web technologies for fast performance
- Designed for real-world scenarios and practical use

---

## ⭐ Support

If you found this calculator helpful, please consider:
- ⭐ **Starring** the repository
- 🐛 **Reporting bugs** via [Issues](https://github.com/CModernel/property-calculator/issues)
- 💡 **Suggesting features** you'd like to see
- 📢 **Sharing** with others who might benefit

---

<div align="center">

**Made with ❤️ for the Australian property market**

[![Star on GitHub](https://img.shields.io/github/stars/CModernel/property-calculator?style=social)](https://github.com/CModernel/property-calculator)

</div>
