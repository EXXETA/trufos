import { z } from 'zod';
import {
  AuthorizationInformation,
  AuthorizationMethod,
  AuthorizationType,
  createDefaultAuthorization,
  getMethod,
} from 'shim/objects/auth';
import { AUTHORIZATION_NONE } from './forms';

const ChangedType = z.union([z.enum(AuthorizationType), z.literal(AUTHORIZATION_NONE)]).optional();
const ChangedMethod = AuthorizationMethod.optional();

/**
 * Applies a change made in the authorization form. If the type or the OAuth method changes, the
 * result starts from {@link createDefaultAuthorization}, keeping the fields that the old and the
 * new method share. The result is always a complete, valid authorization.
 * @param current the current authorization
 * @param delta the changed fields, as the form reports them
 * @returns the changed authorization, or null if the type was changed to none
 * @throws Error if the change makes the authorization invalid
 */
export function applyAuthorizationChange(
  current: AuthorizationInformation | undefined,
  delta: Readonly<Record<string, unknown>>
): AuthorizationInformation | null {
  const changedType = ChangedType.parse(delta.type);
  if (changedType === AUTHORIZATION_NONE) return null;
  const type = changedType ?? current?.type;
  if (type == null) throw new Error('The authorization type is missing');

  const currentMethod = getMethod(current);
  const method =
    ChangedMethod.parse(delta.method) ?? (current?.type === type ? currentMethod : undefined);
  if (current != null && current.type === type && method === currentMethod) {
    return AuthorizationInformation.parse({ ...current, ...delta });
  }

  const defaults = createDefaultAuthorization(type, method);
  const shared =
    current?.type === type
      ? Object.entries(current).filter(([key]) => key in defaults && key !== 'method')
      : [];
  return AuthorizationInformation.parse({ ...defaults, ...Object.fromEntries(shared), ...delta });
}
