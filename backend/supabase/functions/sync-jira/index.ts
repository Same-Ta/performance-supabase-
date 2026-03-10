// Supabase Edge Function - Jira 연동 웹훅
// Deno 런타임 (TypeScript)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: '인증 필요' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: '인증 실패' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { userId, metricId, jiraProjectKey } = await req.json();
    if (!userId || !metricId) {
      return new Response(JSON.stringify({ error: 'userId, metricId 필수' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 메트릭 조회
    const { data: metric, error: metricErr } = await supabase
      .from('performance_metrics')
      .select('*')
      .eq('id', metricId)
      .single();

    if (metricErr || !metric) {
      return new Response(JSON.stringify({ error: 'Metric not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Jira 연동 설정 조회
    const { data: integList } = await supabase
      .from('integrations')
      .select('*')
      .eq('type', 'jira')
      .eq('enabled', true)
      .limit(1);

    const integConfig = integList?.[0];
    if (!integConfig) {
      return new Response(JSON.stringify({ error: 'Jira 연동 설정이 없습니다.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jiraPayload = {
      project: jiraProjectKey || 'PERF',
      summary: `[ProofWork] ${metric.date} 일일 성과 데이터`,
      description: `
        *몰입도*: ${metric.focus_score}/100
        *효율성*: ${metric.efficiency_score}/100
        *목표 정렬도*: ${metric.goal_alignment_score}%
        *활성 시간*: ${Math.round(metric.active_work_minutes / 60)}시간
        *딥 포커스*: ${metric.deep_focus_minutes}분
        *AI 요약*: ${metric.ai_summary}
      `,
      issueType: 'Task',
      webhookUrl: integConfig.webhookUrl,
    };

    // 활동 로그 기록
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action: 'jira_sync',
      details: `${metric.date} 데이터 Jira 동기화 요청`,
      created_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true, payload: jiraPayload }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
