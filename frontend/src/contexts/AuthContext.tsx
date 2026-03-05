import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as firebaseUpdateProfile,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, department: string) => Promise<void>;
  signOut: () => Promise<void>;
  demoLogin: (role: UserRole) => void;
  updateProfileData: (data: Partial<Pick<UserProfile, 'displayName' | 'department' | 'position'>>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// 데모용 프로필 생성
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
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            // 첫 로그인 시 기본 프로필 생성
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '사용자',
              role: 'employee',
              department: '',
              teamId: '',
              position: '',
              joinDate: new Date().toISOString().split('T')[0],
              agentConnected: false,
            };
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          }
        } catch {
          // Firebase 미연결 시 데모 모드
          setProfile(createDemoProfile('employee'));
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    // Firebase 미연결 시 즉시 로딩 해제
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, displayName: string, department: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await firebaseUpdateProfile(credential.user, { displayName });
    const newProfile: UserProfile = {
      uid: credential.user.uid,
      email,
      displayName,
      role: 'employee',
      department,
      teamId: '',
      position: '',
      joinDate: new Date().toISOString().split('T')[0],
      agentConnected: false,
    };
    await setDoc(doc(db, 'users', credential.user.uid), newProfile);
    setProfile(newProfile);
  };

  const updateProfileData = async (data: Partial<Pick<UserProfile, 'displayName' | 'department' | 'position'>>) => {
    // 데모 모드: 로컬 상태만 업데이트
    if (!user || user.uid.startsWith('demo-')) {
      setProfile((prev) => prev ? { ...prev, ...data } : prev);
      return;
    }
    // Firebase Auth displayName 업데이트
    if (data.displayName && auth.currentUser) {
      await firebaseUpdateProfile(auth.currentUser, { displayName: data.displayName });
    }
    // Firestore 문서 업데이트
    await updateDoc(doc(db, 'users', user.uid), data);
    // 로컬 상태 즉시 갱신
    setProfile((prev) => prev ? { ...prev, ...data } : prev);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setProfile(null);
  };

  const demoLogin = (role: UserRole) => {
    const demoProfile = createDemoProfile(role);
    setProfile(demoProfile);
    setUser({ uid: demoProfile.uid } as User);
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
