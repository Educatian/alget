/** Next-step rule for the tutor agent (components/TutorAgent.jsx): adapts to concept mastery and the written activity. */
export function recommendNextStep({ mastery, conceptIds, activityDone, activityStarted }) {
    // Concepts the learner has not answered on yet carry no evidence, so they do not count as weak.
    const values = conceptIds.filter((c) => mastery?.[c] !== undefined).map((c) => Number(mastery[c]))
    if (!values.length) return { id: 'start', level: null, title: 'Check your understanding', text: 'Try the practice questions to see where you stand. The tutor will suggest what to do next from your answers.' }
    const level = Math.min(...values)
    if (level < 0.5) return { id: 'review', level, title: 'Review before moving on', text: 'Your answers suggest one idea here is not solid yet. Let the tutor mark where to look, then try the practice again.' }
    if (level < 0.8) return { id: 'practice', level, title: 'Almost there', text: 'One more try at the practice questions should lock this in.' }
    if (!activityDone) return { id: 'apply', level, title: activityStarted ? 'Finish the written activity' : 'Apply it', text: 'You know the ideas. Put them to work in the written activity and get feedback.' }
    return { id: 'next', level, title: 'Ready for the next section', text: 'Your practice and written work show you have this section.' }
}
