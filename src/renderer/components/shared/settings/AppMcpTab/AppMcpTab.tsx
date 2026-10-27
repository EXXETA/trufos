import { type ReactNode, useEffect, useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import {
  DEFAULT_MCP_SERVER_PORT,
  getMcpServerUrl,
  McpPermission,
  type McpServerSettings,
  type McpServerStatus,
} from 'shim/mcp';
import type { AppSettings } from 'shim/app-settings';
import type { MainProcessEventListener } from 'shim/event-service';
import { MainProcessEvent } from 'shim/event-service';
import { useAppSettingsActions, useAppSettingsStore } from '@/state/appSettingsStore';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { showError } from '@/error/errorHandler';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { SecretInput } from '@/components/ui/secret-input';
import { toast } from '@/components/ui/sonner';

const eventService = RendererEventService.instance;

/** What each permission allows, in words. Executing and editing can reveal secrets. */
const PERMISSIONS: { permission: McpPermission; label: string; description: string }[] = [
  {
    permission: McpPermission.READ,
    label: 'Read',
    description:
      'Find and read requests, environments, the history and responses, and show a request.',
  },
  {
    permission: McpPermission.EXECUTE,
    label: 'Execute',
    description: 'Send requests with the variables and authorization of the collection.',
  },
  {
    permission: McpPermission.EDIT,
    label: 'Edit',
    description:
      'Create, change, move and delete requests and folders, their bodies and scripts, and ' +
      'select the environment. Changes to requests are drafts until they are saved.',
  },
  {
    permission: McpPermission.WRITE_FILES,
    label: 'Write files',
    description: 'Save response bodies as new files anywhere on this computer.',
  },
];

const selectMcpServerSettings = (state: AppSettings): McpServerSettings => state.mcpServer;

/** @returns the status of the MCP server, kept up to date while the component is mounted */
function useMcpServerStatus(): McpServerStatus | undefined {
  const [status, setStatus] = useState<McpServerStatus>();
  useEffect(() => {
    const onChanged: MainProcessEventListener<MainProcessEvent.McpServerStatusChanged> = (
      _,
      changed
    ) => setStatus(changed);
    eventService.on(MainProcessEvent.McpServerStatusChanged, onChanged);
    eventService
      .getMcpServerStatus()
      .then(setStatus, (error) => showError('Could not get the status of the MCP server', error));
    return () =>
      void eventService.removeListener(MainProcessEvent.McpServerStatusChanged, onChanged);
  }, []);
  return status;
}

/** @returns the access token, once the server is enabled. Reading it creates it. */
function useMcpToken(enabled: boolean) {
  const [token, setToken] = useState<string>();
  useEffect(() => {
    if (!enabled) return;
    eventService
      .getMcpToken()
      .then(setToken, (error) => showError('Could not read the access token', error));
  }, [enabled]);

  const regenerate = () =>
    eventService
      .regenerateMcpToken()
      .then((newToken) => {
        setToken(newToken);
        toast.success('Access token regenerated', {
          description: 'Clients using the old token have to be configured again.',
        });
      })
      .catch((error) => showError('Could not regenerate the access token', error));

  return { token, regenerate };
}

function copy(text: string, what: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(`${what} copied`))
    .catch((error) => showError(`Could not copy the ${what.toLowerCase()}`, error));
}

const StatusBadge = ({ status }: { status?: McpServerStatus }) => {
  switch (status?.state) {
    case 'running':
      return <Badge variant="success">Running</Badge>;
    case 'error':
      return <Badge variant="danger">Error</Badge>;
    default:
      return <Badge>Stopped</Badge>;
  }
};

/** A labelled field, laid out like the other forms of the settings: the label above the input. */
const Field = ({ id, label, children }: { id: string; label: string; children: ReactNode }) => (
  <div className="space-y-1">
    <label htmlFor={id} className="text-sm font-medium">
      {label}
    </label>
    <div className="flex items-center gap-2">{children}</div>
  </div>
);

/** A read-only value with a button to copy it. */
const CopyButton = ({ value, what }: { value?: string; what: string }) => (
  <Button
    variant="secondary"
    size="sm"
    disabled={value == null}
    onClick={() => value != null && copy(value, what)}
  >
    <Copy className="size-4" aria-hidden />
    Copy
  </Button>
);

