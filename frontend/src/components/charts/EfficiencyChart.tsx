import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { SoftwareUsageEntry } from '../../types';

interface EfficiencyChartProps {
  softwareData: SoftwareUsageEntry[];
}

const categoryColors: Record<string, string> = {
  development: '#4c6ef5',
  communication: '#fab005',
  documentation: '#40c057',
  design: '#e64980',
  project_mgmt: '#7950f2',
  research: '#15aabf',
  meeting: '#fd7e14',
  other: '#adb5bd',
};

const categoryLabels: Record<string, string> = {
  development: '개발',
  communication: '커뮤니케이션',
  documentation: '문서 작성',
  design: '디자인',
  project_mgmt: '프로젝트 관리',
  research: '리서치',
  meeting: '미팅',
  other: '기타',
};

export default function EfficiencyChart({ softwareData }: EfficiencyChartProps) {
  // 카테고리별 합산
  const grouped = softwareData.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.minutes;
    return acc;
  }, {});

  const chartData = Object.entries(grouped)
    .map(([category, minutes]) => ({
      category: categoryLabels[category] || category,
      minutes,
      color: categoryColors[category] || '#adb5bd',
      hours: (minutes / 60).toFixed(1),
    }))
    .sort((a, b) => b.minutes - a.minutes);

  return (
    <div className="card">
      <h3 className="section-title mb-1">업무 시간 분포</h3>
      <p className="section-subtitle mb-6">카테고리별 소프트웨어 사용 시간</p>

      <ResponsiveContainer width="100%" height={250}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="category"
            tick={{ fontSize: 11, fill: '#666' }}
            axisLine={false}
            tickLine={false}
            width={90}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #eee',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              fontSize: 12,
            }}
            formatter={(value: number) => [`${value}분 (${(value / 60).toFixed(1)}h)`, '사용 시간']}
          />
          <Bar dataKey="minutes" radius={[0, 6, 6, 0]} barSize={20}>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
