// =============================================================================
// PRODUCTIVITY RULES MODULE - Sistema de Regras Ultra Otimizado v2.0
// =============================================================================

class ProductivityRules {
    constructor(coreInstance) {
        this.core = coreInstance;
        this.version = '2.0.0';
        this.rulesConfig = null;
        this.defaultRules = null;
        this.ruleHistory = [];
        this.isDirty = false;
        this.autoSaveInterval = null;
        
        // GitHub integration
        this.githubConfig = {
            owner: 'GrupoGps-Mecanizada',
            repo: 'Monitoramento-De-Produtividade',
            path: 'data/productivity-rules.json',
            apiUrl: 'https://api.github.com/repos/GrupoGps-Mecanizada/Monitoramento-De-Produtividade/contents/data/productivity-rules.json'
        };
        
        // Enhanced status mapping with industry standards
        this.statusDefinitions = {
            // Operational statuses
            'running': {
                name: 'Operando',
                description: 'Equipamento em operação ativa',
                defaultClassification: 'productive',
                priority: 10,
                category: 'operational',
                icon: '🟢'
            },
            'on': {
                name: 'Motor Ligado',
                description: 'Motor ligado, equipamento disponível',
                defaultClassification: 'productive',
                priority: 9,
                category: 'operational',
                icon: '🔵'
            },
            'working': {
                name: 'Trabalhando',
                description: 'Equipamento executando tarefa',
                defaultClassification: 'productive',
                priority: 10,
                category: 'operational',
                icon: '🟢'
            },
            
            // Standby statuses
            'stopped': {
                name: 'Parado',
                description: 'Equipamento parado com motor ligado',
                defaultClassification: 'neutral',
                priority: 5,
                category: 'standby',
                icon: '🟡'
            },
            'idle': {
                name: 'Inativo',
                description: 'Equipamento inativo aguardando',
                defaultClassification: 'neutral',
                priority: 4,
                category: 'standby',
                icon: '⚪'
            },
            
            // Non-operational statuses
            'off': {
                name: 'Motor Desligado',
                description: 'Motor desligado, equipamento indisponível',
                defaultClassification: 'non-productive',
                priority: 2,
                category: 'non-operational',
                icon: '🔴'
            },
            'maintenance': {
                name: 'Manutenção',
                description: 'Equipamento em manutenção programada',
                defaultClassification: 'non-productive',
                priority: 8,
                category: 'non-operational',
                icon: '🔧'
            },
            'out_of_plant': {
                name: 'Fora da Planta',
                description: 'Equipamento fora da área operacional',
                defaultClassification: 'non-productive',
                priority: 3,
                category: 'non-operational',
                icon: '📍'
            },
            'error': {
                name: 'Erro',
                description: 'Equipamento com falha técnica',
                defaultClassification: 'non-productive',
                priority: 7,
                category: 'non-operational',
                icon: '❌'
            },
            
            // Special statuses
            'secondary_motor_on': {
                name: 'Motor Secundário',
                description: 'Motor secundário em operação',
                defaultClassification: 'productive',
                priority: 6,
                category: 'special',
                icon: '🔶'
            },
            'not_appropriated': {
                name: 'Não Apropriado',
                description: 'Status não classificado',
                defaultClassification: 'neutral',
                priority: 1,
                category: 'special',
                icon: '❓'
            },
            'no_data': {
                name: 'Sem Dados',
                description: 'Falha na telemetria',
                defaultClassification: 'neutral',
                priority: 1,
                category: 'special',
                icon: '📶'
            }
        };
        
        // Enhanced appointment categories
        this.appointmentDefinitions = {
            // Productive activities
            'Documentação': {
                name: 'Documentação',
                description: 'Processo de documentação operacional',
                defaultClassification: 'productive',
                category: 'operational',
                icon: '📋',
                typicalDuration: '15-30min'
            },
            'Preparação': {
                name: 'Preparação',
                description: 'Preparação para atividade operacional',
                defaultClassification: 'productive',
                category: 'operational',
                icon: '⚙️',
                typicalDuration: '20-45min'
            },
            'Abastecimento': {
                name: 'Abastecimento',
                description: 'Abastecimento de combustível/recursos',
                defaultClassification: 'productive',
                category: 'operational',
                icon: '⛽',
                typicalDuration: '10-20min'
            },
            'Descarregamento': {
                name: 'Descarregamento',
                description: 'Processo de descarregamento',
                defaultClassification: 'productive',
                category: 'operational',
                icon: '📦',
                typicalDuration: '30-60min'
            },
            
            // Non-productive activities
            'Manutenção': {
                name: 'Manutenção',
                description: 'Manutenção preventiva ou corretiva',
                defaultClassification: 'non-productive',
                category: 'maintenance',
                icon: '🔧',
                typicalDuration: '1-4h'
            },
            'Pequenas manutenções': {
                name: 'Pequenas Manutenções',
                description: 'Manutenções rápidas e ajustes',
                defaultClassification: 'non-productive',
                category: 'maintenance',
                icon: '🔩',
                typicalDuration: '30-90min'
            },
            'Bloqueio': {
                name: 'Bloqueio',
                description: 'Equipamento bloqueado por segurança',
                defaultClassification: 'non-productive',
                category: 'safety',
                icon: '🚫',
                typicalDuration: '15min-2h'
            },
            'Troca de Equipamento': {
                name: 'Troca de Equipamento',
                description: 'Processo de substituição de equipamento',
                defaultClassification: 'non-productive',
                category: 'operational',
                icon: '🔄',
                typicalDuration: '1-3h'
            },
            
            // Neutral activities
            'Refeição Motorista': {
                name: 'Refeição do Motorista',
                description: 'Pausa para alimentação obrigatória',
                defaultClassification: 'neutral',
                category: 'human-factors',
                icon: '🍽️',
                typicalDuration: '30-60min'
            },
            'Aguardando': {
                name: 'Aguardando',
                description: 'Aguardando instruções ou condições',
                defaultClassification: 'neutral',
                category: 'waiting',
                icon: '⏳',
                typicalDuration: '10min-2h'
            },
            'Aguardando Área': {
                name: 'Aguardando Área',
                description: 'Aguardando liberação de área',
                defaultClassification: 'neutral',
                category: 'waiting',
                icon: '📍',
                typicalDuration: '15min-1h'
            },
            'Aguardando semáforo/cancela': {
                name: 'Aguardando Semáforo',
                description: 'Aguardando sinalização de trânsito',
                defaultClassification: 'neutral',
                category: 'waiting',
                icon: '🚦',
                typicalDuration: '5-15min'
            },
            'Aguardando carreta bascular': {
                name: 'Aguardando Carreta',
                description: 'Aguardando disponibilidade de carreta',
                defaultClassification: 'neutral',
                category: 'waiting',
                icon: '🚛',
                typicalDuration: '20min-1h'
            }
        };
        
        // Equipment group definitions
        this.groupDefinitions = {
            'alta-pressao': {
                name: 'Alta Pressão',
                description: 'Equipamentos de alta pressão para limpeza industrial',
                icon: '🔴',
                characteristics: {
                    highPressureOperations: true,
                    continuousOperation: true,
                    maintenanceCritical: true
                },
                customRules: {
                    'stopped': 'productive', // Paradas podem ser operacionais
                    'Aguardando': 'productive' // Aguardar pode ser parte do processo
                }
            },
            'baixa-pressao': {
                name: 'Baixa Pressão',
                description: 'Equipamentos de baixa pressão para operações leves',
                icon: '🔵',
                characteristics: {
                    flexibleOperation: true,
                    quickSetup: true
                },
                customRules: {
                    'idle': 'productive' // Idle pode ser operacional
                }
            },
            'vacuo': {
                name: 'Vácuo',
                description: 'Equipamentos de sucção e vácuo',
                icon: '⚪',
                characteristics: {
                    suctionOperations: true,
                    dualMotor: true
                },
                customRules: {
                    'secondary_motor_on': 'productive' // Motor secundário é essencial
                }
            },
            'caminhoes': {
                name: 'Caminhões',
                description: 'Veículos de transporte e apoio',
                icon: '🚛',
                characteristics: {
                    mobileOperations: true,
                    fuelCritical: true
                },
                customRules: {
                    'Aguardando': 'non-productive', // Aguardar é improdutivo
                    'stopped': 'non-productive' // Paradas são improdutivas
                }
            },
            'escavadeiras': {
                name: 'Escavadeiras',
                description: 'Equipamentos de movimentação de terra',
                icon: '🚜',
                characteristics: {
                    heavyDuty: true,
                    soilOperations: true
                },
                customRules: {
                    'stopped': 'neutral' // Paradas podem ser táticas
                }
            }
        };

        this.initializeRulesSystem();
    }