/**
 * The port input. A port is only stored once it is valid and the input lost focus. Mount it with
 * the port as key, so it starts over when the port changes elsewhere.
 */
const PortInput = ({ port, onChange }: { port: number; onChange: (port: number) => void }) => {
  const [value, setValue] = useState(String(port));
  const parsed = Number(value);
  const isValid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535;

  const commit = () => {
    if (isValid && parsed !== port) onChange(parsed);
  };

  return (
    <>
      <Field id="mcp-port" label="Port">
        <Input
          id="mcp-port"
          inputMode="numeric"
          className="w-28"
          value={value}
          placeholder={String(DEFAULT_MCP_SERVER_PORT)}
          onChange={(event) => setValue(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => event.key === 'Enter' && commit()}
        />
      </Field>
      {!isValid && <Alert variant="danger">The port must be a number from 1 to 65535.</Alert>}
    </>
  );
};

/** The settings of the MCP server agents use to work with the app. */
export const AppMcpTab = () => {
  const settings = useAppSettingsStore(selectMcpServerSettings);
  const { updateSettings } = useAppSettingsActions();
  const status = useMcpServerStatus();
  const { token, regenerate } = useMcpToken(settings.enabled);

  const update = (changes: Partial<McpServerSettings>) =>
    updateSettings({ mcpServer: { ...settings, ...changes } });
  const url = getMcpServerUrl(settings.port);
  const clientCommand = (shownToken: string) =>
    `claude mcp add --transport http trufos ${url} --header "Authorization: Bearer ${shownToken}"`;

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-text-primary text-sm font-medium">MCP Server</h3>
          <p className="text-text-secondary mt-1 text-sm">
            Lets AI agents and other MCP clients on this computer work with the open collection:
            find, read and send requests, and read the responses and the history. What they do shows
            up in the app.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="text-text-primary flex w-fit cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={settings.enabled}
              onCheckedChange={(checked) => update({ enabled: checked === true })}
            />
            Enable MCP server
          </label>
          <StatusBadge status={status} />
        </div>
        {status?.state === 'error' && <Alert variant="danger">{status.message}</Alert>}
        <PortInput key={settings.port} port={settings.port} onChange={(port) => update({ port })} />
      </div>

      {settings.enabled && (
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-text-primary text-sm font-medium">Connection</h3>
            <p className="text-text-secondary mt-1 text-sm">
              Clients send the token as <code>Authorization: Bearer &lt;token&gt;</code>.
            </p>
          </div>
          <Field id="mcp-url" label="URL">
            <Input id="mcp-url" readOnly value={url} />
            <CopyButton value={url} what="URL" />
          </Field>
          <Field id="mcp-token" label="Access token">
            <SecretInput id="mcp-token" secret readOnly value={token ?? ''} />
            <CopyButton value={token} what="Access token" />
            <Button variant="secondary" size="sm" onClick={() => void regenerate()}>
              <RefreshCw className="size-4" aria-hidden />
              Regenerate
            </Button>
          </Field>
          <Field id="mcp-command" label="Add to Claude Code">
            <Input id="mcp-command" readOnly value={clientCommand('<token>')} />
            <CopyButton value={token && clientCommand(token)} what="Command" />
          </Field>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h3 className="text-text-primary text-sm font-medium">Permissions</h3>
        {PERMISSIONS.map(({ permission, label, description }) => (
          <label key={permission} className="flex w-fit cursor-pointer items-start gap-2 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={settings.permissions[permission]}
              onCheckedChange={(checked) =>
                update({ permissions: { ...settings.permissions, [permission]: checked === true } })
              }
            />
            <span className="flex flex-col">
              <span className="text-text-primary">{label}</span>
              <span className="text-text-secondary">{description}</span>
            </span>
          </label>
        ))}
        {/* always shown, so it is no alert that is announced */}
        <Alert role="note">
          Secret variables and credentials are masked in what clients read. A client with the
          Execute and Edit permissions can still reveal them, e.g. by sending them to a server of
          its choice. Only give these permissions to clients you trust.
        </Alert>
      </div>
    </div>
  );
};
