import { useState, useEffect, useCallback, useRef } from 'react';

const ICON_MAP = {
    image: '🖼',
    video: '🎬',
    audio: '🎵',
    pdf: '📄',
    zip: '🗜',
    default: '📎'
};

const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico'].includes(ext)) return ICON_MAP.image;
    if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) return ICON_MAP.video;
    if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return ICON_MAP.audio;
    if (ext === 'pdf') return ICON_MAP.pdf;
    if (['zip', 'tar', 'gz', 'rar'].includes(ext)) return ICON_MAP.zip;
    return ICON_MAP.default;
};

const isImage = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
};

const AssetManager = ({ projectId }) => {
    const [assets, setAssets]       = useState([]);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress]   = useState(0);
    const [feedback, setFeedback]   = useState(null);
    const [preview, setPreview]     = useState(null);
    const [search, setSearch]       = useState('');
    const [deleting, setDeleting]   = useState(null);
    const fileInputRef              = useRef(null);
    const dropZoneRef               = useRef(null);

    const loadAssets = useCallback(async () => {
        try {
            const response = await fetch(`/api/projects/${projectId}/storage/assets`);
            if (response.ok) setAssets(await response.json());
        } catch (e) {
            console.error('Erreur chargement assets:', e);
        }
    }, [projectId]);

    useEffect(() => {
        loadAssets();
    }, [loadAssets]);

    const showFeedback = (type, message) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 4000);
    };

    const uploadFiles = async (files) => {
        if (!files || files.length === 0) return;

        setUploading(true);
        setProgress(0);

        let successCount = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch(`/api/projects/${projectId}/storage/upload`, {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    successCount++;
                } else {
                    const err = await response.json();
                    showFeedback('error', `Erreur upload "${file.name}": ${err.detail || 'inconnu'}`);
                }
            } catch (e) {
                showFeedback('error', `Erreur upload "${file.name}": ${e.message}`);
            }

            setProgress(Math.round(((i + 1) / files.length) * 100));
        }

        setUploading(false);
        setProgress(0);

        if (successCount > 0) {
            showFeedback('success', `${successCount} fichier${successCount > 1 ? 's' : ''} uploadé${successCount > 1 ? 's' : ''} avec succès.`);
            await loadAssets();
        }
    };

    const handleFileChange = (e) => {
        uploadFiles(e.target.files);
        e.target.value = '';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.currentTarget.style.borderColor = '#313244';
        uploadFiles(e.dataTransfer.files);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.currentTarget.style.borderColor = '#89b4fa';
    };

    const handleDragLeave = (e) => {
        e.currentTarget.style.borderColor = '#313244';
    };

    const deleteAsset = async (asset) => {
        if (!window.confirm(`Supprimer "${asset.filename}" ?`)) return;

        setDeleting(asset.key);
        try {
            const response = await fetch(
                `/api/projects/${projectId}/storage/assets/${encodeURIComponent(asset.key)}`,
                { method: 'DELETE' }
            );
            if (response.ok) {
                showFeedback('success', `"${asset.filename}" supprimé.`);
                await loadAssets();
            } else {
                showFeedback('error', 'Impossible de supprimer le fichier.');
            }
        } catch (e) {
            showFeedback('error', e.message);
        }
        setDeleting(null);
    };

    const copyUrl = (url) => {
        navigator.clipboard.writeText(url).then(() => {
            showFeedback('success', 'URL copiée dans le presse-papiers.');
        });
    };

    const filteredAssets = assets.filter(a =>
        a.filename.toLowerCase().includes(search.toLowerCase())
    );

    const totalSize = assets.reduce((sum, a) => sum + a.size, 0);

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h3 style={styles.title}>📦 Gestionnaire d'assets</h3>
                <div style={styles.stats}>
                    {assets.length} fichier{assets.length !== 1 ? 's' : ''} · {humanSize(totalSize)}
                </div>
            </div>

            {feedback && (
                <div style={feedback.type === 'error' ? styles.errorMsg : styles.successMsg}>
                    {feedback.type === 'error' ? '❌ ' : '✅ '}{feedback.message}
                </div>
            )}

            <div
                ref={dropZoneRef}
                style={styles.dropZone}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !uploading && fileInputRef.current?.click()}
            >
                {uploading ? (
                    <div style={styles.uploadProgress}>
                        <div style={styles.progressBar}>
                            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
                        </div>
                        <span style={styles.progressText}>Upload en cours... {progress}%</span>
                    </div>
                ) : (
                    <>
                        <div style={styles.dropIcon}>⬆️</div>
                        <div style={styles.dropText}>Glisser-déposer des fichiers ou <strong>cliquer pour parcourir</strong></div>
                        <div style={styles.dropHint}>Images, vidéos, documents, archives...</div>
                    </>
                )}
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />
            </div>

            <div style={styles.searchRow}>
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher un fichier..."
                    style={styles.searchInput}
                />
                <button onClick={loadAssets} style={styles.refreshBtn} title="Actualiser">🔄</button>
            </div>

            {filteredAssets.length === 0 ? (
                <div style={styles.emptyState}>
                    {search ? `Aucun fichier correspondant à "${search}"` : 'Aucun asset uploadé. Glissez vos fichiers ci-dessus.'}
                </div>
            ) : (
                <div style={styles.grid}>
                    {filteredAssets.map(asset => (
                        <div key={asset.key} style={styles.card}>
                            <div style={styles.cardPreview}>
                                {isImage(asset.filename) ? (
                                    <img
                                        src={asset.url}
                                        alt={asset.filename}
                                        style={styles.thumbnail}
                                        onClick={() => setPreview(asset)}
                                    />
                                ) : (
                                    <div style={styles.fileIconLarge} onClick={() => setPreview(asset)}>
                                        {getFileIcon(asset.filename)}
                                    </div>
                                )}
                            </div>
                            <div style={styles.cardInfo}>
                                <div style={styles.filename} title={asset.filename}>
                                    {getFileIcon(asset.filename)} {asset.filename}
                                </div>
                                <div style={styles.fileMeta}>
                                    {asset.size_human} · {new Date(asset.last_modified).toLocaleDateString('fr-FR')}
                                </div>
                            </div>
                            <div style={styles.cardActions}>
                                <button style={styles.copyBtn} onClick={() => copyUrl(asset.url)} title="Copier l'URL">
                                    🔗
                                </button>
                                <a href={asset.url} target="_blank" rel="noreferrer" style={styles.downloadBtn} title="Ouvrir">
                                    ↗
                                </a>
                                <button
                                    style={styles.deleteBtn}
                                    onClick={() => deleteAsset(asset)}
                                    disabled={deleting === asset.key}
                                    title="Supprimer"
                                >
                                    {deleting === asset.key ? '⏳' : '🗑'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {preview && (
                <div style={styles.modal} onClick={() => setPreview(null)}>
                    <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <span style={styles.modalTitle}>{preview.filename}</span>
                            <button style={styles.modalClose} onClick={() => setPreview(null)}>✕</button>
                        </div>
                        {isImage(preview.filename) ? (
                            <img src={preview.url} alt={preview.filename} style={styles.modalImage} />
                        ) : (
                            <div style={styles.modalFileInfo}>
                                <div style={styles.modalFileIcon}>{getFileIcon(preview.filename)}</div>
                                <div>{preview.size_human}</div>
                            </div>
                        )}
                        <div style={styles.modalActions}>
                            <button style={styles.copyBtn} onClick={() => copyUrl(preview.url)}>🔗 Copier URL</button>
                            <a href={preview.url} target="_blank" rel="noreferrer" style={styles.modalDownload}>
                                ↗ Ouvrir
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const humanSize = (bytes) => {
    for (const unit of ['B', 'KB', 'MB', 'GB']) {
        if (bytes < 1024) return `${bytes.toFixed(1)} ${unit}`;
        bytes /= 1024;
    }
    return `${bytes.toFixed(1)} TB`;
};

const styles = {
    container: { padding: 16, overflow: 'auto', color: '#cdd6f4', fontFamily: 'sans-serif', fontSize: 13, boxSizing: 'border-box' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    title: { margin: 0, fontSize: 16, color: '#89b4fa' },
    stats: { fontSize: 12, color: '#6c7086' },
    errorMsg: { padding: '8px 12px', background: '#3b0f15', color: '#f38ba8', borderRadius: 5, marginBottom: 12 },
    successMsg: { padding: '8px 12px', background: '#0f2e15', color: '#a6e3a1', borderRadius: 5, marginBottom: 12 },
    dropZone: { border: '2px dashed #313244', borderRadius: 8, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', marginBottom: 12, transition: 'border-color .2s', background: '#181825' },
    dropIcon: { fontSize: 28, marginBottom: 6 },
    dropText: { color: '#a6adc8', marginBottom: 4 },
    dropHint: { fontSize: 11, color: '#6c7086' },
    uploadProgress: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
    progressBar: { width: '80%', height: 8, background: '#313244', borderRadius: 10, overflow: 'hidden' },
    progressFill: { height: '100%', background: '#89b4fa', transition: 'width .3s', borderRadius: 10 },
    progressText: { color: '#a6adc8', fontSize: 12 },
    searchRow: { display: 'flex', gap: 8, marginBottom: 12 },
    searchInput: { flex: 1, background: '#1e1e2e', border: '1px solid #313244', color: '#cdd6f4', borderRadius: 5, padding: '7px 10px', fontSize: 13, outline: 'none' },
    refreshBtn: { background: '#313244', border: 'none', color: '#cdd6f4', borderRadius: 5, padding: '6px 10px', cursor: 'pointer', fontSize: 14 },
    emptyState: { color: '#6c7086', fontStyle: 'italic', textAlign: 'center', padding: '30px 0' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 },
    card: { background: '#181825', border: '1px solid #313244', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
    cardPreview: { height: 100, background: '#1e1e2e', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' },
    thumbnail: { width: '100%', height: '100%', objectFit: 'cover' },
    fileIconLarge: { fontSize: 36 },
    cardInfo: { padding: '6px 8px', flex: 1 },
    filename: { fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 },
    fileMeta: { fontSize: 11, color: '#6c7086' },
    cardActions: { display: 'flex', borderTop: '1px solid #313244' },
    copyBtn: { flex: 1, background: 'none', border: 'none', color: '#89b4fa', cursor: 'pointer', padding: '6px 0', fontSize: 14 },
    downloadBtn: { flex: 1, background: 'none', border: 'none', color: '#a6e3a1', cursor: 'pointer', padding: '6px 0', fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    deleteBtn: { flex: 1, background: 'none', border: 'none', color: '#f38ba8', cursor: 'pointer', padding: '6px 0', fontSize: 14 },
    modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modalContent: { background: '#181825', borderRadius: 10, padding: 16, maxWidth: '80vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontWeight: 700, color: '#cdd6f4', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' },
    modalClose: { background: 'none', border: 'none', color: '#6c7086', cursor: 'pointer', fontSize: 18 },
    modalImage: { maxWidth: '70vw', maxHeight: '55vh', objectFit: 'contain', borderRadius: 6 },
    modalFileInfo: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' },
    modalFileIcon: { fontSize: 48, marginBottom: 8 },
    modalActions: { display: 'flex', gap: 8 },
    modalDownload: { background: '#313244', border: 'none', color: '#a6e3a1', borderRadius: 5, padding: '6px 14px', cursor: 'pointer', fontSize: 13, textDecoration: 'none' }
};

export default AssetManager;
