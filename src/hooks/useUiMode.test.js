// @vitest-environment jsdom
import '../test/reactTestSetup';
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUiMode, UI_MODES } from './useUiMode';

const STORAGE_KEY = 'propertyCalculator.uiMode';

describe('useUiMode', () => {
  it('defaults to advanced when nothing is saved - today\'s interface, so nothing is lost', () => {
    const { result } = renderHook(() => useUiMode());
    expect(result.current[0]).toBe(UI_MODES.advanced);
  });

  it('a saved mode wins over the default', () => {
    localStorage.setItem(STORAGE_KEY, UI_MODES.simple);
    const { result } = renderHook(() => useUiMode());
    expect(result.current[0]).toBe(UI_MODES.simple);
  });

  // A stale or hand-edited key must not leave the app rendering neither view.
  it('falls back to advanced for an unrecognised saved value', () => {
    localStorage.setItem(STORAGE_KEY, 'expert');
    const { result } = renderHook(() => useUiMode());
    expect(result.current[0]).toBe(UI_MODES.advanced);
  });

  it('toggleUiMode flips the mode and persists it', () => {
    const { result } = renderHook(() => useUiMode());
    expect(localStorage.getItem(STORAGE_KEY)).toBe(UI_MODES.advanced);

    act(() => result.current[1]());
    expect(result.current[0]).toBe(UI_MODES.simple);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(UI_MODES.simple);

    act(() => result.current[1]());
    expect(result.current[0]).toBe(UI_MODES.advanced);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(UI_MODES.advanced);
  });

  // Uses its OWN key, so clearing the scenario (Reset to defaults) can't take
  // the interface preference with it.
  it('does not read or write the scenario storage key', () => {
    const { result } = renderHook(() => useUiMode());
    act(() => result.current[1]());
    expect(localStorage.getItem('propertyCalculator.scenario')).toBeNull();
  });

  it('does not crash when localStorage throws (e.g. private-mode/quota)', () => {
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => { throw new Error('blocked'); },
        setItem: () => { throw new Error('blocked'); },
        removeItem: () => {},
        clear: () => {},
      },
      configurable: true,
      writable: true,
    });
    try {
      let result;
      expect(() => {
        ({ result } = renderHook(() => useUiMode()));
        act(() => result.current[1]());
      }).not.toThrow();
      expect(result.current[0]).toBe(UI_MODES.simple);
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        value: original,
        configurable: true,
        writable: true,
      });
    }
  });
});
