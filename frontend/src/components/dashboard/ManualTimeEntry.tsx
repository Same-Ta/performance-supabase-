import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { submitMetrics } from '../../services/firestoreService';
import type { PerformanceMetrics, ActivitySegment } from '../../types';
import { X } from 'lucide-react';

interface ManualTimeEntryProps {
  onEntryAdded?: () => void;
}

interface TimeEntry {
  id: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  description: string;
  category: string;
}

const CATEGORIES = [
  { value: 'development', label: '개발' },
  { value: 'communication', label: '커뮤니케이션' },
  { value: 'documentation', label: '문서 작업' },
  { value: 'design', label: '디자인' },
  { value: 'project_mgmt', label: '프로젝트 관리' },
  { value: 'meeting', label: '회의' },
  { value: 'browser', label: '웹 리서치' },
  { value: 'other', label: '기타' },
];

export default function ManualTimeEntry({ onEntryAdded }: ManualTimeEntryProps) {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 현재 타이머 상태
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStart, setTimerStart] = useState<string>('');
  const [timerDesc, setTimerDesc] = useState('');
  const [timerCat, setTimerCat] = useState('development');

  // 수동 입력 폼
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCat, setFormCat] = useState('development');

  const nowHHmm = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const calcMinutes = (start: string, end: string): number => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return Math.max(1, (eh * 60 + em) - (sh * 60 + sm));
  };

  // 실시간 타이머 시작
  const handleTimerStart = () => {
    setTimerStart(nowHHmm());
    setTimerRunning(true);
    setSaved(false);
  };

  // 실시간 타이머 종료
  const handleTimerStop = () => {
    const end = nowHHmm();
    const entry: TimeEntry = {
      id: `manual-${Date.now()}`,
      startTime: timerStart,
      endTime: end,
      description: timerDesc || '수동 추적 작업',
      category: timerCat,
    };
    setEntries(prev => [...prev, entry]);
    setTimerRunning(false);
    setTimerStart('');
    setTimerDesc('');
    setTimerCat('development');
  };

  // 수동 시간 추가
  const handleFormAdd = () => {
    if (!formStart || !formEnd || !formDesc) return;
    const entry: TimeEntry = {
      id: `manual-${Date.now()}`,
      startTime: formStart,
      endTime: formEnd,
      description: formDesc,
      category: formCat,
    };
    setEntries(prev => [...prev, entry]);
    setFormStart('');
    setFormEnd('');
    setFormDesc('');
    setFormCat('development');
    setShowForm(false);
  };

  const removeEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  // Supabase에 저장
  const handleSave = async () => {
    if (!profile?.uid || entries.length === 0) return;
    setSaving(true);
    try {
      const totalMin = entries.reduce((sum, e) => sum + calcMinutes(e.startTime, e.endTime), 0);
      const timeline: ActivitySegment[] = entries.map(e => ({
        startTime: e.startTime,
        endTime: e.endTime,
        app: '수동 입력',
        windowTitle: e.description,
        category: e.category as ActivitySegment['category'],
        durationMinutes: calcMinutes(e.startTime, e.endTime),
        description: e.description,
      }));

      const catMinutes: Record<string, number> = {};
      entries.forEach(e => {
        catMinutes[e.category] = (catMinutes[e.category] || 0) + calcMinutes(e.startTime, e.endTime);
      });

      const today = new Date().toISOString().split('T')[0];
      const metrics: PerformanceMetrics = {
        id: `manual-${profile.uid}-${today}-${Date.now()}`,
        userId: profile.uid,
        date: today,
        sessionId: `manual-${Date.now()}`,
        status: 'pending_review',
        totalWorkMinutes: totalMin,
        activeWorkMinutes: totalMin,
        focusScore: 0,
        efficiencyScore: 0,
        goalAlignmentScore: 0,
        outputScore: 0,
        contextSwitchCount: entries.length - 1,
        contextSwitchRate: 0,
        inputDensity: 0,
        deepFocusMinutes: 0,
        softwareUsage: Object.entries(catMinutes).map(([cat, min]) => ({
          category: cat as any,
          appName: CATEGORIES.find(c => c.value === cat)?.label || cat,
          minutes: min,
          percentage: Math.round((min / totalMin) * 100),
        })),
        aiSummary: `수동 입력: ${entries.map(e => `${e.startTime}-${e.endTime} ${e.description}`).join(', ')}`,
        keyAchievements: entries.map(e => `${e.startTime}~${e.endTime} ${e.description} (${calcMinutes(e.startTime, e.endTime)}분)`),
        suggestedImprovements: [],
        timeline,
        createdAt: new Date().toISOString(),
      };

      await submitMetrics(metrics);
      setSaved(true);
      setEntries([]);
      onEntryAdded?.();
    } catch (e) {
      console.error('Manual save error:', e);
    } finally {
      setSaving(false);
    }
  };

  const totalMin = entries.reduce((sum, e) => sum + calcMinutes(e.startTime, e.endTime), 0);

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="section-title">수동 업무 추적</h3>
        </div>
        {entries.length > 0 && (
          <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full">
            총 {totalMin}분
          </span>
        )}
      </div>

      {/* 실시간 타이머 */}
      <div className="p-4 bg-gray-50 rounded-xl space-y-3">
        {!timerRunning ? (
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="지금 할 업무를 입력하세요..."
              value={timerDesc}
              onChange={e => setTimerDesc(e.target.value)}
              className="input-field flex-1"
            />
            <select
              value={timerCat}
              onChange={e => setTimerCat(e.target.value)}
              className="input-field w-36"
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <button
              onClick={handleTimerStart}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-colors flex-shrink-0"
            >
              시작
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">
                {timerDesc || '업무 진행 중'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                시작: {timerStart} · 현재 진행 중...
              </p>
            </div>
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <button
              onClick={handleTimerStop}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors flex-shrink-0"
            >
              종료
            </button>
          </div>
        )}
      </div>

      {/* 수동 입력 토글 */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="btn-ghost flex items-center gap-1 text-xs w-full justify-center"
        >
          시간 직접 입력
        </button>
      )}

      {showForm && (
        <div className="p-4 border border-dashed border-gray-200 rounded-xl space-y-3 animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">시작 시간</label>
              <input type="time" value={formStart} onChange={e => setFormStart(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">종료 시간</label>
              <input type="time" value={formEnd} onChange={e => setFormEnd(e.target.value)} className="input-field" />
            </div>
          </div>
          <input
            type="text"
            placeholder="업무 설명 (예: 고객사 A 미팅)"
            value={formDesc}
            onChange={e => setFormDesc(e.target.value)}
            className="input-field"
          />
          <div className="flex items-center gap-3">
            <select value={formCat} onChange={e => setFormCat(e.target.value)} className="input-field flex-1">
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <button
              onClick={handleFormAdd}
              disabled={!formStart || !formEnd || !formDesc}
              className="btn-primary flex items-center gap-1 disabled:opacity-40"
            >
              추가
            </button>
            <button onClick={() => setShowForm(false)} className="btn-ghost text-xs">취소</button>
          </div>
        </div>
      )}

      {/* 추가된 항목 목록 */}
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map(e => (
            <div key={e.id} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="flex-shrink-0 text-center w-20">
                <span className="text-xs font-bold text-brand-700">{e.startTime}</span>
                <span className="text-xs text-gray-400 mx-1">~</span>
                <span className="text-xs font-bold text-brand-700">{e.endTime}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{e.description}</p>
                <p className="text-xs text-gray-400">
                  {CATEGORIES.find(c => c.value === e.category)?.label} · {calcMinutes(e.startTime, e.endTime)}분
                </p>
              </div>
              <button
                onClick={() => removeEntry(e.id)}
                className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 저장 버튼 */}
      {entries.length > 0 && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full disabled:opacity-50"
        >
          {saving ? '저장 중…' : `업무 기록 저장 (${entries.length}건, ${totalMin}분)`}
        </button>
      )}

      {saved && (
        <p className="text-xs text-success-700 text-center font-medium">
          저장 완료! 데이터 검토 탭에서 확인할 수 있습니다.
        </p>
      )}
    </div>
  );
}
