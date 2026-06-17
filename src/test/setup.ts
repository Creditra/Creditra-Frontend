import "@testing-library/jest-dom";
import { beforeEach } from "vitest";

const createLocalStorage = (): Storage => {
  let store: Record<string, string> = {};

  return {
    get length() {
      return Object.keys(store).length;
    },
    clear: () => {
      store = {};
    },
    getItem: (key: string) => (key in store ? store[key] : null),
    key: (index: number) => Object.keys(store)[index] ?? null,
    removeItem: (key: string) => {
      delete store[key];
    },
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
  };
};

const localStorage = createLocalStorage();

Object.defineProperty(window, "localStorage", {
  value: localStorage,
  configurable: true,
});

Object.defineProperty(globalThis, "localStorage", {
  value: localStorage,
  configurable: true,
});

beforeEach(() => {
  window.localStorage.clear();
});
