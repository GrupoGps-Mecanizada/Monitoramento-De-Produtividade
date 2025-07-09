// =============================================================================
// PRODUCTIVITY RULES MODULE - Sistema de Regras de Negócio Configurável
// =============================================================================

class ProductivityRules {
    constructor(coreInstance) {
        this.core = coreInstance;
        this.version = '1.0.0';
        this.rulesConfig = null;
        this.defaultRules = null;
        this.ruleHistory = [];
        this.isDirty = false;
        
        // Status de telemetria conhecidos
        this.knownTelemetryStatuses = [
            'running', 'on', 'stopped', 'off', 'maintenance', 
            'out_of_plant', 'not_appropriated', 'no_data', 
            'secondary_motor_on', 'idle', 'working', 'error'
        ];
        
        // Categorias de apontamentos conhecidas
        this.knownAppointmentCategories = [
            'Abastecimento', 'Bloqueio', 'Descarregamento', 'Documentação',
            'Preparação', 'Pequenas manutenções', 'Manutenção', 'Refeição Motorista',
            'Aguardando', 'Aguardando Área', 'Aguardando semáforo/cancela',
            'Aguardando carreta bascular', 'Troca de Equipamento'
        ];
        
        // Grupos de equipamentos conhecidos
        this.knownEquipmentGroups = [
            'Alta Pressão', 'Baixa Pressão', 'Vácuo', 'Caminhões', 
            'Escavadeiras', 'Outros'
        ];

        this.initializeRulesSystem();
    }

    // =============================================================================
    // INICIALIZAÇÃO DO SISTEMA DE REGRAS
    // =============================================================================
    initializeRulesSystem() {
        this.core.addDebugLog('Rules Module inicializado');
        this.createDefaultRules();
        this.loadSavedRules();
        this.setupEventListeners();
    }

    createDefaultRules() {
        this.defaultRules = {
            version: this.version,
            lastModified: new Date().toISOString(),
            telemetryRules: {
                // Status produtivos
                'running': 'productive',
                'on': 'productive',
                'working': 'productive',
                
                // Status não produtivos
                'stopped': 'non-productive',
                'off': 'non-productive',
                'maintenance': 'non-productive',
                'out_of_plant': 'non-productive',
                'error': 'non-productive',
                
                // Status neutros
                'not_appropriated': 'neutral',
                'no_data': 'neutral',
                'idle': 'neutral',
                'secondary_motor_on': 'neutral'
            },
            appointmentRules: {
                // Atividades produtivas
                'Preparação': 'productive',
                'Documentação': 'productive',
                'Abastecimento': 'productive',
                'Descarregamento': 'productive',
                
                // Atividades não produtivas
                'Manutenção': 'non-productive',
                'Pequenas manutenções': 'non-productive',
                'Bloqueio': 'non-productive',
                'Troca de Equipamento': 'non-productive',
                
                // Atividades neutras
                'Refeição Motorista': 'neutral',
                'Aguardando': 'neutral',
                'Aguardando Área': 'neutral',
                'Aguardando semáforo/cancela': 'neutral',
                'Aguardando carreta bascular': 'neutral'
            },
            groupSpecificRules: {
                'Alta Pressão': {
                    overrides: {
                        // Regras específicas para alta pressão
                        'stopped': 'productive', // Paradas podem ser operacionais
                        'Aguardando': 'productive' // Aguardar pode ser parte do processo
                    }
                },
                'Baixa Pressão': {
                    overrides: {
                        'idle': 'productive' // Idle pode ser operacional em baixa pressão
                    }
                },
                'Vácuo': {
                    overrides: {
                        'secondary_motor_on': 'productive' // Motor secundário é operacional
                    }
                },
                'Caminhões': {
                    overrides: {
                        'Aguardando': 'non-productive', // Aguardar é improdutivo para caminhões
                        'stopped': 'non-productive'
                    }
                }
            },
            globalSettings: {
                conflictResolution: 'priority', // priority, latest, longest
                gapTolerance: 60, // segundos
                confidenceThreshold: 0.8,
                defaultClassification: 'neutral',
                enableGroupOverrides: true,
                enableTimeBasedRules: false
            },
            metadata: {
                createdBy: 'System',
                createdAt: new Date().toISOString(),
                description: 'Regras padrão de produtividade para equipamentos GrupoGPS'
            }
        };

        this.core.addDebugLog('Regras padrão criadas');
    }

