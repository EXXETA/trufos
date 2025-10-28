import { Button } from '@/components/ui/button';
import { AddIcon, CheckedIcon, DeleteIcon } from '@/components/icons';
import { Divider } from '@/components/shared/Divider';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  selectQueryParams,
  useCollectionActions,
  useCollectionStore,
} from '@/state/collectionStore';

export const ParamsTab = () => {
  const {
    addQueryParam,
    updateQueryParam,
    clearQueryParams,
    deleteQueryParam,
    setQueryParamActive,
  } = useCollectionActions();

  const queryParams = useCollectionStore(selectQueryParams);

  return (
    <div className="relative h-full p-4">
      <div className="absolute top-4 right-4 left-4 z-10">
        <div className="flex">
          <Button className="h-fit gap-1" size="sm" variant="ghost" onClick={addQueryParam}>
            <AddIcon />
            Add Query Param
          </Button>
          <Button className="h-fit gap-1" size="sm" variant="ghost" onClick={clearQueryParams}>
            <DeleteIcon />
            Delete All
          </Button>
        </div>

        <Divider className="mt-2" />
      </div>

      <div className="absolute top-[68px] right-4 bottom-4 left-4">
        <div className="pb-4">
          <Table className="w-full table-auto">
            <TableHeader>
              <TableRow>
                <TableHead className="w-auto">Key</TableHead>
                <TableHead className="w-full">Value</TableHead>
                <TableHead className="w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {queryParams.map((param, index) => (
                <TableRow key={index}>
                  <TableCell className="w-1/3 break-all">
                    <input
                      type="text"
                      value={param?.key}
                      onChange={(e) => updateQueryParam(index, { key: e.target.value })}
                      className="w-full bg-transparent outline-hidden"
                      placeholder="Enter param key"
                    />
                  </TableCell>

                  <TableCell className="w-full break-all">
                    <input
                      type="text"
                      value={param?.value}
                      onChange={(e) => updateQueryParam(index, { value: e.target.value })}
                      className="w-full bg-transparent outline-hidden"
                      placeholder="Enter param value"
                    />
                  </TableCell>

                  <TableCell className="w-16 text-right">
                    <div className="flex items-center justify-center gap-2">
                      <div className="relative z-10 h-4 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={param?.isActive}
                          onChange={(e) => setQueryParamActive(index, e.target.checked)}
                          className={cn(
                            'form-checkbox h-4 w-4 appearance-none rounded-[2px] border',
                            param?.isActive
                              ? 'border-accent-primary bg-accent-tertiary'
                              : 'border-text-primary bg-transparent'
                          )}
                        />

                        {param?.isActive && (
                          <div
                            className={
                              'pointer-events-none absolute top-0 left-0 flex h-4 w-4 rotate-6 items-center justify-center'
                            }
                          >
                            <CheckedIcon
                              size={16}
                              viewBox={'0 0 16 16'}
                              color={'var(--accent-primary)'}
                            />
                          </div>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-accent-primary active:text-accent-secondary h-6 w-6 hover:bg-transparent"
                        onClick={() => deleteQueryParam(index)}
                      >
                        <DeleteIcon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
