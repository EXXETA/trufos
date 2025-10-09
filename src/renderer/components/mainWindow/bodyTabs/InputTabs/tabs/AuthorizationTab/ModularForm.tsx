import { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { SecretInput } from '@/components/ui/secret-input';

export interface BaseFieldConfig<T> {
  label: string;
  placeholder?: string;
  defaultValue?: T;
}

export interface TextFieldConfig extends BaseFieldConfig<string> {
  type: 'text' | 'password' | 'email';
}

export interface NumberFieldConfig extends BaseFieldConfig<number> {
  type: 'number';
}

export interface SelectFieldConfig extends BaseFieldConfig<string> {
  type: 'select';
  options: Array<{ value: string; label: string }>;
}

export interface CheckboxFieldConfig extends BaseFieldConfig<boolean> {
  type: 'checkbox';
}

export interface TextareaFieldConfig extends BaseFieldConfig<string> {
  type: 'textarea';
  rows?: number;
}

export interface LabelFieldConfig {
  type: 'label';
  text: string;
  className?: string;
}

export type FormFieldConfig =
  | TextFieldConfig
  | NumberFieldConfig
  | SelectFieldConfig
  | CheckboxFieldConfig
  | TextareaFieldConfig
  | LabelFieldConfig;

export type FormComponentConfiguration = Record<string, FormFieldConfig>;

export interface FormProps<T extends Record<string, any>> {
  config: FormComponentConfiguration;
  data: T;
  onDataChanged: (delta: Partial<T>) => void;
  className?: string;
}

export const ModularForm = <T extends Record<string, any>>({
  config,
  className,
  data,
  onDataChanged,
}: FormProps<T>) => {
  const getValue = useCallback(
    <V,>(key: keyof T, defaultValue: V) => {
      if (data[key] == null) {
        onDataChanged({ [key]: defaultValue } as Partial<T>);
        return defaultValue;
      } else {
        return data[key] as V;
      }
    },
    [data, onDataChanged]
  );

  const renderField = (key: keyof T, fieldConfig: FormFieldConfig) => {
    switch (fieldConfig.type) {
      case 'label':
        return (
          <div key={key as string} className={fieldConfig.className}>
            <p className="text-text-primary text-sm">{fieldConfig.text}</p>
          </div>
        );

      case 'text':
      case 'email': {
        const { label, placeholder, defaultValue } = fieldConfig;
        return (
          <div key={key as string} className="space-y-2">
            <label className="text-text-primary text-sm font-medium">{label}</label>
            <Input
              type={fieldConfig.type}
              value={getValue(key, defaultValue ?? '')}
              onChange={(e) => onDataChanged({ [key]: e.target.value } as Partial<T>)}
              placeholder={placeholder}
              className="border-border bg-background-primary text-text-primary placeholder:text-text-secondary focus:ring-accent w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-hidden"
            />
          </div>
        );
      }

      case 'password': {
        const { label, placeholder, defaultValue } = fieldConfig;
        return (
          <div key={key as string} className="space-y-2">
            <label className="text-text-primary text-sm font-medium">{label}</label>
            <SecretInput
              value={getValue(key, defaultValue ?? '')}
              onChange={(e) => onDataChanged({ [key]: e.target.value } as Partial<T>)}
              placeholder={placeholder}
              className="border-border bg-background-primary text-text-primary placeholder:text-text-secondary focus:ring-accent w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-hidden"
            />
          </div>
        );
      }

      case 'number': {
        const { label, placeholder, defaultValue } = fieldConfig;
        return (
          <div key={key as string} className="space-y-2">
            <label className="text-text-primary text-sm font-medium">{label}</label>
            <Input
              type="number"
              value={getValue(key, defaultValue ?? 0)}
              onChange={(e) => onDataChanged({ [key]: e.target.valueAsNumber ?? 0 } as Partial<T>)}
              placeholder={placeholder}
              className="border-border bg-background-primary text-text-primary placeholder:text-text-secondary focus:ring-accent w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-hidden"
            />
          </div>
        );
      }

      case 'select': {
        const { label, placeholder, defaultValue } = fieldConfig;
        return (
          <div key={key as string} className="space-y-2">
            <label className="text-text-primary text-sm font-medium">{label}</label>
            <Select
              value={getValue(key, defaultValue ?? fieldConfig.options[0].value)}
              onValueChange={(value) => onDataChanged({ [key]: value } as Partial<T>)}
            >
              <SelectTrigger className="border-border bg-background-primary w-full rounded-md border px-3 py-2">
                <SelectValue placeholder={placeholder ?? `Select ${label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {fieldConfig.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      }

      case 'checkbox': {
        const { label, defaultValue } = fieldConfig;
        return (
          <div key={key as string} className="flex items-center space-x-2">
            <Checkbox
              id={key as string}
              checked={getValue(key, defaultValue ?? true)}
              onCheckedChange={(checked) =>
                onDataChanged({ [key]: checked === true } as Partial<T>)
              }
              className="h-4 w-4"
            />
            <label
              htmlFor={key as string}
              className="text-text-primary cursor-pointer text-sm font-medium"
            >
              {label}
            </label>
          </div>
        );
      }

      case 'textarea': {
        const { label, placeholder, defaultValue } = fieldConfig;
        return (
          <div key={key as string} className="space-y-2">
            <label className="text-text-primary text-sm font-medium">{label}</label>
            <textarea
              value={getValue(key, defaultValue ?? '')}
              onChange={(e) => onDataChanged({ [key]: e.target.value } as Partial<T>)}
              placeholder={placeholder}
              rows={fieldConfig.rows ?? 3}
              className="resize-vertical border-border bg-background-primary text-text-primary placeholder:text-text-secondary focus:ring-accent w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-hidden"
            />
          </div>
        );
      }

      default:
        // @ts-expect-error all field types should be covered above
        console.warn(`Unknown field type: ${fieldConfig.type}`);
        return null;
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {Object.entries(config).map(([key, fieldConfig]) => renderField(key, fieldConfig))}
    </div>
  );
};