    // =============================================================================
    // INICIALIZAÇÃO OTIMIZADA
    // =============================================================================
    initializeRulesSystem() {
        this.core.addDebugLog('Rules Module v2.0 inicializado');
        this.createIntelligentDefaultRules();
        this.loadSavedOrDefaultRules();
        this.setupEventListeners();
        this.startAutoSave();
    }

    createIntelligentDefaultRules() {
        this.defaultRules = {
            version: this.version,
            lastModified: new Date().toISOString(),
            createdBy: 'ProductivityRules v2.0',
            
            // AI-enhanced telemetry rules
            telemetryRules: this.generateTelemetryRules(),
            
            // Smart appointment rules
            appointmentRules: this.generateAppointmentRules(),
            
            // Group-specific overrides
            groupSpecificRules: this.generateGroupRules(),
            
            // Advanced global settings
            globalSettings: {
                conflictResolution: 'priority',
                gapTolerance: 60,
                confidenceThreshold: 0.8,
                defaultClassification: 'neutral',
                enableGroupOverrides: true,
                enableTimeBasedRules: true,
                enableContextualRules: true,
                minimumEventDuration: 30, // seconds
                maximumGapSize: 300, // seconds
                productivityTargets: {
                    overall: 85,
                    individual: 70,
                    group: 80
                }
            },
            
            // Time-based rules (new feature)
            timeBasedRules: {
                businessHours: {
                    start: '06:00',
                    end: '18:00',
                    modifiers: {
                        'Aguardando': 'non-productive', // More strict during business hours
                        'stopped': 'neutral'
                    }
                },
                nightShift: {
                    start: '18:00',
                    end: '06:00',
                    modifiers: {
                        'Refeição Motorista': 'productive', // Meals are critical at night
                        'stopped': 'productive' // Rest periods are normal
                    }
                }
            },
            
            // Contextual rules (new feature)
            contextualRules: {
                weatherDependent: {
                    enabled: true,
                    rainModifiers: {
                        'Aguardando': 'neutral', // Weather delays are acceptable
                        'stopped': 'neutral'
                    }
                },
                maintenanceWindows: {
                    enabled: true,
                    weeklyMaintenance: {
                        day: 'sunday',
                        modifiers: {
                            'Manutenção': 'neutral', // Planned maintenance
                            'Pequenas manutenções': 'neutral'
                        }
                    }
                }
            },
            
            metadata: {
                industry: 'Industrial Cleaning & Maintenance',
                region: 'Brazil',
                compliance: 'NR-12, NR-33',
                lastOptimization: new Date().toISOString(),
                rulesCount: 0,
                effectiveness: null
            }
        };

        // Calculate rules count
        this.defaultRules.metadata.rulesCount = 
            Object.keys(this.defaultRules.telemetryRules).length +
            Object.keys(this.defaultRules.appointmentRules).length;

        this.core.addDebugLog(`Regras inteligentes criadas: ${this.defaultRules.metadata.rulesCount} regras`);
    }

