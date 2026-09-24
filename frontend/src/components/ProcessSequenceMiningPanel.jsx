import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const EVENTS = [
    ['page_view', '페이지 열기'], ['problem_attempt', '문제 풀이'], ['hint_request', '힌트 요청'],
    ['chat_message', '튜터 대화'], ['stuck_event', '막힘 감지'], ['recommendation_decision', '추천 수락/거절'],
    ['time_on_task', '학습 시간'], ['highlight_create', '하이라이트'], ['sim_open', '시뮬레이션 열기'],
    ['sim_close', '시뮬레이션 닫기'], ['support_request', '도움 요청'], ['support_tab_select', '지원 패널 선택'],
    ['intervention_trace', '개입 기록'], ['evaluation_artifact', '평가 산출물'],
    ['assessment_generate_request', '평가 생성 요청'], ['assessment_generate_success', '평가 생성 완료'],
    ['inline_check_attempt', '인라인 확인'], ['structural_interaction', '콘텐츠 상호작용'],
    ['content_audit', '콘텐츠 검수'], ['learner_model_update', '학습자 모델 갱신'],
]

const label = (value) => String(value || '').replaceAll('_', ' ')

export default function ProcessSequenceMiningPanel() {
    const [course, setCourse] = useState('')
    const [module, setModule] = useState('')
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const [minimum, setMinimum] = useState(5)
    const [sequenceLength, setSequenceLength] = useState(4)
    const [selectedEvents, setSelectedEvents] = useState(EVENTS.map(([id]) => id))
    const [result, setResult] = useState(null)
    const [runs, setRuns] = useState([])
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [reviewStatus, setReviewStatus] = useState('approved')
    const [checklist, setChecklist] = useState({ coverage: false, privacy: false, interpretation: false })
    const [notes, setNotes] = useState('')

    const loadRuns = useCallback(async () => {
        const { data, error: rpcError } = await supabase.rpc('list_process_mining_runs', { p_limit: 20 })
        if (rpcError) throw rpcError
        return Array.isArray(data) ? data : []
    }, [])

    useEffect(() => { loadRuns().then(setRuns).catch(() => {}) }, [loadRuns])

    async function refreshRuns() {
        try { setRuns(await loadRuns()) } catch { /* access is confirmed when the analyst runs a query */ }
    }

    async function analyze(event) {
        event.preventDefault()
        setBusy(true)
        setError('')
        setResult(null)
        const { data, error: rpcError } = await supabase.rpc('analyze_learning_sequences', {
            p_course_id: course || null,
            p_module: module || null,
            p_from: from ? new Date(`${from}T00:00:00`).toISOString() : null,
            p_to: to ? new Date(`${to}T23:59:59.999`).toISOString() : null,
            p_event_types: selectedEvents,
            p_min_learners: Number(minimum),
            p_max_sequence_length: Number(sequenceLength),
        })
        if (rpcError) setError(rpcError.message.includes('instructor_access_required')
            ? '이 기능은 Supabase에서 강사 또는 연구자 권한이 확인된 계정만 사용할 수 있습니다.'
            : `분석을 완료하지 못했습니다: ${rpcError.message}`)
        else {
            setResult(data)
            await refreshRuns()
        }
        setBusy(false)
    }

    async function review(runId) {
        if (!Object.values(checklist).every(Boolean)) {
            setError('검수 전에 데이터 범위, 개인정보 기준, 패턴 해석을 모두 확인해 주세요.')
            return
        }
        setBusy(true)
        setError('')
        const { error: rpcError } = await supabase.rpc('review_process_mining_run', {
            p_run_id: runId, p_status: reviewStatus, p_checklist: checklist, p_notes: notes,
        })
        if (rpcError) setError(rpcError.message.includes('independent_review_required')
            ? '분석 작성자와 다른 강사 계정으로 검수해야 합니다.'
            : `검수 저장 실패: ${rpcError.message}`)
        else { setNotes(''); setChecklist({ coverage: false, privacy: false, interpretation: false }); await refreshRuns() }
        setBusy(false)
    }

    const quality = result?.dataQuality

    return (
        <section className="editorial-section" aria-labelledby="process-sequence-title">
            <header className="editorial-section-header">
                <p className="editorial-kicker">Learning Process Research</p>
                <h2 id="process-sequence-title" className="text-base font-semibold text-[var(--ath-text)]">프로세스마이닝 · 시퀀스마이닝</h2>
                <p className="editorial-section-lead">모듈별 학습 흐름, 자주 나타나는 이벤트 순서, 단계 간 체류시간을 코호트 기준으로 분석하고 독립 검수합니다. 개인별 기록과 식별자는 결과에 포함하지 않습니다.</p>
            </header>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                <form onSubmit={analyze} className="editorial-surface space-y-5 p-6">
                    <h3 className="text-sm font-semibold text-[var(--ath-text)]">분석 옵션</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-semibold text-[var(--ath-muted)]">과목 ID
                            <input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="전체 과목 또는 inst-design" className="editorial-input mt-1" />
                        </label>
                        <label className="text-xs font-semibold text-[var(--ath-muted)]">모듈 번호
                            <input value={module} onChange={(e) => setModule(e.target.value)} placeholder="전체 또는 01" className="editorial-input mt-1" />
                        </label>
                        <label className="text-xs font-semibold text-[var(--ath-muted)]">시작일
                            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="editorial-input mt-1" />
                        </label>
                        <label className="text-xs font-semibold text-[var(--ath-muted)]">종료일
                            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="editorial-input mt-1" />
                        </label>
                        <label className="text-xs font-semibold text-[var(--ath-muted)]">최소 코호트 인원
                            <select value={minimum} onChange={(e) => setMinimum(e.target.value)} className="editorial-input mt-1">
                                {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}명</option>)}
                            </select>
                        </label>
                        <label className="text-xs font-semibold text-[var(--ath-muted)]">시퀀스 최대 길이
                            <select value={sequenceLength} onChange={(e) => setSequenceLength(e.target.value)} className="editorial-input mt-1">
                                {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}개 이벤트</option>)}
                            </select>
                        </label>
                    </div>
                    <fieldset>
                        <legend className="mb-2 text-xs font-semibold text-[var(--ath-muted)]">포함할 학습 이벤트</legend>
                        <div className="grid max-h-44 grid-cols-2 gap-2 overflow-auto rounded-xl border border-[var(--ath-line)] p-3 sm:grid-cols-3">
                            {EVENTS.map(([id, text]) => <label key={id} className="flex items-center gap-2 text-xs text-[var(--ath-text)]">
                                <input type="checkbox" checked={selectedEvents.includes(id)} onChange={(e) => setSelectedEvents((prev) => e.target.checked ? [...prev, id] : prev.filter((item) => item !== id))} />{text}
                            </label>)}
                        </div>
                    </fieldset>
                    <button disabled={busy || selectedEvents.length === 0} className="editorial-button px-5 py-3 text-sm disabled:opacity-50">
                        {busy ? '처리 중…' : '프로세스 · 시퀀스 분석 실행'}
                    </button>
                    {error && <p role="alert" className="text-sm font-medium text-[#8c1d1d]">{error}</p>}
                </form>

                <div className="editorial-surface space-y-5 p-6">
                    <h3 className="text-sm font-semibold text-[var(--ath-text)]">분석 결과와 데이터 검수</h3>
                    {!result ? <p className="text-sm leading-6 text-[var(--ath-muted)]">실행하면 직접 후속 흐름, 대표 경로, 빈발 시퀀스, 이벤트 간 중앙 체류시간, 로그 커버리지를 확인할 수 있습니다.</p> : quality?.suppressed ? (
                        <div className="rounded-xl bg-[var(--ath-panel-muted)] p-4 text-sm leading-6 text-[var(--ath-muted)]">선택한 범위의 인원이 최소 기준({quality.minimumLearners}명)에 미달해 결과를 숨겼습니다. 범위를 넓혀 다시 분석하세요.</div>
                    ) : <>
                        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                            {[['학습자', quality.learnerCount], ['세션', quality.sessions], ['분석 이벤트', quality.scopedEvents], ['전체 로그 모듈 연결 누락', `${quality.missingSectionPercent}%`]].map(([key, value]) => <div key={key} className="rounded-xl bg-[var(--ath-panel-muted)] p-3"><div className="text-[var(--ath-muted)]">{key}</div><div className="mt-1 font-bold text-[var(--ath-text)]">{value}</div></div>)}
                        </div>
                        <div><h4 className="mb-2 text-xs font-bold text-[var(--ath-text)]">직접 후속 흐름 · 중앙 체류시간</h4><div className="space-y-1">{(result.directlyFollows || []).slice(0, 8).map((row, i) => <div key={`${row.source}-${row.target}-${i}`} className="flex flex-wrap justify-between gap-2 rounded-lg border border-[var(--ath-line)] px-3 py-2 text-xs"><span>{label(row.source)} → {label(row.target)}</span><span>{row.transitions}회 · 학습자 {row.learners}명 · {row.medianSeconds}s</span></div>)}{!result.directlyFollows?.length && <p className="text-xs text-[var(--ath-muted)]">기준 인원을 충족한 전이 흐름이 없습니다.</p>}</div></div>
                        <div><h4 className="mb-2 text-xs font-bold text-[var(--ath-text)]">빈발 시퀀스</h4><div className="space-y-1">{(result.sequences || []).slice(0, 8).map((row, i) => <div key={i} className="rounded-lg border border-[var(--ath-line)] px-3 py-2 text-xs"><div>{row.events.map(label).join(' → ')}</div><div className="mt-1 text-[var(--ath-muted)]">학습자 {row.learners}명 · {row.occurrences}회</div></div>)}</div></div>
                        <div><h4 className="mb-2 text-xs font-bold text-[var(--ath-text)]">대표 경로 변형</h4><div className="space-y-1">{(result.variants || []).slice(0, 6).map((row, i) => <div key={i} className="rounded-lg border border-[var(--ath-line)] px-3 py-2 text-xs">{row.events.map(label).join(' → ')} <span className="text-[var(--ath-muted)]">({row.learners}명)</span></div>)}</div></div>
                        <div className="border-t border-[var(--ath-line)] pt-4">
                            <h4 className="text-xs font-bold text-[var(--ath-text)]">독립 검수</h4>
                            <p className="mt-1 text-xs text-[var(--ath-muted)]">분석 작성자와 다른 강사 계정으로 로그인해 검수해야 합니다.</p>
                            <div className="mt-3 space-y-2">{[['coverage', '모듈 연결률과 기간 범위를 확인했다'], ['privacy', '최소 인원 기준과 익명 집계를 확인했다'], ['interpretation', '흐름을 인과관계로 과장하지 않고 해석했다']].map(([key, text]) => <label key={key} className="flex gap-2 text-xs"><input type="checkbox" checked={checklist[key]} onChange={(e) => setChecklist((old) => ({ ...old, [key]: e.target.checked }))} />{text}</label>)}</div>
                            <div className="mt-3 flex gap-2"><select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)} className="editorial-input"><option value="approved">승인</option><option value="revision_requested">수정 요청</option><option value="rejected">반려</option></select><input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="검수 메모" className="editorial-input" /></div>
                            <button disabled={busy || !result.runId} onClick={() => review(result.runId)} className="mt-3 rounded-full border border-[var(--ath-line)] px-4 py-2 text-xs font-semibold disabled:opacity-50">검수 결과 저장</button>
                        </div>
                    </>}
                </div>
            </div>

            <div className="editorial-surface mt-6 overflow-hidden">
                <div className="border-b border-[var(--ath-line)] px-5 py-4"><h3 className="text-sm font-semibold text-[var(--ath-text)]">분석 실행 이력 · 검수 상태</h3></div>
                <div className="divide-y divide-[var(--ath-line)]">{runs.length ? runs.map((run) => <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-xs"><button type="button" onClick={() => setResult({ ...(run.result || {}), runId: run.id })} className="text-left underline decoration-[var(--ath-line-strong)] underline-offset-2">{new Date(run.createdAt).toLocaleString()} · {run.filters?.courseId || '전체 과목'} {run.filters?.module ? `· 모듈 ${run.filters.module}` : ''}</button><span className="font-semibold">{run.status} · 검수 {run.reviewCount}건 {run.isOwner ? '· 작성자' : ''}</span>{run.reviews?.map((review, index) => <p key={`${run.id}-review-${index}`} className="w-full pl-2 text-[var(--ath-muted)]">검수: {review.status}{review.notes ? ` · ${review.notes}` : ''}</p>)}</div>) : <p className="px-5 py-4 text-xs text-[var(--ath-muted)]">저장된 분석이 없습니다.</p>}</div>
            </div>
        </section>
    )
}
