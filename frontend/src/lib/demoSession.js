// Demo-session constants shared between AuthModal (writes it) and App (restores
// it). Kept in a non-component module so react-refresh stays happy and the demo
// session survives reloads / direct section URLs on the hosted demo.
export const DEMO_SESSION_KEY = 'alget_demo_session'
export const DEMO_USER = {
    email: 'demo@alget.local',
    id: '00000000-0000-0000-0000-000000000000',
    isDemo: true,
}
