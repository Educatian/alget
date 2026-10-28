import * as Popover from '@radix-ui/react-popover'
import { logEvent } from '../lib/loggingService'

/**
 * Header chip for the TAMU live class: classmates online and reading this section; opens a list of
 * where classmates are reading now. Counts only, no names (cloudflare/tamu-live-worker).
 */
export default function LiveClassChip({ live, course, sections, currentPath, onNavigate, sharedCount }) {
    const reading = sections
        .map((s) => ({ ...s, path: `${course}/${s.chapter}/${s.section}` }))
        .map((s) => ({ ...s, count: live.sections[s.path] || 0 }))
        .filter((s) => s.count > 0)
    const label = !live.connected ? 'Connecting…' : live.here > 0 ? `${live.here} reading here` : `${live.online} online`

    return (
        <Popover.Root onOpenChange={(open) => open && logEvent('live_class_open', null, { online: live.online, here: live.here, reading: live.reading }, currentPath)}>
            <Popover.Trigger asChild>
                <button
                    type="button"
                    className="flex items-center gap-2 rounded-full border border-[var(--ath-line)] bg-[rgba(255,255,255,0.8)] px-2.5 py-1.5 shadow-sm transition-all hover:bg-[var(--ath-panel)] hover:shadow-md"
                    aria-label={`Live class: ${live.online} classmates online, ${live.here} reading this section`}
                >
                    <span className={`inline-flex h-2.5 w-2.5 rounded-full ${live.connected ? 'animate-pulse bg-emerald-500' : 'bg-slate-300'}`} />
                    <span className="text-sm font-semibold text-[var(--ath-muted)]">{label}</span>
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content side="bottom" align="end" sideOffset={8} className="z-[90] w-72 rounded-2xl border border-[var(--ath-line)] bg-[var(--ath-panel)] p-4 shadow-[0_18px_48px_rgba(15,23,42,0.16)]">
                    <p className="editorial-kicker">Live class</p>
                    <p className="mt-1 text-sm text-[var(--ath-text)]">
                        <b>{live.online}</b> classmate{live.online === 1 ? '' : 's'} online · <b>{live.here}</b> in this section
                    </p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--ath-muted)]">Reading now</p>
                    {reading.length === 0 ? (
                        <p className="mt-1 text-sm text-[var(--ath-muted)]">{live.connected ? 'No classmates are reading right now.' : 'Connecting to the class…'}</p>
                    ) : (
                        <ul className="mt-1 space-y-1">
                            {reading.map((s) => (
                                <li key={s.path}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            logEvent('live_class_jump', s.path, { count: s.count }, currentPath)
                                            onNavigate(s.chapter, s.section)
                                        }}
                                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-[var(--ath-background)] ${s.path === currentPath ? 'font-semibold text-[var(--ath-text)]' : 'text-[var(--ath-muted)]'}`}
                                    >
                                        <span className="truncate">{Number(s.chapter)}.{Number(s.section)} {s.title}</span>
                                        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">{s.count}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="mt-3 border-t border-[var(--ath-line)] pt-2 text-xs text-[var(--ath-muted)]">
                        {sharedCount > 0
                            ? `${sharedCount} passage${sharedCount === 1 ? '' : 's'} here underlined by 2 or more classmates (dotted underline).`
                            : 'Passages that 2 or more classmates underline show here with a dotted underline.'}
                        {' '}Only counts are shared, never names or notes.
                    </p>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    )
}