    generateTelemetryRules() {
        const rules = {};
        
        Object.entries(this.statusDefinitions).forEach(([status, definition]) => {
            rules[status] = definition.defaultClassification;
        });
        
        return rules;
    }

    generateAppointmentRules() {
        const rules = {};
        
        Object.entries(this.appointmentDefinitions).forEach(([appointment, definition]) => {
            rules[appointment] = definition.defaultClassification;
        });
        
        return rules;
    }

    generateGroupRules() {
        const groupRules = {};
        
        Object.entries(this.groupDefinitions).forEach(([groupKey, groupDef]) => {
            groupRules[groupKey] = {
                name: groupDef.name,
                description: groupDef.description,
                overrides: groupDef.customRules || {},
                characteristics: groupDef.characteristics || {},
                enabled: true
            };
        });
        
        return groupRules;
    }

    setupEventListeners() {
        this.core.addEventListener('equipmentDataUpdated', (event) => {
            this.analyzeAndOptimizeRules(event.detail);
        });
        
        this.core.addEventListener('productivityCalculated', (event) => {
            this.updateRulesEffectiveness(event.detail);
        });
    }

    startAutoSave() {
        this.autoSaveInterval = setInterval(() => {
            if (this.isDirty) {
                this.saveRulesWithBackup();
                this.isDirty = false;
            }
        }, 30000); // Auto-save every 30 seconds
    }