    setupEventListeners() {
        this.core.addEventListener('equipmentDataUpdated', (event) => {
            this.updateKnownValues(event.detail);
        });
        
        // Auto-save quando mudanças são feitas
        setInterval(() => {
            if (this.isDirty) {
                this.saveRules();
                this.isDirty = false;
            }
        }, 30000); // Auto-save a cada 30 segundos
    }

    // =============================================================================
    // GERENCIAMENTO DE REGRAS
    // =============================================================================
    loadSavedRules() {
        try {
            const savedRules = localStorage.getItem('productivity_rules');
            if (savedRules) {
                const parsed = JSON.parse(savedRules);
                
                // Validar estrutura das regras
                if (this.validateRulesStructure(parsed)) {
                    this.rulesConfig = parsed;
                    this.core.addDebugLog(`Regras carregadas (versão ${parsed.version})`);
                } else {
                    this.core.addDebugLog('Regras salvas inválidas, usando padrão', 'warning');
                    this.rulesConfig = { ...this.defaultRules };
                }
            } else {
                this.rulesConfig = { ...this.defaultRules };
                this.core.addDebugLog('Usando regras padrão');
            }
        } catch (error) {
            this.core.addDebugLog(`Erro ao carregar regras: ${error.message}`, 'error');
            this.rulesConfig = { ...this.defaultRules };
        }
    }

    saveRules() {
        try {
            if (!this.rulesConfig) {
                this.core.addDebugLog('Nenhuma regra para salvar', 'warning');
                return false;
            }

            // Atualizar metadados
            this.rulesConfig.lastModified = new Date().toISOString();
            this.rulesConfig.version = this.version;

            // Salvar no localStorage
            localStorage.setItem('productivity_rules', JSON.stringify(this.rulesConfig));
            
            // Adicionar ao histórico
            this.addToHistory('saved', this.rulesConfig);
            
            this.core.addDebugLog('Regras salvas com sucesso');
            this.core.dispatchEvent('rulesSaved', { rules: this.rulesConfig });
            
            return true;
        } catch (error) {
            this.core.addDebugLog(`Erro ao salvar regras: ${error.message}`, 'error');
            return false;
        }
    }

    validateRulesStructure(rules) {
        const requiredFields = ['telemetryRules', 'appointmentRules', 'globalSettings'];
        
        if (!rules || typeof rules !== 'object') return false;
        
        for (const field of requiredFields) {
            if (!rules[field] || typeof rules[field] !== 'object') {
                this.core.addDebugLog(`Campo obrigatório ausente: ${field}`, 'warning');
                return false;
            }
        }
        
        // Validar valores das regras
        const validClassifications = ['productive', 'non-productive', 'neutral'];
        
        for (const [status, classification] of Object.entries(rules.telemetryRules)) {
            if (!validClassifications.includes(classification)) {
                this.core.addDebugLog(`Classificação inválida para ${status}: ${classification}`, 'warning');
                return false;
            }
        }
        
        return true;
    }

    // =============================================================================
    // INTERFACE DE CONFIGURAÇÃO DE REGRAS
    // =============================================================================
    renderRulesInterface() {
        this.core.addDebugLog('Renderizando interface de regras');
        
        this.renderTelemetryRules();
        this.renderAppointmentRules();
        this.renderGroupRules();
        this.updateGlobalSettings();
    }

