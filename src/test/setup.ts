import "@testing-library/jest-dom/vitest";
import "../index.css";
import { File as NodeFile, Blob as NodeBlob } from "node:buffer";
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";
import { server } from "../mocks/server";

import { act } from "@testing-library/react";

// jsdom replaces FormData/File/Blob with its own classes, which hang Node's
// native undici fetch when intercepted by MSW v2. Restore Node's native
// implementations so multipart uploads work identically in tests and browsers.
const NativeFormData = (
  await new Response("", {
    headers: { "content-type": "application/x-www-form-urlencoded" },
  }).formData()
).constructor as typeof FormData;

Object.defineProperty(globalThis, "FormData", {
  value: NativeFormData,
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, "File", {
  value: NodeFile,
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, "Blob", {
  value: NodeBlob,
  writable: true,
  configurable: true,
});
if (typeof window !== "undefined") {
  Object.defineProperty(window, "FormData", {
    value: NativeFormData,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, "File", {
    value: NodeFile,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, "Blob", {
    value: NodeBlob,
    writable: true,
    configurable: true,
  });
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

if (typeof window !== "undefined") {
  class MockIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
  }
  Object.defineProperty(window, "IntersectionObserver", {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });
  Object.defineProperty(globalThis, "IntersectionObserver", {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });
}

// Warm up React's enqueueTask so its one-time Math.random() doesn't affect tests that spy on Math.random
await act(async () => {});

const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => {
    storage[key] = String(value);
  },
  removeItem: (key: string) => {
    delete storage[key];
  },
  clear: () => {
    for (const key of Object.keys(storage)) {
      delete storage[key];
    }
  },
  get length() {
    return Object.keys(storage).length;
  },
  key: (i: number) => Object.keys(storage)[i] ?? null,
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
}