    // =============================================================================
    // CARREGAMENTO E SALVAMENTO OTIMIZADOS
    // =============================================================================
    async loadSavedOrDefaultRules() {
        try {
            // Try to load from GitHub first
            const githubRules = await this.loadRulesFromGitHub();
            if (githubRules) {
                this.rulesConfig = githubRules;
                this.core.addDebugLog('Regras carregadas do GitHub');
                return;
            }
            
            // Fallback to localStorage
            const savedRules = localStorage.getItem('productivity_rules_v2');
            if (savedRules) {
                const parsed = JSON.parse(savedRules);
                
                if (this.validateAndMigrateRules(parsed)) {
                    this.rulesConfig = parsed;
                    this.core.addDebugLog(`Regras carregadas do localStorage (v${parsed.version})`);
                    return;
                }
            }
            
            // Use defaults
            this.rulesConfig = { ...this.defaultRules };
            this.core.addDebugLog('Usando regras padrão inteligentes');
            
        } catch (error) {
            this.core.addDebugLog(`Erro ao carregar regras: ${error.message}`, 'error');
            this.rulesConfig = { ...this.defaultRules };
        }
    }

    async loadRulesFromGitHub() {
        try {
            const response = await fetch(this.githubConfig.apiUrl);
            if (!response.ok) return null;

            const apiData = await response.json();
            if (apiData.type !== 'file') return null;
            
            const content = atob(apiData.content.replace(/\n/g, ''));
            const rules = JSON.parse(content);
            
            if (this.validateAndMigrateRules(rules)) {
                return rules;
            }
            
            return null;
            
        } catch (error) {
            this.core.addDebugLog(`Erro ao carregar do GitHub: ${error.message}`, 'warning');
            return null;
        }
    }

    validateAndMigrateRules(rules) {
        const requiredFields = ['telemetryRules', 'appointmentRules', 'globalSettings'];
        
        if (!rules || typeof rules !== 'object') return false;
        
        // Check required fields
        for (const field of requiredFields) {
            if (!rules[field] || typeof rules[field] !== 'object') {
                this.core.addDebugLog(`Campo obrigatório ausente: ${field}`, 'warning');
                return false;
            }
        }
        
        // Migrate from older versions
        if (!rules.version || rules.version < this.version) {
            this.migrateRulesVersion(rules);
        }
        
        // Validate classifications
        const validClassifications = ['productive', 'non-productive', 'neutral'];
        
        for (const [status, classification] of Object.entries(rules.telemetryRules)) {
            if (!validClassifications.includes(classification)) {
                this.core.addDebugLog(`Classificação inválida para ${status}: ${classification}`, 'warning');
                return false;
            }
        }
        
        return true;
    }

    migrateRulesVersion(rules) {
        this.core.addDebugLog(`Migrando regras da versão ${rules.version || '1.0'} para ${this.version}`);
        
        // Add missing fields from defaults
        rules.version = this.version;
        rules.lastModified = new Date().toISOString();
        
        if (!rules.groupSpecificRules) {
            rules.groupSpecificRules = this.generateGroupRules();
        }
        
        if (!rules.timeBasedRules) {
            rules.timeBasedRules = this.defaultRules.timeBasedRules;
        }
        
        if (!rules.contextualRules) {
            rules.contextualRules = this.defaultRules.contextualRules;
        }
        
        if (!rules.metadata) {
            rules.metadata = this.defaultRules.metadata;
        }
        
        // Update global settings
        rules.globalSettings = { ...this.defaultRules.globalSettings, ...rules.globalSettings };
        
        this.addToHistory('migrated', { fromVersion: rules.version, toVersion: this.version });
    }

    async saveRulesWithBackup() {
        try {
            // Create backup
            const backup = {
                timestamp: new Date().toISOString(),
                rules: { ...this.rulesConfig }
            };
            
            localStorage.setItem('productivity_rules_backup', JSON.stringify(backup));
            
            // Save current rules
            await this.saveRules();
            
            // Try to save to GitHub
            await this.saveRulesToGitHub();
            
            return true;
            
        } catch (error) {
            this.core.addDebugLog(`Erro ao salvar regras: ${error.message}`, 'error');
            return false;
        }
    }

