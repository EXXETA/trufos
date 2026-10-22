import {
  PluginFileArea,
  type PluginInfo,
  type PluginPermission,
  PluginPermissionAccess,
  PluginPermissionScope,
} from 'shim/plugin';
import { selectPlugins, usePluginActions, usePluginStore } from '@/state/pluginStore';
import { Checkbox } from '@/components/ui/checkbox';

/** @returns what the permission allows a plugin to do, in words */
function describePermission(permission: PluginPermission): string {
  switch (permission.scope) {
    case PluginPermissionScope.COLLECTION:
      return permission.value === PluginPermissionAccess.READ
        ? 'Read the open collection'
        : 'Change the open collection';
    case PluginPermissionScope.BODIES:
      return 'Read request and response bodies';
    case PluginPermissionScope.FS:
      return permission.value === PluginFileArea.COLLECTION
        ? 'Access the files of the open collection'
        : 'Ask you to pick files and folders';
    case PluginPermissionScope.SECRETS:
      return 'Store its own secrets';
    case PluginPermissionScope.NETWORK:
      return `Connect to ${permission.value}`;
    case PluginPermissionScope.EXEC:
      return `Run the program ${permission.value}`;
  }
}

const PluginEntry = ({ plugin }: { plugin: PluginInfo }) => {
  const { setEnabled } = usePluginActions();

  return (
    <div className="flex flex-col gap-1">
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-(--text-primary)">
        <Checkbox
          checked={plugin.enabled}
          onCheckedChange={(checked) => setEnabled(plugin.id, checked === true)}
        />
        <span className="font-medium">{plugin.name}</span>
        <span className="text-(--text-secondary)">{plugin.version}</span>
      </label>
      {plugin.description !== '' && (
        <span className="text-sm text-(--text-secondary)">{plugin.description}</span>
      )}
      <span className="text-sm text-(--text-secondary)">
        {plugin.permissions.length === 0
          ? 'Needs no permissions.'
          : `Permissions: ${plugin.permissions.map(describePermission).join(', ')}.`}
      </span>
      {plugin.error !== undefined && <span className="text-danger text-sm">{plugin.error}</span>}
    </div>
  );
};

/** Lists the plugins and lets the user enable or disable them. */
export const AppPluginsTab = () => {
  const plugins = usePluginStore(selectPlugins);

  return (
    <div className="flex flex-col gap-6 p-4">
      {plugins.length === 0 ? (
        <span className="text-sm text-(--text-secondary)">No plugins are installed.</span>
      ) : (
        plugins.map((plugin) => <PluginEntry key={plugin.id} plugin={plugin} />)
      )}
    </div>
  );
};
