import { FC, useEffect, useRef, useCallback, useState, JSX } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RequestMethod } from 'shim/objects/request-method';
import { httpMethodColor } from '@/services/StyleHelper';

interface HttpMethodSelectProps {
  selectedHttpMethod: RequestMethod;
  onHttpMethodChange: (method: RequestMethod) => void;
}

export const HttpMethodSelect: FC<HttpMethodSelectProps> = ({
  selectedHttpMethod,
  onHttpMethodChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const httpMethodSelectRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (httpMethodSelectRef.current) {
      httpMethodSelectRef.current.className = httpMethodColor(selectedHttpMethod);
    }
  }, [httpMethodSelectRef?.current, selectedHttpMethod]);

  const renderItems = useCallback(() => {
    const items = [] as JSX.Element[];
    for (const method of Object.values(RequestMethod)) {
      if (method === RequestMethod.OPTIONS) {
        items.push(<SelectSeparator key="separator" />);
      }
      items.push(
        <SelectItem key={method} value={method} className={httpMethodColor(method)}>
          {method}
        </SelectItem>
      );
    }
    return items;
  }, []);

  return (
    <Select
      defaultValue={selectedHttpMethod}
      onValueChange={onHttpMethodChange}
      onOpenChange={setIsOpen}
      open={isOpen}
    >
      <SelectTrigger
        className={`border ${isOpen ? 'rounded-bl-none rounded-tl-3xl border-accent-primary' : 'rounded-l-full border-border'} ease min-w-[102px] p-[8px_8px_8px_16px] transition-colors duration-300`}
        isOpen={isOpen}
      >
        <SelectValue ref={httpMethodSelectRef}>
          <div className="mr-2">{selectedHttpMethod}</div>
        </SelectValue>
      </SelectTrigger>

      <SelectContent className="mt-0 max-h-full rounded-t-none data-[side=bottom]:translate-y-0 data-[side=left]:-translate-x-0 data-[side=right]:translate-x-0 data-[side=top]:-translate-y-0">
        <SelectGroup>{renderItems()}</SelectGroup>
      </SelectContent>
    </Select>
  );
};
