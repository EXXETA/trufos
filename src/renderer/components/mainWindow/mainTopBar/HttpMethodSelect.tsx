import { FC, useEffect, useRef, useCallback } from 'react';
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
    <Select defaultValue={selectedHttpMethod} onValueChange={onHttpMethodChange}>
      <SelectTrigger className="w-[100px] rounded-bl rounded-tl">
        <SelectValue ref={httpMethodSelectRef}>{selectedHttpMethod}</SelectValue>
      </SelectTrigger>
      <SelectContent className="ml-2">
        <SelectGroup>{renderItems()}</SelectGroup>
      </SelectContent>
    </Select>
  );
};
