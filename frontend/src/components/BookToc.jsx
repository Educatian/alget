import { useState } from 'react'

export default function BookToc({ toc, currentChapter, currentSection, onNavigate }) {
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedChapters, setExpandedChapters] = useState([currentChapter])

    // Toggle chapter expansion
    const toggleChapter = (chapterId) => {
        setExpandedChapters(prev =>
            prev.includes(chapterId)
                ? prev.filter(c => c !== chapterId)
                : [...prev, chapterId]
        )
    }

    // Filter sections by search
    const filterToc = (chapters) => {
        if (!searchQuery.trim()) return chapters

        return chapters?.filter(ch =>
            ch.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ch.sections?.some(sec =>
                sec.title.toLowerCase().includes(searchQuery.toLowerCase())
            )
        )
    }

    const filteredChapters = filterToc(toc?.chapters)

    return (
        <div className="p-4">
            {/* Search */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="🔍 Search sections..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#9E1B32] focus:ring-1 focus:ring-[#9E1B32]/20"
                />
            </div>

            {/* TOC Header */}
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                📖 Table of Contents
            </h2>

            {/* Loading State */}
            {!toc && (
                <div className="text-gray-400 text-sm py-4 text-center">
                    Loading...
                </div>
            )}

            {/* Chapter List */}
            <nav className="space-y-1">
                {filteredChapters?.map((chapter) => (
                    <div key={chapter.id} className="border-b border-gray-100 last:border-0">
                        {/* Chapter Header */}
                        <button
                            onClick={() => toggleChapter(chapter.id)}
                            className="w-full flex items-center justify-between px-2 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                            <span className="flex items-center gap-2">
                                <span className="text-lg">{chapter.icon || '📘'}</span>
                                <span className="line-clamp-1">Ch {chapter.id}: {chapter.title}</span>
                            </span>
                            <span className={`text-gray-400 transition-transform ${expandedChapters.includes(chapter.id) ? 'rotate-90' : ''}`}>
                                ▶
                            </span>
                        </button>

                        {/* Section List (expanded) */}
                        {expandedChapters.includes(chapter.id) && (
                            <ul className="ml-4 mb-2 space-y-0.5">
                                {chapter.sections?.map((section) => {
                                    const isActive = currentChapter === chapter.id && currentSection === section.id
                                    return (
                                        <li key={section.id}>
                                            <button
                                                onClick={() => onNavigate(chapter.id, section.id)}
                                                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-all ${isActive
                                                        ? 'bg-[#9E1B32] text-white font-medium shadow-sm'
                                                        : 'text-gray-600 hover:bg-gray-100'
                                                    }`}
                                            >
                                                <span className="line-clamp-1">
                                                    {chapter.id}.{section.id} {section.title}
                                                </span>
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </div>
                ))}
            </nav>

            {/* Empty State */}
            {filteredChapters?.length === 0 && searchQuery && (
                <div className="text-gray-400 text-sm py-4 text-center">
                    No sections found for "{searchQuery}"
                </div>
            )}
        </div>
    )
}
