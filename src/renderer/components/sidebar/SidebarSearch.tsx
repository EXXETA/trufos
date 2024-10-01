import {cn} from '@/lib/utils';
import {Button} from "@/components/ui/button";
import {AddIcon} from "@/components/icons";
import React from "react";
import {addNewRequest} from "@/state/requestsSlice";
import {useDispatch} from "react-redux";


export const SidebarSearch = () => {
  const dispatch = useDispatch();

  function createNewRequest() {
    dispatch(addNewRequest());
  }

  return (
      <div className="flex w-full max-w-sm items-center space-x-[24px]">
        <Button
            className={cn('flex min-w-[36px] h-[36px] p-0 items-center justify-center')}
            type="button"
            style={{
              width: '100%',
            }}
            onClick={createNewRequest}
        >
          <div className={cn('m-2')}>
            <AddIcon size={24} color={'black'}/>
          </div>
          <span className="overflow-hidden">Create New Request</span>
        </Button>
      </div>

  )
}
