import { z } from 'zod';
import type { TrufosObjectType } from 'shim/objects';
import type { ScriptType } from 'shim/scripting';

/** The name of the secrets file */
export const SECRETS_FILE_NAME = '.secrets.bin';

/**
 * Gets the info file name for a given trufos object type.
 * @param type the type of the trufos object
 * @returns the info file name
 */
export function getInfoFileName(type: TrufosObjectType) {
  return `${type}.json`;
}

/**
 * Gets the script file name for a given script type.
 * @param type the type of the script
 * @returns the script file name with file extension `.js`
 */
export function getScriptFileName(type: ScriptType) {
  return `${type}-script.js`;
}

/** The name of the draft directory */
export const DRAFT_DIR_NAME = '.draft';

/** The name of the JSON file containing the order of child objects within a parent directory */
export const ORDER_FILE_NAME = 'order.json';

/**
 * An array containing the IDs of the child objects in the order they should be displayed.
 * This file is stored on the parent level of a collection or folder
 */
export const OrderFile = z.array(z.string());
export type OrderFile = z.infer<typeof OrderFile>;
