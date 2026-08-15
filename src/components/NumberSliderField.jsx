import { useId, useState } from 'react';
import { clampToRange } from '../calculations/clampToRange';
import { parseNumberInput } from '../calculations/parseNumberInput';

// Tailwind only keeps classes that appear as complete literal strings in the
// source, so the track colour CANNOT be built as `bg-${color}-200`.
const TRACK_CLASSES = {
  blue: 'bg-blue-200 dark:bg-blue-900',
  green: 'bg-green-200 dark:bg-green-900',
  indigo: 'bg-indigo-200 dark:bg-indigo-900',
  orange: 'bg-orange-200 dark:bg-orange-900',
  purple: 'bg-purple-200 dark:bg-purple-900',
};

// Split tracks are opt-in because most sliders have one meaningful direction.
// The CSS variables behind this class are overridden by `.dark` in index.css,
// so the inline gradient below stays theme-aware without requiring a theme prop.
const SPLIT_TRACK_CLASSES = {
  etf: 'range-slider-split-etf',
};
const SPLIT_TRACK_LEGENDS = {
  etf: { before: 'Offset-bound', after: 'ETF allocation' },
};

// A number field paired with a slider. The number field is the source of truth
// and accepts any value inside [min, max]; the slider only covers a typical
// range (labelled underneath) for quick exploration.
const NumberSliderField = ({
  label,
  value,
  onChange,
  min,
  max,
  sliderMin = min,
  sliderMax = max,
  step = 1,
  color = 'blue',
  prefix = '',
  suffix = '',
  formatValue = (v) => v.toLocaleString(),
  formatBound,
  hideSlider = false,
  splitColor,
  children,
}) => {
  const id = useId();
  // null means "not editing, mirror the value prop". A string is the raw text
  // the user is typing, which may be empty or half-finished.
  const [draft, setDraft] = useState(null);

  const showBound = formatBound ?? formatValue;

  // Bounds can depend on other state (the deposit's ceiling follows the property
  // price), so never let an inverted range reach the DOM.
  const safeSliderMax = Math.max(sliderMin, sliderMax);

  // While typing, the display and the thumb follow the draft so the user gets
  // instant feedback without the parent recalculating on every keystroke.
  const parsedDraft = draft === null ? value : parseNumberInput(draft);
  const preview = parsedDraft === null ? value : parsedDraft;

  const belowRange = preview < sliderMin;
  const aboveRange = preview > safeSliderMax;
  const splitTrackClass = SPLIT_TRACK_CLASSES[splitColor];
  const splitLegend = SPLIT_TRACK_LEGENDS[splitColor];
  const sliderPosition = safeSliderMax === sliderMin
    ? 0
    : ((clampToRange(preview, sliderMin, safeSliderMax) - sliderMin) / (safeSliderMax - sliderMin)) * 100;
  const sliderStyle = splitTrackClass
    ? {
        backgroundImage: `linear-gradient(to right, var(--slider-split-before) 0%, var(--slider-split-before) ${sliderPosition}%, var(--slider-split-after) ${sliderPosition}%, var(--slider-split-after) 100%)`,
      }
    : undefined;

  const commit = () => {
    if (draft === null) return;
    const parsed = parseNumberInput(draft);
    setDraft(null);
    if (parsed === null) return; // empty or garbage: keep the previous value
    const next = clampToRange(parsed, min, max);
    if (next !== value) onChange(next);
  };

  const handleNumberKeyDown = (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') setDraft(null);
  };

  // The native spinner arrows should feel immediate rather than wait for blur.
  const handleNumberKeyUp = (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') commit();
  };

  const handleSliderChange = (e) => {
    setDraft(null);
    onChange(clampToRange(Number(e.target.value), min, max));
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          {label}
        </label>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 tabular-nums">
          {prefix}{formatValue(preview)}{suffix}
        </span>
      </div>

      <div className="relative">
        {prefix && (
          <span className="absolute inset-y-0 left-2 flex items-center text-sm text-gray-500 dark:text-gray-400 pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          // "any" disables HTML step-grid validation. With a coarse step the
          // browser's spinner would round an exact figure like 742500 onto the
          // grid, destroying the precision this control exists to provide.
          step="any"
          value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleNumberKeyDown}
          onKeyUp={handleNumberKeyUp}
          className={`w-full ${prefix ? 'pl-6' : 'pl-2'} pr-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm tabular-nums bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300`}
        />
      </div>

      {!hideSlider && (
        <>
          <input
            type="range"
            aria-label={`${label} slider`}
            min={sliderMin}
            max={safeSliderMax}
            step={step}
            // Clamping here is required, not cosmetic: a range input whose value
            // exceeds max is clamped by the DOM without firing change, and that
            // React/DOM divergence is what let the deposit outgrow the price.
            value={clampToRange(preview, sliderMin, safeSliderMax)}
            onChange={handleSliderChange}
            style={sliderStyle}
            aria-describedby={splitLegend ? `${id}-split-legend` : undefined}
            className={`w-full h-2 mt-2 rounded-lg appearance-none cursor-pointer ${TRACK_CLASSES[color]} ${splitTrackClass ?? ''}`}
          />

          {splitLegend && (
            <div
              id={`${id}-split-legend`}
              role="group"
              className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-1"
              aria-label={`${splitLegend.before} and ${splitLegend.after} slider legend`}
            >
              <span><span className="text-indigo-500 dark:text-indigo-300">●</span> {splitLegend.before}</span>
              <span>{splitLegend.after} <span className="text-purple-500 dark:text-purple-300">●</span></span>
            </div>
          )}

          <div className="flex justify-between text-xs text-gray-400 mt-1 tabular-nums">
            <span className={belowRange ? 'text-amber-600 dark:text-amber-400 font-medium' : undefined}>
              {belowRange && '<'}{prefix}{showBound(sliderMin)}
            </span>
            <span className={aboveRange ? 'text-amber-600 dark:text-amber-400 font-medium' : undefined}>
              {prefix}{showBound(safeSliderMax)}{aboveRange && '+'}
            </span>
          </div>
        </>
      )}

      {children && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{children}</p>}
    </div>
  );
};

export default NumberSliderField;
