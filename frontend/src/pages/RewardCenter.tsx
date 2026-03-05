import { useAuth } from '../contexts/AuthContext';
import { useRewardStatus } from '../hooks/usePerformance';
import { REWARD_TIERS, getRewardTier } from '../services/analyticsService';
import { ChevronRight, Lock, CheckCircle, Flame, Gift } from 'lucide-react';
import clsx from 'clsx';

export default function RewardCenter() {
  const { profile } = useAuth();
  const userId = profile?.uid ?? '';
  const { rewardStatus, loading } = useRewardStatus(userId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!rewardStatus) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mb-5">
          <Gift className="w-10 h-10 text-brand-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">아직 보상 티어가 없어요</h2>
        <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
          On-Device Agent로 성과 데이터를 제출하면<br />
          자동으로 보상 티어가 계산됩니다.
        </p>
        <div className="mt-8 grid grid-cols-5 gap-2 text-center">
          {REWARD_TIERS.map((t) => (
            <div key={t.id} className="opacity-40">
              <div className="text-2xl">{t.icon}</div>
              <div className="text-xs text-gray-400 mt-1">{t.name}</div>
            </div>
          ))}
        </div>
      </div>
    );
 }

  const currentTier = getRewardTier(rewardStatus.currentScore);
  const currentTierIndex = REWARD_TIERS.findIndex((t) => t.id === currentTier.id);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">보상 센터</h1>
        <p className="text-sm text-gray-500 mt-1">
          높은 성과는 더 큰 자율성으로 보상받습니다.
        </p>
      </div>

      {/* 현재 상태 */}
      <div className="card text-center py-8">
        <div className="text-5xl mb-3">{currentTier.icon}</div>
        <h2 className="text-xl font-bold text-gray-900">{currentTier.name}</h2>
        <p className="text-3xl font-black mt-2" style={{ color: currentTier.color }}>
          {rewardStatus.currentScore}점
        </p>

        <div className="flex items-center justify-center gap-2 mt-3">
          <Flame className="w-5 h-5 text-orange-500" />
          <span className="text-sm font-semibold text-orange-600">
            {rewardStatus.streakDays}일 연속 활성
          </span>
        </div>

        {/* 다음 티어 진행률 */}
        {currentTierIndex < REWARD_TIERS.length - 1 && (
          <div className="max-w-xs mx-auto mt-6">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>{currentTier.name}</span>
              <span>{REWARD_TIERS[currentTierIndex + 1].name}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all duration-700"
                style={{
                  width: `${rewardStatus.nextTierProgress}%`,
                  backgroundColor: currentTier.color,
                }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              다음 티어까지 {100 - rewardStatus.nextTierProgress}% 남음
            </p>
          </div>
        )}
      </div>

      {/* 현재 해제된 혜택 */}
      <div className="card">
        <h3 className="section-title mb-4">🎉 현재 해제된 혜택</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {rewardStatus.unlockedBenefits.map((benefit, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 bg-success-50 rounded-xl"
            >
              <CheckCircle className="w-5 h-5 text-success-500 flex-shrink-0" />
              <span className="text-sm font-medium text-success-700">{benefit}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 전체 티어 로드맵 */}
      <div className="card">
        <h3 className="section-title mb-6">보상 티어 로드맵</h3>
        <div className="space-y-4">
          {REWARD_TIERS.map((tier, idx) => {
            const isUnlocked = idx <= currentTierIndex;
            const isCurrent = tier.id === currentTier.id;

            return (
              <div
                key={tier.id}
                className={clsx(
                  'p-4 rounded-xl border-2 transition-all',
                  isCurrent
                    ? 'border-brand-400 bg-brand-50/30 shadow-sm'
                    : isUnlocked
                    ? 'border-gray-200 bg-white'
                    : 'border-gray-100 bg-gray-50 opacity-60'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{tier.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-gray-900">{tier.name}</h4>
                        {isCurrent && (
                          <span className="badge-info">현재</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {tier.minScore}점 ~ {tier.maxScore}점
                      </p>
                    </div>
                  </div>
                  {!isUnlocked && <Lock className="w-5 h-5 text-gray-300" />}
                  {isUnlocked && !isCurrent && (
                    <CheckCircle className="w-5 h-5 text-success-500" />
                  )}
                  {isCurrent && <ChevronRight className="w-5 h-5 text-brand-500" />}
                </div>

                <div className="flex flex-wrap gap-2">
                  {tier.benefits.map((b, i) => (
                    <span
                      key={i}
                      className={clsx(
                        'text-xs px-2.5 py-1 rounded-full',
                        isUnlocked
                          ? 'bg-white border border-gray-200 text-gray-700'
                          : 'bg-gray-100 text-gray-400'
                      )}
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Win-Win 설명 */}
      <div className="card bg-gradient-to-r from-brand-50 to-purple-50 border-brand-100">
        <h3 className="text-sm font-bold text-brand-800 mb-2">
          🤝 ProofWork의 Win-Win 보상 철학
        </h3>
        <p className="text-xs text-gray-600 leading-relaxed">
          ProofWork는 성과를 '감시'가 아닌 '증명'으로 바라봅니다. 
          높은 성과를 객관적으로 입증한 팀원에게는 더 높은 자율성과 파격적인 혜택이 주어집니다.
          이는 기업에게는 투명한 성과급 배분을, 직원에게는 자율 근무의 자유를 보장하는 
          상호 신뢰 기반의 보상 체계입니다.
        </p>
      </div>
    </div>
  );
}
