// Vitest setup: polyfills for Mantine + jsdom compatibility.
import '@testing-library/jest-dom/vitest'

// Mantine's ScrollArea/Textarea autosize rely on ResizeObserver, which jsdom
// doesn't implement. A no-op stub is enough for component tests.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// Mantine's Combobox (Select/Autocomplete/etc.) scrolls the active option into
// view when the dropdown opens; jsdom doesn't implement scrollIntoView.
if (
  typeof Element !== 'undefined' &&
  !Element.prototype.scrollIntoView
) {
  Element.prototype.scrollIntoView = () => {}
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}
