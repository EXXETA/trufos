import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { AuthorizationInformation, AuthorizationType } from 'shim/objects/auth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';
import { AuthorizationForm, FormComponentConfiguration } from './AuthorizationForm';

const AUTHORIZATION_NONE = 'none' as const;
type AuthorizationTypeOrNone = AuthorizationType | typeof AUTHORIZATION_NONE;

const INITIAL_AUTHORIZATION = Object.fromEntries(
  [
    { type: AuthorizationType.INHERIT },
    { type: AuthorizationType.BEARER, token: '' },
    { type: AuthorizationType.BASIC, username: '', password: '' },
  ].map((auth) => [auth.type, auth])
);

const LABELS: { [K in AuthorizationTypeOrNone]: string } = {
  [AuthorizationType.INHERIT]: 'Inherit from collection',
  [AuthorizationType.BEARER]: 'Bearer Token',
  [AuthorizationType.BASIC]: 'Basic Auth',
  [AUTHORIZATION_NONE]: 'None',
};

const FORMS: { [K in AuthorizationTypeOrNone]: FormComponentConfiguration } = {
  [AUTHORIZATION_NONE]: {
    description: {
      type: 'label',
      text: 'No authorization will be applied to this request.',
    },
  },
  [AuthorizationType.INHERIT]: {
    description: {
      type: 'label',
      text: 'This request will inherit authorization settings from the collection.',
    },
  },
  [AuthorizationType.BEARER]: {
    token: {
      type: 'text',
      label: 'Token',
      placeholder: 'Enter bearer token',
    },
  },
  [AuthorizationType.BASIC]: {
    username: {
      type: 'text',
      label: 'Username',
      placeholder: 'Enter username',
    },
    password: {
      type: 'password',
      label: 'Password',
      placeholder: 'Enter password',
    },
  },
};

export const AuthorizationTab = () => {
  const { updateAuthorization } = useCollectionActions();
  const request = useCollectionStore(selectRequest);
  const auth = useCollectionStore((state) => selectRequest(state).auth);
  const [isTypeSelectOpen, setTypeSelectOpen] = useState(false);

  const type = auth?.type ?? AUTHORIZATION_NONE;

  const handleAuthTypeChange = (value: string) =>
    updateAuthorization(request, INITIAL_AUTHORIZATION[value]);

  return (
    <div className="relative h-full p-4">
      <div className="absolute left-[16px] right-[16px] top-[16px] z-10">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">Authorization Type</label>
            <Select
              value={type}
              onValueChange={handleAuthTypeChange}
              open={isTypeSelectOpen}
              onOpenChange={setTypeSelectOpen}
            >
              <SelectTrigger
                className="w-full rounded-md border border-border bg-background-primary px-3 py-2"
                isOpen={isTypeSelectOpen}
              >
                <SelectValue placeholder="Select authorization type">
                  {LABELS[auth?.type] ?? 'None'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTHORIZATION_NONE}>None</SelectItem>
                <SelectItem value={AuthorizationType.INHERIT}>Inherit from collection</SelectItem>
                <SelectItem value={AuthorizationType.BEARER}>Bearer Token</SelectItem>
                <SelectItem value={AuthorizationType.BASIC}>Basic Auth</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <AuthorizationForm
          config={FORMS[type]}
          auth={auth}
          onAuthorizationChanged={(delta) => updateAuthorization(request, delta)}
        />
      </div>
    </div>
  );
};
