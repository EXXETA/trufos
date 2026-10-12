import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { HttpHeaders } from 'shim/headers';

export interface KeyValueTableProps {
  /** The rows as key/value pairs. Keys may repeat, e.g. for query parameters. */
  rows: [key: string, value: string][];
  /** The label announced by screen readers. */
  'aria-label'?: string;
}

/** Shows key/value pairs read-only, e.g. the headers of a response. */
export function KeyValueTable({ rows, 'aria-label': ariaLabel }: KeyValueTableProps) {
  return (
    <Table className="w-full table-auto" aria-label={ariaLabel}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-auto">Key</TableHead>
          <TableHead className="w-full">Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(([key, value], index) => (
          <TableRow key={index}>
            <TableCell className="w-1/3">{key}</TableCell>
            <TableCell className="break-all select-text">{value}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export interface HeadersTableProps {
  headers: HttpHeaders;
  /** The label announced by screen readers. */
  'aria-label'?: string;
}

/** Shows HTTP headers read-only. Multiple values of a header are joined like in an HTTP message. */
export function HeadersTable({ headers, 'aria-label': ariaLabel }: HeadersTableProps) {
  const rows = Object.entries(headers).map(([key, value]): [string, string] => [
    key,
    Array.isArray(value) ? value.join(', ') : (value ?? ''),
  ]);
  return <KeyValueTable rows={rows} aria-label={ariaLabel} />;
}
