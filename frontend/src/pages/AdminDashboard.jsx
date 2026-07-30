import { useNavigate } from 'react-router'
import AdminControlPlane from '../components/AdminControlPlane'

export default function AdminDashboard() {
    const navigate = useNavigate()

    return (
        <AdminControlPlane
            onBack={() => navigate('/learn')}
            onResearcher={() => navigate('/analytics')}
            cohortContent={(
                <div>
                    <p className="editorial-kicker">LEARNING OPERATIONS</p>
                    <h2 className="mt-1 text-2xl font-semibold text-[var(--ath-text)]">Cohort analytics</h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ath-muted)]">Cohort heatmaps remain in the instructor workspace so operational permissions and learner-level data stay separated.</p>
                    <button type="button" onClick={() => navigate('/instructor')} className="editorial-button mt-5 px-4 py-2.5 text-sm">Open instructor analytics</button>
                </div>
            )}
        />
    )
}
