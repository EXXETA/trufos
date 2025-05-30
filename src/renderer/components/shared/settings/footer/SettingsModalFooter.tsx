import { Button } from '@/components/ui/button';
import * as React from 'react';

export const SettingsModalFooter = (props: {
  save: () => Promise<void>;
  valid: boolean;
  apply: () => Promise<void>;
  cancel: () => void;
}) => {
  return (
    <div>
      <Button
        className="mt-0 mr-2 mb-0"
        onClick={props.save}
        disabled={!props.valid}
        variant={props.valid ? 'default' : 'defaultDisable'}
      >
        <span className="leading-4 font-bold">Save</span>
      </Button>
      <Button
        className="mt-0 ml-0 mr-0 mb-0"
        onClick={props.apply}
        disabled={!props.valid}
        variant={props.valid ? 'secondary' : 'secondaryDisable'}
      >
        <span className="leading-4 font-bold">Apply</span>
      </Button>
      <Button className="mt-0 mr-2 mb-0" onClick={props.cancel} variant="destructive">
        <span className="leading-4 font-bold">Cancel</span>
      </Button>
    </div>
  );
};
