import React from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AuthorizationInformation } from 'shim/objects/auth';

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

export interface AuthorizationFormProps {
  config: FormComponentConfiguration;
  auth: AuthorizationInformation;
  onAuthorizationChanged: (delta: Partial<AuthorizationInformation>) => void;
  className?: string;
}

export const AuthorizationForm: React.FC<AuthorizationFormProps> = ({
  config,
  className,
  auth,
  onAuthorizationChanged,
}) => {
  const renderField = (key: string, fieldConfig: FormFieldConfig) => {
    switch (fieldConfig.type) {
      case 'label':
        return (
          <div key={key} className={fieldConfig.className}>
            <p className="text-sm text-text-primary">{fieldConfig.text}</p>
          </div>
        );

      case 'text':
      case 'password':
      case 'email': {
        const { label, placeholder } = fieldConfig;
        return (
          <div key={key} className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{label}</label>
            <Input
              type={fieldConfig.type}
              value={auth[key as keyof AuthorizationInformation]}
              onChange={(e) => onAuthorizationChanged({ [key]: e.target.value })}
              placeholder={placeholder}
              className="w-full rounded-md border border-border bg-background-primary px-3 py-2 text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        );
      }

      case 'number': {
        const { label, placeholder } = fieldConfig;
        return (
          <div key={key} className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{label}</label>
            <Input
              type="number"
              value={auth[key as keyof AuthorizationInformation]}
              onChange={(e) => onAuthorizationChanged({ [key]: e.target.valueAsNumber ?? 0 })}
              placeholder={placeholder}
              className="w-full rounded-md border border-border bg-background-primary px-3 py-2 text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        );
      }

      case 'select': {
        const { label, placeholder } = fieldConfig;
        return (
          <div key={key} className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{label}</label>
            <Select
              value={auth[key as keyof AuthorizationInformation]}
              onValueChange={(value) => onAuthorizationChanged({ [key]: value })}
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
          <div key={key} className="flex items-center space-x-2">
            <Checkbox
              id={key}
              checked={auth[key as keyof AuthorizationInformation] as unknown as boolean} // TODO: fix type casting once there's a boolean field in authorization
              onCheckedChange={(checked) => onAuthorizationChanged({ [key]: checked === true })}
              className="h-4 w-4"
            />
            <label htmlFor={key} className="cursor-pointer text-sm font-medium text-text-primary">
              {label}
            </label>
          </div>
        );
      }

      case 'textarea': {
        const { label, placeholder } = fieldConfig;
        return (
          <div key={key} className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{label}</label>
            <textarea
              value={auth[key as keyof AuthorizationInformation]}
              onChange={(e) => onAuthorizationChanged({ [key]: e.target.value })}
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
    <div className={`space-y-4 ${className ?? ''}`}>
      {Object.entries(config).map(([key, fieldConfig]) => renderField(key, fieldConfig))}
    </div>
  );
};
