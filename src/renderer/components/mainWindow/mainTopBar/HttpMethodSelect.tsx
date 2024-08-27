import * as React from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RequestMethod } from 'shim/requestMethod';
import {httpMethodColor} from "@/services/StyleHelper";

interface HttpMethodSelectProps {
  selectedHttpMethod: RequestMethod;
  onHttpMethodChange: (method: RequestMethod) => void;
}

export const HttpMethodSelect: React.FC<HttpMethodSelectProps> = ({ selectedHttpMethod, onHttpMethodChange }) => {
  const httpMethodSelectRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (httpMethodSelectRef.current) {
      httpMethodSelectRef.current.className = httpMethodColor(selectedHttpMethod);
    }
  }, [selectedHttpMethod]);

  return (
    <Select defaultValue={selectedHttpMethod} onValueChange={onHttpMethodChange}>
      <SelectTrigger className="w-[100px] rounded-bl rounded-tl">
        <SelectValue ref={httpMethodSelectRef}>{selectedHttpMethod}</SelectValue>
      </SelectTrigger>
      <SelectContent className="ml-2">
        <SelectGroup>
          {Object.entries(RequestMethod).map(([key, value]) => (
            <SelectItem key={key} value={value} className={httpMethodColor(value)}>{value}</SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};
