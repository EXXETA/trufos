import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { AuthorizationType } from 'shim/objects/auth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';

export const AuthorizationTab = () => {
  const { updateAuthorization } = useCollectionActions();
  const request = useCollectionStore((state) => selectRequest(state));
  const auth = request?.auth;
  const [isOpen, setIsOpen] = useState(false);

  const handleAuthTypeChange = (value: string) => {
    if (!request) return;

    const authType = value as AuthorizationType;

    switch (authType) {
      case AuthorizationType.INHERIT:
        updateAuthorization(request, { type: AuthorizationType.INHERIT });
        break;
      case AuthorizationType.BEARER:
        updateAuthorization(request, {
          type: AuthorizationType.BEARER,
          token: '',
        });
        break;
      case AuthorizationType.BASIC:
        updateAuthorization(request, {
          type: AuthorizationType.BASIC,
          username: '',
          password: '',
        });
        break;
    }
  };

  const getDisplayValue = () => {
    switch (auth?.type) {
      case AuthorizationType.INHERIT:
        return 'Inherit from collection';
      case AuthorizationType.BEARER:
        return 'Bearer Token';
      case AuthorizationType.BASIC:
        return 'Basic Auth';
      default:
        return 'None';
    }
  };

  return (
    <div className="relative h-full p-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary">Authorization Type</label>
          <Select
            value={auth?.type || AuthorizationType.INHERIT}
            onValueChange={handleAuthTypeChange}
            open={isOpen}
            onOpenChange={setIsOpen}
          >
            <SelectTrigger
              className="w-full rounded-md border border-border bg-background-primary px-3 py-2"
              isOpen={isOpen}
            >
              <SelectValue placeholder="Select authorization type">{getDisplayValue()}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AuthorizationType.INHERIT}>Inherit from collection</SelectItem>
              <SelectItem value={AuthorizationType.BEARER}>Bearer Token</SelectItem>
              <SelectItem value={AuthorizationType.BASIC}>Basic Auth</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Render input fields based on auth type */}
        {auth?.type === AuthorizationType.BEARER && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">Token</label>
            <input
              type="text"
              value={auth.token || ''}
              onChange={(e) => updateAuthorization(request, { token: e.target.value })}
              className="w-full rounded-md border border-border bg-background-primary px-3 py-2 text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Enter bearer token"
            />
          </div>
        )}

        {auth?.type === AuthorizationType.BASIC && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Username</label>
              <input
                type="text"
                value={auth.username || ''}
                onChange={(e) => updateAuthorization(request, { username: e.target.value })}
                className="w-full rounded-md border border-border bg-background-primary px-3 py-2 text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Enter username"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Password</label>
              <input
                type="password"
                value={auth.password || ''}
                onChange={(e) => updateAuthorization(request, { password: e.target.value })}
                className="w-full rounded-md border border-border bg-background-primary px-3 py-2 text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Enter password"
              />
            </div>
          </div>
        )}

        {(!auth || auth.type === AuthorizationType.INHERIT) && (
          <div className="text-sm text-text-secondary">
            This request will inherit authorization settings from the collection.
          </div>
        )}
      </div>
    </div>
  );
};
