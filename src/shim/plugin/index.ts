// The public API for plugins. Plugins import from this module only, everything else in `src/` is
// private to the app.
export * from './version';
export * from './manifest';
export * from './host';
export * from './contributions';
export * from '../objects';
export { DisplayableError } from '../error/DisplayableError';
// Helpers of the app that plugins need as well. They are part of the API like everything else
// exported here, so their signatures and behaviour only change with the version of the API.
export { truncate, uniqueName } from '../string';
export { isObject } from '../object';
