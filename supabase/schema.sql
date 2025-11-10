-- Configuration Supabase pour le projet QCM Intelligent
-- Exécutez ces scripts dans l'ordre dans votre dashboard Supabase

-- 1. Création de la table des sessions
CREATE TABLE IF NOT EXISTS qcm_sessions (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    consent_recontact BOOLEAN DEFAULT FALSE,
    questions_count INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    completed_at TIMESTAMP WITH TIME ZONE,
    final_feedback TEXT,
    user_agent TEXT,
    ip_address INET
);

-- 2. Création de la table des réponses
CREATE TABLE IF NOT EXISTS qcm_responses (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL REFERENCES qcm_sessions(session_id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(100),
    question_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    metadata JSONB
);

-- 3. Création des index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_qcm_sessions_session_id ON qcm_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_qcm_sessions_email ON qcm_sessions(email);
CREATE INDEX IF NOT EXISTS idx_qcm_sessions_created_at ON qcm_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_qcm_responses_session_id ON qcm_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_qcm_responses_created_at ON qcm_responses(created_at);
CREATE INDEX IF NOT EXISTS idx_qcm_responses_category ON qcm_responses(category);

-- 4. Création d'une fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. Trigger pour la mise à jour automatique de updated_at
CREATE TRIGGER update_qcm_sessions_updated_at 
    BEFORE UPDATE ON qcm_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 6. Création d'une vue pour les statistiques
CREATE OR REPLACE VIEW qcm_stats AS
SELECT 
    COUNT(DISTINCT s.session_id) as total_sessions,
    COUNT(DISTINCT CASE WHEN s.is_completed THEN s.session_id END) as completed_sessions,
    AVG(s.questions_count) as avg_questions_per_session,
    COUNT(DISTINCT s.email) as unique_emails,
    COUNT(DISTINCT CASE WHEN s.consent_recontact THEN s.email END) as consent_emails,
    DATE_TRUNC('day', s.created_at) as date,
    COUNT(*) as daily_sessions
FROM qcm_sessions s
GROUP BY DATE_TRUNC('day', s.created_at)
ORDER BY date DESC;

-- 7. Création d'une vue pour l'analyse des catégories
CREATE OR REPLACE VIEW qcm_category_analysis AS
SELECT 
    r.category,
    COUNT(*) as response_count,
    COUNT(DISTINCT r.session_id) as unique_sessions,
    AVG(LENGTH(r.answer)) as avg_answer_length,
    DATE_TRUNC('day', r.created_at) as date
FROM qcm_responses r
WHERE r.category IS NOT NULL
GROUP BY r.category, DATE_TRUNC('day', r.created_at)
ORDER BY date DESC, response_count DESC;

-- 8. Configuration RLS (Row Level Security)
ALTER TABLE qcm_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qcm_responses ENABLE ROW LEVEL SECURITY;

-- 9. Politique RLS pour permettre les insertions anonymes
CREATE POLICY "Allow anonymous insert on qcm_sessions" 
ON qcm_sessions FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow anonymous select own session" 
ON qcm_sessions FOR SELECT 
USING (true);

CREATE POLICY "Allow anonymous update own session" 
ON qcm_sessions FOR UPDATE 
USING (true);

CREATE POLICY "Allow anonymous insert on qcm_responses" 
ON qcm_responses FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow anonymous select on qcm_responses" 
ON qcm_responses FOR SELECT 
USING (true);

-- 10. Fonction pour nettoyer les anciennes sessions (optionnel)
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS void AS $$
BEGIN
    -- Supprimer les sessions incomplètes de plus de 24h
    DELETE FROM qcm_sessions 
    WHERE is_completed = FALSE 
    AND created_at < NOW() - INTERVAL '24 hours';
    
    -- Marquer comme complétées les sessions avec plus de 10 questions
    UPDATE qcm_sessions 
    SET is_completed = TRUE, 
        completed_at = NOW() 
    WHERE questions_count >= 10 
    AND is_completed = FALSE;
END;
$$ LANGUAGE plpgsql;

-- 11. Création d'une extension pour générer des UUIDs (si pas déjà activée)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

COMMENT ON TABLE qcm_sessions IS 'Stockage des sessions utilisateur pour le QCM';
COMMENT ON TABLE qcm_responses IS 'Stockage des questions et réponses du QCM';
COMMENT ON VIEW qcm_stats IS 'Statistiques globales des sessions QCM';
COMMENT ON VIEW qcm_category_analysis IS 'Analyse des réponses par catégorie';