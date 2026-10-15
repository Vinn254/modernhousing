'use client';

// Renders the tenancy agreement items the way the lease document itself is laid
// out: the 33 clauses as a Clause | Wording table, and Appendix 1 as a Property
// Condition Check List table with the document's own columns (condition on
// commencement, comments, condition on end of tenancy, comments) grouped by room.

import { CATEGORY_LEASE, CONDITION_COLUMNS } from '../../lib/leaseText';
import type { AgreementItem } from '../../lib/agreementPdf';

interface Props {
  items: AgreementItem[];
  /** confirm = the tenant ticks each row; readonly = review only. */
  mode?: 'confirm' | 'readonly';
  checked?: string[];
  onToggle?: (id: string) => void;
  disabled?: boolean;
}

function roomName(category: string) {
  return category.replace(/^Property Condition\s*-\s*/i, '').toUpperCase();
}

export default function AgreementItemsTable({ items, mode = 'readonly', checked = [], onToggle, disabled }: Props) {
  const sorted = [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const clauses = sorted.filter((i) => (i.category ?? '') === CATEGORY_LEASE);
  const condition = sorted.filter((i) => (i.category ?? '') !== CATEGORY_LEASE);
  const rooms = Array.from(new Set(condition.map((i) => i.category ?? 'Property Condition')));
  const isConfirm = mode === 'confirm' && !!onToggle;
  const checkedSet = new Set(checked);

  const tickCell = (item: AgreementItem) => {
    if (!isConfirm) {
      return checkedSet.has(item.id)
        ? <span className="status-pill status-active">Confirmed</span>
        : <span className="status-pill status-pending">Not confirmed</span>;
    }
    return (
      <input
        type="checkbox"
        className="agreement-tick"
        aria-label={`Confirm ${item.label}`}
        disabled={disabled}
        checked={checkedSet.has(item.id)}
        onChange={() => onToggle?.(item.id)}
      />
    );
  };

  return (
    <div className="agreement-tables">
      {clauses.length > 0 && (
        <div className="table-shell agreement-table">
          <table className="landlord-table agreement-clause-table">
            <caption className="agreement-table-caption">Lease Clauses</caption>
            <thead>
              <tr>
                <th className="agreement-col-item">Clause</th>
                <th>Agreement wording</th>
                <th className="agreement-col-tick">{isConfirm ? 'Accepted' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {clauses.map((item) => (
                <tr key={item.id} className={checkedSet.has(item.id) ? 'is-confirmed' : undefined}>
                  <td className="agreement-col-item"><strong>{item.label}</strong></td>
                  <td className="agreement-clause-body">{item.body_text}</td>
                  <td className="agreement-col-tick">{tickCell(item)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {condition.length > 0 && (
        <div className="table-shell agreement-table">
          <table className="landlord-table agreement-condition-table">
            <caption className="agreement-table-caption">Appendix 1 — Property Condition Check List</caption>
            <thead>
              <tr>
                <th className="agreement-col-item">Item</th>
                {CONDITION_COLUMNS.map((c, i) => (
                  <th key={`${c}-${i}`} className="agreement-col-condition">{c}</th>
                ))}
                <th className="agreement-col-tick">{isConfirm ? 'Confirmed' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <RoomRows
                  key={room}
                  room={room}
                  items={condition.filter((i) => (i.category ?? 'Property Condition') === room)}
                  tickCell={tickCell}
                  isConfirmed={(id) => checkedSet.has(id)}
                  columnCount={CONDITION_COLUMNS.length + 2}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {clauses.length === 0 && condition.length === 0 && (
        <p className="landlord-empty">No items selected for this agreement.</p>
      )}
    </div>
  );
}

function RoomRows({
  room,
  items,
  tickCell,
  isConfirmed,
  columnCount,
}: {
  room: string;
  items: AgreementItem[];
  tickCell: (item: AgreementItem) => React.ReactNode;
  isConfirmed: (id: string) => boolean;
  columnCount: number;
}) {
  return (
    <>
      <tr className="agreement-room-row">
        <td colSpan={columnCount}>{roomName(room)}</td>
      </tr>
      {items.map((item) => (
        <tr key={item.id} className={isConfirmed(item.id) ? 'is-confirmed' : undefined}>
          <td className="agreement-col-item"><strong>{item.label}</strong></td>
          <td className="agreement-condition-cell" />
          <td className="agreement-condition-cell" />
          <td className="agreement-condition-cell agreement-condition-cell--end" />
          <td className="agreement-condition-cell" />
          <td className="agreement-col-tick">{tickCell(item)}</td>
        </tr>
      ))}
    </>
  );
}
