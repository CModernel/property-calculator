import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Imported explicitly by each jsdom-environment test file (not wired into
// vite.config.js's global setupFiles) - a global afterEach here would run
// after every test in every file, including the node-environment
// calculations/*.test.js files, where `document` doesn't exist and
// cleanup() would throw.

// Node 20+'s own experimental global `localStorage` already exists on
// globalThis, so vitest's jsdom environment (which only overrides keys not
// already present on Node's global) leaves it in place instead of jsdom's
// working implementation - and Node's own version throws/no-ops without a
// `--localstorage-file` flag. Force-assign jsdom's real (working) instance,
// exposed as `globalThis.jsdom` by vitest's jsdom environment setup, so
// src/persistence/scenarioStorage.js's localStorage calls work in tests.
const realLocalStorage = globalThis.jsdom?.window?.localStorage;
if (realLocalStorage) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: realLocalStorage,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  cleanup();
  globalThis.localStorage?.clear();
  // vi.spyOn on an already-spied method (e.g. window.alert re-spied in a
  // per-file beforeEach) returns the SAME mock instance rather than a fresh
  // one, so call history would otherwise leak across tests within a file -
  // restore everything to its real implementation after each test so the
  // next test's spyOn starts clean.
  vi.restoreAllMocks();
});
