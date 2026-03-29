function getStorage(storageType) {
    if (typeof window === 'undefined') {
        return null
    }

    try {
        return storageType === 'session' ? window.sessionStorage : window.localStorage
    } catch (error) {
        console.warn(`[ALGET] ${storageType}Storage is unavailable:`, error)
        return null
    }
}

function safeGet(storageType, key, fallbackValue = null) {
    const storage = getStorage(storageType)

    if (!storage) {
        return fallbackValue
    }

    try {
        const value = storage.getItem(key)
        return value ?? fallbackValue
    } catch (error) {
        console.warn(`[ALGET] Failed to read ${storageType}Storage key "${key}":`, error)
        return fallbackValue
    }
}

function safeSet(storageType, key, value) {
    const storage = getStorage(storageType)

    if (!storage) {
        return false
    }

    try {
        storage.setItem(key, value)
        return true
    } catch (error) {
        console.warn(`[ALGET] Failed to write ${storageType}Storage key "${key}":`, error)
        return false
    }
}

function safeRemove(storageType, key) {
    const storage = getStorage(storageType)

    if (!storage) {
        return false
    }

    try {
        storage.removeItem(key)
        return true
    } catch (error) {
        console.warn(`[ALGET] Failed to remove ${storageType}Storage key "${key}":`, error)
        return false
    }
}

export function safeLocalStorageGet(key, fallbackValue = null) {
    return safeGet('local', key, fallbackValue)
}

export function safeLocalStorageSet(key, value) {
    return safeSet('local', key, value)
}

export function safeLocalStorageRemove(key) {
    return safeRemove('local', key)
}

export function safeSessionStorageGet(key, fallbackValue = null) {
    return safeGet('session', key, fallbackValue)
}

export function safeSessionStorageSet(key, value) {
    return safeSet('session', key, value)
}

export function safeSessionStorageRemove(key) {
    return safeRemove('session', key)
}
