import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { AuthorizationType } from 'shim/objects/auth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMemo, useState } from 'react';
import { ModularForm, FormComponentConfiguration } from './ModularForm';
import { OAuth2Method } from 'shim/objects/auth/oauth2';

const AUTHORIZATION_NONE = 'none' as const;
type AuthorizationTypeOrNone = AuthorizationType | typeof AUTHORIZATION_NONE;

const INITIAL_AUTHORIZATION = Object.fromEntries(
  [
    { type: AuthorizationType.INHERIT },
    { type: AuthorizationType.BEARER, token: '' },
    { type: AuthorizationType.BASIC, username: '', password: '' },
    {
      type: AuthorizationType.OAUTH2,
      method: OAuth2Method.CLIENT_CREDENTIALS,
      clientId: '',
      clientSecret: '',
      tokenUrl: '',
      scope: '',
    },
  ].map((auth) => [auth.type, auth])
);

const LABELS: { [K in AuthorizationTypeOrNone]: string } = {
  [AUTHORIZATION_NONE]: 'None',
  [AuthorizationType.INHERIT]: 'Inherit from collection',
  [AuthorizationType.BEARER]: 'Bearer Token',
  [AuthorizationType.BASIC]: 'Basic Auth',
  [AuthorizationType.OAUTH2]: 'OAuth 2.0',
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
  [AuthorizationType.OAUTH2]: {
    method: {
      type: 'select',
      label: 'OAuth 2.0 Method',
      options: [
        { value: OAuth2Method.CLIENT_CREDENTIALS, label: 'Client Credentials' },
        { value: OAuth2Method.AUTHORIZATION_CODE, label: 'Authorization Code' },
      ],
    },
  },
};

const OAUTH2_FORMS: { [K in OAuth2Method]: FormComponentConfiguration } = {
  [OAuth2Method.CLIENT_CREDENTIALS]: {
    clientId: {
      type: 'text',
      label: 'Client ID',
      placeholder: 'Enter client ID',
    },
    clientSecret: {
      type: 'password',
      label: 'Client Secret',
      placeholder: 'Enter client secret',
    },
    tokenUrl: {
      type: 'text',
      label: 'Token URL',
      placeholder: 'Enter token URL',
    },
    scope: {
      type: 'text',
      label: 'Scope',
      placeholder: 'Enter scopes (optional, space-separated)',
    },
  },
  [OAuth2Method.AUTHORIZATION_CODE]: {
    description: {
      type: 'label',
      text: 'OAuth 2.0 Authorization Code flow is not yet implemented.',
    },
  },
};

export const AuthorizationTab = () => {
  const { updateAuthorization } = useCollectionActions();
  const request = useCollectionStore(selectRequest);
  const auth = useCollectionStore((state) => selectRequest(state).auth);
  const [isTypeSelectOpen, setTypeSelectOpen] = useState(false);

  const [type, form] = useMemo(() => {
    const type = auth?.type ?? AUTHORIZATION_NONE;
    let form: FormComponentConfiguration;
    if (auth?.type === AuthorizationType.OAUTH2) {
      form = {
        ...FORMS[type],
        ...OAUTH2_FORMS[auth.method],
      };
    } else {
      form = FORMS[type];
    }
    return [type, form];
  }, [auth]);

  const handleAuthTypeChange = (value: string) =>
    updateAuthorization(request, INITIAL_AUTHORIZATION[value]);

  return (
    <div className="relative h-full p-4">
      <div className="absolute left-[16px] right-[16px] top-[16px] z-10 pb-4">
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
                <SelectValue placeholder="Select authorization type">{LABELS[type]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LABELS).map(([value, label]: [AuthorizationTypeOrNone, string]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ModularForm
            config={form}
            form={auth}
            onFormChanged={(delta) => updateAuthorization(request, delta)}
          />
        </div>
      </div>
    </div>);
};
