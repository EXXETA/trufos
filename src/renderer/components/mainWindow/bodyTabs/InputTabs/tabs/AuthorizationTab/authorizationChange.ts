import { z } from 'zod';
import {
  AuthorizationInformation,
  AuthorizationType,
  createDefaultAuthorization,
  getMethod,
} from 'shim/objects/auth';

const OptionalAuthorizationType = z.enum(AuthorizationType).optional();

/**
 * Applies a change made in the authorization form. If the type or the OAuth method changes, the
 * result starts from {@link createDefaultAuthorization}, keeping the fields that the old and the
 * new method share. The result is always a complete, valid authorization.
 * @param current the current authorization
 * @param delta the changed fields, as the form reports them
 * @throws Error if the change makes the authorization invalid
 */
export function applyAuthorizationChange(
  current: AuthorizationInformation | undefined,
  delta: Readonly<Record<string, unknown>>
): AuthorizationInformation {
  const type = OptionalAuthorizationType.parse(delta.type) ?? current?.type;
  if (type == null) throw new Error('The authorization type is missing');

  const currentMethod = getMethod(current);
  const method = getMethod(delta) ?? (current?.type === type ? currentMethod : undefined);
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
