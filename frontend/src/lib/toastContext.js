import { createContext, useContext } from 'react'

export const ToastContext = createContext(null)

export function useToast() {
    const ctx = useContext(ToastContext)
    if (!ctx) {
        return {
            success: (m) => console.info('[toast:no-provider:success]', m),
            error: (m) => console.warn('[toast:no-provider:error]', m),
            info: (m) => console.info('[toast:no-provider:info]', m),
            warning: (m) => console.warn('[toast:no-provider:warning]', m),
            dismiss: () => {},
        }
    }
    return ctx
}