    renderTelemetryRules() {
        const container = document.getElementById('telemetryRulesGrid');
        if (!container) return;

        container.innerHTML = '';

        // Combinar status conhecidos com regras existentes
        const allStatuses = new Set([
            ...this.knownTelemetryStatuses,
            ...Object.keys(this.rulesConfig.telemetryRules)
        ]);

        Array.from(allStatuses).sort().forEach(status => {
            const currentRule = this.rulesConfig.telemetryRules[status] || 'neutral';
            
            const ruleItem = document.createElement('div');
            ruleItem.className = 'rule-item';
            ruleItem.innerHTML = `
                <span class="status-name" title="Status de telemetria">${status}</span>
                <select class="productivity-classification" data-status="${status}" data-type="telemetry">
                    <option value="productive" ${currentRule === 'productive' ? 'selected' : ''}>Produtivo</option>
                    <option value="non-productive" ${currentRule === 'non-productive' ? 'selected' : ''}>Não Produtivo</option>
                    <option value="neutral" ${currentRule === 'neutral' ? 'selected' : ''}>Neutro</option>
                </select>
            `;
            
            container.appendChild(ruleItem);
        });

        // Adicionar event listeners
        container.querySelectorAll('.productivity-classification').forEach(select => {
            select.addEventListener('change', (e) => {
                this.updateRule('telemetry', e.target.dataset.status, e.target.value);
            });
        });

        this.core.addDebugLog(`Renderizadas ${allStatuses.size} regras de telemetria`);
    }

    renderAppointmentRules() {
        const container = document.getElementById('appointmentRulesGrid');
        if (!container) return;

        container.innerHTML = '';

        // Combinar categorias conhecidas com regras existentes
        const allCategories = new Set([
            ...this.knownAppointmentCategories,
            ...Object.keys(this.rulesConfig.appointmentRules)
        ]);

        Array.from(allCategories).sort().forEach(category => {
            const currentRule = this.rulesConfig.appointmentRules[category] || 'neutral';
            
            const ruleItem = document.createElement('div');
            ruleItem.className = 'rule-item';
            ruleItem.innerHTML = `
                <span class="status-name" title="Categoria de apontamento">${category}</span>
                <select class="productivity-classification" data-category="${category}" data-type="appointment">
                    <option value="productive" ${currentRule === 'productive' ? 'selected' : ''}>Produtivo</option>
                    <option value="non-productive" ${currentRule === 'non-productive' ? 'selected' : ''}>Não Produtivo</option>
                    <option value="neutral" ${currentRule === 'neutral' ? 'selected' : ''}>Neutro</option>
                </select>
            `;
            
            container.appendChild(ruleItem);
        });

        // Adicionar event listeners
        container.querySelectorAll('.productivity-classification').forEach(select => {
            select.addEventListener('change', (e) => {
                this.updateRule('appointment', e.target.dataset.category, e.target.value);
            });
        });

        this.core.addDebugLog(`Renderizadas ${allCategories.size} regras de apontamentos`);
    }

    renderGroupRules() {
        const container = document.getElementById('groupRulesContainer');
        if (!container) return;

        container.innerHTML = '';

        this.knownEquipmentGroups.forEach(group => {
            const groupConfig = this.rulesConfig.groupSpecificRules[group] || { overrides: {} };
            
            const groupSection = document.createElement('div');
            groupSection.className = 'rules-section';
            groupSection.style.marginBottom = '1rem';
            
            groupSection.innerHTML = `
                <h4 style="color: #2c3e50; margin-bottom: 1rem;">${group}</h4>
                <div class="group-overrides" id="group-${group.replace(/\s+/g, '-')}" style="
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 0.5rem;
                "></div>
                <button class="btn secondary" onclick="productivitySystem.rules.addGroupOverride('${group}')" style="
                    margin-top: 1rem;
                    padding: 0.5rem 1rem;
                    font-size: 0.85rem;
                ">
                    <span>+</span> Adicionar Override
                </button>
            `;
            
            container.appendChild(groupSection);
            
            // Renderizar overrides existentes
            this.renderGroupOverrides(group, groupConfig.overrides);
        });

        this.core.addDebugLog(`Renderizadas regras para ${this.knownEquipmentGroups.length} grupos`);
    }

