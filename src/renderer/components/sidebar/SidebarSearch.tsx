import {Input} from "@/components/ui/input"
import {cn} from '@/lib/utils';
import {MagnifyingGlassIcon} from '@radix-ui/react-icons';
import {Button} from "@/components/ui/button";
import {AddIcon} from "@/components/icons";
import React, {useState} from "react";


export const SidebarSearch = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
      <div className="flex w-full max-w-sm items-center space-x-[24px]">
        <div className={'w-full'} style={{
          width: isExpanded ? '36%' : '100%',
          transition: 'width 240ms ease',
        }}>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon/>
            </div>

            <Input className={cn('rounded pl-8 pr-1')} type="text"
                   placeholder="Search for requests"/>
          </div>
        </div>
        <Button
            className={cn('flex min-w-[36px] h-[36px] p-0 items-center justify-center')}
            type="button"
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
            style={{
              width: isExpanded ? '100%' : '36px',
              transition: 'width 240ms ease',
            }}
        >
          <div className={cn('m-2')}>
            <AddIcon size={24} color={'black'}/>
          </div>
          <span className="overflow-hidden">Create New Request</span>
        </Button>
      </div>

  )
}
