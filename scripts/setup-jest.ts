import streams from 'web-streams-polyfill';
import {TextDecoder, TextEncoder} from 'util';

Object.assign(global, streams);
Object.assign(global, {
  TextDecoder,
  TextEncoder,
  setImmediate: setTimeout,
  clearImmediate: clearTimeout
});