    renderGroupOverrides(group, overrides) {
        const container = document.getElementById(`group-${group.replace(/\s+/g, '-')}`);
        if (!container) return;

        container.innerHTML = '';

        Object.entries(overrides).forEach(([key, value]) => {
            const overrideItem = document.createElement('div');
            overrideItem.className = 'rule-item';
            overrideItem.style.display = 'flex';
            overrideItem.style.alignItems = 'center';
            overrideItem.style.gap = '0.5rem';
            
            overrideItem.innerHTML = `
                <span style="font-weight: 600; flex: 1;">${key}</span>
                <select style="flex: 0 0 140px;" data-group="${group}" data-key="${key}">
                    <option value="productive" ${value === 'productive' ? 'selected' : ''}>Produtivo</option>
                    <option value="non-productive" ${value === 'non-productive' ? 'selected' : ''}>Não Produtivo</option>
                    <option value="neutral" ${value === 'neutral' ? 'selected' : ''}>Neutro</option>
                </select>
                <button onclick="productivitySystem.rules.removeGroupOverride('${group}', '${key}')" style="
                    background: #e74c3c;
                    color: white;
                    border: none;
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.8rem;
                ">×</button>
            `;
            
            container.appendChild(overrideItem);
        });

        // Adicionar event listeners
        container.querySelectorAll('select').forEach(select => {
            select.addEventListener('change', (e) => {
                this.updateGroupOverride(e.target.dataset.group, e.target.dataset.key, e.target.value);
            });
        });
    }

    // =============================================================================
    // ATUALIZAÇÃO DE REGRAS
    // =============================================================================
    updateRule(type, key, value) {
        if (!this.rulesConfig) return;

        const targetRules = type === 'telemetry' ? 'telemetryRules' : 'appointmentRules';
        
        if (!this.rulesConfig[targetRules]) {
            this.rulesConfig[targetRules] = {};
        }

        const oldValue = this.rulesConfig[targetRules][key];
        this.rulesConfig[targetRules][key] = value;
        
        this.isDirty = true;
        this.addToHistory('updated', { type, key, oldValue, newValue: value });
        
        this.core.addDebugLog(`Regra atualizada: ${type}[${key}] = ${value}`);
        this.core.dispatchEvent('ruleUpdated', { type, key, value });
    }

    updateGroupOverride(group, key, value) {
        if (!this.rulesConfig.groupSpecificRules[group]) {
            this.rulesConfig.groupSpecificRules[group] = { overrides: {} };
        }

        const oldValue = this.rulesConfig.groupSpecificRules[group].overrides[key];
        this.rulesConfig.groupSpecificRules[group].overrides[key] = value;
        
        this.isDirty = true;
        this.addToHistory('group_updated', { group, key, oldValue, newValue: value });
        
        this.core.addDebugLog(`Override de grupo atualizado: ${group}[${key}] = ${value}`);
    }

    addGroupOverride(group) {
        const key = prompt('Digite o status ou categoria para override:');
        if (!key || key.trim() === '') return;

        const value = prompt('Classificação (productive/non-productive/neutral):', 'neutral');
        if (!['productive', 'non-productive', 'neutral'].includes(value)) {
            alert('Classificação inválida!');
            return;
        }

        if (!this.rulesConfig.groupSpecificRules[group]) {
            this.rulesConfig.groupSpecificRules[group] = { overrides: {} };
        }

        this.rulesConfig.groupSpecificRules[group].overrides[key] = value;
        this.isDirty = true;
        
        this.renderGroupOverrides(group, this.rulesConfig.groupSpecificRules[group].overrides);
        this.core.addDebugLog(`Override adicionado para ${group}: ${key} = ${value}`);
    }

