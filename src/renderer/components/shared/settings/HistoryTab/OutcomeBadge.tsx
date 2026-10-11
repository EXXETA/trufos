import {
  getHttpStatusColorClass,
  getHttpStatusText,
} from '@/components/mainWindow/responseStatus/ResponseStatusFormatter';
import { getDurationTextInSec } from '@/util/format-util';
import { HistoryOutcomeSummary } from 'shim/history';

export interface OutcomeBadgeProps {
  outcome: HistoryOutcomeSummary;
  /** Shows the status text and the duration instead of only the status code. */
  detailed?: boolean;
}

/** Shows how a request of the history ended: its status, its error, or that it was aborted. */
export const OutcomeBadge = ({ outcome, detailed = false }: OutcomeBadgeProps) => {
  switch (outcome.type) {
    case 'response':
      return (
        <span className="flex gap-2">
          <span className={getHttpStatusColorClass(outcome.status)}>
            {detailed ? getHttpStatusText(outcome.status) : outcome.status}
          </span>
          {detailed && <span>{getDurationTextInSec(outcome.duration)}</span>}
        </span>
      );
    case 'error':
      return <span className="error truncate">{outcome.message}</span>;
    case 'aborted':
      return <span className="text-text-secondary">The request was aborted.</span>;
  }
};
