import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCompactMoney } from '../calculations/formatting';
import { withMonthlyPrincipal, getYearTickMonths } from '../calculations/chartData';

// The classic amortization chart: per-month Principal vs. Interest,
// stacked - shows the crossover point and how offset shifts it earlier
// (TODO-51).
// Same JS-level color handling as LoanBalanceChart.jsx (TODO-47) - recharts
// props don't respond to Tailwind's `dark:` variant.
const PrincipalInterestChart = ({ monthlyData, isDarkMode }) => (
  <ResponsiveContainer width="100%" height={200}>
    <AreaChart data={withMonthlyPrincipal(monthlyData)} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
      <Area
        type="monotone"
        dataKey="monthlyPrincipalPaid"
        name="Principal"
        stackId="1"
        stroke="#16a34a"
        fill="#4ade80"
      />
      <Area
        type="monotone"
        dataKey="monthlyInterestPaid"
        name="Interest"
        stackId="1"
        stroke="#dc2626"
        fill="#f87171"
      />
    </AreaChart>
  </ResponsiveContainer>
);

export default PrincipalInterestChart;
