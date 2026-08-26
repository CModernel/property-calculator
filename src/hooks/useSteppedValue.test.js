// @vitest-environment jsdom
import '../test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSteppedValue } from './useSteppedValue';

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

describe('useSteppedValue', () => {
  it('appends a new change when startMonth is unique', () => {
    const { result } = renderHook(() => useSteppedValue(200, []));
    act(() => result.current.addChange(300, 6));
    expect(result.current.changes).toHaveLength(1);
    expect(result.current.changes[0]).toMatchObject({ amount: 300, startMonth: 6 });
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('alerts and does not add a change when startMonth duplicates an existing one', () => {
    const { result } = renderHook(() => useSteppedValue(200, [{ id: 1, amount: 250, startMonth: 6 }]));
    act(() => result.current.addChange(999, 6));
    expect(result.current.changes).toHaveLength(1);
    expect(result.current.changes[0].amount).toBe(250);
    expect(window.alert).toHaveBeenCalledTimes(1);
  });

  // TODO-169: min/max are the owning field's own bounds (e.g. an interest
  // rate field's 0.1-20), passed in by the caller. Before this fix, addChange
  // never validated the amount at all.
  it('alerts and does not add a change when the amount is below min', () => {
    const { result } = renderHook(() => useSteppedValue(5, []));
    act(() => result.current.addChange(0, 25, 0.1, 20));
    expect(result.current.changes).toHaveLength(0);
    expect(window.alert).toHaveBeenCalledTimes(1);
  });

  it('alerts and does not add a change when the amount is above max', () => {
    const { result } = renderHook(() => useSteppedValue(5, []));
    act(() => result.current.addChange(25, 25, 0.1, 20));
    expect(result.current.changes).toHaveLength(0);
    expect(window.alert).toHaveBeenCalledTimes(1);
  });

  it('alerts and does not add a change when the amount is not a finite number', () => {
    const { result } = renderHook(() => useSteppedValue(5, []));
    act(() => result.current.addChange(NaN, 25, 0.1, 20));
    expect(result.current.changes).toHaveLength(0);
    expect(window.alert).toHaveBeenCalledTimes(1);
  });

  it('accepts an amount within min/max', () => {
    const { result } = renderHook(() => useSteppedValue(5, []));
    act(() => result.current.addChange(10, 25, 0.1, 20));
    expect(result.current.changes).toHaveLength(1);
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('removeChange removes only the matching id', () => {
    const initialChanges = [
      { id: 1, amount: 250, startMonth: 6 },
      { id: 2, amount: 300, startMonth: 12 },
    ];
    const { result } = renderHook(() => useSteppedValue(200, initialChanges));
    act(() => result.current.removeChange(1));
    expect(result.current.changes).toHaveLength(1);
    expect(result.current.changes[0].id).toBe(2);
  });

  it('setBase updates independently of changes', () => {
    const { result } = renderHook(() => useSteppedValue(200, [{ id: 1, amount: 250, startMonth: 6 }]));
    act(() => result.current.setBase(500));
    expect(result.current.base).toBe(500);
    expect(result.current.changes).toHaveLength(1);
  });
});
