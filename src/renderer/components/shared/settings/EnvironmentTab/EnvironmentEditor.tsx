import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Check, X, MoreVertical, Copy, Trash2, Edit } from 'lucide-react';
import { useState, useEffect } from 'react';
import { EnvironmentMap } from 'shim/objects/environment';
import { VariableEditor } from '@/components/shared/settings/VariableTab/VariableEditor';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { VariableObjectWithKey } from 'shim/objects/variables';
import { cn } from '@/lib/utils';
import { variableArrayToMap, variableMapToArray } from '@/state/helper/variableMappers';

export interface EnvironmentEditorProps {
  environments: EnvironmentMap;
  selectedEnvironment: string | null;
  onEnvironmentsChange?: (environments: EnvironmentMap) => void;
  onEnvironmentSelect?: (environmentKey: string | null) => void;
  onValidChange?: (valid: boolean) => void;
}

export const EnvironmentEditor = ({
  environments,
  selectedEnvironment,
  onEnvironmentsChange,
  onEnvironmentSelect,
  onValidChange,
}: EnvironmentEditorProps) => {
  const [newEnvironmentName, setNewEnvironmentName] = useState('');
  const [isEnvironmentValid, setIsEnvironmentValid] = useState(true);
  const [editingEnvironment, setEditingEnvironment] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const environmentKeys = Object.keys(environments);

  const isValidEnvironmentName = (name: string) => {
    return name.trim() && !environments[name] && name.length <= 50;
  };

  useEffect(() => {
    onValidChange?.(isEnvironmentValid);
  }, [isEnvironmentValid, onValidChange]);

  const addEnvironment = () => {
    if (isValidEnvironmentName(newEnvironmentName)) {
      const updatedEnvironments = {
        ...environments,
        [newEnvironmentName]: { variables: {} },
      };
      onEnvironmentsChange?.(updatedEnvironments);

      if (!selectedEnvironment) {
        onEnvironmentSelect?.(newEnvironmentName);
      }

      setNewEnvironmentName('');
    }
  };

  const removeEnvironment = (key: string) => {
    const updatedEnvironments = { ...environments };
    delete updatedEnvironments[key];
    onEnvironmentsChange?.(updatedEnvironments);

    if (selectedEnvironment === key) {
      const remainingKeys = Object.keys(updatedEnvironments);
      onEnvironmentSelect?.(remainingKeys.length > 0 ? remainingKeys[0] : null);
    }
  };

  const updateEnvironmentVariables = (
    environmentKey: string,
    variables: VariableObjectWithKey[]
  ) => {
    if (!environments[environmentKey]) return;

    const updatedEnvironments = {
      ...environments,
      [environmentKey]: {
        ...environments[environmentKey],
        variables: variableArrayToMap(variables),
      },
    };
    onEnvironmentsChange?.(updatedEnvironments);
  };

  const renameEnvironment = (oldKey: string, newKey: string) => {
    if (newKey.trim() && !environments[newKey] && oldKey !== newKey) {
      const updatedEnvironments = { ...environments };
      updatedEnvironments[newKey] = updatedEnvironments[oldKey];
      delete updatedEnvironments[oldKey];

      onEnvironmentsChange?.(updatedEnvironments);

      if (selectedEnvironment === oldKey) {
        onEnvironmentSelect?.(newKey);
      }
    }
  };

  const copyEnvironment = (key: string) => {
    if (environments[key]) {
      let copyName = `${key} Copy`;
      let counter = 1;

      while (environments[copyName]) {
        counter++;
        copyName = `${key} Copy ${counter}`;
      }

      const updatedEnvironments = {
        ...environments,
        [copyName]: { ...environments[key] },
      };

      onEnvironmentsChange?.(updatedEnvironments);
    }
  };

  const currentEnvironmentVariables = selectedEnvironment
    ? variableMapToArray(environments[selectedEnvironment]?.variables || {})
    : [];

  const startEditing = (key: string) => {
    setEditingEnvironment(key);
    setEditingName(key);
  };

  const saveEdit = () => {
    if (
      editingEnvironment &&
      editingName.trim() &&
      editingName !== editingEnvironment &&
      !environments[editingName]
    ) {
      renameEnvironment(editingEnvironment, editingName.trim());
    }
    setEditingEnvironment(null);
    setEditingName('');
  };

  const cancelEdit = () => {
    setEditingEnvironment(null);
    setEditingName('');
  };

  return (
    <div className="flex h-full">
      {/* Left Environment Sidebar */}
      <div className="bg-backgrund flex w-80 flex-col border-r">
        {/* Header */}
        <div className="shrink-0 border-b">
          <div className="flex flex-col gap-4 p-4">
            <h3 className="font-medium text-sidebar-foreground">Environments</h3>

            <div className="relative">
              <Input
                placeholder="new environment"
                value={newEnvironmentName}
                onChange={(e) => setNewEnvironmentName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEnvironment()}
                className="h-8 w-full bg-background pr-10 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={addEnvironment}
                      disabled={!isValidEnvironmentName(newEnvironmentName)}
                      size="sm"
                      variant="ghost"
                      className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Add Environment</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        {/* Environment List */}
        <div className="flex-1 overflow-y-auto p-4">
          {environmentKeys.length === 0 ? (
            <div className="text-sidebar-muted-foreground px-2 py-8 text-center text-sm">
              No environments yet
            </div>
          ) : (
            <div className="space-y-1">
              {environmentKeys.map((key) => (
                <div
                  key={key}
                  className={cn(
                    'group flex w-full cursor-pointer items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground',
                    selectedEnvironment === key &&
                      'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                  )}
                  onClick={() => onEnvironmentSelect?.(key)}
                >
                  <div className="min-w-0 flex-1">
                    {editingEnvironment === key ? (
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            saveEdit();
                          } else if (e.key === 'Escape') {
                            cancelEdit();
                          }
                        }}
                        className="h-8 w-full bg-background text-sm shadow-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                        autoFocus
                      />
                    ) : (
                      <>
                        <div className="truncate font-medium">{key}</div>
                        <div className="text-sidebar-muted-foreground text-xs">
                          {Object.keys(environments[key].variables).length} variables
                        </div>
                      </>
                    )}
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    {editingEnvironment === key ? (
                      <div className="flex items-center gap-1">
                        <Button
                          onClick={saveEdit}
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          aria-label="Save"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          onClick={cancelEdit}
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          aria-label="Cancel"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            aria-label="More options"
                          >
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(key);
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              copyEnvironment(key);
                            }}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              removeEnvironment(key);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Variable Editor */}
      <div className="flex min-w-0 flex-1 flex-col">
        {selectedEnvironment ? (
          <>
            {/* Header */}
            <div className="shrink-0 border-b p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sidebar-foreground">
                  <span className="font-bold">{selectedEnvironment}</span>
                </h3>
              </div>
            </div>

            {/* Variable Editor */}
            <div className="flex-1 overflow-y-auto p-4">
              <VariableEditor
                variables={currentEnvironmentVariables}
                onValidChange={setIsEnvironmentValid}
                onVariablesChange={(variables) =>
                  updateEnvironmentVariables(selectedEnvironment, variables)
                }
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div className="mb-2 text-lg font-medium">
                {environmentKeys.length === 0 ? 'No Environments' : 'Select an Environment'}
              </div>
              <div className="text-sm">
                {environmentKeys.length === 0
                  ? 'Create your first environment using the sidebar'
                  : 'Choose an environment from the sidebar to manage its variables'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
