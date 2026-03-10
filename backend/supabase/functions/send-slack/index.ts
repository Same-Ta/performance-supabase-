// Supabase Edge Function - Slack 알림
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

    const { userId, metricId } = await req.json();

    const { data: metric } = await supabase
      .from('performance_metrics')
      .select('*')
      .eq('id', metricId)
      .single();

    if (!metric) {
      return new Response(JSON.stringify({ error: 'Metric not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('uid', userId)
      .single();

    const userName = profile?.display_name ?? 'Unknown';

    const slackMessage = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `📊 ${userName}님의 일일 성과 요약 (${metric.date})`,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*🧠 몰입도:* ${metric.focus_score}/100` },
            { type: 'mrkdwn', text: `*⚡ 효율성:* ${metric.efficiency_score}/100` },
            { type: 'mrkdwn', text: `*🎯 목표 정렬:* ${metric.goal_alignment_score}%` },
            { type: 'mrkdwn', text: `*⏱ 활성 시간:* ${Math.round(metric.active_work_minutes / 60)}h` },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*AI 요약:* ${metric.ai_summary}`,
          },
        },
      ],
    };

    // Slack Webhook으로 전송
    const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
    if (slackWebhookUrl) {
      await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackMessage),
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Slack 알림 전송 완료' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
