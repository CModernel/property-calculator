import { useState } from 'react';
import NumberSliderField from './NumberSliderField';

// Wraps NumberSliderField with an optional list of scheduled rate changes -
// each one supersedes the base value (and any earlier change) from its
// start month onward, e.g. "council rates go from $450 to $600 starting
// month 13". Collapsed by default so 7 of these on one page don't turn into
// a wall of forms - most fields will never need one.
const SteppedExpenseField = ({ field, ...numberSliderProps }) => {
  const { base, setBase, changes, addChange, removeChange } = field;
  const [showAddChange, setShowAddChange] = useState(false);
  const [newAmount, setNewAmount] = useState(base);
  const [newStartMonth, setNewStartMonth] = useState(1);

  const handleAdd = () => {
    addChange(newAmount, newStartMonth);
    setShowAddChange(false);
    setNewAmount(base);
    setNewStartMonth(1);
  };

  return (
    <div>
      <NumberSliderField value={base} onChange={setBase} {...numberSliderProps} />

      <button
        type="button"
        onClick={() => setShowAddChange(!showAddChange)}
        className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
      >
        {showAddChange ? '✕ Cancel' : '+ Schedule a change'}
      </button>

      {showAddChange && (
        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">New amount</label>
            <input
              type="number"
              value={newAmount}
              onChange={(e) => setNewAmount(Number(e.target.value))}
              className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Starting month: {newStartMonth}</label>
            <input
              type="range"
              min="1"
              max="360"
              value={newStartMonth}
              onChange={(e) => setNewStartMonth(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="w-full py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
          >
            Add scheduled change
          </button>
        </div>
      )}

      {changes.length > 0 && (
        <div className="mt-2 space-y-1">
          {[...changes]
            .sort((a, b) => a.startMonth - b.startMonth)
            .map((c) => (
              <div
                key={c.id}
                className="flex justify-between items-center px-2 py-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs"
              >
                <span>
                  {numberSliderProps.prefix}
                  {c.amount.toLocaleString()} from month {c.startMonth}
                </span>
                <button type="button" onClick={() => removeChange(c.id)} className="text-red-500 font-bold px-1">
                  ✕
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default SteppedExpenseField;