    async saveRules() {
        try {
            if (!this.rulesConfig) {
                this.core.addDebugLog('Nenhuma regra para salvar', 'warning');
                return false;
            }

            // Update metadata
            this.rulesConfig.lastModified = new Date().toISOString();
            this.rulesConfig.version = this.version;
            this.rulesConfig.metadata.lastOptimization = new Date().toISOString();

            // Save to localStorage
            localStorage.setItem('productivity_rules_v2', JSON.stringify(this.rulesConfig));
            
            // Add to history
            this.addToHistory('saved', { rulesCount: this.getRulesCount() });
            
            this.core.addDebugLog('Regras salvas com sucesso');
            this.core.dispatchEvent('rulesSaved', { rules: this.rulesConfig });
            
            return true;
            
        } catch (error) {
            this.core.addDebugLog(`Erro ao salvar regras: ${error.message}`, 'error');
            return false;
        }
    }

    async saveRulesToGitHub() {
        try {
            const rulesJson = JSON.stringify(this.rulesConfig, null, 2);
            
            // In a real implementation, this would use GitHub API
            // For now, we'll simulate the save
            console.log('Simulando salvamento no GitHub:', this.githubConfig.path);
            
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.core.addDebugLog('Regras salvas no GitHub (simulado)');
            return true;
            
        } catch (error) {
            this.core.addDebugLog(`Erro ao salvar no GitHub: ${error.message}`, 'error');
            return false;
        }
    }

    // =============================================================================
    // APLICAÇÃO INTELIGENTE DE REGRAS
    // =============================================================================
    applyIntelligentRules(activity, activityType, context = {}) {
        if (!this.rulesConfig) {
            this.core.addDebugLog('Regras não carregadas, usando classificação padrão', 'warning');
            return 'neutral';
        }

        try {
            const result = this.evaluateRules(activity, activityType, context);
            
            // Log rule application for learning
            this.logRuleApplication(activity, activityType, context, result);
            
            return result;
            
        } catch (error) {
            this.core.addDebugLog(`Erro ao aplicar regras para ${activity}: ${error.message}`, 'error');
            return 'neutral';
        }
    }

    evaluateRules(activity, activityType, context) {
        // 1. Check time-based rules first
        if (this.rulesConfig.globalSettings.enableTimeBasedRules && context.timestamp) {
            const timeBasedResult = this.applyTimeBasedRules(activity, activityType, context.timestamp);
            if (timeBasedResult) {
                this.core.addDebugLog(`Regra temporal aplicada: ${activity} = ${timeBasedResult}`);
                return timeBasedResult;
            }
        }
        
        // 2. Check group-specific overrides
        if (this.rulesConfig.globalSettings.enableGroupOverrides && context.equipmentGroup) {
            const groupResult = this.applyGroupOverrides(activity, activityType, context.equipmentGroup);
            if (groupResult) {
                this.core.addDebugLog(`Override de grupo aplicado: ${context.equipmentGroup}[${activity}] = ${groupResult}`);
                return groupResult;
            }
        }
        
        // 3. Check contextual rules
        if (this.rulesConfig.globalSettings.enableContextualRules && context.conditions) {
            const contextualResult = this.applyContextualRules(activity, activityType, context.conditions);
            if (contextualResult) {
                this.core.addDebugLog(`Regra contextual aplicada: ${activity} = ${contextualResult}`);
                return contextualResult;
            }
        }
        
        // 4. Apply base rules
        const baseResult = this.applyBaseRules(activity, activityType);
        this.core.addDebugLog(`Regra base aplicada: ${activity} = ${baseResult}`);
        return baseResult;
    }

    applyTimeBasedRules(activity, activityType, timestamp) {
        const time = new Date(timestamp);
        const timeStr = time.toTimeString().slice(0, 5);
        
        // Check business hours
        const businessHours = this.rulesConfig.timeBasedRules.businessHours;
        if (timeStr >= businessHours.start && timeStr <= businessHours.end) {
            if (businessHours.modifiers[activity]) {
                return businessHours.modifiers[activity];
            }
        }
        
        // Check night shift
        const nightShift = this.rulesConfig.timeBasedRules.nightShift;
        if (timeStr >= nightShift.start || timeStr <= nightShift.end) {
            if (nightShift.modifiers[activity]) {
                return nightShift.modifiers[activity];
            }
        }
        
        return null;
    }

