-- RCT analysis views for ALGET research dashboard.
--
-- Joins the research-instrumentation tables (interaction_events x
-- recommendation_decisions x intervention_traces x evaluation_runs) into
-- aggregated views the AnalyticsDashboard can query directly without the
-- researcher writing ad-hoc SQL.

-- 1. Intervention outcome by chosen action.
--    For each closed intervention, surface accept rate and reward by the
--    recommended action (explain / represent / practice / ask / advance).
create or replace view rct_intervention_outcomes as
select
  rd.chosen_action,
  count(*)                                                       as total_closed,
  count(*) filter (where it.accepted is true)                    as accepted_count,
  count(*) filter (where it.accepted is false)                   as declined_count,
  count(*) filter (where it.outcome_label = 'correct_after_support')   as resolved_positive,
  count(*) filter (where it.outcome_label = 'still_incorrect')         as resolved_negative,
  avg(it.immediate_reward) filter (where it.accepted is true)    as avg_reward_accepted,
  avg(it.immediate_reward) filter (where it.accepted is false)   as avg_reward_declined,
  avg(extract(epoch from (it.closed_at - it.opened_at)))         as avg_seconds_to_close
from intervention_traces it
join recommendation_decisions rd on rd.id = it.recommendation_id
where it.closed_at is not null
group by rd.chosen_action;

-- 2. Per-user pre/post/retention learning gain.
--    NULL columns mean the user has not yet completed that phase.
create or replace view rct_evaluation_gains as
select
  user_id,
  course_id,
  max(score_pct) filter (where phase = 'pre')               as pre_score,
  max(score_pct) filter (where phase = 'post')              as post_score,
  max(score_pct) filter (where phase = 'retention')         as retention_score,
  max(score_pct) filter (where phase = 'post')
    - max(score_pct) filter (where phase = 'pre')           as post_pre_gain,
  max(score_pct) filter (where phase = 'retention')
    - max(score_pct) filter (where phase = 'post')          as retention_post_drift,
  max(completed_at) filter (where phase = 'pre')            as pre_completed_at,
  max(completed_at) filter (where phase = 'post')           as post_completed_at
from evaluation_runs
group by user_id, course_id;

-- 3. Telemetry profile per user (volume of each event_type from
--    interaction_events). Useful for behavioral clustering / outlier checks.
create or replace view rct_user_telemetry_profile as
select
  user_id,
  count(*)                                                   as total_events,
  count(*) filter (where event_type = 'hint_request')        as hint_requests,
  count(*) filter (where event_type = 'chat_engagement')     as chat_engagements,
  count(*) filter (where event_type = 'simulation_play')     as simulation_plays,
  count(*) filter (where event_type = 'stuck_event')         as stuck_events,
  count(*) filter (where event_type = 'recommendation_decision') as recommendations_seen,
  count(*) filter (where event_type = 'intervention_trace')  as intervention_updates,
  min(event_ts)                                              as first_event_at,
  max(event_ts)                                              as last_event_at
from interaction_events
group by user_id;

-- Views inherit RLS from their underlying tables, but we expose them to
-- authenticated researchers via grants to PostgREST's anon/authenticated roles.
grant select on rct_intervention_outcomes to anon, authenticated;
grant select on rct_evaluation_gains to anon, authenticated;
grant select on rct_user_telemetry_profile to anon, authenticated;
