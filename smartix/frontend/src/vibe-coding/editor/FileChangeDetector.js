import { useEffect, useRef } from 'react';
import { useSuggestions } from '../hooks/useSuggestions';

export const FileChangeDetector = ({ projectId, editor, onSuggestions }) => {
    const { fetchSuggestions } = useSuggestions();
    const lastContentRef = useRef({});
    const debounceTimerRef = useRef(null);

    useEffect(() => {
        if (!editor) return;

        const model = editor.getModel ? editor.getModel() : null;
        if (!model) return;

        const disposable = model.onDidChangeContent(() => {
            const filePath = model.uri.path;
            const currentContent = model.getValue();
            const lastContent = lastContentRef.current[filePath];

            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            debounceTimerRef.current = setTimeout(async () => {
                if (lastContent === undefined) {
                    await fetchSuggestions(projectId, 'file_created', filePath, currentContent);
                } else if (lastContent !== currentContent) {
                    await fetchSuggestions(projectId, 'file_modified', filePath, currentContent);
                }
                lastContentRef.current[filePath] = currentContent;
            }, 1000);
        });

        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            disposable.dispose();
        };
    }, [editor, projectId, fetchSuggestions]);

    return null;
};

export default FileChangeDetector;
