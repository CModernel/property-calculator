import { useTooltipToggle } from '../hooks/useTooltipToggle';

// Generic version of LvrBadge's hover/focus tooltip pattern (Tailwind
// group/group-focus-within) - LvrBadge renders a fixed LVR table, this one
// takes arbitrary text content for any "(?) explain this figure" use case.
// TODO-114: useTooltipToggle adds a tap-to-open/tap-outside-to-close path
// alongside the existing hover/focus-within one, for touch devices where
// neither :hover nor :focus-within reliably fires on a <button> tap.
const InfoTooltip = ({ label, children }) => {
  const { isOpen, toggle, ref } = useTooltipToggle();
  return (
    <span ref={ref} className="relative inline-flex group align-middle ml-1">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] leading-none border cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-300 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600"
        aria-label={label}
      >
        ?
      </button>

      <div
        role="tooltip"
        className={`${isOpen ? 'visible opacity-100' : 'invisible opacity-0'} group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity duration-150 absolute z-20 top-full left-1/2 -translate-x-1/2 mt-2 w-64 max-w-[90vw] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-lg text-xs text-gray-600 dark:text-gray-300 font-normal normal-case`}
      >
        {children}
      </div>
    </span>
  );
};

export default InfoTooltip;
