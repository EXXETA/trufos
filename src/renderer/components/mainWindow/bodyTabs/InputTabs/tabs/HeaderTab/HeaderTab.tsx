import { useCollectionActions, useSelectedRequestHeaders } from '@/state/collectionStore';
import { HeaderEditor } from '@/components/shared/headers/HeaderEditor';

export const HeaderTab = () => {
  const { editHeaders, setHeaderEnabled } = useCollectionActions();
  const { headers, inherited, automatic } = useSelectedRequestHeaders();

  return (
    <div className="p-4">
      <HeaderEditor
        headers={headers}
        onChange={editHeaders}
        derived={{ automatic, inherited, onEnabledChange: setHeaderEnabled }}
      />
    </div>
  );
};
