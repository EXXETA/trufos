import {
  Eye,
  FileText,
  FolderOpen,
  Globe,
  KeyRound,
  type LucideIcon,
  PencilLine,
  Puzzle,
  Terminal,
} from 'lucide-react';
import {
  type PluginInfo,
  type PluginPermission,
  PluginPermissionAccess,
  PluginPermissionScope,
} from 'shim/plugin';
import { selectPlugins, usePluginActions, usePluginStore } from '@/state/pluginStore';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

/** What a permission allows a plugin to do, in words, and whether that reaches beyond the app. */
interface PermissionInfo {
  label: string;
  icon: LucideIcon;
  external?: boolean;
}

/** @returns what the permission allows a plugin to do */
function describePermission(permission: PluginPermission): PermissionInfo {
  switch (permission.scope) {
    case PluginPermissionScope.COLLECTION:
      return permission.value === PluginPermissionAccess.READ
        ? { label: 'Read the open collection', icon: Eye }
        : { label: 'Change the open collection', icon: PencilLine };
    case PluginPermissionScope.BODIES:
      return { label: 'Read request and response bodies', icon: FileText };
    case PluginPermissionScope.FS:
      // the host does not limit a plugin to the file area of its permission yet
      return { label: 'Access any file on your computer', icon: FolderOpen };
    case PluginPermissionScope.SECRETS:
      return { label: 'Store its own secrets', icon: KeyRound };
    case PluginPermissionScope.NETWORK:
      return { label: `Connect to ${permission.value}`, icon: Globe, external: true };
    case PluginPermissionScope.EXEC:
      return { label: `Run the program ${permission.value}`, icon: Terminal, external: true };
  }
}

const PermissionPill = ({ label, icon: Icon, external }: PermissionInfo) => {
  return (
    <li>
      <Badge variant={external ? 'warning' : 'neutral'}>
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {label}
      </Badge>
    </li>
  );
};

const PluginEntry = ({ plugin }: { plugin: PluginInfo }) => {
  const { setEnabled } = usePluginActions();
  const titleId = `plugin-${plugin.id}-title`;
  // different permissions can read the same, which says nothing more to the user
  const permissions = [
    ...new Map(
      plugin.permissions.map((permission) => {
        const info = describePermission(permission);
        return [info.label, info];
      })
    ).values(),
  ];

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        'border-border bg-card flex gap-4 rounded-lg border p-4',
        plugin.error !== undefined && 'border-danger/40'
      )}
    >
      {/* the checkbox stays outside, so a disabled plugin is dimmed but its toggle is not */}
      <div className={cn('flex min-w-0 flex-1 gap-4', !plugin.enabled && 'opacity-50')}>
        <div className="bg-accent-primary/10 text-accent-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Puzzle className="size-5" aria-hidden />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h4 id={titleId} className="text-text-primary text-sm font-medium">
              {plugin.name}
            </h4>
            <Badge className="tabular-nums">{plugin.version}</Badge>
          </div>
          {plugin.description !== '' && (
            <p className="text-text-secondary text-sm">{plugin.description}</p>
          )}
          {permissions.length === 0 ? (
            <span className="text-text-secondary text-xs">Needs no permissions.</span>
          ) : (
            <ul aria-label="Permissions" className="flex flex-wrap gap-1.5">
              {permissions.map((permission) => (
                <PermissionPill key={permission.label} {...permission} />
              ))}
            </ul>
          )}
          {plugin.error !== undefined && <Alert variant="danger">{plugin.error}</Alert>}
        </div>
      </div>

      <label className="text-text-secondary flex h-fit shrink-0 cursor-pointer items-center gap-2 text-xs">
        <Checkbox
          aria-label={`Enable ${plugin.name}`}
          checked={plugin.enabled}
          onCheckedChange={(checked) => setEnabled(plugin.id, checked === true)}
        />
        Enabled
      </label>
    </article>
  );
};

/** Lists the plugins and lets the user enable or disable them. */
export const AppPluginsTab = () => {
  const plugins = usePluginStore(selectPlugins);

  return (
    <div className="flex flex-col gap-6 p-4">
      <div>
        <h3 className="text-text-primary text-sm font-medium">Plugins</h3>
        <p className="text-text-secondary mt-1 text-sm">
          Plugins add importers and exporters to Trufos. Each one lists the permissions it asks for.
          Turning a plugin off takes effect immediately.
        </p>
      </div>

      {plugins.length === 0 ? (
        <div className="border-border text-text-secondary flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-sm">
          <Puzzle className="size-6" aria-hidden />
          No plugins are installed.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {plugins.map((plugin) => (
            <PluginEntry key={plugin.id} plugin={plugin} />
          ))}
        </div>
      )}
    </div>
  );
};
