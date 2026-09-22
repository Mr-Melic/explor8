import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * Generated components mark their interactive surfaces with `data-ocid`, not
 * `data-testid`, so the testing library is pointed at the app's own convention
 * once here rather than every test re-deriving a selector.
 */
configure({ testIdAttribute: "data-ocid" });

afterEach(() => {
  cleanup();
});

// jsdom ships no Web Crypto digest, but the register's hashing is a core
// behavior under test. Node's own `crypto.subtle` is the same SHA-256 the
// browser exposes, so it is wired in rather than stubbed.
if (!globalThis.crypto?.subtle) {
  const { webcrypto } = await import("node:crypto");
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}

// `URL.createObjectURL` is used by the photo uploader to preview staged files.
if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = vi.fn(() => "blob:test-preview");
  URL.revokeObjectURL = vi.fn();
}

// jsdom's `Blob`/`File` does not implement `arrayBuffer()`, but the register's
// client-side file verification reads uploaded bytes through it. jsdom does
// implement `FileReader`, so the missing method is backed by that rather than
// stubbed with fake bytes.
if (typeof Blob.prototype.arrayBuffer !== "function") {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

// jsdom implements no pointer capture, but Radix UI's Select calls
// `hasPointerCapture`/`setPointerCapture`/`releasePointerCapture` when its
// trigger is clicked. Without these the select throws
// `target.hasPointerCapture is not a function` and its options never open, so
// the admin panel's role picker cannot be driven in a jsdom run. The methods
// are no-ops here: jsdom dispatches the click to the trigger regardless.
if (typeof Element.prototype.hasPointerCapture !== "function") {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
}

// Radix UI's Select scrolls the highlighted option into view when its content
// opens, and jsdom implements no `scrollIntoView`. Without it the select's
// content throws `candidate?.scrollIntoView is not a function` and its options
// never render. The no-op keeps the option list mounted for the test.
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => undefined;
}

// jsdom implements no `matchMedia`, but the app shell mounts sonner's
// `<Toaster>`, which reads it on mount to follow the system colour scheme.
// Without it the whole shell throws and unmounts, so a test of the default
// route would see a blank document. The stub reports "no preference".
if (typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
