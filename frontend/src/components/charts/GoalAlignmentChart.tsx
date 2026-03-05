import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { GoalAlignmentDetail } from '../../types';

interface GoalAlignmentChartProps {
  data: GoalAlignmentDetail[];
}

export default function GoalAlignmentChart({ data }: GoalAlignmentChartProps) {
  const chartData = data.map((d) => ({
    goal: d.goalTitle.length > 12 ? d.goalTitle.slice(0, 12) + '...' : d.goalTitle,
    alignment: d.alignmentPercentage,
    fullTitle: d.goalTitle,
  }));

  return (
    <div className="card">
      <h3 className="section-title mb-1">업무 목표 정렬도</h3>
      <p className="section-subtitle mb-6">
        회사 OKR/KPI 대비 실제 업무 일치율
      </p>

      <ResponsiveContainer width="100%" height={300}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="goal"
            tick={{ fontSize: 11, fill: '#666' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#999' }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #eee',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              fontSize: 12,
            }}
            formatter={(value: number) => [`${value}%`, '정렬도']}
          />
          <Radar
            name="목표 정렬도"
            dataKey="alignment"
            stroke="#4c6ef5"
            fill="#4c6ef5"
            fillOpacity={0.25}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* 상세 목록 */}
      <div className="mt-4 space-y-2">
        {data.map((item) => (
          <div key={item.goalId} className="flex items-center gap-3 text-sm">
            <div className="flex-1 min-w-0">
              <p className="text-gray-700 truncate">{item.goalTitle}</p>
            </div>
            <div className="w-32 bg-gray-100 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-brand-500 transition-all duration-500"
                style={{ width: `${item.alignmentPercentage}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-gray-600 w-10 text-right">
              {item.alignmentPercentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
