import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Divider } from '@/components/shared/Divider';
import { SidebarSearch } from '@/components/sidebar/SidebarSearch';
import { FooterBar } from '@/components/sidebar/FooterBar';
import { AddIcon } from '@/components/icons';

export const Sidebar = () => {
  const [ isExpanded, setIsExpanded ] = useState(false);

  return (
    <div>
      <div className={'flex flex-col gap-6 p-6 min-w-80 max-w-80 h-screen bg-card'}>
        <div className='flex w-full max-w-sm items-center space-x-[24px]'>
          <SidebarSearch style={{
            width: isExpanded ? '36px' : '100%',
            transition: 'width 240ms ease'
          }} />

          <Button
            className={cn('flex min-w-[36px] h-[36px] p-0 items-center justify-center ')}
            type='button'
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
            style={{
              width: isExpanded ? '100%' : '36px',
              transition: 'width 240ms ease'
            }}
          >

            <div className={cn('m-2')}>
              <AddIcon size={24} color={'black'} />
            </div>

            <span className='overflow-hidden'>Create New Request</span>
          </Button>
        </div>

        <Divider />

      </div>
      <FooterBar/>
  </div>
  );
};
