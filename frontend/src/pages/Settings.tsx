import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Settings as SettingsIcon,
  Shield,
  Bell,
  Link as LinkIcon,
  Monitor,
  Save,
  RefreshCw,
  Pencil,
  X,
  Check,
} from 'lucide-react';
import clsx from 'clsx';

type Tab = 'agent' | 'privacy' | 'integrations' | 'notifications';

export default function Settings() {
  const { profile, updateProfileData } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('agent');
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const startEditProfile = () => {
    setEditName(profile?.displayName ?? '');
    setEditDept(profile?.department ?? '');
    setEditPosition(profile?.position ?? '');
    setProfileSaved(false);
    setEditingProfile(true);
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    try {
      await updateProfileData({ displayName: editName, department: editDept, position: editPosition });
      setProfileSaved(true);
      setEditingProfile(false);
    } finally {
      setProfileSaving(false);
    }
  };
  const [captureInterval, setCaptureInterval] = useState(5);
  const [autoDeleteMinutes, setAutoDeleteMinutes] = useState(0);
  const [privacyMode, setPrivacyMode] = useState<'strict' | 'balanced'>('strict');
  const [jiraEnabled, setJiraEnabled] = useState(false);
  const [slackEnabled, setSlackEnabled] = useState(true);

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'agent', label: 'Agent 설정', icon: Monitor },
    { id: 'privacy', label: '프라이버시', icon: Shield },
    { id: 'integrations', label: '연동 관리', icon: LinkIcon },
    { id: 'notifications', label: '알림 설정', icon: Bell },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="text-sm text-gray-500 mt-1">
          On-Device Agent 및 시스템 설정을 관리합니다.
        </p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px',
                activeTab === tab.id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Agent 설정 */}
      {activeTab === 'agent' && (
        <div className="card space-y-6">
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">캡처 간격 (초)</h3>
            <p className="text-xs text-gray-500 mb-3">
              화면 스크린샷 캡처 주기입니다. 높을수록 리소스를 덜 사용합니다.
            </p>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={30}
                value={captureInterval}
                onChange={(e) => setCaptureInterval(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-bold text-brand-600 w-12 text-right">
                {captureInterval}초
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">리소스 제한</h3>
            <p className="text-xs text-gray-500 mb-3">
              On-Device Agent의 최대 CPU/GPU 점유율 제한
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">최대 CPU 점유율</p>
                <p className="text-xl font-bold text-gray-900">10%</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">최대 GPU 점유율</p>
                <p className="text-xl font-bold text-gray-900">10%</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">AI 모델</h3>
            <p className="text-xs text-gray-500 mb-3">
              현재 사용 중인 On-Device 비전 모델
            </p>
            <div className="p-3 bg-brand-50 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-brand-700">MobileNetV3 + TinyVLM (INT8 Quantized)</p>
                <p className="text-xs text-gray-500">TensorRT 최적화 | 모델 크기: 45MB</p>
              </div>
              <button className="btn-ghost flex items-center gap-1 text-xs">
                <RefreshCw className="w-3.5 h-3.5" />
                업데이트 확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 프라이버시 설정 */}
      {activeTab === 'privacy' && (
        <div className="card space-y-6">
          <div className="p-4 bg-success-50 rounded-xl border border-success-200">
            <div className="flex items-start gap-3">
              <Shield className="w-6 h-6 text-success-600 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-success-800">Privacy-by-Design 보장</h3>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  모든 영상 데이터는 로컬 PC에서만 처리되며, 분석 즉시 파기됩니다.
                  외부 서버 전송은 직원 승인 후 수치 데이터만 전송됩니다.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">프라이버시 모드</h3>
            <div className="space-y-3">
              <label className={clsx(
                'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                privacyMode === 'strict' ? 'border-brand-400 bg-brand-50/30' : 'border-gray-200'
              )}>
                <input
                  type="radio"
                  name="privacy"
                  checked={privacyMode === 'strict'}
                  onChange={() => setPrivacyMode('strict')}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-semibold">엄격 모드 (권장)</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    프레임 즉시 파기 + 메모리 제로화 + 민감 영역 자동 블러
                  </p>
                </div>
              </label>

              <label className={clsx(
                'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                privacyMode === 'balanced' ? 'border-brand-400 bg-brand-50/30' : 'border-gray-200'
              )}>
                <input
                  type="radio"
                  name="privacy"
                  checked={privacyMode === 'balanced'}
                  onChange={() => setPrivacyMode('balanced')}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-semibold">밸런스 모드</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    최근 5분 버퍼 유지 (정확도 향상) + 파기 로그 기록
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">자동 분석 프레임 파기</h3>
            <p className="text-xs text-gray-500 mb-3">
              분석 완료 후 로컬 임시 데이터 파기까지의 지연 시간
            </p>
            <select
              className="input-field"
              value={autoDeleteMinutes}
              onChange={(e) => setAutoDeleteMinutes(Number(e.target.value))}
            >
              <option value={0}>즉시 파기 (0초)</option>
              <option value={1}>1분 후 파기</option>
              <option value={5}>5분 후 파기</option>
            </select>
          </div>
        </div>
      )}

      {/* 연동 설정 */}
      {activeTab === 'integrations' && (
        <div className="card space-y-6">
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-4">외부 서비스 연동</h3>

            {/* Jira */}
            <div className="p-4 border border-gray-200 rounded-xl flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-lg">
                  📋
                </div>
                <div>
                  <p className="text-sm font-semibold">Jira</p>
                  <p className="text-xs text-gray-500">KPI/OKR 자동 매핑</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={jiraEnabled}
                  onChange={(e) => setJiraEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600" />
              </label>
            </div>

            {/* Slack */}
            <div className="p-4 border border-gray-200 rounded-xl flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-lg">
                  💬
                </div>
                <div>
                  <p className="text-sm font-semibold">Slack</p>
                  <p className="text-xs text-gray-500">일일 요약 알림</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={slackEnabled}
                  onChange={(e) => setSlackEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600" />
              </label>
            </div>

            {/* Notion */}
            <div className="p-4 border border-gray-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-lg">
                  📝
                </div>
                <div>
                  <p className="text-sm font-semibold">Notion</p>
                  <p className="text-xs text-gray-500">성과 데이터 자동 기록</p>
                </div>
              </div>
              <span className="text-xs text-gray-400 px-3 py-1 bg-gray-100 rounded-full">
                출시 예정
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 알림 설정 */}
      {activeTab === 'notifications' && (
        <div className="card space-y-4">
          <h3 className="text-sm font-bold text-gray-900 mb-2">알림 설정</h3>
          {[
            { label: '일일 업무 요약 알림', desc: '매일 퇴근 시 요약 리포트 알림', default: true },
            { label: '데이터 검토 요청', desc: 'Agent 분석 완료 시 검토 요청', default: true },
            { label: '목표 정렬도 경고', desc: '정렬도가 50% 이하일 때 알림', default: true },
            { label: '보상 티어 변동', desc: '보상 등급 변경 시 알림', default: true },
            { label: '과로 경고', desc: '연속 10시간 이상 근무 시 알림', default: false },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
              <div>
                <p className="text-sm font-medium text-gray-700">{item.label}</p>
                <p className="text-xs text-gray-400">{item.desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked={item.default}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600" />
              </label>
            </div>
          ))}
        </div>
      )}

      {/* 저장 버튼 */}
      <div className="flex justify-end">
        <button className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          설정 저장
        </button>
      </div>

      {/* 프로필 정보 (하단) */}
      {profile && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" />
              프로필 정보
            </h3>
            {!editingProfile ? (
              <button
                onClick={startEditProfile}
                className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium"
              >
                <Pencil className="w-3.5 h-3.5" />
                편집
              </button>
            ) : (
              <button
                onClick={() => setEditingProfile(false)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 font-medium"
              >
                <X className="w-3.5 h-3.5" />
                취소
              </button>
            )}
          </div>

          {profileSaved && !editingProfile && (
            <div className="mb-3 flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <Check className="w-3.5 h-3.5" />
              프로필이 저장되었습니다.
            </div>
          )}

          {editingProfile ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">이름</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">이메일 (변경 불가)</label>
                <input
                  type="text"
                  value={profile.email}
                  disabled
                  className="w-full text-sm border border-gray-100 rounded-lg px-3 py-2 bg-gray-50 text-gray-400 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">부서</label>
                <input
                  type="text"
                  value={editDept}
                  onChange={(e) => setEditDept(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">직책</label>
                <input
                  type="text"
                  value={editPosition}
                  onChange={(e) => setEditPosition(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <button
                  onClick={saveProfile}
                  disabled={profileSaving}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  {profileSaving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {profileSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">이름</p>
                <p className="text-sm font-semibold">{profile.displayName || <span className="text-gray-400 italic">미설정</span>}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">이메일</p>
                <p className="text-sm font-semibold">{profile.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">부서</p>
                <p className="text-sm font-semibold">{profile.department || <span className="text-gray-400 italic">미설정</span>}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">직책</p>
                <p className="text-sm font-semibold">{profile.position || <span className="text-gray-400 italic">미설정</span>}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
