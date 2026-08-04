import { classifyLvr, LVR_BANDS } from '../calculations/classifyLvr';

// Hover/focus handled entirely with Tailwind's `group`/`group-focus-within` -
// no useState needed, and focus-within gives keyboard accessibility for free.
const LvrBadge = ({ lvr }) => {
  const current = classifyLvr(lvr);

  return (
    <span className="relative inline-flex group align-middle ml-1">
      <button
        type="button"
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] leading-none border cursor-default focus:outline-none focus:ring-2 focus:ring-gray-300 ${current.bgClass}`}
        aria-label={`LVR risk: ${current.summary} (${current.band})`}
      >
        {current.symbol}
      </button>

      <div
        role="tooltip"
        className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity duration-150 absolute z-20 top-full left-1/2 -translate-x-1/2 mt-2 w-72 max-w-[90vw] rounded-lg border border-gray-200 bg-white p-3 shadow-lg text-xs"
      >
        <p className="text-gray-600 mb-2">
          The lower the LVR, the lower the risk and the greater the borrowing flexibility.
        </p>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-gray-500">
              <th className="pr-2 pb-1 font-medium">LVR</th>
              <th className="pr-2 pb-1 font-medium" />
              <th className="pb-1 font-medium">Summary</th>
            </tr>
          </thead>
          <tbody>
            {LVR_BANDS.map((band) => (
              <tr key={band.band} className={band === current ? 'bg-gray-100' : undefined}>
                <td className="pr-2 py-1 align-top whitespace-nowrap">{band.band}</td>
                <td className="pr-2 py-1 align-top">{band.symbol}</td>
                <td className={`py-1 align-top font-medium ${band.textClass}`}>{band.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </span>
  );
};

export default LvrBadge;