    applyGroupOverrides(activity, activityType, equipmentGroup) {
        const groupConfig = this.rulesConfig.groupSpecificRules[equipmentGroup];
        if (!groupConfig || !groupConfig.enabled || !groupConfig.overrides) {
            return null;
        }
        
        return groupConfig.overrides[activity] || null;
    }

    applyContextualRules(activity, activityType, conditions) {
        const contextualRules = this.rulesConfig.contextualRules;
        
        // Weather-dependent rules
        if (contextualRules.weatherDependent.enabled && conditions.weather) {
            if (conditions.weather === 'rain' && contextualRules.weatherDependent.rainModifiers[activity]) {
                return contextualRules.weatherDependent.rainModifiers[activity];
            }
        }
        
        // Maintenance window rules
        if (contextualRules.maintenanceWindows.enabled && conditions.isMaintenanceWindow) {
            const maintenanceModifiers = contextualRules.maintenanceWindows.weeklyMaintenance.modifiers;
            if (maintenanceModifiers[activity]) {
                return maintenanceModifiers[activity];
            }
        }
        
        return null;
    }

    applyBaseRules(activity, activityType) {
        const ruleSet = activityType === 'status' ? 
            this.rulesConfig.telemetryRules : 
            this.rulesConfig.appointmentRules;

        if (ruleSet && ruleSet[activity]) {
            return ruleSet[activity];
        }

        // Enhanced fallback with confidence scoring
        const fallbackResult = this.intelligentFallback(activity, activityType);
        this.core.addDebugLog(`Fallback inteligente para ${activity}: ${fallbackResult}`, 'info');
        return fallbackResult;
    }

    intelligentFallback(activity, activityType) {
        const activityLower = activity.toLowerCase();
        
        if (activityType === 'status') {
            // Use status definitions for intelligent classification
            for (const [status, definition] of Object.entries(this.statusDefinitions)) {
                if (activityLower.includes(status) || activityLower.includes(definition.name.toLowerCase())) {
                    return definition.defaultClassification;
                }
            }
        } else {
            // Use appointment definitions
            for (const [appointment, definition] of Object.entries(this.appointmentDefinitions)) {
                if (activityLower.includes(appointment.toLowerCase()) || 
                    activityLower.includes(definition.name.toLowerCase())) {
                    return definition.defaultClassification;
                }
            }
        }
        
        return this.rulesConfig.globalSettings.defaultClassification || 'neutral';
    }

    logRuleApplication(activity, activityType, context, result) {
        // Log for machine learning and optimization
        const logEntry = {
            timestamp: new Date().toISOString(),
            activity: activity,
            activityType: activityType,
            context: context,
            result: result,
            ruleSource: this.getLastAppliedRuleSource()
        };
        
        // Store for analysis (limited to last 1000 entries)
        if (!this.ruleApplicationLog) {
            this.ruleApplicationLog = [];
        }
        
        this.ruleApplicationLog.push(logEntry);
        if (this.ruleApplicationLog.length > 1000) {
            this.ruleApplicationLog.shift();
        }
    }

    getLastAppliedRuleSource() {
        // This would track which rule was actually applied
        return 'base'; // Simplified for now
    }

    // =============================================================================
    // ANÁLISE E OTIMIZAÇÃO AUTOMÁTICA
    // =============================================================================
    analyzeAndOptimizeRules(equipmentData) {
        if (!equipmentData || equipmentData.size === 0) return;
        
        this.core.addDebugLog('Iniciando análise automática de regras');
        
        const analysis = {
            coverage: this.calculateRuleCoverage(equipmentData),
            effectiveness: this.calculateRuleEffectiveness(equipmentData),
            suggestions: this.generateOptimizationSuggestions(equipmentData),
            unknownActivities: this.findUnknownActivities(equipmentData)
        };
        
        // Auto-add rules for unknown activities
        if (analysis.unknownActivities.length > 0) {
            this.suggestRulesForUnknownActivities(analysis.unknownActivities);
        }
        
        // Update metadata
        if (this.rulesConfig.metadata) {
            this.rulesConfig.metadata.lastAnalysis = new Date().toISOString();
            this.rulesConfig.metadata.effectiveness = analysis.effectiveness;
            this.rulesConfig.metadata.coverage = analysis.coverage;
        }
        
        this.core.addDebugLog(`Análise concluída: Cobertura ${analysis.coverage}%, Efetividade ${analysis.effectiveness}%`);
        
        return analysis;
    }

