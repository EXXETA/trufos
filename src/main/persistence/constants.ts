import z from 'zod';

/** The name of the secrets file */
export const SECRETS_FILE_NAME = '.secrets.bin';

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
