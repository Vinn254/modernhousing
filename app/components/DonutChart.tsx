'use client';

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
}

export default function DonutChart({ data, size = 120, thickness = 20, centerLabel }: DonutChartProps) {
  const total = Math.max(1, data.reduce((sum, item) => sum + item.value, 0));
  const radius = (size - thickness) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Create segments as rotating circles
  const segments = data.map((item, index) => {
    const percent = item.value / total;
    const rotation = data.slice(0, index).reduce((sum, d) => sum + d.value / total, 0) * 360;
    return { ...item, percent, rotation };
  });

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        {segments.map((seg, i) => (
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
        ))}
        <circle cx={center} cy={center} r={radius - thickness / 2} fill="#fff" />
      </svg>
      {centerLabel && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '20px',
          fontWeight: 700,
          color: 'var(--ink)',
          whiteSpace: 'nowrap',
        }}>
          {centerLabel}
        </div>
      )}
    </div>
  );
}