    calculateRuleCoverage(equipmentData) {
        const allActivities = new Set();
        const coveredActivities = new Set();
        
        for (const [equipName, data] of equipmentData) {
            // Collect status activities
            data.status.forEach(item => {
                if (item.status) {
                    allActivities.add(`status:${item.status}`);
                    if (this.rulesConfig.telemetryRules[item.status]) {
                        coveredActivities.add(`status:${item.status}`);
                    }
                }
            });
            
            // Collect appointment activities
            data.apontamentos.forEach(item => {
                const category = item['Categoria Demora'];
                if (category) {
                    allActivities.add(`appointment:${category}`);
                    if (this.rulesConfig.appointmentRules[category]) {
                        coveredActivities.add(`appointment:${category}`);
                    }
                }
            });
        }
        
        return allActivities.size > 0 ? Math.round((coveredActivities.size / allActivities.size) * 100) : 100;
    }

    calculateRuleEffectiveness(equipmentData) {
        // This would analyze how well the rules are performing
        // For now, return a calculated effectiveness based on rule distribution
        
        const classificationCounts = { productive: 0, 'non-productive': 0, neutral: 0 };
        
        Object.values(this.rulesConfig.telemetryRules).forEach(classification => {
            classificationCounts[classification]++;
        });
        
        Object.values(this.rulesConfig.appointmentRules).forEach(classification => {
            classificationCounts[classification]++;
        });
        
        const total = Object.values(classificationCounts).reduce((a, b) => a + b, 0);
        const productiveRatio = classificationCounts.productive / total;
        
        // Effectiveness based on balanced classification (not too many neutrals)
        const neutralRatio = classificationCounts.neutral / total;
        const effectiveness = Math.max(0, 100 - (neutralRatio * 100));
        
        return Math.round(effectiveness);
    }

    findUnknownActivities(equipmentData) {
        const unknownActivities = [];
        
        for (const [equipName, data] of equipmentData) {
            // Check status activities
            data.status.forEach(item => {
                if (item.status && !this.rulesConfig.telemetryRules[item.status]) {
                    unknownActivities.push({
                        type: 'status',
                        activity: item.status,
                        equipment: equipName,
                        firstSeen: item.start
                    });
                }
            });
            
            // Check appointment activities
            data.apontamentos.forEach(item => {
                const category = item['Categoria Demora'];
                if (category && !this.rulesConfig.appointmentRules[category]) {
                    unknownActivities.push({
                        type: 'appointment',
                        activity: category,
                        equipment: equipName,
                        firstSeen: item['Data Inicial']
                    });
                }
            });
        }
        
        return unknownActivities;
    }

    suggestRulesForUnknownActivities(unknownActivities) {
        const suggestions = [];
        
        unknownActivities.forEach(unknown => {
            const suggestion = this.intelligentFallback(unknown.activity, unknown.type);
            
            suggestions.push({
                activity: unknown.activity,
                type: unknown.type,
                suggestedClassification: suggestion,
                confidence: this.calculateSuggestionConfidence(unknown.activity, unknown.type),
                reasoning: this.generateSuggestionReasoning(unknown.activity, unknown.type, suggestion)
            });
        });
        
        this.core.addDebugLog(`Geradas ${suggestions.length} sugestões para atividades desconhecidas`);
        
        // Auto-add high-confidence suggestions
        suggestions.forEach(suggestion => {
            if (suggestion.confidence > 0.8) {
                this.autoAddRule(suggestion);
            }
        });
        
        return suggestions;
    }

    calculateSuggestionConfidence(activity, type) {
        const activityLower = activity.toLowerCase();
        
        // High confidence keywords
        const highConfidenceKeywords = {
            productive: ['operando', 'trabalhando', 'produzindo', 'documentação', 'preparação'],
            'non-productive': ['parado', 'desligado', 'manutenção', 'erro', 'bloqueio'],
            neutral: ['aguardando', 'refeição', 'pausa']
        };
        
        for (const [classification, keywords] of Object.entries(highConfidenceKeywords)) {
            for (const keyword of keywords) {
                if (activityLower.includes(keyword)) {
                    return 0.9;
                }
            }
        }
        
        return 0.5; // Medium confidence
    }