    removeGroupOverride(group, key) {
        if (confirm(`Remover override "${key}" do grupo "${group}"?`)) {
            delete this.rulesConfig.groupSpecificRules[group].overrides[key];
            this.isDirty = true;
            
            this.renderGroupOverrides(group, this.rulesConfig.groupSpecificRules[group].overrides);
            this.core.addDebugLog(`Override removido: ${group}[${key}]`);
        }
    }

    updateGlobalSettings() {
        const settings = this.rulesConfig.globalSettings;
        
        // Atualizar controles da interface se existirem
        const conflictResolutionSelect = document.getElementById('conflictResolution');
        if (conflictResolutionSelect) {
            conflictResolutionSelect.value = settings.conflictResolution;
        }

        const gapToleranceSelect = document.getElementById('gapTolerance');
        if (gapToleranceSelect) {
            gapToleranceSelect.value = settings.gapTolerance;
        }
    }

    // =============================================================================
    // APLICAÇÃO DE REGRAS
    // =============================================================================
    applyRules(activity, activityType, equipmentGroup = null) {
        if (!this.rulesConfig) {
            this.core.addDebugLog('Regras não carregadas, usando classificação padrão', 'warning');
            return 'neutral';
        }

        try {
            // 1. Verificar override específico do grupo primeiro
            if (equipmentGroup && this.rulesConfig.globalSettings.enableGroupOverrides) {
                const groupRules = this.rulesConfig.groupSpecificRules[equipmentGroup];
                if (groupRules && groupRules.overrides && groupRules.overrides[activity]) {
                    this.core.addDebugLog(`Aplicando override de grupo ${equipmentGroup}: ${activity} = ${groupRules.overrides[activity]}`);
                    return groupRules.overrides[activity];
                }
            }

            // 2. Aplicar regra padrão baseada no tipo
            const ruleSet = activityType === 'status' ? 
                this.rulesConfig.telemetryRules : 
                this.rulesConfig.appointmentRules;

            if (ruleSet && ruleSet[activity]) {
                return ruleSet[activity];
            }

            // 3. Fallback para classificação padrão
            const defaultClassification = this.rulesConfig.globalSettings.defaultClassification || 'neutral';
            this.core.addDebugLog(`Usando classificação padrão para ${activity}: ${defaultClassification}`, 'info');
            return defaultClassification;

        } catch (error) {
            this.core.addDebugLog(`Erro ao aplicar regras para ${activity}: ${error.message}`, 'error');
            return 'neutral';
        }
    }

    getClassificationStats() {
        const stats = {
            telemetry: { productive: 0, 'non-productive': 0, neutral: 0 },
            appointment: { productive: 0, 'non-productive': 0, neutral: 0 },
            total: { productive: 0, 'non-productive': 0, neutral: 0 }
        };

        // Contar regras de telemetria
        Object.values(this.rulesConfig.telemetryRules).forEach(classification => {
            stats.telemetry[classification]++;
            stats.total[classification]++;
        });

        // Contar regras de apontamentos
        Object.values(this.rulesConfig.appointmentRules).forEach(classification => {
            stats.appointment[classification]++;
            stats.total[classification]++;
        });

        return stats;
    }

    // =============================================================================
    // VERSIONAMENTO E HISTÓRICO
    // =============================================================================
    addToHistory(action, data) {
        const historyEntry = {
            timestamp: new Date().toISOString(),
            action: action,
            data: data,
            version: this.version
        };

        this.ruleHistory.push(historyEntry);

        // Manter apenas os últimos 50 históricos
        if (this.ruleHistory.length > 50) {
            this.ruleHistory.shift();
        }

        this.core.addDebugLog(`Histórico de regras: ${action}`);
    }

    getHistory() {
        return this.ruleHistory;
    }

