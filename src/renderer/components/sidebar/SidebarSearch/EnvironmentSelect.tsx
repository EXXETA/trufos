import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuTriggerIcon,
} from '@/components/ui/dropdown-menu';
import { CiMenuKebab } from 'react-icons/ci';
import { handleMouseEvent } from '@/util/callback-util';
import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { RendererEventService } from '@/services/event/renderer-event-service';

const rendererEventService = RendererEventService.instance;

export const EnvironmentSelect = () => {
  const [selectedEnvironmentKey, setSelectedEnvironmentKey] = useState<string>();
  const environments = useCollectionStore((state) => state.collection?.environments ?? {});

  const selectEnvironment = useCallback(async (key: string) => {
    setSelectedEnvironmentKey(key);
    await rendererEventService.selectEnvironment(key);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button>
          {selectedEnvironmentKey ?? 'Select Environment'}
          <DropdownMenuTriggerIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className={'bg-background'}>
        {Object.keys(environments).map((key, index) => (
          <DropdownMenuItem
            key={index}
            onClick={handleMouseEvent(() => selectEnvironment(key))}
            className="text-danger"
          >
            {key}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