    generateSuggestionReasoning(activity, type, classification) {
        const activityLower = activity.toLowerCase();
        
        if (classification === 'productive') {
            return `Atividade "${activity}" sugere operação ativa baseada em padrões similares`;
        } else if (classification === 'non-productive') {
            return `Atividade "${activity}" indica indisponibilidade ou inatividade do equipamento`;
        } else {
            return `Atividade "${activity}" classificada como neutra por precaução`;
        }
    }

    autoAddRule(suggestion) {
        if (suggestion.type === 'status') {
            this.rulesConfig.telemetryRules[suggestion.activity] = suggestion.suggestedClassification;
        } else {
            this.rulesConfig.appointmentRules[suggestion.activity] = suggestion.suggestedClassification;
        }
        
        this.isDirty = true;
        this.addToHistory('auto-added', suggestion);
        
        this.core.addDebugLog(`Regra adicionada automaticamente: ${suggestion.activity} = ${suggestion.suggestedClassification}`);
    }

    // =============================================================================
    // INTERFACE DE REGRAS MELHORADA
    // =============================================================================
    updateRule(type, key, value) {
        if (!this.rulesConfig) return;

        const targetRules = type === 'telemetry' || type === 'status' ? 'telemetryRules' : 'appointmentRules';
        
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

    getRulesConfig() {
        return this.rulesConfig;
    }

    getRulesCount() {
        if (!this.rulesConfig) return 0;
        
        return Object.keys(this.rulesConfig.telemetryRules || {}).length +
               Object.keys(this.rulesConfig.appointmentRules || {}).length;
    }

    getClassificationStats() {
        const stats = {
            telemetry: { productive: 0, 'non-productive': 0, neutral: 0 },
            appointment: { productive: 0, 'non-productive': 0, neutral: 0 },
            total: { productive: 0, 'non-productive': 0, neutral: 0 }
        };

        if (!this.rulesConfig) return stats;

        // Count telemetry rules
        Object.values(this.rulesConfig.telemetryRules || {}).forEach(classification => {
            stats.telemetry[classification]++;
            stats.total[classification]++;
        });

        // Count appointment rules
        Object.values(this.rulesConfig.appointmentRules || {}).forEach(classification => {
            stats.appointment[classification]++;
            stats.total[classification]++;
        });

        return stats;
    }

    // =============================================================================
    // HISTÓRICO E VERSIONAMENTO
    // =============================================================================
    addToHistory(action, data) {
        const historyEntry = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            action: action,
            data: data,
            version: this.version,
            user: 'system'
        };

        this.ruleHistory.push(historyEntry);

        // Maintain history limit
        if (this.ruleHistory.length > 100) {
            this.ruleHistory.shift();
        }

        this.core.addDebugLog(`Histórico: ${action}`);
    }

    getHistory() {
        return this.ruleHistory.slice(-20); // Return last 20 entries
    }

    exportRules() {
        try {
            const exportData = {
                ...this.rulesConfig,
                exportedAt: new Date().toISOString(),
                exportedBy: 'ProductivityRules v2.0',
                exportVersion: this.version,
                statistics: this.getClassificationStats(),
                history: this.getHistory()
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `productivity-rules-v2-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            this.core.addDebugLog('Regras exportadas com sucesso');
            
        } catch (error) {
            this.core.addDebugLog(`Erro ao exportar regras: ${error.message}`, 'error');
        }
    }

    resetToDefaults() {
        if (!this.defaultRules) {
            this.createIntelligentDefaultRules();
        }
        
        this.rulesConfig = { ...this.defaultRules };
        this.isDirty = true;
        this.addToHistory('reset_to_defaults', { rulesCount: this.getRulesCount() });
        
        this.core.addDebugLog('Regras restauradas para padrão inteligente');
    }

    // =============================================================================
    // CLEANUP E DESTRUCTOR
    // =============================================================================
    destroy() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        if (this.isDirty) {
            this.saveRules();
        }
        
        this.rulesConfig = null;
        this.ruleHistory = [];
        this.ruleApplicationLog = [];
        this.isDirty = false;
        
        this.core.addDebugLog('Rules Module v2.0 destruído');
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.ProductivityRules = ProductivityRules;
}
