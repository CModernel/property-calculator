// @vitest-environment jsdom
import '../test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScheduleForm } from './useScheduleForm';
import { MAX_MONTH } from '../calculations/recurringAmount';

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

describe('useScheduleForm', () => {
  it('defaults to a recurring monthly schedule running forever', () => {
    const { result } = renderHook(() => useScheduleForm());
    expect(result.current.oneTime).toBe(false);
    expect(result.current.startMonth).toBe(1);
    expect(result.current.recurrence).toBe('monthly');
    expect(result.current.endMonth).toBe(MAX_MONTH);
  });

  // Offset Contributions opens one-time, preserving the pre-TODO-32 behavior
  // where every contribution was a single lump sum.
  it('opens as one-time when asked', () => {
    const { result } = renderHook(() => useScheduleForm({ oneTime: true }));
    expect(result.current.oneTime).toBe(true);
  });

  it('schedule for a recurring item carries recurrence and endMonth', () => {
    const { result } = renderHook(() => useScheduleForm());
    act(() => result.current.setRecurrence('quarterly'));
    act(() => result.current.setStartMonth(6));
    act(() => result.current.setEndMonth(24));
    expect(result.current.schedule).toEqual({ startMonth: 6, recurrence: 'quarterly', endMonth: 24 });
  });

  // The absent key matters: isScheduleActive treats a missing endMonth
  // differently from one it would have to ignore.
  it("schedule for a one-time item is recurrence 'none' with NO endMonth key", () => {
    const { result } = renderHook(() => useScheduleForm({ oneTime: true }));
    act(() => result.current.setStartMonth(6));
    act(() => result.current.setEndMonth(24));
    expect(result.current.schedule).toEqual({ startMonth: 6, recurrence: 'none' });
    expect('endMonth' in result.current.schedule).toBe(false);
  });

  it('validateRange alerts and fails when a recurring range is inverted', () => {
    const { result } = renderHook(() => useScheduleForm());
    act(() => result.current.setEndMonth(10));
    act(() => result.current.setStartMonth(50));
    expect(result.current.validateRange()).toBe(false);
    expect(window.alert).toHaveBeenCalledWith('Start month must be before end month.');
  });

  it('validateRange ignores an inverted range for a one-time item', () => {
    const { result } = renderHook(() => useScheduleForm({ oneTime: true }));
    act(() => result.current.setEndMonth(10));
    act(() => result.current.setStartMonth(50));
    expect(result.current.validateRange()).toBe(true);
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('reset restores every field to how the form opened', () => {
    const { result } = renderHook(() => useScheduleForm({ oneTime: true }));
    act(() => result.current.setOneTime(false));
    act(() => result.current.setRecurrence('yearly'));
    act(() => result.current.setStartMonth(9));
    act(() => result.current.setEndMonth(30));
    act(() => result.current.reset());
    expect(result.current).toMatchObject({
      oneTime: true, startMonth: 1, recurrence: 'monthly', endMonth: MAX_MONTH,
    });
  });

  it('reset({ startMonth }) overrides only the month, leaving the rest at their opening values', () => {
    const { result } = renderHook(() => useScheduleForm({ oneTime: true }));
    act(() => result.current.setOneTime(false));
    act(() => result.current.reset({ startMonth: 7 }));
    expect(result.current.startMonth).toBe(7);
    expect(result.current.oneTime).toBe(true);
  });

  // House Rent/Room Rent/Other have no INCOME_CATEGORY_DEFAULTS entry at all.
  it('applyDefaults(undefined) leaves the form alone', () => {
    const { result } = renderHook(() => useScheduleForm());
    act(() => result.current.setRecurrence('yearly'));
    act(() => result.current.applyDefaults(undefined));
    expect(result.current.recurrence).toBe('yearly');
    expect(result.current.oneTime).toBe(false);
  });

  // 'Child Support' deliberately omits endMonth from its defaults.
  it('applyDefaults only writes the fields it lists', () => {
    const { result } = renderHook(() => useScheduleForm());
    act(() => result.current.setEndMonth(24));
    act(() => result.current.applyDefaults({ oneTime: false, recurrence: 'monthly' }));
    expect(result.current.endMonth).toBe(24);
    expect(result.current.recurrence).toBe('monthly');
  });

  // Bonus/Gift/Tax Refund/Freelance carry only oneTime, so recurrence and
  // endMonth keep whatever the user had picked.
  it('applyDefaults for a one-time category does not touch recurrence or End Month', () => {
    const { result } = renderHook(() => useScheduleForm());
    act(() => result.current.setRecurrence('yearly'));
    act(() => result.current.setEndMonth(24));
    act(() => result.current.applyDefaults({ oneTime: true }));
    expect(result.current.oneTime).toBe(true);
    expect(result.current.recurrence).toBe('yearly');
    expect(result.current.endMonth).toBe(24);
  });
});
