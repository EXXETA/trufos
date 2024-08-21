import {Button} from '../ui/button';
import {FileIcon, PlusIcon} from '@radix-ui/react-icons';
import {HttpHeaders} from "../../../shim/headers";

export type HeaderProps = {
  headers?: HttpHeaders;
}

export const Header = (props: HeaderProps) => {
  const {headers} = props;

  // TODO: appropriate logic should be provided
  return (
    <header className={'flex gap-3 mb-9'}>
      <Button className={'gap-3 px-3'} size={'sm'} variant={'ghost'}>
        <div><PlusIcon/></div>

        <span className={'leading-4'}>Create Collection</span>
      </Button>

      <Button className={'gap-3 px-3'} size={'sm'} variant={'ghost'}>
        <div><FileIcon/></div>

        <span className={'leading-4'}>Open Collection</span>
      </Button>

      <Button className={'gap-3 px-3'} size={'sm'} variant={'ghost'}>
        <div><PlusIcon/></div>

        <span className={'leading-4'}>Import Collection</span>
      </Button>
    </header>
  )
}
