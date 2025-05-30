import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';

export interface SimpleSelectProps<T> {
  value: T;
  onValueChange: (value: T) => void;
  placeholder?: string;
  items: [T, string][];
}

export function SimpleSelect<T extends string>(props: SimpleSelectProps<T>) {
  const { value, onValueChange, placeholder, items } = props;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Select
      value={value}
      onValueChange={(value) => onValueChange(value as T)}
      onOpenChange={setIsOpen}
    >
      <SelectTrigger className="w-[fit-content] h-[fit-content] p-0 " isOpen={isOpen}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>

      <SelectContent>
        <SelectGroup>
          {items.map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
