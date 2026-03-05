import type { SoftwareUsageEntry} from '../../types';
import { Monitor } from 'lucide-react';

interface ProductivityOverviewProps {
  softwareData: SoftwareUsageEntry[];
  focusScore: number;
  efficiencyScore: number;
  activeMinutes: number;
  totalMinutes: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  development: '#3B82F6',
  communication: '#A855F7',
  documentation: '#10B981',
  design: '#EC4899',
  project_mgmt: '#F59E0B',
  browser: '#0EA5E9',
  meeting: '#F97316',
  research: '#14B8A6',
  idle: '#D1D5DB',
  other: '#9CA3AF',
};

function CircleProgress({ value, size = 72, label, color }: { value: number; size?: number; label: string; color: string }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F3F4F6" strokeWidth={5} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-gray-800">{value}%</span>
        </div>
      </div>
      <span className="text-[10px] font-medium text-gray-500 text-center leading-tight">{label}</span>
    </div>
  );
}

export default function ProductivityOverview({
  softwareData,
  focusScore,
  efficiencyScore,
  activeMinutes,
  totalMinutes,
}: ProductivityOverviewProps) {
  const productivePercent = totalMinutes > 0 ? Math.round((activeMinutes / totalMinutes) * 100) : 0;

  // 상위 앱 5개
  const topApps = [...softwareData].sort((a, b) => b.minutes - a.minutes).slice(0, 5);
  const maxMinutes = topApps.length > 0 ? topApps[0].minutes : 1;

  return (
    <div className="card space-y-5">
      <div className="flex items-center gap-2">
        <Monitor className="w-5 h-5 text-brand-500" />
        <h3 className="section-title">생산성 분석</h3>
      </div>

      {/* 원형 지표들 */}
      <div className="flex justify-center gap-6 py-2">
        <CircleProgress value={productivePercent} label="생산성" color="#22C55E" />
        <CircleProgress value={focusScore} label="몰입도" color="#6366F1" />
        <CircleProgress value={efficiencyScore} label="효율성" color="#3B82F6" />
      </div>

      {/* Top 사용 앱 */}
      {topApps.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            Top 사용 앱 · 웹사이트
          </p>
          {topApps.map((app, i) => {
            const color = CATEGORY_COLORS[app.category] || '#9CA3AF';
            const widthPct = Math.max(6, (app.minutes / maxMinutes) * 100);
            const hrs = Math.floor(app.minutes / 60);
            const mins = Math.round(app.minutes % 60);
            const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-4 text-right font-medium">{i + 1}</span>
                <span className="text-sm text-gray-700 w-24 truncate font-medium">{app.appName}</span>
                <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${widthPct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-16 text-right font-semibold">{timeStr}</span>
              </div>
            );
          })}
        </div>
      )}

      {topApps.length === 0 && (
        <div className="py-6 text-center">
          <p className="text-sm text-gray-400">아직 앱 사용 데이터가 없습니다.</p>
        </div>
      )}
    </div>
  );
}
