import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCompactMoney } from '../calculations/formatting';
import { getYearTickMonths } from '../calculations/chartData';

// Full-timeline version of the Timeline Explorer's single-month "Loan:
// $X | Offset: $Y" / "Net Effective Balance: $Z" figures (TODO-51).
// recharts props never see Tailwind's `dark:` variant (TODO-47), so the grid/
// axis/tooltip colors that'd otherwise be near-invisible or a jarring white
// popup on a dark card are switched here in JS instead. The line colors
// themselves stay the same in both themes - already vivid enough to read on
// a dark background.
const LoanBalanceChart = ({ monthlyData, isDarkMode }) => (
  <ResponsiveContainer width="100%" height={200}>
    <LineChart data={monthlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
      <XAxis
        dataKey="month"
        ticks={getYearTickMonths(monthlyData.length)}
        tickFormatter={(month) => `${Math.round(month / 12)}y`}
        tick={{ fill: isDarkMode ? '#9ca3af' : '#666' }}
      />
      <YAxis
        tickFormatter={(v) => `$${formatCompactMoney(v)}`}
        width={70}
        tick={{ fill: isDarkMode ? '#9ca3af' : '#666' }}
      />
      <Tooltip
        formatter={(value) => `$${Math.round(value).toLocaleString()}`}
        labelFormatter={(month) => `Month ${month}`}
        contentStyle={isDarkMode ? { backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' } : undefined}
        labelStyle={isDarkMode ? { color: '#f3f4f6' } : undefined}
      />
      <Legend />
      <Line type="monotone" dataKey="balance" name="Loan Balance" stroke="#ef4444" dot={false} strokeWidth={2} />
      <Line type="monotone" dataKey="offset" name="Offset" stroke="#3b82f6" dot={false} strokeWidth={2} />
      <Line
        type="monotone"
        dataKey="effectiveBalance"
        name="Effective Balance"
        stroke="#7c3aed"
        dot={false}
        strokeWidth={3}
      />
    </LineChart>
  </ResponsiveContainer>
);

export default LoanBalanceChart;
