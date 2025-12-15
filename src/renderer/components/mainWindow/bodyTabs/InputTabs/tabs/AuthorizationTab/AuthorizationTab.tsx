import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import {
  AuthorizationInformation,
  AuthorizationType,
  OAuth2AuthorizationInformation,
  OAuth2ClientAuthenticationMethod,
  OAuth2Method,
  OAuth2PKCECodeChallengeMethod,
} from 'shim/objects';
import { useMemo } from 'react';
import { ModularForm, FormComponentConfiguration } from './ModularForm';

const AUTHORIZATION_NONE = 'none' as const;
type AuthorizationTypeOrNone = AuthorizationType | typeof AUTHORIZATION_NONE;

const LABELS: { [K in AuthorizationTypeOrNone]: string } = {
  [AUTHORIZATION_NONE]: 'None',
  [AuthorizationType.INHERIT]: 'Inherit from collection',
  [AuthorizationType.BEARER]: 'Bearer Token',
  [AuthorizationType.BASIC]: 'Basic Auth',
  [AuthorizationType.OAUTH2]: 'OAuth 2.0',
};

const BASE_FORM = {
  type: {
    type: 'select' as const,
    label: 'Authorization Type',
    options: Object.entries(LABELS).map(([value, label]) => ({ value, label })),
    defaultValue: AUTHORIZATION_NONE,
  },
};

const FORMS: { [K in AuthorizationTypeOrNone]: FormComponentConfiguration } = {
  [AUTHORIZATION_NONE]: {
    ...BASE_FORM,
    description: {
      type: 'label',
      text: 'No authorization will be applied to this request.',
    },
  },
  [AuthorizationType.INHERIT]: {
    ...BASE_FORM,
    description: {
      type: 'label',
      text: 'This request will inherit authorization settings from the collection.',
    },
  },
  [AuthorizationType.BEARER]: {
    ...BASE_FORM,
    token: {
      type: 'text',
      label: 'Token',
      placeholder: 'Enter bearer token',
    },
  },
  [AuthorizationType.BASIC]: {
    ...BASE_FORM,
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
    ...BASE_FORM,
    method: {
      type: 'select',
      label: 'OAuth 2.0 Method',
      options: [
        { value: OAuth2Method.CLIENT_CREDENTIALS, label: 'Client Credentials' },
        { value: OAuth2Method.AUTHORIZATION_CODE, label: 'Authorization Code' },
        { value: OAuth2Method.AUTHORIZATION_CODE_PKCE, label: 'Authorization Code with PKCE' },
      ],
      defaultValue: OAuth2Method.CLIENT_CREDENTIALS,
    },
  },
};

const OAUTH2_BASE_FORM: FormComponentConfiguration = {
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
  issuerUrl: {
    type: 'text',
    label: 'Issuer URL',
    placeholder: 'https://example.com/oauth2/issuer',
  },
  tokenUrl: {
    type: 'text',
    label: 'Token URL',
    placeholder: 'https://example.com/oauth2/token',
  },
  scope: {
    type: 'text',
    label: 'Scope',
    placeholder: '(optional, space-separated)',
  },
  clientAuthenticationMethod: {
    type: 'select',
    label: 'Client Authentication Method',
    options: [
      {
        value: OAuth2ClientAuthenticationMethod.BASIC_AUTH,
        label: 'Send Credentials as Basic Auth Header',
      },
      {
        value: OAuth2ClientAuthenticationMethod.REQUEST_BODY,
        label: 'Send Credentials in Request Body',
      },
    ],
    defaultValue: OAuth2ClientAuthenticationMethod.BASIC_AUTH,
  },
};

const OAUTH2_FORMS: { [K in OAuth2Method]: FormComponentConfiguration } = {
  [OAuth2Method.CLIENT_CREDENTIALS]: {
    ...OAUTH2_BASE_FORM,
  },
  [OAuth2Method.AUTHORIZATION_CODE]: {
    ...OAUTH2_BASE_FORM,
    authorizationUrl: {
      type: 'text',
      label: 'Authorization URL',
      placeholder: 'https://example.com/oauth2/authorize',
    },
    callbackUrl: {
      type: 'text',
      label: 'Callback URL',
      placeholder: 'https://example.com/oauth2/callback',
    },
    state: {
      type: 'text',
      label: 'State',
      placeholder: 'Enter state (optional, will be generated if empty)',
    },
    cache: {
      type: 'checkbox',
      label: 'Keep Browser Session Cache',
      defaultValue: true,
    },
  },
  [OAuth2Method.AUTHORIZATION_CODE_PKCE]: {
    ...OAUTH2_BASE_FORM,
    authorizationUrl: {
      type: 'text',
      label: 'Authorization URL',
      placeholder: 'https://example.com/oauth2/authorize',
    },
    callbackUrl: {
      type: 'text',
      label: 'Callback URL',
      placeholder: 'https://example.com/oauth2/callback',
    },
    codeChallengeMethod: {
      type: 'select',
      label: 'Code Challenge Method',
      options: [
        {
          value: OAuth2PKCECodeChallengeMethod.S256,
          label: 'S256 (Recommended)',
        },
        {
          value: OAuth2PKCECodeChallengeMethod.PLAIN,
          label: 'Plain',
        },
      ],
      defaultValue: OAuth2PKCECodeChallengeMethod.S256,
    },
    codeVerifier: {
      type: 'text',
      label: 'Code Verifier',
      placeholder: 'Enter code verifier (optional, will be generated if empty)',
    },
    state: {
      type: 'text',
      label: 'State',
      placeholder: 'Enter state (optional, will be generated if empty)',
    },
    cache: {
      type: 'checkbox',
      label: 'Keep Browser Session Cache',
      defaultValue: true,
    },
  },
};

export const AuthorizationTab = () => {
  const { updateAuthorization } = useCollectionActions();
  const request = useCollectionStore(selectRequest);
  const auth = useCollectionStore((state) => selectRequest(state).auth);

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
  }, [auth?.type, (auth as OAuth2AuthorizationInformation)?.method]);

  return (
    <div className="relative h-full p-4">
      <div className="absolute top-[16px] right-[16px] left-[16px] z-10 space-y-4 pb-4">
        <ModularForm
          config={form}
          data={{ ...auth, type }}
          onDataChanged={(
            delta: Partial<AuthorizationInformation> | { type: typeof AUTHORIZATION_NONE }
          ) => updateAuthorization(request, delta.type === AUTHORIZATION_NONE ? null : delta)}
        />
      </div>
    </div>
  );
};
