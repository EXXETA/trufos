import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AddIcon } from '@/components/icons';
import { useCollectionActions } from '@/state/collectionStore';

export const SidebarSearch = () => {
  const { t } = useTranslation();
  const { addNewRequest } = useCollectionActions();

  return (
    <div className="flex w-full max-w-sm items-center space-x-6">
      <Button
        className="flex h-9 min-w-9 items-center justify-center p-0"
        type="button"
        style={{
          width: '100%',
        }}
        onClick={() => addNewRequest()}
      >
        <div className={cn('m-2')}>
          <AddIcon size={24} color={'black'} />
        </div>
        <span className="overflow-hidden">{t('sidebar.createRequest')}</span>
      </Button>
    </div>
  );
};
