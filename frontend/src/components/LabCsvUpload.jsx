import { useState } from 'react'
import { CheckCircle2, Upload } from 'lucide-react'
import { recordLabCsvSkipped, uploadLabCsv } from '../lib/labExports'

const RESEARCH_EMAIL = 'seabu@crimson.ua.edu'

/**
 * Last step of a Simulation Lab: download the lab's CSV (its own Export CSV button)
 * and upload it here. A learner whose download does not work can say so and continue.
 */
export default function LabCsvUpload({ lab, done, onDone }) {
    const [file, setFile] = useState(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [cantDownload, setCantDownload] = useState(false)
    const [reason, setReason] = useState('')

    if (done) {
        return (
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[var(--ath-primary)]">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Your lab results file step is done. Thank you!
            </p>
        )
    }

    const upload = async () => {
        setSaving(true)
        setError('')
        try {
            await uploadLabCsv(lab, file)
            onDone?.('uploaded')
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    const skip = () => {
        recordLabCsvSkipped(lab, reason)
        onDone?.('skipped')
    }

    return (
        <div className="mt-4 rounded-[1.2rem] border border-[var(--ath-line)] bg-[var(--ath-panel)] p-4">
            <h4 className="flex items-center gap-2 font-semibold text-[var(--ath-text)]">
                <Upload className="h-4 w-4" aria-hidden="true" /> Last step: upload your lab results file
            </h4>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[var(--ath-text)]">
                <li>In the lab below, click its <strong>Export CSV</strong> button. A .csv file is saved to your Downloads folder.</li>
                <li>Choose that file here and press <strong>Upload</strong>.</li>
            </ol>
            <p className="mt-2 text-xs text-[var(--ath-muted)]">
                The file holds only your trial settings and results. It is stored with your Study ID, not your name.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="text-sm">
                    <span className="sr-only">Lab results file</span>
                    <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => { setFile(e.target.files?.[0] || null); setError('') }}
                        className="text-sm text-[var(--ath-text)] file:mr-3 file:rounded-full file:border-0 file:bg-[var(--ath-primary)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--ath-background)]"
                    />
                </label>
                <button type="button" onClick={upload} disabled={!file || saving} className="editorial-button px-5 py-2 text-sm disabled:opacity-60">
                    {saving ? 'Uploading...' : 'Upload'}
                </button>
            </div>
            {error && <p role="alert" className="mt-2 text-sm font-medium text-[var(--ath-danger)]">{error}</p>}

            {!cantDownload ? (
                <button type="button" onClick={() => setCantDownload(true)} className="mt-3 text-xs text-[var(--ath-muted)] underline">
                    The download does not work for me
                </button>
            ) : (
                <div className="mt-3 space-y-2">
                    <label htmlFor={`csv-skip-${lab.id}`} className="block text-xs text-[var(--ath-muted)]">
                        Sorry about that. Briefly, what happened? You can then continue, and you are welcome to email the file
                        later to {RESEARCH_EMAIL} with your Study ID.
                    </label>
                    <input
                        id={`csv-skip-${lab.id}`}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="editorial-input w-full text-sm"
                        placeholder="e.g. nothing happened when I clicked Export CSV"
                    />
                    <button type="button" onClick={skip} disabled={!reason.trim()} className="editorial-button-secondary px-4 py-2 text-xs disabled:opacity-60">
                        Continue without the file
                    </button>
                </div>
            )}
        </div>
    )
}