    revertToVersion(historyIndex) {
        if (historyIndex < 0 || historyIndex >= this.ruleHistory.length) {
            this.core.addDebugLog('Índice de histórico inválido', 'error');
            return false;
        }

        const targetHistory = this.ruleHistory[historyIndex];
        
        if (confirm(`Reverter para versão de ${new Date(targetHistory.timestamp).toLocaleString()}?`)) {
            // Implementar reversão baseada no tipo de ação
            this.addToHistory('reverted', { targetVersion: historyIndex });
            this.isDirty = true;
            this.renderRulesInterface();
            
            this.core.addDebugLog(`Revertido para versão ${historyIndex}`);
            return true;
        }
        
        return false;
    }

    // =============================================================================
    // IMPORT/EXPORT
    // =============================================================================
    exportRules() {
        try {
            const exportData = {
                ...this.rulesConfig,
                exportedAt: new Date().toISOString(),
                exportedBy: 'ProductivityRules',
                exportVersion: this.version
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `productivity-rules-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            this.core.addDebugLog('Regras exportadas com sucesso');
            
        } catch (error) {
            this.core.addDebugLog(`Erro ao exportar regras: ${error.message}`, 'error');
        }
    }

    importRules(fileInput) {
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedRules = JSON.parse(e.target.result);
                
                if (this.validateRulesStructure(importedRules)) {
                    if (confirm('Importar regras? Isso substituirá as regras atuais.')) {
                        this.rulesConfig = importedRules;
                        this.isDirty = true;
                        this.renderRulesInterface();
                        this.addToHistory('imported', { filename: file.name });
                        
                        this.core.addDebugLog(`Regras importadas de ${file.name}`);
                    }
                } else {
                    alert('Arquivo de regras inválido!');
                    this.core.addDebugLog('Tentativa de import com arquivo inválido', 'error');
                }
            } catch (error) {
                alert('Erro ao ler arquivo de regras!');
                this.core.addDebugLog(`Erro no import: ${error.message}`, 'error');
            }
        };
        
        reader.readAsText(file);
    }

    resetToDefaults() {
        if (confirm('Restaurar regras padrão? Todas as configurações atuais serão perdidas.')) {
            this.rulesConfig = { ...this.defaultRules };
            this.isDirty = true;
            this.renderRulesInterface();
            this.addToHistory('reset_to_defaults', {});
            
            this.core.addDebugLog('Regras restauradas para padrão');
        }
    }

    // =============================================================================
    // UTILITÁRIOS
    // =============================================================================
    updateKnownValues(equipmentData) {
        // Atualizar status conhecidos baseado nos dados reais
        const newStatuses = new Set();
        const newCategories = new Set();

        for (const [equipName, data] of equipmentData) {
            data.status.forEach(item => {
                if (item.status) newStatuses.add(item.status);
            });
            
            data.apontamentos.forEach(item => {
                if (item['Categoria Demora']) newCategories.add(item['Categoria Demora']);
            });
        }

        // Adicionar novos valores às listas conhecidas
        newStatuses.forEach(status => {
            if (!this.knownTelemetryStatuses.includes(status)) {
                this.knownTelemetryStatuses.push(status);
                this.core.addDebugLog(`Novo status detectado: ${status}`);
            }
        });

        newCategories.forEach(category => {
            if (!this.knownAppointmentCategories.includes(category)) {
                this.knownAppointmentCategories.push(category);
                this.core.addDebugLog(`Nova categoria detectada: ${category}`);
            }
        });
    }

    getRulesConfig() {
        return this.rulesConfig;
    }

    getRulesVersion() {
        return this.rulesConfig ? this.rulesConfig.version : null;
    }

    getRulesLastModified() {
        return this.rulesConfig ? this.rulesConfig.lastModified : null;
    }

    // =============================================================================
    // LIMPEZA E DESTRUTOR
    // =============================================================================
    destroy() {
        if (this.isDirty) {
            this.saveRules();
        }
        
        this.rulesConfig = null;
        this.ruleHistory = [];
        this.isDirty = false;
        
        this.core.addDebugLog('Rules Module destruído');
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.ProductivityRules = ProductivityRules;
}
