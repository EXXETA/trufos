import { Input } from "@/components/ui/input"
import { cn } from '@/lib/utils';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';

interface SidebarSearchProps {
  style?: object
}

export const SidebarSearch = ({style}: SidebarSearchProps) => {
  return (
    <div className={'w-full'} style={style}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon />
        </div>

        <Input className={cn('rounded pl-8 pr-1')} type="text" placeholder="Search for requests" />
      </div>
    </div>
  )
}
