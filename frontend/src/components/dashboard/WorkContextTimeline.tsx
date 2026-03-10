import { useState, useEffect, useCallback } from 'react';
import { Eye, Brain, Monitor, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import type { ActivitySegment, LiveScreenContext } from '../../types';

const AGENT_URL = 'http://localhost:5001';

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  development: { label: '개발', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  documentation: { label: '문서', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  communication: { label: '커뮤니케이션', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  design: { label: '디자인', color: 'text-pink-700', bg: 'bg-pink-50 border-pink-200' },
  project_mgmt: { label: '프로젝트 관리', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  research: { label: '리서치', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200' },
  meeting: { label: '회의', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  idle: { label: '자리비움', color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200' },
  other: { label: '기타', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' },
};

interface Props {
  timeline?: ActivitySegment[];
  isLive?: boolean;
}

export default function WorkContextTimeline({ timeline, isLive = false }: Props) {
  const [liveContext, setLiveContext] = useState<LiveScreenContext | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const fetchContext = useCallback(async () => {
    try {
      const res = await fetch(`${AGENT_URL}/context`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return;
      const data: LiveScreenContext = await res.json();
      setLiveContext(data);
    } catch {
      // Agent offline
    }
  }, []);

  useEffect(() => {
    if (!isLive) return;
    fetchContext();
    const id = setInterval(fetchContext, 5000);
    return () => clearInterval(id);
  }, [isLive, fetchContext]);

  const segments = timeline || [];
  const hasAIContext = segments.some(s => s.screenSummary || s.workInference);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-brand-500" />
          <span className="font-semibold text-gray-800">업무 컨텍스트 타임라인</span>
          {hasAIContext && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-brand-50 border border-brand-200 rounded-full text-[10px] font-medium text-brand-600">
              <Sparkles className="w-3 h-3" />
              AI 분석
            </span>
          )}
        </div>
        {isLive && liveContext?.totalAnalyses != null && (
          <span className="text-[10px] text-gray-400">
            분석 {liveContext.totalAnalyses}회 완료
          </span>
        )}
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* 실시간 AI 컨텍스트 (라이브 모드) */}
        {isLive && liveContext?.hasContext && (
          <div className="bg-gradient-to-r from-brand-50 to-blue-50 rounded-xl px-4 py-3 border border-brand-100">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-3.5 h-3.5 text-brand-500" />
              <span className="text-xs font-semibold text-brand-700">실시간 AI 화면 분석</span>
              <span className="text-[10px] text-brand-400">
                {liveContext.currentApp} · {liveContext.blockDurationMinutes}분째
              </span>
            </div>
            {liveContext.currentSummary && (
              <p className="text-sm text-gray-700 mb-1">
                <Monitor className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
                {liveContext.currentSummary}
              </p>
            )}
            {liveContext.currentInference && (
              <p className="text-sm text-brand-600 font-medium">
                <Brain className="w-3.5 h-3.5 inline mr-1 text-brand-400" />
                {liveContext.currentInference}
              </p>
            )}
            {liveContext.narrative && (
              <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-brand-100">
                {liveContext.narrative}
              </p>
            )}
          </div>
        )}

        {/* 타임라인 세그먼트 */}
        {segments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            {isLive ? '추적이 시작되면 업무 컨텍스트가 표시됩니다.' : '타임라인 데이터가 없습니다.'}
          </p>
        ) : (
          <div className="space-y-2">
            {segments.map((seg, idx) => {
              const cat = CATEGORY_CONFIG[seg.category] || CATEGORY_CONFIG.other;
              const isExpanded = expandedIdx === idx;
              const hasDetails = seg.screenSummary || seg.workInference;

              return (
                <div key={idx} className={`rounded-xl border transition-all ${cat.bg}`}>
                  <button
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                    className="w-full text-left px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cat.color} bg-white/60`}>
                            {cat.label}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {seg.startTime} – {seg.endTime}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {seg.durationMinutes}분
                          </span>
                          {seg.analysisCount != null && seg.analysisCount > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-brand-500">
                              <Sparkles className="w-2.5 h-2.5" /> {seg.analysisCount}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-800 font-medium truncate">
                          {seg.description}
                        </p>
                        {/* AI 화면 요약 (있으면 항상 표시) */}
                        {seg.screenSummary && !isExpanded && (
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            <Eye className="w-3 h-3 inline mr-1 text-gray-400" />
                            {seg.screenSummary}
                          </p>
                        )}
                      </div>
                      {hasDetails && (
                        <div className="shrink-0 mt-1">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      )}
                    </div>
                  </button>

                  {/* 확장 상세 (AI 분석 내용) */}
                  {isExpanded && hasDetails && (
                    <div className="px-4 pb-3 space-y-2 border-t border-black/5">
                      {seg.screenSummary && (
                        <div className="pt-2">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">
                            <Monitor className="w-3 h-3 inline mr-1" />
                            화면 요약
                          </p>
                          <p className="text-sm text-gray-700">{seg.screenSummary}</p>
                        </div>
                      )}
                      {seg.workInference && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">
                            <Brain className="w-3 h-3 inline mr-1" />
                            업무 추론
                          </p>
                          <p className="text-sm text-brand-700 font-medium">{seg.workInference}</p>
                        </div>
                      )}
                      {seg.detectedElements && seg.detectedElements.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">감지된 요소</p>
                          <div className="flex flex-wrap gap-1">
                            {seg.detectedElements.map((el, i) => (
                              <span key={i} className="px-2 py-0.5 bg-white/80 rounded text-[10px] text-gray-600 border border-gray-200">
                                {el}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
