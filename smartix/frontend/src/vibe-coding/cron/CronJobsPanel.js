import { useState, useEffect, useCallback } from 'react';

const SCHEDULE_PRESETS = [
    { label: 'Chaque minute', value: '* * * * *' },
    { label: 'Toutes les heures', value: '0 * * * *' },
    { label: 'Tous les jours à minuit', value: '0 0 * * *' },
    { label: 'Tous les lundis à 8h', value: '0 8 * * 1' },
    { label: 'Le 1er de chaque mois', value: '0 0 1 * *' }
];

const CronJobsPanel = ({ projectId }) => {
    const [jobs, setJobs]       = useState([]);
    const [newJob, setNewJob]   = useState({ schedule: '0 * * * *', command: '', name: '' });
    const [adding, setAdding]   = useState(false);
    const [testing, setTesting] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [logs, setLogs]       = useState({});
    const [expandedLogs, setExpandedLogs] = useState(null);

    const loadJobs = useCallback(async () => {
        try {
            const response = await fetch(`/api/projects/${projectId}/cron`);
            if (response.ok) setJobs(await response.json());
        } catch (e) {
            console.error('Erreur chargement cron jobs:', e);
        }
    }, [projectId]);

    useEffect(() => {
        loadJobs();
        const interval = setInterval(loadJobs, 30000);
        return () => clearInterval(interval);
    }, [loadJobs]);

    const showFeedback = (type, message) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 4000);
    };

    const addJob = async () => {
        if (!newJob.command.trim()) {
            showFeedback('error', 'La commande est requise.');
            return;
        }
        if (!newJob.schedule.trim()) {
            showFeedback('error', 'L\'expression cron est requise.');
            return;
        }

        setAdding(true);
        try {
            const response = await fetch(`/api/projects/${projectId}/cron`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newJob)
            });

            if (response.ok) {
                showFeedback('success', 'Tâche ajoutée avec succès.');
                setNewJob({ schedule: '0 * * * *', command: '', name: '' });
                await loadJobs();
            } else {
                const err = await response.json();
                showFeedback('error', err.detail || 'Erreur lors de l\'ajout.');
            }
        } catch (e) {
            showFeedback('error', e.message);
        }
        setAdding(false);
    };

    const deleteJob = async (jobId) => {
        if (!window.confirm('Supprimer cette tâche planifiée ?')) return;
        try {
            await fetch(`/api/projects/${projectId}/cron/${jobId}`, { method: 'DELETE' });
            showFeedback('success', 'Tâche supprimée.');
            await loadJobs();
        } catch (e) {
            showFeedback('error', e.message);
        }
    };

    const testJob = async (jobId) => {
        setTesting(jobId);
        try {
            const response = await fetch(`/api/projects/${projectId}/cron/${jobId}/test`, {
                method: 'POST'
            });
            const result = await response.json();
            if (result.error) {
                showFeedback('error', `Test échoué: ${result.error}`);
            } else {
                showFeedback('success', `Test exécuté en ${result.duration_ms}ms`);
                await loadJobLogs(jobId);
            }
        } catch (e) {
            showFeedback('error', e.message);
        }
        setTesting(null);
    };

    const loadJobLogs = async (jobId) => {
        try {
            const response = await fetch(`/api/projects/${projectId}/cron/${jobId}/logs`);
            if (response.ok) {
                const jobLogs = await response.json();
                setLogs(prev => ({ ...prev, [jobId]: jobLogs }));
                setExpandedLogs(jobId);
            }
        } catch (e) {
            console.error('Erreur chargement logs:', e);
        }
    };

    const formatDate = (iso) => {
        if (!iso) return 'jamais';
        return new Date(iso).toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    };

    return (
        <div style={styles.container}>
            <h3 style={styles.title}>⏰ Tâches planifiées (Cron)</h3>

            {feedback && (
                <div style={feedback.type === 'error' ? styles.errorMsg : styles.successMsg}>
                    {feedback.type === 'error' ? '❌ ' : '✅ '}{feedback.message}
                </div>
            )}

            <div style={styles.newJobCard}>
                <h4 style={styles.cardTitle}>➕ Nouvelle tâche</h4>

                <label style={styles.label}>Nom (optionnel)</label>
                <input
                    value={newJob.name}
                    onChange={(e) => setNewJob({ ...newJob, name: e.target.value })}
                    placeholder="Ex: Nettoyage quotidien"
                    style={styles.input}
                />

                <label style={styles.label}>Expression cron</label>
                <div style={styles.scheduleRow}>
                    <input
                        value={newJob.schedule}
                        onChange={(e) => setNewJob({ ...newJob, schedule: e.target.value })}
                        placeholder="* * * * *"
                        style={{ ...styles.input, fontFamily: 'monospace', flex: 1 }}
                    />
                    <select
                        style={styles.presetSelect}
                        onChange={(e) => e.target.value && setNewJob({ ...newJob, schedule: e.target.value })}
                        defaultValue=""
                    >
                        <option value="">Préréglages...</option>
                        {SCHEDULE_PRESETS.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                    </select>
                </div>

                <div style={styles.cronHelp}>
                    {['Minute\n(0-59)', 'Heure\n(0-23)', 'Jour\n(1-31)', 'Mois\n(1-12)', 'Semaine\n(0-6)'].map((label, i) => (
                        <span key={i} style={styles.cronHelpItem}>{label}</span>
                    ))}
                </div>

                <label style={styles.label}>Commande</label>
                <input
                    value={newJob.command}
                    onChange={(e) => setNewJob({ ...newJob, command: e.target.value })}
                    placeholder="python script.py ou node task.js"
                    style={{ ...styles.input, fontFamily: 'monospace' }}
                    onKeyDown={(e) => e.key === 'Enter' && addJob()}
                />

                <button onClick={addJob} disabled={adding} style={styles.addBtn}>
                    {adding ? '⏳ Ajout...' : '✅ Ajouter la tâche'}
                </button>
            </div>

            <div>
                <h4 style={styles.cardTitle}>
                    📋 Tâches existantes ({jobs.length})
                    <button style={styles.refreshSmall} onClick={loadJobs}>🔄</button>
                </h4>

                {jobs.length === 0 ? (
                    <p style={styles.emptyText}>Aucune tâche planifiée. Créez-en une ci-dessus.</p>
                ) : (
                    <div style={styles.jobsList}>
                        {jobs.map(job => (
                            <div key={job.id} style={styles.jobCard}>
                                <div style={styles.jobHeader}>
                                    <div>
                                        <span style={styles.jobName}>{job.name || job.command}</span>
                                        <span style={{
                                            ...styles.statusBadge,
                                            ...(job.last_status === 'success' ? styles.badgeSuccess
                                                : job.last_status === 'error' ? styles.badgeError
                                                : styles.badgeNeutral)
                                        }}>
                                            {job.last_status || 'jamais exécuté'}
                                        </span>
                                    </div>
                                    <div style={styles.jobActions}>
                                        <button
                                            style={styles.testBtn}
                                            onClick={() => testJob(job.id)}
                                            disabled={testing === job.id}
                                            title="Exécuter maintenant"
                                        >
                                            {testing === job.id ? '⏳' : '▶ Tester'}
                                        </button>
                                        <button
                                            style={styles.logsBtn}
                                            onClick={() => expandedLogs === job.id
                                                ? setExpandedLogs(null)
                                                : loadJobLogs(job.id)
                                            }
                                        >
                                            📜 Logs
                                        </button>
                                        <button
                                            style={styles.deleteBtn}
                                            onClick={() => deleteJob(job.id)}
                                            title="Supprimer"
                                        >
                                            🗑
                                        </button>
                                    </div>
                                </div>

                                <div style={styles.jobDetails}>
                                    <span style={styles.detailItem}>
                                        <span style={styles.detailLabel}>Planification:</span>
                                        <code style={styles.code}>{job.schedule}</code>
                                    </span>
                                    <span style={styles.detailItem}>
                                        <span style={styles.detailLabel}>Commande:</span>
                                        <code style={styles.code}>$ {job.command}</code>
                                    </span>
                                    <span style={styles.detailItem}>
                                        <span style={styles.detailLabel}>Prochaine:</span>
                                        <span>{formatDate(job.next_run)}</span>
                                    </span>
                                    <span style={styles.detailItem}>
                                        <span style={styles.detailLabel}>Dernière:</span>
                                        <span>{formatDate(job.last_run)}</span>
                                    </span>
                                </div>

                                {expandedLogs === job.id && logs[job.id] && (
                                    <div style={styles.logsBox}>
                                        <div style={styles.logsTitle}>📜 Historique des exécutions</div>
                                        {logs[job.id].length === 0 ? (
                                            <div style={styles.noLogs}>Aucun log disponible.</div>
                                        ) : (
                                            logs[job.id].slice().reverse().map((log, i) => (
                                                <div key={i} style={styles.logEntry}>
                                                    <div style={styles.logHeader}>
                                                        <span style={log.success ? styles.logOk : styles.logErr}>
                                                            {log.success ? '✅ OK' : '❌ ERREUR'}
                                                        </span>
                                                        <span style={styles.logDate}>{formatDate(log.started_at)}</span>
                                                        <span style={styles.logDuration}>{log.duration_ms}ms</span>
                                                    </div>
                                                    {log.output && (
                                                        <pre style={styles.logOutput}>{log.output}</pre>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const styles = {
    container: { padding: 16, overflow: 'auto', color: '#cdd6f4', fontFamily: 'sans-serif', fontSize: 13 },
    title: { margin: '0 0 16px', fontSize: 16, color: '#89b4fa' },
    newJobCard: { background: '#181825', border: '1px solid #313244', borderRadius: 8, padding: 16, marginBottom: 20 },
    cardTitle: { margin: '0 0 12px', fontSize: 14, color: '#cdd6f4', display: 'flex', alignItems: 'center', gap: 8 },
    label: { display: 'block', color: '#6c7086', fontSize: 12, marginBottom: 4, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { width: '100%', background: '#1e1e2e', border: '1px solid #313244', color: '#cdd6f4', borderRadius: 5, padding: '7px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
    scheduleRow: { display: 'flex', gap: 8, alignItems: 'center' },
    presetSelect: { background: '#1e1e2e', border: '1px solid #313244', color: '#cdd6f4', borderRadius: 5, padding: '7px 8px', fontSize: 12, outline: 'none', flexShrink: 0 },
    cronHelp: { display: 'flex', gap: 8, marginTop: 6, marginBottom: 4 },
    cronHelpItem: { flex: 1, textAlign: 'center', fontSize: 10, color: '#6c7086', background: '#1e1e2e', borderRadius: 4, padding: '3px 2px', whiteSpace: 'pre-line', lineHeight: 1.3 },
    addBtn: { marginTop: 14, background: '#a6e3a1', border: 'none', color: '#1e1e2e', borderRadius: 5, padding: '8px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 13 },
    refreshSmall: { background: 'none', border: 'none', color: '#6c7086', cursor: 'pointer', fontSize: 13, padding: '0 4px' },
    emptyText: { color: '#6c7086', fontStyle: 'italic' },
    jobsList: { display: 'flex', flexDirection: 'column', gap: 10 },
    jobCard: { background: '#181825', border: '1px solid #313244', borderRadius: 8, padding: 12 },
    jobHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    jobName: { fontWeight: 700, color: '#cdd6f4', fontSize: 14 },
    statusBadge: { marginLeft: 8, fontSize: 11, borderRadius: 10, padding: '2px 8px' },
    badgeSuccess: { background: '#0f2e15', color: '#a6e3a1' },
    badgeError: { background: '#3b0f15', color: '#f38ba8' },
    badgeNeutral: { background: '#313244', color: '#6c7086' },
    jobActions: { display: 'flex', gap: 6 },
    testBtn: { background: '#89b4fa', border: 'none', color: '#1e1e2e', borderRadius: 5, padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 },
    logsBtn: { background: '#313244', border: 'none', color: '#cdd6f4', borderRadius: 5, padding: '5px 10px', cursor: 'pointer', fontSize: 12 },
    deleteBtn: { background: '#313244', border: 'none', color: '#f38ba8', borderRadius: 5, padding: '5px 10px', cursor: 'pointer', fontSize: 12 },
    jobDetails: { display: 'flex', flexWrap: 'wrap', gap: '4px 16px' },
    detailItem: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 },
    detailLabel: { color: '#6c7086' },
    code: { background: '#1e1e2e', borderRadius: 3, padding: '1px 6px', color: '#f5c2e7', fontFamily: 'monospace', fontSize: 11 },
    logsBox: { marginTop: 10, background: '#1e1e2e', borderRadius: 6, padding: 10, border: '1px solid #313244' },
    logsTitle: { color: '#89b4fa', fontSize: 12, marginBottom: 8, fontWeight: 700 },
    noLogs: { color: '#6c7086', fontStyle: 'italic', fontSize: 12 },
    logEntry: { marginBottom: 8, borderBottom: '1px solid #313244', paddingBottom: 8 },
    logHeader: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 },
    logOk: { color: '#a6e3a1', fontSize: 12, fontWeight: 700 },
    logErr: { color: '#f38ba8', fontSize: 12, fontWeight: 700 },
    logDate: { color: '#6c7086', fontSize: 11 },
    logDuration: { color: '#a6adc8', fontSize: 11, background: '#313244', borderRadius: 10, padding: '1px 6px' },
    logOutput: { margin: 0, background: '#181825', borderRadius: 4, padding: '6px 8px', color: '#a6adc8', fontSize: 11, fontFamily: 'monospace', overflowX: 'auto', maxHeight: 150 },
    errorMsg: { padding: '8px 12px', background: '#3b0f15', color: '#f38ba8', borderRadius: 5, marginBottom: 12 },
    successMsg: { padding: '8px 12px', background: '#0f2e15', color: '#a6e3a1', borderRadius: 5, marginBottom: 12 }
};

export default CronJobsPanel;
