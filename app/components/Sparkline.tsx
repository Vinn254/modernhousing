'use client';

interface SparklineProps {
  data: number[];
  color: string;
  w?: number;
  h?: number;
}

export default function Sparkline({ data, color, w = 110, h = 36 }: SparklineProps) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ');
  const area = `${pts} ${w},${h} 0,${h}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sg-${color.replace('#','')})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {data.map((v, i) => i === data.length - 1 && (
        <circle key={i} cx={(i / (data.length - 1)) * w} cy={h - ((v - min) / range) * (h - 4) - 2} r="3" fill={color}/>
      ))}
    </svg>
  );
}