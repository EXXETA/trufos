import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthorizationTab } from './AuthorizationTab';
import { CollectionStoreProvider, createCollectionStore } from '@/state/collectionStore';
import { FakeCollectionMain, makeCollection, makeRequest } from '@/__mocks__/fake-collection-main';
import { normalizeCollection } from 'shim/collection-model';
import {
  AuthorizationType,
  OAuth2ClientAuthenticationMethod,
  OAuth2ClientAuthorizationCodeFlowInformation,
  OAuth2Method,
} from 'shim/objects/auth';

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: { instance: {} },
}));

vi.mock('@/lib/ipc-stream', () => ({
  IpcPushStream: { open: vi.fn() },
}));

vi.mock('@/error/errorHandler', () => ({
  showError: vi.fn(),
}));

describe('AuthorizationTab', () => {
  it('does not change a saved request whose authorization lacks optional fields', () => {
    // state and cache are optional and missing
    const auth: OAuth2ClientAuthorizationCodeFlowInformation = {
      type: AuthorizationType.OAUTH2,
      method: OAuth2Method.AUTHORIZATION_CODE,
      issuerUrl: '',
      clientId: 'client',
      clientSecret: '',
      tokenUrl: '',
      scope: '',
      clientAuthenticationMethod: OAuth2ClientAuthenticationMethod.BASIC_AUTH,
      authorizationUrl: '',
      callbackUrl: '',
    };
    const main = new FakeCollectionMain(
      normalizeCollection(makeCollection('col', [makeRequest('r1', 'col', { auth })]))
    );
    const { store, replica } = createCollectionStore(
      structuredClone(main.model),
      main.dispatch,
      main.getCollectionState
    );
    main.onEvent((event) => replica.receive(event));
    store.setState({ selectedRequestId: 'r1' });

    render(
      <CollectionStoreProvider value={store}>
        <AuthorizationTab />
      </CollectionStoreProvider>
    );

    const cache = screen.getByRole('checkbox', { name: 'Keep Browser Session Cache' });
    expect(cache.getAttribute('aria-checked')).toBe('true');
    expect(main.received).toEqual([]);
    expect(store.getState().requests.get('r1')).toEqual(makeRequest('r1', 'col', { auth }));
  });
});
