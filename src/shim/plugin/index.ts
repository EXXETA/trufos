// The public API for plugins. Plugins import from this module only, everything else in `src/` is
// private to the app.
export * from './version';
export * from './manifest';
export * from './host';
export * from './contributions';
export * from '../objects';
export { DisplayableError } from '../error/DisplayableError';
// helpers of the app that plugins need as well, so they are not written twice
export { truncate, uniqueName } from '../string';
export { isObject } from '../object';
