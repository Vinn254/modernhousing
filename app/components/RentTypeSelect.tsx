'use client';

import { RENT_PAYMENT_TYPES, rentTypeDefinition } from '../../lib/rentTypes';

interface RentTypeSelectProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
}

export default function RentTypeSelect({ value, onChange, label = 'Rent payment type', disabled }: RentTypeSelectProps) {
  const definition = rentTypeDefinition(value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-2)' }}>{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        style={{ width: '100%', minWidth: 0 }}
      >
        <option value="">Select type</option>
        {RENT_PAYMENT_TYPES.map((type) => (
          <option key={type.value} value={type.value}>{type.label}</option>
        ))}
      </select>
      {definition && (
        <p style={{ fontSize: '11px', color: 'var(--ink-3)', margin: 0 }}>{definition}</p>
      )}
    </div>
  );
}
