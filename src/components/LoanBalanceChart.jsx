import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCompactMoney } from '../calculations/formatting';
import { getYearTickMonths } from '../calculations/chartData';

// Full-timeline version of the Timeline Explorer's single-month "Loan:
// $X | Offset: $Y" / "Net Effective Balance: $Z" figures (TODO-51).
const LoanBalanceChart = ({ monthlyData }) => (
  <ResponsiveContainer width="100%" height={200}>
    <LineChart data={monthlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
      <XAxis
        dataKey="month"
        ticks={getYearTickMonths(monthlyData.length)}
        tickFormatter={(month) => `${Math.round(month / 12)}y`}
      />
      <YAxis tickFormatter={(v) => `$${formatCompactMoney(v)}`} width={70} />
      <Tooltip
        formatter={(value) => `$${Math.round(value).toLocaleString()}`}
        labelFormatter={(month) => `Month ${month}`}
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
