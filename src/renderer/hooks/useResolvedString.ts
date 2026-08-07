import { RendererEventService } from '@/services/event/renderer-event-service';
import { useEnvironmentStore } from '@/state/environmentStore';
import { selectVariables, useVariableStore } from '@/state/variableStore';
import { useEffect, useState } from 'react';

const eventService = RendererEventService.instance;

/**
 * Resolves the template variables in the given string. The string is resolved again whenever it or
 * one of the variables it may reference changes.
 *
 * @param string The string that may contain `{{ someVariable }}` templates.
 * @returns The resolved string, null if it references a variable that is not defined, or undefined
 * while the resolution is still pending.
 */
export function useResolvedString(string: string) {
  const collectionVariables = useVariableStore(selectVariables);
  const environmentVariables = useEnvironmentStore(
    (state) => state.environments[state.selectedEnvironment ?? '']?.variables
  );
  const [resolvedString, setResolvedString] = useState<string | null>();

  useEffect(() => {
    let obsolete = false;
    eventService
      .resolveVariablesInString(string)
      .then((resolvedString) => {
        if (!obsolete) setResolvedString(resolvedString);
      })
      .catch(console.error);

    return () => {
      obsolete = true;
    };
  }, [string, collectionVariables, environmentVariables]);

  return resolvedString;
}
