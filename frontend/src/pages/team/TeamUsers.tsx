/**
 * Team > Users
 * 팀원 목록 — 초대, 그룹 관리, 시트 수 변경 (TimeDoctor 스타일)
 */
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getMyWorkspaces,
  inviteMemberToWorkspace,
  type Workspace,
} from '../../services/firestoreService';
import { UserPlus, Settings, Plus, Search, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface MemberRow {
  id: string;
  name: string;
  email: string;
  role: string;
  group: string;
  externalId: string;
  involvedIn: string;
}

export default function TeamUsers() {
  const { profile } = useAuth();
  const userId = profile?.uid ?? '';
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWs, setSelectedWs] = useState('');

  // 초대 모달
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const ws = await getMyWorkspaces(userId);
        if (cancelled) return;
        setWorkspaces(ws);
        if (ws.length > 0 && !selectedWs) setSelectedWs(ws[0].id);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (!userId) { setLoading(false); return; }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  // 워크스페이스 멤버 로드
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!selectedWs) return;
      setLoading(true);
      try {
        const ws = workspaces.find(w => w.id === selectedWs);
        if (!ws) return;
        const rows: MemberRow[] = ws.members.map(m => ({
          id: m.uid,
          name: m.displayName || m.email,
          email: m.email,
          role: m.role,
          group: 'People',
          externalId: '-',
          involvedIn: selectedWs,
        }));
        setMembers(rows);
      } catch {
        // workspace에 접근 불가 시 내 프로필만
        if (!cancelled && profile) {
          setMembers([{
            id: profile.uid,
            name: profile.displayName,
            email: profile.email,
            role: profile.role,
            group: 'People',
            externalId: '-',
            involvedIn: selectedWs,
          }]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedWs, workspaces, profile]);

  const filtered = useMemo(() => {
    if (!search) return members;
    const q = search.toLowerCase();
    return members.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q),
    );
  }, [members, search]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !selectedWs) return;
    const ws = workspaces.find(w => w.id === selectedWs);
    if (!ws) return;
    setInviting(true);
    setInviteMsg('');
    try {
      await inviteMemberToWorkspace(
        selectedWs,
        ws,
        userId,
        profile?.displayName ?? '',
        profile?.email ?? '',
        inviteEmail.trim(),
      );
      setInviteMsg('초대가 전송되었습니다.');
      setInviteEmail('');
    } catch (err: any) {
      setInviteMsg(err.message || '초대 실패');
    } finally {
      setInviting(false);
    }
  };

  if (loading && members.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 제목 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <div className="flex items-center gap-3">
          {workspaces.length > 1 && (
            <select
              value={selectedWs}
              onChange={e => setSelectedWs(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-300 focus:outline-none"
            >
              {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}
          <button
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Invite people
          </button>
        </div>
      </div>

      {/* 초대 모달 */}
      {showInvite && (
        <div className="card border-2 border-green-200 space-y-3">
          <h3 className="text-sm font-bold text-gray-800">팀원 초대</h3>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="이메일 주소 입력"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-300 focus:outline-none"
            />
            <button
              onClick={handleInvite}
              disabled={inviting}
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50 transition-colors"
            >
              {inviting ? '전송 중...' : '초대'}
            </button>
            <button onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-gray-600 text-sm px-2">
              취소
            </button>
          </div>
          {inviteMsg && <p className="text-xs text-green-600">{inviteMsg}</p>}
        </div>
      )}

      {/* 툴바 */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Invite people
        </button>
        <button className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-700 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
          Create group
        </button>
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <span>{members.length} / 100 Users</span>
        </div>
        <span className="text-sm text-brand-600 hover:underline cursor-pointer">Change number of seats</span>

        <div className="ml-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="검색..."
            className="pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-300 focus:outline-none"
          />
        </div>
      </div>

      {/* 사용자 테이블 */}
      <div className="card !p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <span className="inline-flex items-center gap-1 cursor-pointer">Groups/Users <ChevronDown className="w-3 h-3" /></span>
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Expand All</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">External ID</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Involved In</th>
            </tr>
          </thead>
          <tbody>
            {/* 그룹 헤더 */}
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <td colSpan={4} className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-300" />
                  <span className="text-sm font-semibold text-gray-800">People</span>
                  <span className="text-xs text-gray-500">({filtered.length} user{filtered.length !== 1 ? 's' : ''})</span>
                  <Settings className="w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-gray-600" />
                  <Plus className="w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-gray-600" />
                </div>
              </td>
            </tr>
            {filtered.map(m => (
              <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 pl-6">
                    <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                      {m.name[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{m.name}</p>
                      <p className="text-xs text-gray-500">{m.email}</p>
                    </div>
                    <span className={clsx(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full ml-2',
                      m.role === 'manager' ? 'bg-purple-100 text-purple-700'
                        : m.role === 'hr_admin' ? 'bg-indigo-100 text-indigo-700'
                        : m.role === 'super_admin' ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600',
                    )}>
                      {m.role}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-xs text-gray-500">—</td>
                <td className="px-4 py-3 text-center text-xs text-gray-500">{m.externalId}</td>
                <td className="px-4 py-3 text-center text-xs text-gray-500">{m.involvedIn.slice(0, 8)}…</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-gray-400">
                  사용자를 찾을 수 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
