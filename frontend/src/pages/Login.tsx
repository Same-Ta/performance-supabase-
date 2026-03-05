import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Eye, EyeOff, Mail, Lock, User, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { UserRole } from '../types';

type AuthMode = 'login' | 'signup';

export default function Login() {
  const { signIn, signUp, demoLogin } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');

  // 공통
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 회원가입 전용
  const [displayName, setDisplayName] = useState('');
  const [department, setDepartment] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPw('');
    setDisplayName('');
    setDepartment('');
    setShowPw(false);
    setShowConfirmPw(false);
    setError('');
    setAgreeTerms(false);
    setAgreePrivacy(false);
    setSignupSuccess(false);
  };

  const switchMode = (newMode: AuthMode) => {
    resetForm();
    setMode(newMode);
  };

  // 유효성 검증
  const validateSignup = (): string | null => {
    if (!displayName.trim()) return '이름을 입력해주세요.';
    if (displayName.trim().length < 2) return '이름은 2자 이상 입력해주세요.';
    if (!email.trim()) return '이메일을 입력해주세요.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '올바른 이메일 형식을 입력해주세요.';
    if (!department.trim()) return '소속 부서를 입력해주세요.';
    if (password.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) return '비밀번호에 영문과 숫자를 모두 포함해주세요.';
    if (password !== confirmPw) return '비밀번호가 일치하지 않습니다.';
    if (!agreeTerms) return '이용약관에 동의해주세요.';
    if (!agreePrivacy) return '개인정보 처리방침에 동의해주세요.';
    return null;
  };

  const getPasswordStrength = (): { level: number; label: string; color: string } => {
    if (!password) return { level: 0, label: '', color: '' };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*()_+\-=\[\]{};':",./<>?]/.test(password)) score++;

    if (score <= 1) return { level: 1, label: '취약', color: 'bg-danger-500' };
    if (score <= 2) return { level: 2, label: '보통', color: 'bg-warning-500' };
    if (score <= 3) return { level: 3, label: '양호', color: 'bg-brand-400' };
    return { level: 4, label: '강력', color: 'bg-success-500' };
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('이메일 또는 비밀번호를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validateSignup();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, displayName.trim(), department.trim());
      setSignupSuccess(true);
      setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code === 'auth/email-already-in-use') {
        setError('이미 가입된 이메일입니다. 로그인해주세요.');
      } else if (firebaseError.code === 'auth/weak-password') {
        setError('비밀번호가 너무 약합니다. 8자 이상으로 설정해주세요.');
      } else if (firebaseError.code === 'auth/invalid-email') {
        setError('올바른 이메일 형식을 입력해주세요.');
      } else {
        setError('회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = (role: UserRole) => {
    demoLogin(role);
    navigate('/dashboard', { replace: true });
  };

  const pwStrength = getPasswordStrength();

  // 회원가입 성공 화면
  if (signupSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card text-center py-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-success-100 rounded-full mb-4">
              <CheckCircle2 className="w-8 h-8 text-success-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">가입이 완료되었습니다!</h2>
            <p className="text-sm text-gray-500 mb-6">
              <span className="font-medium text-brand-600">{displayName}</span>님, ProofWork에 오신 것을 환영합니다.
            </p>
            <p className="text-xs text-gray-400 mb-8">
              잠시 후 자동으로 대시보드로 이동합니다.
              <br />이동하지 않으면 아래 버튼을 클릭해주세요.
            </p>
            <button
              onClick={() => switchMode('login')}
              className="btn-primary w-full"
            >
              시작하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600 rounded-2xl shadow-lg mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ProofWork</h1>
          <p className="text-sm text-gray-500 mt-1">나의 가치를 증명하는 AI 파트너</p>
        </div>

        {/* 탭 전환 */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => switchMode('login')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              mode === 'login'
                ? 'bg-white text-brand-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            로그인
          </button>
          <button
            onClick={() => switchMode('signup')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              mode === 'signup'
                ? 'bg-white text-brand-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            회원가입
          </button>
        </div>

        {/* 로그인 폼 */}
        {mode === 'login' && (
          <div className="card">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    className="input-field pl-10"
                    placeholder="email@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    className="input-field pl-10 pr-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPw(!showPw)}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={loading}
              >
                {loading ? '로그인 중...' : '로그인'}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-4">
              계정이 없으신가요?{' '}
              <button onClick={() => switchMode('signup')} className="text-brand-600 font-medium hover:underline">
                회원가입
              </button>
            </p>

            {/* 구분선 */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-gray-400">데모 모드로 체험하기</span>
              </div>
            </div>

            {/* 데모 로그인 */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleDemo('employee')}
                className="p-3 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-all text-center"
              >
                <span className="text-lg">👨‍💻</span>
                <p className="text-xs font-medium text-gray-700 mt-1">직원 모드</p>
              </button>
              <button
                onClick={() => handleDemo('manager')}
                className="p-3 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-all text-center"
              >
                <span className="text-lg">👩‍💼</span>
                <p className="text-xs font-medium text-gray-700 mt-1">관리자 모드</p>
              </button>
              <button
                onClick={() => handleDemo('hr_admin')}
                className="p-3 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-all text-center"
              >
                <span className="text-lg">📋</span>
                <p className="text-xs font-medium text-gray-700 mt-1">HR 모드</p>
              </button>
              <button
                onClick={() => handleDemo('super_admin')}
                className="p-3 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-all text-center"
              >
                <span className="text-lg">⚙️</span>
                <p className="text-xs font-medium text-gray-700 mt-1">관리 모드</p>
              </button>
            </div>
          </div>
        )}

        {/* 회원가입 폼 */}
        {mode === 'signup' && (
          <div className="card">
            <form onSubmit={handleSignup} className="space-y-4">
              {/* 이름 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">이름 <span className="text-danger-500">*</span></label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    className="input-field pl-10"
                    placeholder="홍길동"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    autoComplete="name"
                    maxLength={20}
                  />
                </div>
              </div>

              {/* 이메일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">회사 이메일 <span className="text-danger-500">*</span></label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    className="input-field pl-10"
                    placeholder="email@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* 소속 부서 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">소속 부서 <span className="text-danger-500">*</span></label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    className="input-field pl-10"
                    placeholder="프론트엔드 개발팀"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    maxLength={30}
                  />
                </div>
              </div>

              {/* 비밀번호 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호 <span className="text-danger-500">*</span></label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    className="input-field pl-10 pr-10"
                    placeholder="영문 + 숫자 8자 이상"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPw(!showPw)}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* 비밀번호 강도 표시 */}
                {password && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            i <= pwStrength.level ? pwStrength.color : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs mt-1 ${
                      pwStrength.level <= 1 ? 'text-danger-500'
                      : pwStrength.level <= 2 ? 'text-warning-500'
                      : 'text-success-500'
                    }`}>
                      비밀번호 강도: {pwStrength.label}
                    </p>
                  </div>
                )}
              </div>

              {/* 비밀번호 확인 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호 확인 <span className="text-danger-500">*</span></label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    className={`input-field pl-10 pr-10 ${
                      confirmPw && confirmPw !== password ? 'border-danger-300 focus:ring-danger-500' : ''
                    }`}
                    placeholder="비밀번호 재입력"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                  >
                    {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPw && confirmPw !== password && (
                  <p className="text-xs text-danger-500 mt-1">비밀번호가 일치하지 않습니다.</p>
                )}
                {confirmPw && confirmPw === password && password.length > 0 && (
                  <p className="text-xs text-success-500 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> 비밀번호가 일치합니다.
                  </p>
                )}
              </div>

              {/* 약관 동의 */}
              <div className="space-y-2 pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={agreeTerms && agreePrivacy}
                    onChange={(e) => {
                      setAgreeTerms(e.target.checked);
                      setAgreePrivacy(e.target.checked);
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    전체 동의
                  </span>
                </label>
                <div className="ml-6 space-y-1.5">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-xs text-gray-500">
                      <span className="text-danger-500">[필수]</span> 서비스 이용약관에 동의합니다.
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreePrivacy}
                      onChange={(e) => setAgreePrivacy(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-xs text-gray-500">
                      <span className="text-danger-500">[필수]</span> 개인정보 처리방침에 동의합니다.
                    </span>
                  </label>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={loading}
              >
                {loading ? '가입 처리 중...' : '회원가입'}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-4">
              이미 계정이 있으신가요?{' '}
              <button onClick={() => switchMode('login')} className="text-brand-600 font-medium hover:underline">
                로그인
              </button>
            </p>
          </div>
        )}

        {/* 보안 라벨 */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
            <Shield className="w-3 h-3" />
            영상 데이터는 로컬에서만 처리되며, 외부 서버로 전송되지 않습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
