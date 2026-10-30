import { useEffect, useRef, useState } from 'react';
import { showError } from '@/error/errorHandler';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { AuthorizationInformation, AuthorizationType, getMethod, OAuth2Method } from 'shim/objects';
import type { FormDelta } from './ModularForm';

export interface OAuth2Discovery {
  isDiscovering: boolean;
  discover: () => Promise<void>;
}

/**
 * Fills in the endpoints of an OAuth 2.0 authorization from its issuer URL. A discovery is obsolete
 * once the issuer changes or the editor is gone: its outcome is dropped and another one can start.
 * Any other change is kept, as the result applies to the latest authorization.
 * @param auth the authorization
 * @param onDataChanged receives the discovered endpoints
 */
export function useOAuth2Discovery(
  auth: AuthorizationInformation | undefined,
  onDataChanged: (delta: FormDelta) => void
): OAuth2Discovery {
  const issuerUrl = auth?.type === AuthorizationType.OAUTH2 ? auth.issuerUrl : undefined;
  const [isDiscovering, setIsDiscovering] = useState(false);
  const latest = useRef({ auth, onDataChanged });
  const currentRun = useRef<object>(undefined);

  useEffect(() => {
    latest.current = { auth, onDataChanged };
  });
  useEffect(
    () => () => {
      currentRun.current = undefined;
      setIsDiscovering(false);
    },
    [issuerUrl]
  );

  const discover = async () => {
    if (issuerUrl == null) return;
    const run = (currentRun.current = {});
    setIsDiscovering(true);
    const result = await RendererEventService.instance.discoverOAuth2Endpoints(issuerUrl).then(
      (endpoints) => ({ endpoints }),
      (error: unknown) => ({ error })
    );
    if (currentRun.current !== run) return;
    setIsDiscovering(false);

    if ('error' in result) {
      showError('Could not discover the endpoints', result.error);
      return;
    }
    const { endpoints } = result;
    const needsAuthorizationUrl =
      getMethod(latest.current.auth) !== OAuth2Method.CLIENT_CREDENTIALS;
    if (needsAuthorizationUrl && endpoints.authorizationUrl == null) {
      showError(
        'The server does not publish an authorization endpoint, which this grant type needs.',
        new Error(`No authorization endpoint found for ${issuerUrl}`)
      );
      return;
    }
    // the authorization of the client credentials flow drops the authorization URL
    latest.current.onDataChanged({ ...endpoints });
  };

  return { isDiscovering, discover };
}
