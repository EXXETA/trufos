import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { createDefaultAuthorization, getMethod } from 'shim/objects';
import { useMemo } from 'react';
import { ModularForm } from './ModularForm';
import { AUTHORIZATION_NONE, getAuthorizationForm } from './forms';
import { applyAuthorizationChange } from './authorizationChange';

export const AuthorizationTab = () => {
  const { updateRequest } = useCollectionActions();
  const auth = useCollectionStore((state) => selectRequest(state)?.auth);
  const type = auth?.type ?? AUTHORIZATION_NONE;
  const method = getMethod(auth);

  const form = useMemo(() => getAuthorizationForm(type, method), [type, method]);
  // the defaults fill fields an older version of the authorization does not have yet
  const data = useMemo(
    () => (auth == null ? { type } : { ...createDefaultAuthorization(auth.type, method), ...auth }),
    [auth, type, method]
  );

  return (
    <div className="relative h-full p-4">
      <div className="absolute top-4 right-4 left-4 z-10 space-y-4 pb-4">
        <ModularForm
          config={form}
          data={data}
          onDataChanged={(delta) =>
            updateRequest({
              auth:
                delta.type === AUTHORIZATION_NONE ? null : applyAuthorizationChange(auth, delta),
            })
          }
        />
      </div>
    </div>
  );
};
