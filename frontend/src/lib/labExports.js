// Upload of a Simulation Lab's exported CSV to the private 'lab-exports' bucket
// (backend/supabase_lab_exports.sql): one folder per account, staff-readable only.
import { supabase } from './supabase'
import { logEvent } from './loggingService'

export const MAX_LAB_CSV_BYTES = 2 * 1024 * 1024

export function checkLabCsv(file) {
    if (!file) return 'Choose the CSV file the lab saved.'
    if (!/\.csv$/i.test(file.name)) return 'That is not a .csv file. Choose the file the lab saved (it ends in .csv).'
    if (file.size === 0) return 'That file is empty. Export it from the lab again.'
    if (file.size > MAX_LAB_CSV_BYTES) return "That file is too large (over 2 MB). Make sure it is the lab's CSV export."
    return null
}

function readText(file) {
    if (typeof file.text === 'function') return file.text()
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = reject
        reader.readAsText(file)
    })
}

export async function uploadLabCsv(lab, file) {
    const problem = checkLabCsv(file)
    if (problem) throw new Error(problem)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Please sign in again, then upload the file.')
    const path = `${user.id}/${lab.id}-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
    const { error } = await supabase.storage.from('lab-exports').upload(path, file, {
        contentType: 'text/csv', upsert: false,
    })
    if (error) throw new Error('The upload did not go through. Please try again, or email the file to the research team.')
    const text = await readText(file).catch(() => '')
    logEvent('sim_lab_csv_uploaded', lab.id, {
        lab: lab.id, path, file_name: file.name.slice(0, 200), size_bytes: file.size,
        rows: text ? Math.max(0, text.trim().split(/\r?\n/).length - 1) : null,
        header: text ? text.split(/\r?\n/, 1)[0].slice(0, 500) : null,
    }, lab.sectionId)
    return path
}

export function recordLabCsvSkipped(lab, reason) {
    logEvent('sim_lab_csv_skipped', lab.id, { lab: lab.id, reason: String(reason || '').slice(0, 500) }, lab.sectionId)
}
