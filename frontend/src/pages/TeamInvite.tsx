import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  sendTeamInvite,
  getMyInvites,
  cancelInvite,
} from '../services/firestoreService';
import type { TeamInvite as TeamInviteDoc } from '../services/firestoreService';
import {
  UserPlus,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  Send,
  Users,
} from 'lucide-react';
import clsx from 'clsx';

const STATUS_CONFIG = {
  pending: { label: '대기 중', color: 'text-amber-600 bg-amber-50', icon: Clock },
  accepted: { label: '수락됨', color: 'text-success-700 bg-success-50', icon: CheckCircle2 },
  declined: { label: '거절/취소', color: 'text-red-600 bg-red-50', icon: XCircle },
};

export default function TeamInvite() {
  const { profile } = useAuth();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'employee' | 'manager'>('employee');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const [invites, setInvites] = useState<TeamInviteDoc[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadInvites = async () => {
    if (!profile?.uid) return;
    setLoadingInvites(true);
    setLoadError(null);
    try {
      const list = await getMyInvites(profile.uid);
      setInvites(list);
    } catch (e) {
      console.error('loadInvites error:', e);
      setLoadError(e instanceof Error ? e.message : '초대 목록을 불러올 수 없습니다.');
    } finally {
      setLoadingInvites(false);
    }
  };

  useEffect(() => {
    loadInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.uid]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid || !email.trim()) return;
    setSending(true);
    setSendResult(null);
    try {
      await sendTeamInvite(
        profile.uid,
        profile.displayName,
        profile.email,
        profile.teamId || 'default',
        profile.department || '팀',
        email.trim(),
        role
      );
      setSendResult({ ok: true, msg: `${email.trim()}에게 초대를 발송했습니다.` });
      setEmail('');
      loadInvites();
    } catch (err) {
      setSendResult({ ok: false, msg: err instanceof Error ? err.message : '오류가 발생했습니다.' });
    } finally {
      setSending(false);
    }
  };

  const handleCancel = async (inviteId: string) => {
    await cancelInvite(inviteId);
    loadInvites();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-7 h-7 text-brand-600" />
          팀원 초대
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          이메일로 팀원을 초대하면 상대방이 가입 후 같은 팀 성과 데이터를 공유합니다.
        </p>
      </div>

      {/* 초대 폼 */}
      <form onSubmit={handleSend} className="card space-y-4">
        <h3 className="section-title flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          새 초대 발송
        </h3>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            초대할 이메일 주소
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="input-field pl-10"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">역할</label>
          <div className="flex gap-3">
            {(['employee', 'manager'] as const).map((r) => (
              <label
                key={r}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-all text-sm font-medium',
                  role === r
                    ? 'border-brand-400 bg-brand-50 text-brand-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={role === r}
                  onChange={() => setRole(r)}
                  className="sr-only"
                />
                {r === 'employee' ? '팀원 (직원)' : '관리자'}
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={sending || !email.trim()}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {sending ? '발송 중…' : '초대 발송'}
          </button>
          {sendResult && (
            <p className={clsx('text-sm font-medium', sendResult.ok ? 'text-success-700' : 'text-red-600')}>
              {sendResult.msg}
            </p>
          )}
        </div>
      </form>

      {/* 초대 목록 */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="section-title">발송한 초대 목록</h3>
          <button onClick={loadInvites} className="btn-ghost text-xs">새로고침</button>
        </div>

        {loadingInvites && (
          <div className="py-8 text-center">
            <div className="w-6 h-6 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto" />
          </div>
        )}

        {!loadingInvites && loadError && (
          <div className="py-6 text-center">
            <p className="text-sm text-red-500">{loadError}</p>
            <button onClick={loadInvites} className="btn-ghost text-xs mt-2">다시 시도</button>
          </div>
        )}

        {!loadingInvites && !loadError && invites.length === 0 && (
          <div className="py-10 text-center">
            <UserPlus className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">발송한 초대가 없습니다.</p>
          </div>
        )}

        {!loadingInvites && invites.map((inv) => {
          const cfg = STATUS_CONFIG[inv.status];
          const Icon = cfg.icon;
          return (
            <div
              key={inv.id}
              className="flex items-center gap-3 p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-brand-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{inv.email}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">
                    {inv.role === 'employee' ? '팀원' : '관리자'} · {new Date(inv.createdAt).toLocaleDateString('ko-KR')}
                  </span>
                </div>
              </div>
              <span className={clsx('flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full', cfg.color)}>
                <Icon className="w-3.5 h-3.5" />
                {cfg.label}
              </span>
              {inv.status === 'pending' && (
                <button
                  onClick={() => handleCancel(inv.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                  title="초대 취소"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 안내 */}
      <div className="card bg-blue-50/40 border border-blue-100">
        <h4 className="text-sm font-semibold text-blue-800 mb-2">초대 안내</h4>
        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside leading-relaxed">
          <li>초대된 이메일 주소로 회원가입 후 같은 팀으로 자동 연결됩니다.</li>
          <li>수락 전까지 <strong>대기 중</strong> 상태로 표시되며, 언제든 취소할 수 있습니다.</li>
          <li>현재는 앱 내부에서 초대 링크를 직접 공유해 주세요. (이메일 자동 전송은 추후 지원 예정)</li>
        </ul>
      </div>
    </div>
  );
}
