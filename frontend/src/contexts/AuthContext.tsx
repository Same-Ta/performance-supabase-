import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import type { UserProfile, UserRole } from '../types';

// Firebase의 user.uid 를 유지하기 위한 호환 타입
export interface AppUser extends User {
  uid: string; // User.id 의 별칭 (하위 호환)
}

function toAppUser(u: User | null): AppUser | null {
  if (!u) return null;
  return { ...u, uid: u.id } as AppUser;
}

interface AuthContextType {
  user: AppUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, department: string) => Promise<void>;
  signOut: () => Promise<void>;
  demoLogin: (role: UserRole) => void;
  updateProfileData: (data: Partial<Pick<UserProfile, 'displayName' | 'department' | 'position'>>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function createDemoProfile(role: UserRole): UserProfile {
  const profiles: Record<UserRole, UserProfile> = {
    employee: {
      uid: 'demo-employee-001',
      email: 'employee@proofwork.io',
      displayName: '김민수',
      role: 'employee',
      department: '프론트엔드 개발팀',
      teamId: 'team-frontend',
      position: '시니어 개발자',
      joinDate: '2024-03-15',
      agentConnected: true,
      lastAgentSync: new Date().toISOString(),
    },
    manager: {
      uid: 'demo-manager-001',
      email: 'manager@proofwork.io',
      displayName: '이서현',
      role: 'manager',
      department: '프론트엔드 개발팀',
      teamId: 'team-frontend',
      position: '팀장',
      joinDate: '2022-01-10',
      agentConnected: true,
      lastAgentSync: new Date().toISOString(),
    },
    hr_admin: {
      uid: 'demo-hr-001',
      email: 'hr@proofwork.io',
      displayName: '박지영',
      role: 'hr_admin',
      department: '인사팀',
      teamId: 'team-hr',
      position: '인사매니저',
      joinDate: '2023-06-01',
      agentConnected: false,
    },
    super_admin: {
      uid: 'demo-admin-001',
      email: 'admin@proofwork.io',
      displayName: '관리자',
      role: 'super_admin',
      department: '경영지원',
      teamId: 'team-admin',
      position: 'CTO',
      joinDate: '2021-01-01',
      agentConnected: false,
    },
  };
  return profiles[role];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const appUser = toAppUser(session?.user ?? null);
      setUser(appUser);
      if (appUser) {
        loadProfile(appUser.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const appUser = toAppUser(session?.user ?? null);
      setUser(appUser);
      if (appUser) {
        await loadProfile(appUser.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    const timeout = setTimeout(() => setLoading(false), 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProfile(uid: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('uid', uid)
        .single();

      if (error || !data) {
        const { data: authUser } = await supabase.auth.getUser();
        const newProfile: UserProfile = {
          uid,
          email: authUser.user?.email || '',
          displayName: authUser.user?.user_metadata?.display_name || '사용자',
          role: 'employee',
          department: '',
          teamId: '',
          position: '',
          joinDate: new Date().toISOString().split('T')[0],
          agentConnected: false,
        };
        await supabase.from('profiles').upsert(newProfile);
        setProfile(newProfile);
      } else {
        setProfile(data as UserProfile);
      }
    } catch {
      setProfile(createDemoProfile('employee'));
    } finally {
      setLoading(false);
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, displayName: string, department: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;
    if (data.user) {
      const newProfile: UserProfile = {
        uid: data.user.id,
        email,
        displayName,
        role: 'employee',
        department,
        teamId: '',
        position: '',
        joinDate: new Date().toISOString().split('T')[0],
        agentConnected: false,
      };
      await supabase.from('profiles').upsert(newProfile);
      setProfile(newProfile);
    }
  };

  const updateProfileData = async (data: Partial<Pick<UserProfile, 'displayName' | 'department' | 'position'>>) => {
    setProfile((prev) => prev ? { ...prev, ...data } : prev);
    if (!user || user.uid.startsWith('demo-')) return;
    try {
      if (data.displayName) {
        await supabase.auth.updateUser({ data: { display_name: data.displayName } });
      }
      await supabase.from('profiles').update(data).eq('uid', user.id);
    } catch (error) {
      console.warn('[AuthContext] 프로필 업데이트 실패:', error);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const demoLogin = (role: UserRole) => {
    const demoProfile = createDemoProfile(role);
    setProfile(demoProfile);
    setUser({
      id: demoProfile.uid,
      uid: demoProfile.uid,
      email: demoProfile.email,
    } as AppUser);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, demoLogin, updateProfileData }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
