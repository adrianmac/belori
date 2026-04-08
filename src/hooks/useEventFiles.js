import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useEventFiles(eventId) {
  const { boutique } = useAuth()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const BUCKET = 'event-files'

  useEffect(() => {
    if (!eventId || !boutique?.id) return
    fetchFiles()
  }, [eventId, boutique?.id])

  async function fetchFiles() {
    setLoading(true)
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(`${boutique.id}/${eventId}`, { sortBy: { column: 'created_at', order: 'desc' } })
      if (!error && data) {
        setFiles(data.filter(f => f.name !== '.emptyFolderPlaceholder'))
      }
    } catch (err) {
      console.error('fetchFiles error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function uploadFile(file) {
    const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const path = `${boutique.id}/${eventId}/${safeName}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
    if (!error) await fetchFiles()
    return { error }
  }

  async function deleteFile(fileName) {
    const path = `${boutique.id}/${eventId}/${fileName}`
    const { error } = await supabase.storage.from(BUCKET).remove([path])
    if (!error) await fetchFiles()
    return { error }
  }

  function getPublicUrl(fileName) {
    const path = `${boutique.id}/${eventId}/${fileName}`
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return data?.publicUrl || null
  }

  function formatBytes(bytes) {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function getFileIcon(name) {
    const ext = (name || '').split('.').pop().toLowerCase()
    if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return '🖼️'
    if (['pdf'].includes(ext)) return '📄'
    if (['doc','docx'].includes(ext)) return '📝'
    if (['xls','xlsx','csv'].includes(ext)) return '📊'
    if (['zip','rar'].includes(ext)) return '🗜️'
    return '📎'
  }

  return { files, loading, uploadFile, deleteFile, getPublicUrl, formatBytes, getFileIcon, refetch: fetchFiles }
}
