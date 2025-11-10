// Gestionnaire de l'interface utilisateur
class UIManager {
    constructor() {
        this.messagesContainer = null;
        this.messageInput = null;
        this.sendButton = null;
        this.emailForm = null;
        this.chatContainer = null;
        this.progressBar = null;
        this.isTyping = false;
        this.lastBotMessage = '';
    }

    // Initialisation de l'interface
    init() {
        try {
            console.log('🎨 Initialisation UI Manager...');
            
            // Récupération des éléments DOM
            this.messagesContainer = document.getElementById('messagesContainer');
            this.messageInput = document.getElementById('messageInput');
            this.sendButton = document.getElementById('sendButton');
            this.emailForm = document.getElementById('emailForm');
            this.chatContainer = document.getElementById('chatContainer');
            this.progressBar = document.getElementById('progressBar');
            this.progressFill = document.getElementById('progressFill');
            this.progressText = document.getElementById('progressText');

            // Configuration des événements
            this.setupEventListeners();
            
            // État initial
            this.showEmailForm();
            
            console.log('✅ UI Manager initialisé');
        } catch (error) {
            console.error('❌ Erreur initialisation UI Manager:', error);
            throw error;
        }
    }

    // Configuration des événements
    setupEventListeners() {
        // Formulaire email
        const startButton = document.getElementById('startQcm');
        const emailInput = document.getElementById('emailInput');
        
        if (startButton) {
            startButton.addEventListener('click', () => this.handleEmailSubmit());
        }
        
        if (emailInput) {
            emailInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleEmailSubmit();
                }
            });
            
            emailInput.addEventListener('input', () => this.validateEmailInput());
        }

        // Chat interface
        if (this.sendButton) {
            this.sendButton.addEventListener('click', () => this.handleSendMessage());
        }
        
        if (this.messageInput) {
            this.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSendMessage();
                }
            });
            
            this.messageInput.addEventListener('input', () => this.handleInputChange());
        }

        // Gestion des suggestions de questions
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('suggestion-chip')) {
                this.handleSuggestionClick(e.target.textContent);
            }
        });
    }

    // Gestion de la soumission d'email
    async handleEmailSubmit() {
        try {
            const emailInput = document.getElementById('emailInput');
            const consentCheckbox = document.getElementById('contactConsent');
            const startButton = document.getElementById('startQcm');
            
            const email = emailInput.value.trim();
            const consent = consentCheckbox.checked;
            
            if (!this.validateEmail(email)) {
                this.showEmailError('Veuillez entrer un email valide');
                return;
            }

            // Désactivation pendant le traitement
            startButton.disabled = true;
            startButton.textContent = 'Démarrage...';

            // Démarrage de la session
            await window.qcmManager.startSession(email, consent);
            
            // Transition vers le chat
            this.showChatInterface();
            this.showProgressBar();
            
        } catch (error) {
            console.error('❌ Erreur soumission email:', error);
            this.showEmailError(error.message || 'Une erreur s\'est produite');
            
            // Réactivation du bouton
            const startButton = document.getElementById('startQcm');
            startButton.disabled = false;
            startButton.textContent = 'Commencer le QCM';
        }
    }

    // Validation de l'email
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Validation en temps réel de l'input email
    validateEmailInput() {
        const emailInput = document.getElementById('emailInput');
        const startButton = document.getElementById('startQcm');
        
        const isValid = this.validateEmail(emailInput.value.trim());
        
        if (isValid) {
            emailInput.classList.remove('error');
            emailInput.classList.add('success');
            startButton.disabled = false;
        } else {
            emailInput.classList.remove('success');
            startButton.disabled = true;
        }
    }

    // Affichage d'erreur email
    showEmailError(message) {
        const emailInput = document.getElementById('emailInput');
        emailInput.classList.add('error');
        
        // Supprimer les anciens messages d'erreur
        const existingError = document.querySelector('.email-error');
        if (existingError) {
            existingError.remove();
        }
        
        // Créer un nouveau message d'erreur
        const errorDiv = document.createElement('div');
        errorDiv.className = 'email-error';
        errorDiv.style.color = 'var(--error-color)';
        errorDiv.style.fontSize = '0.9rem';
        errorDiv.style.marginTop = 'var(--spacing-sm)';
        errorDiv.textContent = message;
        
        emailInput.parentNode.after(errorDiv);
    }

    // Gestion de l'envoi de message
    async handleSendMessage() {
        try {
            const message = this.messageInput.value.trim();
            
            if (!message || this.isTyping) return;
            
            // Validation de la longueur
            if (message.length > CONFIG.MAX_MESSAGE_LENGTH) {
                this.showMessageError(`Message trop long (max ${CONFIG.MAX_MESSAGE_LENGTH} caractères)`);
                return;
            }

            // Ajout du message utilisateur
            this.addUserMessage(message);
            
            // Nettoyage de l'input
            this.messageInput.value = '';
            this.updateInputState();
            
            // Indicateur de frappe
            this.showTypingIndicator();
            
            // Traitement par le QCM Manager
            await window.qcmManager.processUserResponse(message);
            
        } catch (error) {
            console.error('❌ Erreur envoi message:', error);
            this.hideTypingIndicator();
            this.addBotMessage('Désolé, une erreur s\'est produite. Pouvez-vous reformuler ?');
        } finally {
            this.hideTypingIndicator();
        }
    }

    // Ajout d'un message utilisateur
    addUserMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';
        messageDiv.innerHTML = `
            <div class="avatar">👤</div>
            <div class="content">
                <p>${this.escapeHtml(message)}</p>
            </div>
        `;
        
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    // Ajout d'un message bot
    addBotMessage(message, suggestedQuestions = []) {
        this.lastBotMessage = message;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot-message';
        
        let suggestionsHtml = '';
        if (suggestedQuestions && suggestedQuestions.length > 0) {
            suggestionsHtml = `
                <div class="suggested-questions">
                    ${suggestedQuestions.map(q => 
                        `<span class="suggestion-chip">${this.escapeHtml(q)}</span>`
                    ).join('')}
                </div>
            `;
        }
        
        messageDiv.innerHTML = `
            <div class="avatar">🤖</div>
            <div class="content">
                <p>${this.escapeHtml(message)}</p>
                ${suggestionsHtml}
            </div>
        `;
        
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    // Gestion des suggestions cliquées
    handleSuggestionClick(suggestion) {
        this.messageInput.value = suggestion;
        this.updateInputState();
        this.messageInput.focus();
    }

    // Indicateur de frappe
    showTypingIndicator() {
        if (this.isTyping) return;
        
        this.isTyping = true;
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot-message typing-message';
        typingDiv.innerHTML = `
            <div class="avatar">🤖</div>
            <div class="content">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        
        this.messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    // Masquer l'indicateur de frappe
    hideTypingIndicator() {
        this.isTyping = false;
        const typingMessage = document.querySelector('.typing-message');
        if (typingMessage) {
            typingMessage.remove();
        }
    }

    // Mise à jour de l'état de l'input
    updateInputState() {
        const hasText = this.messageInput.value.trim().length > 0;
        this.sendButton.disabled = !hasText || this.isTyping;
    }

    // Gestion du changement d'input
    handleInputChange() {
        this.updateInputState();
        
        // Auto-resize du textarea si nécessaire
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = this.messageInput.scrollHeight + 'px';
    }

    // Désactivation de l'input
    disableInput(placeholder = 'Session terminée') {
        this.messageInput.disabled = true;
        this.messageInput.placeholder = placeholder;
        this.sendButton.disabled = true;
    }

    // Affichage du formulaire email
    showEmailForm() {
        this.emailForm.style.display = 'block';
        this.chatContainer.style.display = 'none';
        this.progressBar.style.display = 'none';
    }

    // Affichage du chat
    showChatInterface() {
        this.emailForm.style.display = 'none';
        this.chatContainer.style.display = 'flex';
        
        // Activation de l'input
        this.messageInput.disabled = false;
        this.messageInput.placeholder = 'Tapez votre réponse ici...';
        this.messageInput.focus();
    }

    // Affichage de la barre de progression
    showProgressBar() {
        this.progressBar.style.display = 'block';
        this.updateProgress(0, CONFIG.MAX_QUESTIONS_PER_SESSION);
    }

    // Mise à jour de la barre de progression
    updateProgress(current, total) {
        const percentage = (current / total) * 100;
        this.progressFill.style.width = `${percentage}%`;
        this.progressText.textContent = `${current} / ${total} questions`;
    }

    // Affichage d'erreur de message
    showMessageError(message) {
        // Créer une notification temporaire
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--error-color);
            color: white;
            padding: var(--spacing-md);
            border-radius: var(--border-radius-small);
            z-index: 1000;
            animation: slideInRight 0.3s ease-out;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Supprimer après 3 secondes
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Scroll vers le bas
    scrollToBottom() {
        setTimeout(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }, 100);
    }

    // Échappement HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Récupération du dernier message bot
    getLastBotMessage() {
        return this.lastBotMessage;
    }

    // Nettoyage de l'interface
    reset() {
        this.messagesContainer.innerHTML = '';
        this.messageInput.value = '';
        this.messageInput.disabled = false;
        this.sendButton.disabled = true;
        this.lastBotMessage = '';
        this.isTyping = false;
        
        // Reset du formulaire email
        document.getElementById('emailInput').value = '';
        document.getElementById('contactConsent').checked = false;
        
        // Affichage du formulaire email
        this.showEmailForm();
    }

    // Affichage d'état de connexion
    setConnectionStatus(isConnected) {
        const indicator = document.querySelector('.status-indicator');
        if (indicator) {
            indicator.style.background = isConnected ? 'var(--success-color)' : 'var(--error-color)';
        }
    }
}

// Instance globale
window.uiManager = new UIManager();