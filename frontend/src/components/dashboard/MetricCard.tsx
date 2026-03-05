import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import clsx from 'clsx';

interface MetricCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  change?: number;           // 전일 대비 변화 (%)
  icon: ReactNode;
  color: 'brand' | 'success' | 'warning' | 'danger';
  description?: string;
}

const colorMap = {
  brand: 'bg-brand-50 text-brand-600',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
};

export default function MetricCard({
  title,
  value,
  suffix,
  change,
  icon,
  color,
  description,
}: MetricCardProps) {
  const trendIcon =
    change === undefined ? null : change > 0 ? (
      <TrendingUp className="w-3.5 h-3.5" />
    ) : change < 0 ? (
      <TrendingDown className="w-3.5 h-3.5" />
    ) : (
      <Minus className="w-3.5 h-3.5" />
    );

  const trendColor =
    change === undefined
      ? ''
      : change > 0
      ? 'text-success-700 bg-success-50'
      : change < 0
      ? 'text-danger-700 bg-danger-50'
      : 'text-gray-500 bg-gray-100';

  return (
    <div className="card-hover animate-fade-in">
      <div className="flex items-start justify-between mb-4">
        <div className={clsx('p-2.5 rounded-xl', colorMap[color])}>
          {icon}
        </div>
        {change !== undefined && (
          <div
            className={clsx(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
              trendColor
            )}
          >
            {trendIcon}
            <span>{change > 0 ? '+' : ''}{change}%</span>
          </div>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {suffix && <span className="text-sm text-gray-400">{suffix}</span>}
      </div>

      {description && (
        <p className="text-xs text-gray-400 mt-2">{description}</p>
      )}
    </div>
  );
}
