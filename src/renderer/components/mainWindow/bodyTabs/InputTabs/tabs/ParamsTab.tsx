import { useEffect, useState } from 'react';
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
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { TrufosQueryParam } from 'shim/objects/queryParams';
import { getQueryParamsFromUrl } from '@/util/query-util';
import { shallowEqual } from '@/util/object-util';
// import { TrufosQueryParam } from '@/shim/objects/queryParams';

export const ParamsTab = () => {
  const [isActiveStateUpdating, setIsActiveStateUpdating] = useState<boolean>(false);

  const {
    updateRequest,
    addQueryParam,
    updateQueryParam,
    clearQueryParams,
    deleteQueryParam,
    toggleQueryParam,
  } = useCollectionActions();

  const queryParams = useCollectionStore((state) => selectRequest(state).queryParams);

  const request = useCollectionStore(selectRequest);
  const requestUrl = request?.url;

  const { queryParams: queryParamsFromUrl } = getQueryParamsFromUrl(requestUrl);

  useEffect(() => {
    if (isActiveStateUpdating) {
      const currentParams = queryParams || [];

      // if (JSON.stringify(queryParamsFromUrl) !== JSON.stringify(currentParams)) {
      //   updateRequest({ queryParams: currentParams });
      // }

      if (shallowEqual(queryParamsFromUrl, currentParams)) {
        updateRequest({ queryParams: currentParams });
      }

      setIsActiveStateUpdating(false);
    } else {
      updateRequest({ queryParams: queryParamsFromUrl });
    }
  }, [queryParamsFromUrl]);

  const buildUrl = (activeParams: TrufosQueryParam[]) => {
    try {
      const url = new URL(requestUrl);

      url.search = '';

      activeParams.forEach(({ key, value, isActive }) => {
        if (isActive && key) {
          if (typeof value === 'string') {
            url.searchParams.append(key, value);
          }
        }
      });

      return url.toString();
    } catch (error) {
      console.error('Error building URL:', error);
      return requestUrl;
    }
  };

  const handleAddQueryParam = () => {
    addQueryParam();
  };

  const handleUpdateQueryParam = (index: number, field: 'key' | 'value', value: string) => {
    const updatedParams = queryParams.map((param, i) =>
      i === index ? { ...param, [field]: value } : param
    );

    const newBuiltUrl = buildUrl(updatedParams);

    if (newBuiltUrl !== requestUrl) {
      updateRequest({ url: newBuiltUrl });
    }

    updateQueryParam(index, { [field]: value });
  };

  const handleDeleteQueryParam = (index: number) => {
    const updatedParams = queryParams.filter((_, i) => i !== index);

    const newBuiltUrl = buildUrl(updatedParams);

    if (newBuiltUrl !== requestUrl) {
      updateRequest({ url: newBuiltUrl });
    }

    deleteQueryParam(index);
  };

  const handleDeleteAllParams = () => {
    const newBuiltUrl = buildUrl([]);

    if (newBuiltUrl !== requestUrl) {
      updateRequest({ url: newBuiltUrl });
    }

    clearQueryParams();
  };

  const handleToggleQueryParam = (index: number) => {
    setIsActiveStateUpdating(true);

    const currentParams = queryParams || [];

    const updatedParams = currentParams.map((param, i) => {
      return i === index ? { ...param, isActive: !param.isActive } : param;
    });

    const newBuiltUrl = buildUrl(updatedParams);

    updateRequest({ url: newBuiltUrl });

    toggleQueryParam(index);
  };

  return (
    <div className={'p-4 h-full relative'}>
      <div className={'absolute top-[16px] right-[16px] left-[16px] z-10'}>
        <div className={'flex'}>
          <Button
            className={'gap-1 h-fit'}
            size={'sm'}
            variant={'ghost'}
            onClick={handleAddQueryParam}
          >
            <AddIcon />
            Add Query Param
          </Button>
          <Button
            className={'gap-1 h-fit'}
            size={'sm'}
            variant={'ghost'}
            onClick={handleDeleteAllParams}
          >
            <DeleteIcon />
            Delete All
          </Button>
        </div>

        <Divider className={'mt-2'} />
      </div>

      <div className="absolute top-[68px] left-[16px] bottom-[16px] right-[16px]">
        <Table className="table-auto w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-auto">Key</TableHead>
              <TableHead className="w-full">Value</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {queryParams?.map((param, index) => (
              <TableRow key={index}>
                <TableCell className="w-1/3 break-all">
                  <input
                    type="text"
                    value={param.key}
                    onChange={(e) => handleUpdateQueryParam(index, 'key', e.target.value)}
                    className="w-full bg-transparent outline-none"
                    placeholder="Enter param key"
                  />
                </TableCell>

                <TableCell className="w-full break-all">
                  <input
                    type="text"
                    value={param.value}
                    onChange={(e) => handleUpdateQueryParam(index, 'value', e.target.value)}
                    className="w-full bg-transparent outline-none"
                    placeholder="Enter param value"
                  />
                </TableCell>

                <TableCell className="w-16 text-right">
                  <div className="flex items-center justify-center gap-2">
                    <div className={'relative h-4 z-10 cursor-pointer'}>
                      <input
                        type="checkbox"
                        checked={param.isActive}
                        onChange={() => handleToggleQueryParam(index)}
                        className={cn(
                          'form-checkbox h-4 w-4 appearance-none border rounded-[2px]',
                          param.isActive
                            ? 'border-[rgba(107,194,224,1)] bg-[rgba(25,54,65,1)]'
                            : 'border-[rgba(238,238,238,1)] bg-transparent'
                        )}
                      />

                      {param.isActive && (
                        <div
                          className={
                            'absolute left-0 top-0 h-4 w-4 flex items-center justify-center pointer-events-none rotate-6'
                          }
                        >
                          <CheckedIcon
                            size={16}
                            viewBox={'0 0 16 16'}
                            color={'rgba(107,194,224,1)'}
                          />
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-transparent hover:text-[rgba(107,194,224,1)] active:text-[#12B1E7] h-6 w-6"
                      onClick={() => handleDeleteQueryParam(index)}
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
  );
};
