import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Monitor, Clock, Brain, TrendingUp, Zap, Target, ChevronDown, ChevronUp,
  Sparkles, AlertTriangle, Award, AppWindow, Layers, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import clsx from 'clsx';
import type { DetailedAnalysis } from '../../services/workAnalysisService';
import type { AIDetailedReport } from '../../services/geminiReportService';

interface DetailedWorkReportProps {
  analysis: DetailedAnalysis;
  aiReport: AIDetailedReport | null;
  aiLoading: boolean;
  onGenerateAI?: () => void;
}

// ─── 유틸 ────────────────────────────────────────────────────

function fmtMin(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.round(minutes)}m`;
}

const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-blue-100 text-blue-700',
};
const PRIORITY_LABELS = { high: '높음', medium: '보통', low: '낮음' };

const TREND_ICONS = {
  up: <ArrowUpRight className="w-3.5 h-3.5 text-green-500" />,
  down: <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />,
  stable: <Minus className="w-3.5 h-3.5 text-gray-400" />,
};

// ─── 메인 컴포넌트 ──────────────────────────────────────────

export default function DetailedWorkReport({
  analysis,
  aiReport,
  aiLoading,
  onGenerateAI,
}: DetailedWorkReportProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    apps: true,
    timeline: true,
    hourly: false,
    pattern: true,
    ai: true,
  });

  const toggle = (key: string) =>
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  if (analysis.activeWorkMinutes === 0) {
    return (
      <div className="card text-center py-12">
        <Monitor className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">분석할 업무 데이터가 없습니다.</p>
        <p className="text-xs text-gray-400 mt-1">추적을 시작하면 상세 리포트가 생성됩니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ─── 핵심 지표 요약 ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={<Clock className="w-5 h-5 text-blue-500" />} label="총 업무 시간" value={fmtMin(analysis.totalWorkMinutes)} />
        <StatCard icon={<Zap className="w-5 h-5 text-green-500" />} label="활성 시간" value={fmtMin(analysis.activeWorkMinutes)} />
        <StatCard icon={<Target className="w-5 h-5 text-purple-500" />} label="생산성" value={`${analysis.productivityRate}%`} />
        <StatCard icon={<Brain className="w-5 h-5 text-indigo-500" />} label="작업 스타일" value={analysis.workPattern.workStyle} />
      </div>

      {/* ─── AI 업무 서술 ─── */}
      <Section
        id="ai"
        title="AI 업무 분석 리포트"
        icon={<Sparkles className="w-5 h-5 text-amber-500" />}
        expanded={expandedSections.ai}
        onToggle={() => toggle('ai')}
      >
        {aiReport ? (
          <div className="space-y-6">
            {/* 업무 내러티브 */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">업무 내용 요약</p>
              <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-4">
                {aiReport.workNarrative}
              </p>
            </div>

            {/* 앱별 작업 분석 */}
            {aiReport.appWorkAnalysis.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">앱별 작업 분석</p>
                <div className="space-y-3">
                  {aiReport.appWorkAnalysis.map((app, i) => (
                    <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <AppWindow className="w-4 h-4 text-brand-500" />
                        <span className="text-sm font-bold text-gray-800">{app.appName}</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{app.workDescription}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                        <span className="bg-gray-50 px-2 py-1 rounded">📦 {app.estimatedOutput}</span>
                        <span className="bg-gray-50 px-2 py-1 rounded">📊 {app.productivityNote}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 시간 흐름 서술 */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">시간별 업무 흐름</p>
              <p className="text-sm text-gray-700 leading-relaxed bg-blue-50 rounded-xl p-4 border border-blue-100">
                {aiReport.timeflowNarrative}
              </p>
            </div>

            {/* 생산성 심층 분석 */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                <p className="text-xs font-bold text-green-700 mb-2">💪 강점</p>
                <ul className="space-y-1.5">
                  {aiReport.productivityAnalysis.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-green-800 flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">●</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                <p className="text-xs font-bold text-amber-700 mb-2">🌱 개선 영역</p>
                <ul className="space-y-1.5">
                  {aiReport.productivityAnalysis.weaknesses.map((w, i) => (
                    <li key={i} className="text-sm text-amber-800 flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">●</span>{w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 업계 비교 */}
            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
              <p className="text-xs font-bold text-indigo-700 mb-2">📈 업계 비교 분석</p>
              <p className="text-sm text-indigo-800">{aiReport.productivityAnalysis.comparison}</p>
            </div>

            {/* 실행 가능한 제안 */}
            {aiReport.actionableRecommendations.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">실행 가능한 개선 제안</p>
                <div className="space-y-3">
                  {aiReport.actionableRecommendations.map((rec, i) => (
                    <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-bold text-gray-800">{rec.title}</span>
                        <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', PRIORITY_COLORS[rec.priority])}>
                          {PRIORITY_LABELS[rec.priority]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{rec.description}</p>
                      <p className="text-xs text-brand-600">기대 효과: {rec.expectedImpact}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 성과 하이라이트 */}
            {aiReport.performanceHighlights.length > 0 && (
              <div className="bg-brand-50 rounded-xl p-4 border-2 border-brand-200">
                <div className="flex items-center gap-2 mb-3">
                  <Award className="w-5 h-5 text-brand-600" />
                  <p className="text-sm font-bold text-brand-800">성과 어필 포인트</p>
                </div>
                <ul className="space-y-2">
                  {aiReport.performanceHighlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-3 bg-white rounded-lg px-3 py-2 border border-brand-100">
                      <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-sm text-gray-800">{h}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Sparkles className="w-10 h-10 text-amber-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-3">
              AI가 실제 앱 사용 데이터와 작업 내용을 분석하여 상세 리포트를 생성합니다.
            </p>
            <button
              onClick={onGenerateAI}
              disabled={aiLoading}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-md"
            >
              {aiLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  분석 중...
                </span>
              ) : (
                'AI 상세 분석 시작'
              )}
            </button>
          </div>
        )}
      </Section>

      {/* ─── 앱별 사용 분석 ─── */}
      <Section
        id="apps"
        title="앱별 사용 분석"
        icon={<Layers className="w-5 h-5 text-blue-500" />}
        expanded={expandedSections.apps}
        onToggle={() => toggle('apps')}
        badge={`${analysis.appAnalyses.length}개 앱`}
      >
        {analysis.appAnalyses.length > 0 ? (
          <div className="space-y-2">
            {/* 헤더 */}
            <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-gray-400 uppercase px-3 py-1">
              <div className="col-span-3">앱</div>
              <div className="col-span-2">카테고리</div>
              <div className="col-span-2 text-right">시간</div>
              <div className="col-span-2 text-right">세션</div>
              <div className="col-span-2 text-right">비율</div>
              <div className="col-span-1 text-center">추이</div>
            </div>
            {analysis.appAnalyses.map((app, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                <div className="col-span-3 flex items-center gap-2 min-w-0">
                  <span className="text-xs font-medium text-gray-400 w-4 flex-shrink-0">{i + 1}</span>
                  <span className="text-sm font-semibold text-gray-800 truncate">{app.appName}</span>
                </div>
                <div className="col-span-2">
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: analysis.categorySummaries.find(c => c.category === app.category)?.color || '#9CA3AF' }}
                  >
                    {app.categoryLabel}
                  </span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-sm font-bold text-gray-700">{fmtMin(app.totalMinutes)}</span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-xs text-gray-500">{app.sessions}회</span>
                  <span className="text-[10px] text-gray-400 ml-1">(평균 {fmtMin(app.avgSessionMinutes)})</span>
                </div>
                <div className="col-span-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${app.percentage}%`,
                          backgroundColor: app.isProductive ? '#22C55E' : '#94A3B8',
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-600 w-8 text-right">{app.percentage}%</span>
                  </div>
                </div>
                <div className="col-span-1 flex justify-center">
                  {TREND_ICONS[app.trend]}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">앱 사용 데이터가 없습니다.</p>
        )}
      </Section>

      {/* ─── 카테고리별 시간 분포 ─── */}
      {analysis.categorySummaries.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="w-5 h-5 text-brand-500" />
            <h3 className="section-title">카테고리별 업무 시간</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {analysis.categorySummaries.map((cat) => (
              <div key={cat.category} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: cat.color }} />
                  <span className="text-xs font-bold text-gray-700">{cat.label}</span>
                </div>
                <p className="text-lg font-bold text-gray-900">{fmtMin(cat.totalMinutes)}</p>
                <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                  <span>{cat.percentage}%</span>
                  <span>{cat.appCount}개 앱</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-1 truncate">주요: {cat.topApp}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 시간대별 생산성 히트맵 ─── */}
      <Section
        id="hourly"
        title="시간대별 생산성"
        icon={<TrendingUp className="w-5 h-5 text-green-500" />}
        expanded={expandedSections.hourly}
        onToggle={() => toggle('hourly')}
      >
        {analysis.hourlyProductivity.length > 0 ? (
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analysis.hourlyProductivity} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#999' }} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#999' }} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #eee', fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                  formatter={(value: number, name: string) => {
                    const label = name === 'productiveMinutes' ? '생산적' : '활성';
                    return [`${value}분`, label];
                  }}
                />
                <Bar dataKey="activeMinutes" radius={[4, 4, 0, 0]} barSize={16} fill="#E2E8F0" name="activeMinutes" />
                <Bar dataKey="productiveMinutes" radius={[4, 4, 0, 0]} barSize={16} name="productiveMinutes">
                  {analysis.hourlyProductivity.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.productivityRate >= 70 ? '#22C55E' : entry.productivityRate >= 40 ? '#F59E0B' : '#EF4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
              <div className="flex items-center justify-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm bg-green-500" /> 생산적 (70%+)
              </div>
              <div className="flex items-center justify-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm bg-yellow-500" /> 보통 (40-70%)
              </div>
              <div className="flex items-center justify-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm bg-red-500" /> 낮음 (&lt;40%)
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">시간대별 데이터가 없습니다.</p>
        )}
      </Section>

      {/* ─── 작업 패턴 분석 ─── */}
      <Section
        id="pattern"
        title="작업 패턴 분석"
        icon={<Brain className="w-5 h-5 text-purple-500" />}
        expanded={expandedSections.pattern}
        onToggle={() => toggle('pattern')}
      >
        <div className="space-y-4">
          {/* 작업 스타일 */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-5 border border-purple-100">
            <p className="text-2xl font-bold text-purple-800 mb-2">{analysis.workPattern.workStyle}</p>
            <p className="text-sm text-purple-700 leading-relaxed">{analysis.workPattern.workStyleDescription}</p>
          </div>

          {/* 패턴 수치 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <PatternCard label="피크 시간대" value={analysis.workPattern.peakHour} sub={`${analysis.workPattern.peakProductivity}분 생산적`} />
            <PatternCard label="평균 연속 작업" value={fmtMin(analysis.workPattern.avgSessionLength)} sub="세션 평균" />
            <PatternCard label="최장 연속 작업" value={fmtMin(analysis.workPattern.longestStreak)} sub="무중단 기록" />
            <PatternCard label="딥포커스 블록" value={`${analysis.workPattern.focusBlocks}개`} sub="20분+ 집중" />
            <PatternCard label="컨텍스트 전환" value={analysis.workPattern.switchFrequency} sub="전환 빈도" />
          </div>
        </div>
      </Section>

      {/* ─── 구체적 작업 내용 타임라인 ─── */}
      <Section
        id="timeline"
        title="작업 내용 상세"
        icon={<Clock className="w-5 h-5 text-orange-500" />}
        expanded={expandedSections.timeline}
        onToggle={() => toggle('timeline')}
        badge={`${analysis.workContents.length}건`}
      >
        {analysis.workContents.length > 0 ? (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {analysis.workContents.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                <div
                  className="w-1 h-10 rounded-full flex-shrink-0"
                  style={{ backgroundColor: analysis.categorySummaries.find(c => c.category === item.category)?.color || '#9CA3AF' }}
                />
                <div className="w-24 flex-shrink-0">
                  <span className="text-xs font-bold text-gray-700">{item.timeRange}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{item.description}</p>
                  <p className="text-[10px] text-gray-400">{item.app} · {item.categoryLabel}</p>
                </div>
                {item.isDeepFocus && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 flex-shrink-0">
                    딥포커스
                  </span>
                )}
                <span className="text-xs font-semibold text-gray-500 w-10 text-right flex-shrink-0">
                  {item.durationMinutes}분
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">작업 내용 데이터가 없습니다.</p>
        )}
      </Section>

      {/* ─── 인사이트 ─── */}
      {analysis.insights.length > 0 && (
        <div className="card bg-gray-50 border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="section-title">핵심 인사이트</h3>
          </div>
          <ul className="space-y-2">
            {analysis.insights.map((insight, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-amber-500 mt-0.5 flex-shrink-0">▸</span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── 서브 컴포넌트 ──────────────────────────────────────────

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card flex items-center gap-3 !py-4">
      {icon}
      <div>
        <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function Section({
  id: _id,
  title,
  icon,
  expanded,
  onToggle,
  badge,
  children,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="section-title">{title}</h3>
          {badge && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {badge}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {expanded && <div className="mt-4">{children}</div>}
    </div>
  );
}

function PatternCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}
