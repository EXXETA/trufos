import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { AuthorizationInformation } from 'shim/objects';
import { useMemo } from 'react';
import { ModularForm } from './ModularForm';
import { AUTHORIZATION_NONE, getAuthorizationForm } from './forms';

export const AuthorizationTab = () => {
  const { updateAuthorization } = useCollectionActions();
  const request = useCollectionStore(selectRequest)!;
  const auth = request.auth;
  const type = auth?.type ?? AUTHORIZATION_NONE;
  const method = auth != null && 'method' in auth ? auth.method : undefined;

  const form = useMemo(() => getAuthorizationForm(type, method), [type, method]);

  return (
    <div className="relative h-full p-4">
      <div className="absolute top-4 right-4 left-4 z-10 space-y-4 pb-4">
        <ModularForm
          config={form}
          // @ts-expect-error data may contain 'none' type which is handled by the form
          data={{ ...auth, type }}
          onDataChanged={(
            delta: Partial<AuthorizationInformation> | { type: typeof AUTHORIZATION_NONE }
          ) => updateAuthorization(request, delta.type === AUTHORIZATION_NONE ? null : delta)}
        />
      </div>
    </div>
  );
};
