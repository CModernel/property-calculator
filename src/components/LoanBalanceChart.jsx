import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCompactMoney } from '../calculations/formatting';
import { getYearTickMonths } from '../calculations/chartData';
import { chartColors, DARK_LEGEND_TEXT, LIGHT_LEGEND_TEXT } from './chartTheme';

// Full-timeline version of the Timeline Explorer's single-month "Loan:
// $X | Offset: $Y" / "Net Effective Balance: $Z" figures (TODO-51).
// recharts props never see Tailwind's `dark:` variant (TODO-47), so the grid/
// axis/tooltip colors that'd otherwise be near-invisible or a jarring white
// popup on a dark card are switched here in JS instead. TODO-192: that now
// includes the line colors (violet was 2.6:1 on the dark card) and the legend
// text, which recharts would otherwise colour like its series - neutral in both
// themes (TODO-193), see chartTheme.js.
const LoanBalanceChart = ({ monthlyData, isDarkMode }) => {
  const colors = chartColors(isDarkMode);
  return (
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
      <Legend formatter={(value) => <span style={{ color: isDarkMode ? DARK_LEGEND_TEXT : LIGHT_LEGEND_TEXT }}>{value}</span>} />
      <Line type="monotone" dataKey="balance" name="Loan Balance" stroke={colors.balance} dot={false} strokeWidth={2} />
      <Line type="monotone" dataKey="offset" name="Offset" stroke={colors.offset} dot={false} strokeWidth={2} />
      <Line
        type="monotone"
        dataKey="effectiveBalance"
        name="Effective Balance"
        stroke={colors.effective}
        dot={false}
        strokeWidth={3}
      />
    </LineChart>
  </ResponsiveContainer>
  );
};

export default LoanBalanceChart;
