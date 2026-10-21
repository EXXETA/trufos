import { useCollectionActions, useSelectedRequestHeaders } from '@/state/collectionStore';
import { HeaderEditor } from '@/components/shared/headers/HeaderEditor';

export const HeaderTab = () => {
  const { editHeaders, setInheritedHeaderEnabled } = useCollectionActions();
  const { headers, inherited } = useSelectedRequestHeaders();

  return (
    <div className="p-4">
      <HeaderEditor
        headers={headers}
        onChange={editHeaders}
        inherited={{ headers: inherited, onEnabledChange: setInheritedHeaderEnabled }}
      />
    </div>
  );
};
