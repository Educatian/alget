import { createContext, useContext } from 'react'

export const ThemeContext = createContext(null)

export function useTheme() {
    const ctx = useContext(ThemeContext)
    if (!ctx) {
        return { theme: 'light', setTheme: () => {}, toggleTheme: () => {} }
    }
    return ctx
}
