'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Point {
  label: string;
  cumulative: number;
  points: number;
}

/**
 * Cumulative points across the season.
 *
 * An area chart rather than bars: the story people care about is the shape of
 * the climb, not the individual match, and a flat stretch reads instantly as a
 * drought.
 */
export function PointsChart({ data }: { data: readonly Point[] }) {
  if (data.length < 2) {
    return (
      <p className="py-10 text-center text-sm text-ink-muted">
        Graf se crta nakon druge odigrane utakmice.
      </p>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={[...data]} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <defs>
            <linearGradient id="pointsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e30613" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#e30613" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />

          <XAxis
            dataKey="label"
            tick={{ fill: '#64789a', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />

          <YAxis
            tick={{ fill: '#64789a', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={40}
          />

          <Tooltip
            contentStyle={{
              background: 'rgba(10,23,41,0.95)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              fontSize: 12,
            }}
            labelStyle={{ color: '#9fb3d1' }}
            formatter={(value: number, name) => [
              value,
              name === 'cumulative' ? 'Ukupno bodova' : 'Bodova',
            ]}
          />

          <Area
            type="monotone"
            dataKey="cumulative"
            stroke="#e30613"
            strokeWidth={2}
            fill="url(#pointsFill)"
            dot={false}
            activeDot={{ r: 4, fill: '#ff2b38' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
