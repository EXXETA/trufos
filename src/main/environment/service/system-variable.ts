import { VariableMap } from 'shim/objects/variables';
import { randomInt, randomUUID } from 'node:crypto';

const systemVariables: VariableMap = {
  $timestampIso: {
    get value() {
      return new Date().toISOString();
    },
    description: 'The current timestamp in ISO format.',
  },
  $timestampUnix: {
    get value() {
      return Math.floor(Date.now() / 1e3).toString();
    },
    description: 'The current timestamp in Unix format.',
  },
  $time: {
    get value() {
      return new Date().toTimeString();
    },
    description: 'The current time.',
  },
  $date: {
    get value() {
      return new Date().toDateString();
    },
    description: 'The current date.',
  },
  $randomInt: {
    get value() {
      return randomInt(2 ** 48 - 1).toString();
    },
    description: 'A positive random integer less than 2⁴⁸.',
  },
  $randomUuid: {
    get value() {
      return randomUUID();
    },
    description: 'A random UUID.',
  },
};

/**
 * Returns the value of a dynamic, predefined system variable.
 * @param key The key of the system variable.
 * @returns The value of the system variable if it exists, otherwise undefined.
 */
export function getSystemVariable(key: string) {
  return systemVariables[key];
}

/**
 * Returns all keys of the system variables.
 */
export function getSystemVariableKeys() {
  return Object.keys(systemVariables);
}

/**
 * Returns all system variables.
 */
export function getSystemVariables() {
  return Object.entries(systemVariables);
}
