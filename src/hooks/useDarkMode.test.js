// @vitest-environment jsdom
import '../test/reactTestSetup';
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDarkMode } from './useDarkMode';

const STORAGE_KEY = 'propertyCalculator.theme';

afterEach(() => {
  delete window.matchMedia;
});

describe('useDarkMode', () => {
  it('prefers a saved "dark" value in localStorage over matchMedia', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    window.matchMedia = () => ({ matches: false });
    const { result } = renderHook(() => useDarkMode());
    expect(result.current[0]).toBe(true);
  });

  it('prefers a saved "light" value in localStorage over matchMedia', () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    window.matchMedia = () => ({ matches: true });
    const { result } = renderHook(() => useDarkMode());
    expect(result.current[0]).toBe(false);
  });

  it('falls back to matchMedia when nothing is saved', () => {
    window.matchMedia = () => ({ matches: true });
    const { result } = renderHook(() => useDarkMode());
    expect(result.current[0]).toBe(true);
  });

  it('falls back to light when matchMedia is unavailable (the default jsdom test environment)', () => {
    const { result } = renderHook(() => useDarkMode());
    expect(result.current[0]).toBe(false);
  });

  it('toggleDarkMode flips state, updates the document class, and persists to localStorage', () => {
    const { result } = renderHook(() => useDarkMode());
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    act(() => result.current[1]());

    expect(result.current[0]).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');

    act(() => result.current[1]());

    expect(result.current[0]).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
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
        ({ result } = renderHook(() => useDarkMode()));
        act(() => result.current[1]());
      }).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        value: original,
        configurable: true,
        writable: true,
      });
    }
  });
});
