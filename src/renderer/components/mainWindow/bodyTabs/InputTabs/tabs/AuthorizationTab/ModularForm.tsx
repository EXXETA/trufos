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

/** The values of a form, by field key. */
export type FormData = Readonly<Record<string, unknown>>;

/** A change of one field of a form. */
export type FormDelta = Record<string, string | number | boolean>;

export interface FormProps {
  config: FormComponentConfiguration;
  /** The values to show. Every field is expected to have a value of its type. */
  data: FormData;
  onDataChanged: (delta: FormDelta) => void;
  className?: string;
}

export const ModularForm = ({ config, className, data, onDataChanged }: FormProps) => {
  const getString = (key: string) => {
    const value = data[key];
    return typeof value === 'string' ? value : '';
  };
  const getNumber = (key: string) => {
    const value = data[key];
    return typeof value === 'number' ? value : 0;
  };
  const getBoolean = (key: string) => data[key] === true;

  const renderField = (key: string, fieldConfig: FormFieldConfig) => {
    switch (fieldConfig.type) {
      case 'label':
        return (
          <div key={key} className={fieldConfig.className}>
            <p className="text-text-primary text-sm">{fieldConfig.text}</p>
          </div>
        );

      case 'text':
      case 'email': {
        const { label, placeholder } = fieldConfig;
        return (
          <div key={key} className="space-y-2">
            <label className="text-text-primary text-sm font-medium">{label}</label>
            <Input
              type={fieldConfig.type}
              value={getString(key)}
              onChange={(e) => onDataChanged({ [key]: e.target.value })}
              placeholder={placeholder}
              className="border-border bg-background-primary text-text-primary placeholder:text-text-secondary focus:ring-accent w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-hidden"
            />
          </div>
        );
      }

      case 'password': {
        const { label, placeholder } = fieldConfig;
        return (
          <div key={key} className="space-y-2">
            <label className="text-text-primary text-sm font-medium">{label}</label>
            <SecretInput
              value={getString(key)}
              onChange={(e) => onDataChanged({ [key]: e.target.value })}
              placeholder={placeholder}
              className="border-border bg-background-primary text-text-primary placeholder:text-text-secondary focus:ring-accent w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-hidden"
            />
          </div>
        );
      }

      case 'number': {
        const { label, placeholder } = fieldConfig;
        return (
          <div key={key} className="space-y-2">
            <label className="text-text-primary text-sm font-medium">{label}</label>
            <Input
              type="number"
              value={getNumber(key)}
              onChange={(e) => onDataChanged({ [key]: e.target.valueAsNumber ?? 0 })}
              placeholder={placeholder}
              className="border-border bg-background-primary text-text-primary placeholder:text-text-secondary focus:ring-accent w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-hidden"
            />
          </div>
        );
      }

      case 'select': {
        const { label, placeholder } = fieldConfig;
        return (
          <div key={key} className="space-y-2">
            <label className="text-text-primary text-sm font-medium">{label}</label>
            <Select
              value={getString(key)}
              onValueChange={(value) => onDataChanged({ [key]: value })}
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
        const { label } = fieldConfig;
        return (
          <div key={key} className="flex items-center space-x-2">
            <Checkbox
              id={key}
              checked={getBoolean(key)}
              onCheckedChange={(checked) => onDataChanged({ [key]: checked === true })}
              className="h-4 w-4"
            />
            <label htmlFor={key} className="text-text-primary cursor-pointer text-sm font-medium">
              {label}
            </label>
          </div>
        );
      }

      case 'textarea': {
        const { label, placeholder } = fieldConfig;
        return (
          <div key={key} className="space-y-2">
            <label className="text-text-primary text-sm font-medium">{label}</label>
            <textarea
              value={getString(key)}
              onChange={(e) => onDataChanged({ [key]: e.target.value })}
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
