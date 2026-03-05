import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { DailyTrend } from '../../types';

interface FocusChartProps {
  data: DailyTrend[];
  title?: string;
}

export default function FocusChart({ data, title = '몰입도 트렌드' }: FocusChartProps) {
  return (
    <div className="card">
      <h3 className="section-title mb-1">{title}</h3>
      <p className="section-subtitle mb-6">최근 일별 몰입도 및 효율성 추이</p>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="focusGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#5c7cfa" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#5c7cfa" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="effGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#40c057" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#40c057" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => v.slice(5)}
            tick={{ fontSize: 11, fill: '#999' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#999' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #eee',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              fontSize: 12,
            }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
          />
          <Area
            type="monotone"
            dataKey="focusScore"
            name="몰입도"
            stroke="#5c7cfa"
            strokeWidth={2}
            fill="url(#focusGrad)"
            dot={{ r: 3, fill: '#5c7cfa' }}
          />
          <Area
            type="monotone"
            dataKey="efficiencyScore"
            name="효율성"
            stroke="#40c057"
            strokeWidth={2}
            fill="url(#effGrad)"
            dot={{ r: 3, fill: '#40c057' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
