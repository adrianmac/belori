import { useEffect } from 'react'

const DB_NAME = 'belori-offline'
const DB_VERSION = 1

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' })
      }
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveToCache(key, data) {
  try {
    const db = await openDB()
    const tx = db.transaction('cache', 'readwrite')
    tx.objectStore('cache').put({ key, data, savedAt: Date.now() })
  } catch (e) { /* ignore */ }
}

export async function loadFromCache(key) {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction('cache', 'readonly')
      const req = tx.objectStore('cache').get(key)
      req.onsuccess = () => resolve(req.result?.data || null)
      req.onerror = () => resolve(null)
    })
  } catch (e) { return null }
}

export function useOfflineCache(key, liveData) {
  useEffect(() => {
    if (liveData && liveData.length > 0) {
      saveToCache(key, liveData)
    }
  }, [key, liveData])
}
