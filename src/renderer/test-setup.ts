import { vi } from 'vitest';

/**
 * Global test setup for renderer tests
 * 
 * Mocks Browser APIs that JSDOM doesn't implement but are required by UI libraries
 * like Radix UI (used in Select, Dropdown, etc.)
 */

// Pointer Capture APIs (used by Radix UI for drag interactions)
HTMLElement.prototype.hasPointerCapture = vi.fn();
HTMLElement.prototype.releasePointerCapture = vi.fn();
HTMLElement.prototype.setPointerCapture = vi.fn();

// Scroll APIs (used by Radix UI for keyboard navigation)
HTMLElement.prototype.scrollIntoView = vi.fn();
