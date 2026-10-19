import { useMemo } from 'react';
import { useCollectionStore } from '@/state/collectionStore';
import { showError } from '@/error/errorHandler';
import { getAuthorizationSource } from 'shim/collection-model';
import { AuthorizationInformation, createDefaultAuthorization, getMethod } from 'shim/objects';
import { type FormDelta, ModularForm } from './ModularForm';
import {
  AUTHORIZATION_NONE,
  AUTHORIZATION_TYPE_LABELS,
  AuthorizationLevel,
  buildAuthorizationForm,
} from './forms';
import { applyAuthorizationChange } from './authorizationChange';

export interface AuthorizationEditorProps {
  /** What the authorization belongs to. Determines the types to choose from. */
  level: AuthorizationLevel;
  /** The ID of the parent, to describe what is inherited. The collection has none. */
  parentId?: string;
  auth?: AuthorizationInformation;
  /** Called with the changed authorization, or null if it was changed to none. */
  onAuthChange: (auth: AuthorizationInformation | null) => void;
}

/** Describes the authorization that is inherited from the given parent. */
function useInheritedDescription(parentId: string | undefined): string | undefined {
  const source = useCollectionStore((state) =>
    parentId == null ? undefined : getAuthorizationSource(state, parentId)
  );
  if (source == null) return;
  if (source.auth == null) {
    return 'Nothing is inherited: neither a parent folder nor the collection has an authorization.';
  }
  const label = AUTHORIZATION_TYPE_LABELS[source.auth.type];
  return source.type === 'collection'
    ? `${label} is inherited from the collection.`
    : `${label} is inherited from the folder "${source.title}".`;
}

/** Edits the authorization of a request, a folder or the collection. */
export const AuthorizationEditor = ({
  level,
  parentId,
  auth,
  onAuthChange,
}: AuthorizationEditorProps) => {
  const type = auth?.type ?? AUTHORIZATION_NONE;
  const method = getMethod(auth);
  const inheritedDescription = useInheritedDescription(parentId);

  const form = useMemo(
    () => buildAuthorizationForm(type, method, level, inheritedDescription),
    [type, method, level, inheritedDescription]
  );
  // the defaults fill fields an older version of the authorization does not have yet
  const data = useMemo(
    () => (auth == null ? { type } : { ...createDefaultAuthorization(auth.type, method), ...auth }),
    [auth, type, method]
  );

  const onDataChanged = (delta: FormDelta) => {
    let changed: AuthorizationInformation | null;
    try {
      changed = applyAuthorizationChange(auth, delta);
    } catch (error) {
      showError('The authorization is invalid', error);
      return;
    }
    onAuthChange(changed);
  };

  return <ModularForm config={form} data={data} onDataChanged={onDataChanged} />;
};
