import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import type { UserProfile } from '../types';

// Supabase user.id 를 uid 별칭으로 유지하는 호환 타입
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
  updateProfileData: (data: Partial<Pick<UserProfile, 'displayName' | 'department' | 'position'>>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // ① getSession(): localStorage에서 즉시 읽으므로 네트워크 불요 → 빠름
    //    배포 환경에서 onAuthStateChange INITIAL_SESSION이 늦게/미발화 시에도 안전하게 loading 해제
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      const appUser = toAppUser(session?.user ?? null);
      setUser(appUser);
      if (appUser) {
        loadProfile(appUser.id);   // loading은 loadProfile finally에서 해제
      } else {
        setProfile(null);
        setLoading(false);
      }
    }).catch(() => {
      if (isMounted) setLoading(false);
    });

    // ② onAuthStateChange: 로그인/로그아웃/토큰 갱신 등 이후 변경만 처리
    //    INITIAL_SESSION은 getSession()으로 이미 처리했으므로 skip
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (event === 'INITIAL_SESSION') return; // getSession()이 처리함
      const appUser = toAppUser(session?.user ?? null);
      setUser(appUser);
      if (appUser) {
        await loadProfile(appUser.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // ③ 극단적 안전망: getSession/loadProfile 모두 실패해도 1초 후 loading 해제
    const timeout = setTimeout(() => { if (isMounted) setLoading(false); }, 1000);

    return () => {
      isMounted = false;
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

      if (data) {
        // 정상 조회
        setProfile(data as UserProfile);
        return;
      }

      // PGRST116 = 행 없음 (프로필 미생성 상태) → 신규 생성
      // 그 외 오류(RLS, 네트워크 등) → 기존 DB 데이터를 절대 덮어쓰지 않음
      if (error?.code !== 'PGRST116') {
        console.warn('[AuthContext] 프로필 조회 실패 (DB 덮어쓰기 차단):', error?.code, error?.message);
        setProfile(null);
        return;
      }

      // 프로필이 진짜 없는 경우에만 신규 생성
      let userEmail = '';
      let userName = '사용자';
      try {
        const { data: authUser } = await supabase.auth.getUser();
        userEmail = authUser.user?.email || '';
        userName = authUser.user?.user_metadata?.display_name || '사용자';
      } catch {
        // auth 조회 실패해도 진행
      }
      const newProfile: UserProfile = {
        uid,
        email: userEmail,
        displayName: userName,
        role: 'employee',
        department: '',
        teamId: '',
        position: '',
        joinDate: new Date().toISOString().split('T')[0],
        agentConnected: false,
      };
      try {
        await supabase.from('profiles').upsert(newProfile);
      } catch {
        // upsert 실패해도 로컬 프로필은 사용
      }
      setProfile(newProfile);
    } catch {
      setProfile(null);
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
    if (!user) return;
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
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, updateProfileData }}>
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
