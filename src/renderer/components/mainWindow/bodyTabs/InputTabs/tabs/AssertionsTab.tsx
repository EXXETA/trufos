import { Button } from '@/components/ui/button';
import { AddIcon, DeleteIcon } from '@/components/icons';
import { ActiveCheckbox } from '@/components/shared/ActiveCheckbox';
import { Divider } from '@/components/shared/Divider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  selectAssertions,
  useCollectionActions,
  useCollectionStore,
} from '@/state/collectionStore';
import { Assertion, AssertionOperator, AssertionType } from 'shim/objects/assertion';

const typeLabels: Record<AssertionType, string> = {
  [AssertionType.STATUS_CODE]: 'Status',
  [AssertionType.RESPONSE_TIME]: 'Time',
  [AssertionType.HEADER]: 'Header',
  [AssertionType.JSON_PATH]: 'JSON Path',
};

const operatorLabels: Record<AssertionOperator, string> = {
  [AssertionOperator.EQUALS]: 'Equals',
  [AssertionOperator.IN_RANGE]: 'In range',
  [AssertionOperator.BELOW]: 'Below',
  [AssertionOperator.PRESENT]: 'Present',
  [AssertionOperator.CONTAINS]: 'Contains',
  [AssertionOperator.EXISTS]: 'Exists',
};

const operatorsByType: Record<AssertionType, AssertionOperator[]> = {
  [AssertionType.STATUS_CODE]: [AssertionOperator.EQUALS, AssertionOperator.IN_RANGE],
  [AssertionType.RESPONSE_TIME]: [AssertionOperator.BELOW],
  [AssertionType.HEADER]: [
    AssertionOperator.PRESENT,
    AssertionOperator.EQUALS,
    AssertionOperator.CONTAINS,
  ],
  [AssertionType.JSON_PATH]: [
    AssertionOperator.EXISTS,
    AssertionOperator.EQUALS,
    AssertionOperator.CONTAINS,
  ],
};

const defaultOperatorByType: Record<AssertionType, AssertionOperator> = {
  [AssertionType.STATUS_CODE]: AssertionOperator.EQUALS,
  [AssertionType.RESPONSE_TIME]: AssertionOperator.BELOW,
  [AssertionType.HEADER]: AssertionOperator.PRESENT,
  [AssertionType.JSON_PATH]: AssertionOperator.EXISTS,
};

export const AssertionsTab = (): React.ReactNode => {
  const { addAssertion, deleteAssertion, updateAssertion, setAssertionActive } =
    useCollectionActions();
  const assertions = useCollectionStore(selectAssertions);

  return (
    <div className="relative h-full p-4">
      <div className="absolute top-4 right-4 left-4 z-10">
        <Button
          className="h-fit gap-1 hover:bg-transparent"
          size="sm"
          variant="ghost"
          onClick={addAssertion}
        >
          <AddIcon />
          Add Assertion
        </Button>

        <Divider className="mt-2" />
      </div>

      <div className="absolute top-[68px] right-4 bottom-4 left-4 overflow-auto">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" />
              <TableHead className="w-36">Type</TableHead>
              <TableHead className="w-36">Check</TableHead>
              <TableHead className="w-1/3">Target</TableHead>
              <TableHead className="w-1/3">Expected</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {assertions.map((assertion, index) => (
              <AssertionRow
                key={assertion.id}
                assertion={assertion}
                index={index}
                onDelete={deleteAssertion}
                onUpdate={updateAssertion}
                onActiveChange={setAssertionActive}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

interface AssertionRowProps {
  assertion: Assertion;
  index: number;
  onDelete(index: number): void;
  onUpdate(index: number, assertion: Partial<Assertion>): void;
  onActiveChange(index: number, active?: boolean): void;
}

function AssertionRow({
  assertion,
  index,
  onDelete,
  onUpdate,
  onActiveChange,
}: Readonly<AssertionRowProps>): React.ReactNode {
  const handleTypeChange = (type: AssertionType): void => {
    onUpdate(index, {
      type,
      operator: defaultOperatorByType[type],
      target: getDefaultTarget(type, assertion.target),
      expected: getDefaultExpected(type, assertion.expected),
    });
  };

  return (
    <TableRow>
      <TableCell>
        <ActiveCheckbox
          checked={assertion.isActive}
          onChange={(active) => onActiveChange(index, active)}
        />
      </TableCell>

      <TableCell>
        <Select
          value={assertion.type}
          onValueChange={(value) => handleTypeChange(value as AssertionType)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(AssertionType).map((type) => (
              <SelectItem key={type} value={type}>
                {typeLabels[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      <TableCell>
        <Select
          value={assertion.operator}
          onValueChange={(value) => onUpdate(index, { operator: value as AssertionOperator })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operatorsByType[assertion.type].map((operator) => (
              <SelectItem key={operator} value={operator}>
                {operatorLabels[operator]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      <TableCell>
        {usesTarget(assertion.type) && (
          <input
            className="w-full bg-transparent outline-hidden"
            placeholder={getTargetPlaceholder(assertion.type)}
            value={assertion.target ?? ''}
            onChange={(event) => onUpdate(index, { target: event.target.value })}
          />
        )}
      </TableCell>

      <TableCell>
        {usesExpected(assertion.operator) && (
          <div className="flex items-center gap-1">
            <input
              className="w-full bg-transparent outline-hidden"
              placeholder={getExpectedPlaceholder(assertion)}
              value={assertion.expected ?? ''}
              onChange={(event) => onUpdate(index, { expected: event.target.value })}
            />
            {assertion.type === AssertionType.RESPONSE_TIME && (
              <span className="text-text-secondary shrink-0 text-xs">ms</span>
            )}
          </div>
        )}
      </TableCell>

      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon"
          className="hover:text-accent-primary active:text-accent-secondary h-6 w-6 hover:bg-transparent"
          onClick={() => onDelete(index)}
        >
          <DeleteIcon />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function usesTarget(type: AssertionType): boolean {
  return type === AssertionType.HEADER || type === AssertionType.JSON_PATH;
}

function usesExpected(operator: AssertionOperator): boolean {
  return operator !== AssertionOperator.PRESENT && operator !== AssertionOperator.EXISTS;
}

function getDefaultTarget(type: AssertionType, current: string | undefined): string | undefined {
  if (!usesTarget(type)) return undefined;
  return current ?? (type === AssertionType.JSON_PATH ? '$.' : '');
}

function getDefaultExpected(type: AssertionType, current: string | undefined): string | undefined {
  if (type === AssertionType.STATUS_CODE) return current ?? '200';
  if (type === AssertionType.RESPONSE_TIME) return current ?? '500';
  return current;
}

function getTargetPlaceholder(type: AssertionType): string {
  if (type === AssertionType.HEADER) return 'content-type';
  if (type === AssertionType.JSON_PATH) return '$.data.id';
  return '';
}

function getExpectedPlaceholder(assertion: Assertion): string {
  if (assertion.type === AssertionType.STATUS_CODE) return '200 or 200-299';
  if (assertion.type === AssertionType.RESPONSE_TIME) return '500';
  return 'Expected value';
}
