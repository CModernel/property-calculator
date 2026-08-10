// @vitest-environment jsdom
import '../test/reactTestSetup';
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTooltipToggle } from './useTooltipToggle';

describe('useTooltipToggle', () => {
  it('starts closed', () => {
    const { result } = renderHook(() => useTooltipToggle());
    expect(result.current.isOpen).toBe(false);
  });

  it('toggle flips isOpen open, then closed again', () => {
    const { result } = renderHook(() => useTooltipToggle());
    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(false);
  });

  it('exposes a ref for the caller to attach to the trigger/tooltip wrapper', () => {
    const { result } = renderHook(() => useTooltipToggle());
    expect(result.current.ref.current).toBeNull();
  });
});
