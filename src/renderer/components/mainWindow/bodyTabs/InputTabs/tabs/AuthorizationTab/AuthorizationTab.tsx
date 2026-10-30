import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { AuthorizationEditor } from '@/components/shared/settings/AuthorizationTab/AuthorizationEditor';

export const AuthorizationTab = () => {
  const { updateRequest } = useCollectionActions();
  const auth = useCollectionStore((state) => selectRequest(state)!.auth);
  const parentId = useCollectionStore((state) => selectRequest(state)!.parentId);
  const requestId = useCollectionStore((state) => selectRequest(state)!.id);

  return (
    <div className="relative h-full p-4">
      <div className="absolute top-4 right-4 left-4 z-10 space-y-4 pb-4">
        <AuthorizationEditor
          // a discovery that is still running must not fill in the next request
          key={requestId}
          level="request"
          parentId={parentId}
          auth={auth}
          onAuthChange={(changed) => updateRequest({ auth: changed })}
        />
      </div>
    </div>
  );
};
