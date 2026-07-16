'use client';

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  showLabels?: boolean;
}

export default function DonutChart({ data, size = 120, thickness = 20, centerLabel, showLabels = false }: DonutChartProps) {
  const total = Math.max(1, data.reduce((sum, item) => sum + item.value, 0));
  const radius = (size - thickness) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = data.map((item, index) => {
    const percent = item.value / total;
    const rotation = data.slice(0, index).reduce((sum, d) => sum + d.value / total, 0) * 360;
    return { ...item, percent, rotation };
  });

  const hasValues = total > 0 && data.some(d => d.value > 0);

  return (
    <div style={{ position: 'relative', width: size, height: showLabels ? size + 20 : size }}>
      <svg width={size} height={size}>
        {hasValues ? (
          segments.map((seg, i) => (
            <g key={i} style={{ transform: `rotate(${seg.rotation}deg)`, transformOrigin: `${center}px ${center}px` }}>
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - seg.percent)}
                strokeLinecap="round"
              />
            </g>
          ))
        ) : (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={thickness}
          />
        )}
        <circle cx={center} cy={center} r={radius - thickness / 2} fill="#fff" />
      </svg>
      {centerLabel && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: size < 80 ? '14px' : '18px',
          fontWeight: 700,
          color: 'var(--ink)',
          whiteSpace: 'nowrap',
        }}>
          {centerLabel}
        </div>
      )}
      {showLabels && (
        <div style={{ position: 'absolute', top: size, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 12, fontSize: '11px', marginTop: 4 }}>
          {data.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color, display: 'inline-block' }}></span>
              <span style={{ color: 'var(--ink-3)' }}>{item.label}: {item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}