import { VariableObject } from 'shim/variables';
import { randomInt, randomUUID } from 'node:crypto';

const systemVariables = new Map<VariableObject['key'], VariableObject>(
  [
    {
      key: '$timestampIso',
      get value() {
        return new Date().toISOString();
      },
      description: 'The current timestamp in ISO format.',
    },
    {
      key: '$timestampUnix',
      get value() {
        return Math.floor(Date.now() / 1e3).toString();
      },
      description: 'The current timestamp in Unix format.',
    },
    {
      key: '$time',
      get value() {
        return new Date().toTimeString();
      },
      description: 'The current time.',
    },
    {
      key: '$date',
      get value() {
        return new Date().toDateString();
      },
      description: 'The current date.',
    },
    {
      key: '$randomInt',
      get value() {
        return randomInt(2 ** 48 - 1).toString();
      },
      description: 'A positive random integer less than 2⁴⁸.',
    },
    {
      key: '$randomUuid',
      get value() {
        return randomUUID();
      },
      description: 'A random UUID.',
    },
  ].map((variable) => [variable.key, { enabled: true, ...variable }])
);

/**
 * Returns the value of a dynamic, predefined system variable.
 * @param key The key of the system variable.
 * @returns The value of the system variable if it exists, otherwise undefined.
 */
export function getSystemVariable(key: string) {
  return systemVariables.get(key);
}

/**
 * Returns all keys of the system variables.
 */
export function getSystemVariableKeys() {
  return Array.from(systemVariables.keys());
}

/**
 * Returns all system variables.
 */
export function getSystemVariables() {
  return Array.from(systemVariables.values());
}
