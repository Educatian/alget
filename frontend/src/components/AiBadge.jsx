import { hasFeature } from '../lib/site'

const ON = hasFeature('ai-badge')

/**
 * The "✦ AI" pill that marks every generative AI touchpoint (explanations, AI hints, written feedback,
 * tutor notes), in one colour used for nothing else. Renders nothing on sites without the ai-badge feature.
 * `onDark` is for dark surfaces such as the selection toolbar.
 */
export default function AiBadge({ onDark = false, className = '' }) {
    if (!ON) return null
    return (
        <span
            className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px align-middle text-[10px] font-bold leading-4 tracking-wide ${onDark ? 'bg-violet-300 text-violet-950' : 'bg-violet-100 text-violet-800 ring-1 ring-violet-300'} ${className}`}
            title="Uses generative AI"
        >
            <span aria-hidden="true">✦</span>AI
        </span>
    )
}
