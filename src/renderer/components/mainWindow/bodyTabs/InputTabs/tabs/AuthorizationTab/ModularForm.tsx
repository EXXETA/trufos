import { useState } from 'react';
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

export interface BaseFieldConfig {
  label: string;
  placeholder?: string;
}

export interface TextFieldConfig extends BaseFieldConfig {
  type: 'text' | 'password' | 'email';
}

export interface NumberFieldConfig extends BaseFieldConfig {
  type: 'number';
}

export interface SelectFieldConfig extends BaseFieldConfig {
  type: 'select';
  options: Array<{ value: string; label: string }>;
}

export interface CheckboxFieldConfig extends BaseFieldConfig {
  type: 'checkbox';
}

export interface TextareaFieldConfig extends BaseFieldConfig {
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

export interface FormProps<T extends Record<string, never>> {
  config: FormComponentConfiguration;
  form: T;
  onFormChanged: (delta: Partial<T>) => void;
  className?: string;
}

export const ModularForm = <T extends Record<string, never>>({
  config,
  className,
  form,
  onFormChanged,
}: FormProps<T>) => {
  const [visible, setVisible] = useState<Partial<{ [K in keyof T]: boolean }>>({});
  const toggleVisibility = (key: keyof T) => {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const renderField = (key: keyof T, fieldConfig: FormFieldConfig) => {
    switch (fieldConfig.type) {
      case 'label':
        return (
          <div key={key as string} className={fieldConfig.className}>
            <p className="text-sm text-text-primary">{fieldConfig.text}</p>
          </div>
        );

      case 'text':
      case 'email': {
        const { label, placeholder } = fieldConfig;
        return (
          <div key={key as string} className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{label}</label>
            <Input
              type={fieldConfig.type}
              value={form[key]}
              onChange={(e) => onFormChanged({ [key]: e.target.value } as Partial<T>)}
              placeholder={placeholder}
              className="w-full rounded-md border border-border bg-background-primary px-3 py-2 text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        );
      }

      case 'password': {
        const { label, placeholder } = fieldConfig;
        return (
          <div key={key as string} className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{label}</label>
            <div className="relative w-full">
              <Input
                type={visible[key] ? 'text' : 'password'}
                value={form[key]}
                onChange={(e) => onFormChanged({ [key]: e.target.value } as Partial<T>)}
                placeholder={placeholder}
                className="w-full rounded-md border border-border bg-background-primary px-3 py-2 text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="button"
                onClick={() => toggleVisibility(key)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-sm text-text-secondary hover:text-text-primary"
              >
                {visible[key] ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        );
      }

      case 'number': {
        const { label, placeholder } = fieldConfig;
        return (
          <div key={key as string} className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{label}</label>
            <Input
              type="number"
              value={form[key]}
              onChange={(e) => onFormChanged({ [key]: e.target.valueAsNumber ?? 0 } as Partial<T>)}
              placeholder={placeholder}
              className="w-full rounded-md border border-border bg-background-primary px-3 py-2 text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        );
      }

      case 'select': {
        const { label, placeholder } = fieldConfig;
        return (
          <div key={key as string} className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{label}</label>
            <Select
              value={form[key]}
              onValueChange={(value) => onFormChanged({ [key]: value } as Partial<T>)}
            >
              <SelectTrigger className="w-full rounded-md border border-border bg-background-primary px-3 py-2">
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
        const { label } = fieldConfig;
        return (
          <div key={key as string} className="flex items-center space-x-2">
            <Checkbox
              id={key as string}
              checked={form[key] as unknown as boolean} // TODO: fix type casting once there's a boolean field in authorization
              onCheckedChange={(checked) =>
                onFormChanged({ [key]: checked === true } as Partial<T>)
              }
              className="h-4 w-4"
            />
            <label
              htmlFor={key as string}
              className="cursor-pointer text-sm font-medium text-text-primary"
            >
              {label}
            </label>
          </div>
        );
      }

      case 'textarea': {
        const { label, placeholder } = fieldConfig;
        return (
          <div key={key as string} className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{label}</label>
            <textarea
              value={form[key]}
              onChange={(e) => onFormChanged({ [key]: e.target.value } as Partial<T>)}
              placeholder={placeholder}
              rows={fieldConfig.rows ?? 3}
              className="resize-vertical w-full rounded-md border border-border bg-background-primary px-3 py-2 text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
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
