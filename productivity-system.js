// =============================================================================
// PRODUCTIVITY SYSTEM MODULE - Sistema Principal Refatorado
// =============================================================================

class ProductivitySystem {
    constructor() {
        // Inicializar módulos
        this.core = new ProductivityCore();
        this.analytics = new ProductivityAnalytics(this.core);
        this.rules = new ProductivityRules(this.core);
        
        // Estado do sistema
        this.timeline = null;
        this.items = new vis.DataSet();
        this.groups = new vis.DataSet();
        this.csvData = [];
        this.jsonData = [];
        this.equipmentMap = new Map();
        this.isUpdating = false;
        this.autoSyncInterval = null;
        this.currentViewWindow = null;
        this.lastDataHash = '';
        
        // Performance optimization
        this.renderQueue = [];
        this.isRendering = false;
        this.debounceTimers = new Map();
        
        // Estatísticas de processamento
        this.processingStats = {
            conflictsResolved: 0,
            duplicatesRemoved: 0,
            originalRecords: 0,
            finalRecords: 0,
            lastProcessingTime: 0
        };

        // Estado de filtros
        this.filterState = {
            equipment: '',
            period: 'week',
            startDate: null,
            endDate: null,
            status: '',
            group: '',
            customFilters: {}
        };

        // Lazy loading para timeline
        this.lazyLoadConfig = {
            enabled: true,
            batchSize: 50,
            loadMoreThreshold: 100, // pixels
            currentBatch: 0,
            totalBatches: 0
        };

        this.initializeSystem();
    }

    // =============================================================================
    // INICIALIZAÇÃO DO SISTEMA PRINCIPAL
    // =============================================================================
    async initializeSystem() {
        this.core.addDebugLog('🚀 Iniciando Sistema de Produtividade Modernizado');
        
        try {
            // Configurar event listeners entre módulos
            this.setupModuleIntegration();
            
            // Configurar interface
            this.setupEventListeners();
            this.setupAdvancedFilters();
            
            // Inicializar regras
            this.rules.renderRulesInterface();
            
            // Atualizar informações do sistema
            this.updateSystemInfo();
            this.updateSyncStatus('loading', 'Inicializando sistema...');
            
            // Iniciar sincronização
            await this.initGitHubSync();
            
            this.core.addDebugLog('✅ Sistema inicializado com sucesso');
            
        } catch (error) {
            this.core.addDebugLog(`❌ Erro na inicialização: ${error.message}`, 'error');
            this.showNotification('Erro na inicialização do sistema', 'error');
        }
    }

    setupModuleIntegration() {
        // Eventos do Core
        this.core.addEventListener('debugLog', (event) => {
            this.updateDebugPanel();
        });

        // Eventos do Analytics
        this.core.addEventListener('analyticsUpdateRequested', (event) => {
            if (this.equipmentMap.size > 0) {
                this.updateAnalytics();
            }
        });

        // Eventos das Rules
        this.core.addEventListener('rulesSaved', (event) => {
            this.showNotification('Regras de produtividade salvas!', 'success');
            // Reprocessar dados com novas regras
            if (this.equipmentMap.size > 0) {
                this.processDataWithConflictResolution();
            }
        });

        this.core.addEventListener('ruleUpdated', (event) => {
            // Auto-aplicar regras em tempo real
            this.debounceOperation('applyRules', () => {
                this.updateAnalytics();
            }, 2000);
        });
    }

    setupEventListeners() {
        // Filtros com debounce otimizado
        document.getElementById('equipmentFilter')?.addEventListener('change', () => {
            this.debounceOperation('equipmentFilter', () => this.applyAdvancedFilters(), 100);
        });

        document.getElementById('periodFilter')?.addEventListener('change', () => {
            this.handlePeriodChange();
        });

        document.getElementById('startDate')?.addEventListener('change', () => {
            this.debounceOperation('startDate', () => this.applyAdvancedFilters(), 500);
        });

        document.getElementById('endDate')?.addEventListener('change', () => {
            this.debounceOperation('endDate', () => this.applyAdvancedFilters(), 500);
        });

        // Window resize handler para timeline
        window.addEventListener('resize', this.debounceOperation('resize', () => {
            if (this.timeline) {
                this.timeline.redraw();
            }
        }, 250));

        // Beforeunload para salvar estado
        window.addEventListener('beforeunload', () => {
            this.saveSystemState();
        });
    }

    // =============================================================================
    // SINCRONIZAÇÃO INTELIGENTE COM GITHUB
    // =============================================================================
    async initGitHubSync() {
        this.core.addDebugLog('🔄 Iniciando sincronização automática GitHub...');
        await this.syncFromGitHub();
        this.startGitHubAutoSync();
    }

    async syncFromGitHub() {
        if (this.isUpdating) {
            this.core.addDebugLog('Sincronização já em andamento, ignorando', 'warning');
            return;
        }

        this.isUpdating = true;
        this.updateSyncStatus('loading', 'Sincronizando dados...');
        
        try {
            // Salvar estado atual da timeline
            this.saveTimelineState();

            const startTime = performance.now();
            
            // Buscar dados em paralelo com retry automático
            const [csvResult, jsonResult] = await Promise.allSettled([
                this.fetchDataWithRetry('csv'),
                this.fetchDataWithRetry('json')
            ]);

            let successCount = 0;
            let newDataDetected = false;

            // Processar resultado CSV
            if (csvResult.status === 'fulfilled' && csvResult.value.success) {
                const newCsvData = csvResult.value.data;
                const newHash = this.core.generateHash(newCsvData);
                
                if (newHash !== this.csvDataHash) {
                    this.csvData = newCsvData;
                    this.csvDataHash = newHash;
                    newDataDetected = true;
                    this.core.addDebugLog(`CSV atualizado: ${this.csvData.length} registros`);
                }
                successCount++;
            } else {
                this.core.addDebugLog(`Erro no CSV: ${csvResult.reason?.message || 'Falha na requisição'}`, 'error');
            }

            // Processar resultado JSON
            if (jsonResult.status === 'fulfilled' && jsonResult.value.success) {
                const newJsonData = jsonResult.value.data;
                const newDataHash = this.core.generateHash(newJsonData);
                
                if (newDataHash !== this.lastDataHash) {
                    this.jsonData = newJsonData;
                    this.lastDataHash = newDataHash;
                    newDataDetected = true;
                    this.core.addDebugLog(`JSON atualizado: ${this.jsonData.length} registros`);
                }
                successCount++;
            } else {
                this.core.addDebugLog(`Erro no JSON: ${jsonResult.reason?.message || 'Falha na requisição'}`, 'error');
            }

            const syncTime = performance.now() - startTime;

            if (successCount > 0) {
                if (newDataDetected) {
                    await this.processDataWithConflictResolution();
                    this.showNotification(`✅ Dados atualizados (${syncTime.toFixed(0)}ms)`, 'success');
                } else {
                    this.core.addDebugLog('Nenhum dado novo detectado');
                }
                
                this.updateSyncStatus('success', `Dados sincronizados (${this.getTimeSinceSync()})`);
            } else {
                this.updateSyncStatus('error', 'Falha na sincronização');
                this.showNotification('❌ Erro na sincronização', 'error');
            }

        } catch (error) {
            this.core.addDebugLog(`Erro na sincronização: ${error.message}`, 'error');
            this.updateSyncStatus('error', 'Erro na sincronização');
            this.showNotification(`❌ Erro: ${error.message}`, 'error');
        } finally {
            this.isUpdating = false;
            this.updateLastUpdateTime();
        }
    }

    async fetchDataWithRetry(dataType) {
        const maxRetries = this.core.config.retryAttempts;
        const retryDelay = this.core.config.retryDelay;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this.core.addDebugLog(`Tentativa ${attempt}/${maxRetries} para ${dataType.toUpperCase()}`);
                
                const result = dataType === 'csv' ? 
                    await this.fetchCSVFromGitHub() : 
                    await this.fetchJSONFromGitHub();
                    
                if (result.success) {
                    return result;
                }
                
                if (attempt < maxRetries) {
                    this.core.addDebugLog(`Tentativa ${attempt} falhou, aguardando ${retryDelay}ms`, 'warning');
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
                
            } catch (error) {
                this.core.addDebugLog(`Tentativa ${attempt} falhou: ${error.message}`, 'error');
                
                if (attempt === maxRetries) {
                    throw error;
                }
                
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
        
        throw new Error(`Falha após ${maxRetries} tentativas`);
    }

    async fetchCSVFromGitHub() {
        const config = this.core.githubConfig.csvRepo;
        
        return this.core.measureAsyncOperation('fetchCSV', async () => {
            try {
                const response = await fetch(config.apiUrl);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const apiData = await response.json();
                
                if (apiData.type !== 'file') {
                    throw new Error('Não é um arquivo válido');
                }
                
                let csvText = atob(apiData.content.replace(/\n/g, ''));
                
                try {
                    csvText = decodeURIComponent(escape(csvText));
                } catch (error) {
                    this.core.addDebugLog('Mantendo texto CSV original', 'info');
                }
                
                const parsedData = await this.core.parseCSV(csvText);
                
                // Validar dados
                const validation = this.core.validateCSVData(parsedData);
                if (!validation.isValid) {
                    this.core.addDebugLog(`CSV com ${validation.errors.length} erros`, 'warning');
                }
                
                return { success: true, data: validation.validRecords };
                
            } catch (error) {
                this.core.addDebugLog(`Erro ao buscar CSV: ${error.message}`, 'error');
                return { success: false, data: [], error: error.message };
            }
        });
    }

    async fetchJSONFromGitHub() {
        const config = this.core.githubConfig.jsonRepo;
        
        return this.core.measureAsyncOperation('fetchJSON', async () => {
            try {
                const response = await fetch(config.apiUrl);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const apiData = await response.json();
                
                if (apiData.type !== 'file') {
                    throw new Error('Não é um arquivo válido');
                }
                
                let jsonText = atob(apiData.content.replace(/\n/g, ''));
                
                try {
                    jsonText = decodeURIComponent(escape(jsonText));
                } catch (error) {
                    this.core.addDebugLog('Mantendo texto JSON original', 'info');
                }
                
                const records = this.core.parseJSON(jsonText);
                
                // Validar dados
                const validation = this.core.validateJSONData(records);
                if (!validation.isValid) {
                    this.core.addDebugLog(`JSON com ${validation.errors.length} erros`, 'warning');
                }
                
                return { success: true, data: validation.validRecords };
                
            } catch (error) {
                this.core.addDebugLog(`Erro ao buscar JSON: ${error.message}`, 'error');
                return { success: false, data: [], error: error.message };
            }
        });
    }

    startGitHubAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
        }

        if (this.core.config.autoSyncInterval > 0) {
            this.core.addDebugLog(`⏰ Auto-sync configurado para ${this.core.config.autoSyncInterval / 60000} minutos`);
            
            this.autoSyncInterval = setInterval(async () => {
                if (!this.isUpdating) {
                    this.core.addDebugLog('🔄 Executando auto-sync...');
                    await this.syncFromGitHub();
                }
            }, this.core.config.autoSyncInterval);

            this.updateNextSyncTime();
        }
    }

    // =============================================================================
    // PROCESSAMENTO AVANÇADO COM RESOLUÇÃO DE CONFLITOS
    // =============================================================================
    async processDataWithConflictResolution() {
        if (this.csvData.length === 0 && this.jsonData.length === 0) {
            this.core.addDebugLog('Nenhum dado para processar', 'warning');
            return;
        }

        return this.core.measureAsyncOperation('processDataWithConflictResolution', async () => {
            this.core.addDebugLog('Iniciando processamento avançado com resolução de conflitos');
            
            const startTime = performance.now();
            
            // Reset stats
            this.processingStats = {
                conflictsResolved: 0,
                duplicatesRemoved: 0,
                originalRecords: this.jsonData.length + this.csvData.length,
                finalRecords: 0,
                lastProcessingTime: 0
            };

            // Limpar dados anteriores
            this.equipmentMap.clear();
            
            // Processar dados com batch processing
            await this.unifyEquipmentDataBatch();
            await this.createGroupsBatch();
            await this.createTimelineItemsWithAdvancedConflictResolution();

            // Garantir inicialização da timeline
            await this.ensureTimelineInitialization();

            // Atualizar analytics
            this.updateAnalytics();
            
            // Atualizar interface
            this.updateInterface();
            
            const processingTime = performance.now() - startTime;
            this.processingStats.lastProcessingTime = processingTime;
            
            this.core.addDebugLog(`✅ Processamento concluído em ${processingTime.toFixed(2)}ms: ${this.processingStats.finalRecords} registros finais`);
            
            // Dispatch evento para outros módulos
            this.core.dispatchEvent('dataProcessed', {
                equipmentData: this.equipmentMap,
                processingStats: this.processingStats
            });
        });
    }

    async unifyEquipmentDataBatch() {
        return this.core.measureAsyncOperation('unifyEquipmentData', async () => {
            // Processar CSV em batches
            const csvBatchSize = this.core.config.batchSize;
            for (let i = 0; i < this.csvData.length; i += csvBatchSize) {
                const batch = this.csvData.slice(i, i + csvBatchSize);
                
                batch.forEach((item) => {
                    const equipName = this.core.normalizeEquipmentName(item.Vaga || item.Placa);
                    if (!this.equipmentMap.has(equipName)) {
                        this.equipmentMap.set(equipName, {
                            name: equipName,
                            originalName: item.Vaga || item.Placa,
                            apontamentos: [],
                            status: []
                        });
                    }
                    this.equipmentMap.get(equipName).apontamentos.push(item);
                });
                
                // Yield control para não bloquear UI
                if (i % (csvBatchSize * 5) === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            // Processar JSON em batches
            const jsonBatchSize = this.core.config.batchSize;
            for (let i = 0; i < this.jsonData.length; i += jsonBatchSize) {
                const batch = this.jsonData.slice(i, i + jsonBatchSize);
                
                batch.forEach((item) => {
                    const equipName = this.core.normalizeEquipmentName(item.vacancy_name);
                    if (!this.equipmentMap.has(equipName)) {
                        this.equipmentMap.set(equipName, {
                            name: equipName,
                            originalName: item.vacancy_name,
                            apontamentos: [],
                            status: []
                        });
                    }
                    this.equipmentMap.get(equipName).status.push(item);
                });
                
                // Yield control
                if (i % (jsonBatchSize * 5) === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            // Ordenar dados por data
            for (const [equipName, data] of this.equipmentMap) {
                data.apontamentos.sort((a, b) => {
                    const dateA = this.core.parseDate(a['Data Inicial']);
                    const dateB = this.core.parseDate(b['Data Inicial']);
                    return (dateA || 0) - (dateB || 0);
                });
                
                data.status.sort((a, b) => {
                    const dateA = this.core.parseDate(a.start);
                    const dateB = this.core.parseDate(b.start);
                    return (dateA || 0) - (dateB || 0);
                });
            }

            this.core.addDebugLog(`Dados unificados: ${this.equipmentMap.size} equipamentos`);
        });
    }

    async createGroupsBatch() {
        return this.core.measureAsyncOperation('createGroups', async () => {
            this.groups.clear();
            
            let groupId = 0;
            const sortedEquipments = Array.from(this.equipmentMap.entries())
                .sort(([nameA], [nameB]) => nameA.localeCompare(nameB));
            
            const batchSize = 20; // Processar grupos em batches menores
            
            for (let i = 0; i < sortedEquipments.length; i += batchSize) {
                const batch = sortedEquipments.slice(i, i + batchSize);
                
                for (const [equipName, data] of batch) {
                    if (data.apontamentos.length > 0 || data.status.length > 0) {
                        const displayName = this.core.getDisplayName(equipName);
                        
                        this.groups.add({
                            id: `${equipName}_apont`,
                            content: `<div style="font-weight: 600; color: #2c3e50; font-size: 13px;">${displayName}</div><div style="font-size: 11px; color: #7f8c8d;">📊 Apontamentos</div>`,
                            order: groupId * 2
                        });
                        
                        this.groups.add({
                            id: `${equipName}_status`,
                            content: `<div style="font-weight: 600; color: #2c3e50; font-size: 13px;">${displayName}</div><div style="font-size: 11px; color: #7f8c8d;">🔄 Status</div>`,
                            order: groupId * 2 + 1
                        });
                        
                        groupId++;
                    }
                }
                
                // Yield control
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            this.core.addDebugLog(`Grupos criados: ${this.groups.length}`);
        });
    }

    async createTimelineItemsWithAdvancedConflictResolution() {
        return this.core.measureAsyncOperation('createTimelineItems', async () => {
            this.items.clear();
            let itemId = 0;
            
            const equipmentArray = Array.from(this.equipmentMap.entries());
            const batchSize = 10; // Processar equipamentos em batches
            
            for (let i = 0; i < equipmentArray.length; i += batchSize) {
                const batch = equipmentArray.slice(i, i + batchSize);
                
                for (const [equipName, data] of batch) {
                    // Processar apontamentos (sem mudanças, pois são eventos únicos)
                    data.apontamentos.forEach(apont => {
                        const start = this.core.parseDate(apont['Data Inicial']);
                        const end = this.core.parseDate(apont['Data Final']);
                        
                        if (start && end && start < end) {
                            const category = apont['Categoria Demora'] || 'Outros';
                            const className = this.core.apontColors[category] || 'apont-aguardando';
                            
                            this.items.add({
                                id: `apont_${itemId++}`,
                                group: `${equipName}_apont`,
                                content: this.core.truncateText(category, 20),
                                start: start,
                                end: end,
                                className: className,
                                title: this.createApontTooltip(apont, equipName),
                                type: 'range'
                            });
                        }
                    });

                    // Processar status COM resolução avançada de conflitos
                    if (data.status.length > 0) {
                        const resolvedStatus = await this.resolveStatusConflictsAdvanced(data.status, equipName);
                        
                        resolvedStatus.forEach((status) => {
                            const start = this.core.parseDate(status.start);
                            const end = this.core.parseDate(status.end);
                            
                            if (start && end && start < end) {
                                const statusCode = status.status || 'unknown';
                                const className = this.core.statusColors[statusCode] || 'status-not_appropriated';
                                
                                this.items.add({
                                    id: `status_${itemId++}`,
                                    group: `${equipName}_status`,
                                    content: this.core.truncateText(status.status_title || statusCode, 25),
                                    start: start,
                                    end: end,
                                    className: className,
                                    title: this.createStatusTooltipEnhanced(status, equipName),
                                    type: 'range'
                                });
                            }
                        });
                    }
                }
                
                // Yield control periodicamente
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            this.processingStats.finalRecords = this.items.length;
            this.core.addDebugLog(`Timeline items criados: ${this.items.length}`);
        });
    }

    // RESOLUÇÃO AVANÇADA DE CONFLITOS
    async resolveStatusConflictsAdvanced(statusList, equipmentName) {
        if (!statusList || statusList.length === 0) return [];

        return this.core.measureOperation('resolveConflictsAdvanced', () => {
            this.core.addDebugLog(`Resolvendo conflitos avançados para ${equipmentName}: ${statusList.length} registros`);

            // 1. Remover duplicatas exatas
            const uniqueStatus = this.removeDuplicatesAdvanced(statusList);
            const duplicatesRemoved = statusList.length - uniqueStatus.length;
            this.processingStats.duplicatesRemoved += duplicatesRemoved;
            
            // 2. Ordenar por tempo de início
            const sortedStatus = uniqueStatus.sort((a, b) => 
                new Date(a.start) - new Date(b.start)
            );

            // 3. Detectar e resolver sobreposições com algoritmo aprimorado
            const resolvedStatus = this.resolveOverlapsAdvanced(sortedStatus, equipmentName);

            // 4. Consolidar períodos consecutivos do mesmo status
            const consolidatedStatus = this.consolidateConsecutiveAdvanced(resolvedStatus, equipmentName);

            // 5. Preencher gaps pequenos de forma inteligente
            const finalStatus = this.fillSmallGapsIntelligent(consolidatedStatus, equipmentName);

            // 6. Machine learning básico para padrões recorrentes
            const mlOptimizedStatus = this.applyMLOptimizations(finalStatus, equipmentName);

            this.processingStats.finalRecords += mlOptimizedStatus.length;
            
            this.core.addDebugLog(`${equipmentName}: ${statusList.length} → ${mlOptimizedStatus.length} registros (${duplicatesRemoved} duplicatas removidas)`);
            
            return mlOptimizedStatus;
        });
    }

    removeDuplicatesAdvanced(statusList) {
        const seen = new Map();
        return statusList.filter(status => {
            // Criar chave mais sofisticada considerando pequenas variações de tempo
            const startTime = new Date(status.start).getTime();
            const endTime = new Date(status.end).getTime();
            const roundedStart = Math.round(startTime / 60000) * 60000; // Arredondar para minuto
            const roundedEnd = Math.round(endTime / 60000) * 60000;
            
            const key = `${roundedStart}-${roundedEnd}-${status.status}-${status.vacancy_code}`;
            
            if (seen.has(key)) {
                // Manter o registro com mais informações
                const existing = seen.get(key);
                if (status.total_time > existing.total_time) {
                    seen.set(key, status);
                    return true;
                }
                return false;
            }
            
            seen.set(key, status);
            return true;
        });
    }

    resolveOverlapsAdvanced(statusList, equipmentName) {
        if (statusList.length <= 1) return statusList;

        const resolved = [];
        let current = null;
        let conflictCount = 0;

        for (const status of statusList) {
            if (!current) {
                current = { ...status };
                continue;
            }

            const currentEnd = new Date(current.end);
            const statusStart = new Date(status.start);
            const statusEnd = new Date(status.end);

            // Verificar sobreposição com tolerância
            const overlapThreshold = 30000; // 30 segundos
            const hasOverlap = statusStart < currentEnd && (currentEnd - statusStart) > overlapThreshold;

            if (hasOverlap) {
                conflictCount++;
                this.processingStats.conflictsResolved++;
                
                // Algoritmo avançado de resolução
                const resolution = this.resolveConflictAdvanced(current, status, equipmentName);
                
                switch (resolution.action) {
                    case 'merge_weighted':
                        // Mesclagem com peso baseado em confiança
                        current = this.mergeStatusWithWeight(current, status, resolution.weights);
                        break;
                        
                    case 'split_intelligent':
                        // Divisão inteligente baseada em padrões
                        const splitResult = this.splitStatusIntelligent(current, status, resolution.splitPoint);
                        resolved.push(splitResult.first);
                        current = splitResult.second;
                        break;
                        
                    case 'priority_enhanced':
                        // Prioridade aprimorada com contexto
                        if (resolution.winner === 'current') {
                            current.confidence = (current.confidence || 0.5) + 0.1;
                            current.end = statusEnd > currentEnd ? status.end : current.end;
                        } else {
                            status.confidence = (status.confidence || 0.5) + 0.1;
                            current = { ...status };
                        }
                        break;
                        
                    default:
                        // Fallback para método tradicional
                        current = this.resolveConflictTraditional(current, status);
                }
                
                // Logging detalhado
                this.core.addDebugLog(`Conflito ${conflictCount} resolvido: ${resolution.action} (${current.status} vs ${status.status})`);
                
            } else {
                // Sem sobreposição
                resolved.push(current);
                current = { ...status };
            }
        }

        if (current) {
            resolved.push(current);
        }

        this.core.addDebugLog(`${equipmentName}: ${conflictCount} conflitos resolvidos`);
        return resolved;
    }

    resolveConflictAdvanced(status1, status2, equipmentName) {
        const priority1 = this.core.statusPriority[status1.status] || 0;
        const priority2 = this.core.statusPriority[status2.status] || 0;
        const confidence1 = status1.confidence || 0.5;
        const confidence2 = status2.confidence || 0.5;
        
        // Determinar grupo do equipamento para contexto
        const equipmentGroup = this.analytics.determineEquipmentGroup(equipmentName);
        
        // Score composto considerando prioridade, confiança e contexto
        const score1 = priority1 * 0.6 + confidence1 * 0.3 + this.getContextScore(status1.status, equipmentGroup) * 0.1;
        const score2 = priority2 * 0.6 + confidence2 * 0.3 + this.getContextScore(status2.status, equipmentGroup) * 0.1;
        
        const duration1 = new Date(status1.end) - new Date(status1.start);
        const duration2 = new Date(status2.end) - new Date(status2.start);
        
        switch (this.core.config.conflictResolution) {
            case 'priority':
                if (Math.abs(score1 - score2) > 0.2) { // Diferença significativa
                    return {
                        action: 'priority_enhanced',
                        winner: score1 > score2 ? 'current' : 'new',
                        confidence: Math.abs(score1 - score2)
                    };
                } else {
                    // Scores similares, usar mesclagem ponderada
                    return {
                        action: 'merge_weighted',
                        weights: { status1: score1, status2: score2 }
                    };
                }
                
            case 'intelligent':
                // Modo inteligente: usar machine learning básico
                const pattern = this.detectPattern(status1, status2, equipmentName);
                return {
                    action: pattern.confidence > 0.7 ? 'split_intelligent' : 'merge_weighted',
                    splitPoint: pattern.optimalSplitPoint,
                    weights: { status1: pattern.weight1, status2: pattern.weight2 }
                };
                
            default:
                return this.resolveConflictTraditional(status1, status2);
        }
    }

    getContextScore(status, equipmentGroup) {
        // Score baseado no contexto do equipamento
        const contextRules = {
            'Alta Pressão': {
                'stopped': 0.8, // Paradas são normais
                'running': 0.9
            },
            'Vácuo': {
                'secondary_motor_on': 0.9, // Motor secundário é comum
                'maintenance': 0.7
            },
            'Caminhões': {
                'running': 0.9,
                'stopped': 0.3 // Paradas são menos produtivas
            }
        };
        
        return contextRules[equipmentGroup]?.[status] || 0.5;
    }

    detectPattern(status1, status2, equipmentName) {
        // Machine learning básico para detectar padrões
        const patternCache = this.core.getCache(`pattern_${equipmentName}`);
        
        if (patternCache) {
            const historicalPattern = patternCache.find(p => 
                p.status1 === status1.status && p.status2 === status2.status
            );
            
            if (historicalPattern) {
                return {
                    confidence: historicalPattern.successRate,
                    optimalSplitPoint: historicalPattern.optimalSplit,
                    weight1: historicalPattern.weight1,
                    weight2: historicalPattern.weight2
                };
            }
        }
        
        // Padrão padrão se não houver histórico
        return {
            confidence: 0.5,
            optimalSplitPoint: 0.5,
            weight1: 0.5,
            weight2: 0.5
        };
    }

    consolidateConsecutiveAdvanced(statusList, equipmentName) {
        if (statusList.length <= 1) return statusList;

        const consolidated = [];
        let current = null;
        let consolidationCount = 0;

        for (const status of statusList) {
            if (!current) {
                current = { ...status };
                continue;
            }

            const currentEnd = new Date(current.end);
            const statusStart = new Date(status.start);
            const gapSeconds = (statusStart - currentEnd) / 1000;
            
            // Tolerância adaptativa baseada no tipo de status
            const adaptiveTolerance = this.getAdaptiveTolerance(current.status, status.status);
            
            // Condições para consolidação
            const sameStatus = current.status === status.status;
            const sameStatusTitle = current.status_title === status.status_title;
            const withinTolerance = Math.abs(gapSeconds) <= adaptiveTolerance;
            const compatibleStatuses = this.areStatusesCompatible(current.status, status.status);

            if ((sameStatus && sameStatusTitle && withinTolerance) || 
                (compatibleStatuses && Math.abs(gapSeconds) <= 30)) {
                
                // Consolidação avançada
                current = this.mergeStatusAdvanced(current, status);
                consolidationCount++;
                
            } else {
                consolidated.push(current);
                current = { ...status };
            }
        }

        if (current) {
            consolidated.push(current);
        }

        this.core.addDebugLog(`${equipmentName}: ${consolidationCount} consolidações realizadas`);
        return consolidated;
    }

    getAdaptiveTolerance(status1, status2) {
        // Tolerância baseada no tipo de status
        const baseTimeout = this.core.config.gapTolerance;
        
        const toleranceRules = {
            'maintenance': baseTimeout * 3, // Manutenção pode ter gaps maiores
            'running': baseTimeout * 0.5,   // Running precisa ser mais preciso
            'stopped': baseTimeout * 2,     // Stopped pode ter mais flexibilidade
            'off': baseTimeout * 1.5
        };
        
        const tolerance1 = toleranceRules[status1] || baseTimeout;
        const tolerance2 = toleranceRules[status2] || baseTimeout;
        
        return Math.max(tolerance1, tolerance2);
    }

    areStatusesCompatible(status1, status2) {
        // Grupos de status compatíveis que podem ser mesclados
        const compatibleGroups = [
            ['running', 'on', 'working'],
            ['stopped', 'idle'],
            ['off', 'not_appropriated'],
            ['maintenance', 'error']
        ];
        
        return compatibleGroups.some(group => 
            group.includes(status1) && group.includes(status2)
        );
    }

    mergeStatusAdvanced(status1, status2) {
        return {
            ...status1,
            end: status2.end,
            total_time: (parseFloat(status1.total_time) || 0) + (parseFloat(status2.total_time) || 0),
            consolidated_count: (status1.consolidated_count || 1) + 1,
            confidence: Math.min((status1.confidence || 0.5) + 0.1, 1.0),
            merged_sources: [
                ...(status1.merged_sources || [status1.start]),
                status2.start
            ]
        };
    }

    fillSmallGapsIntelligent(statusList, equipmentName) {
        if (statusList.length <= 1) return statusList;

        const filled = [];
        let gapsFilled = 0;
        
        for (let i = 0; i < statusList.length; i++) {
            filled.push(statusList[i]);
            
            if (i < statusList.length - 1) {
                const currentEnd = new Date(statusList[i].end);
                const nextStart = new Date(statusList[i + 1].start);
                const gapSeconds = (nextStart - currentEnd) / 1000;
                
                if (gapSeconds > 0 && gapSeconds <= this.core.config.gapTolerance * 2) {
                    // Escolher status de preenchimento inteligente
                    const fillStatus = this.chooseFillStatus(statusList[i], statusList[i + 1], equipmentName);
                    
                    filled.push({
                        ...statusList[i],
                        status: fillStatus.status,
                        status_title: fillStatus.title,
                        start: statusList[i].end,
                        end: statusList[i + 1].start,
                        total_time: gapSeconds / 3600,
                        gap_filled: true,
                        gap_type: fillStatus.type,
                        confidence: fillStatus.confidence
                    });
                    
                    gapsFilled++;
                }
            }
        }

        this.core.addDebugLog(`${equipmentName}: ${gapsFilled} gaps preenchidos inteligentemente`);
        return filled;
    }

    chooseFillStatus(prevStatus, nextStatus, equipmentName) {
        // Escolher status de preenchimento baseado em contexto
        const equipmentGroup = this.analytics.determineEquipmentGroup(equipmentName);
        
        // Regras contextuais para preenchimento
        const fillRules = {
            'Alta Pressão': {
                'running-stopped': { status: 'transitioning', title: 'Transicionando', confidence: 0.8 },
                'stopped-running': { status: 'preparing', title: 'Preparando', confidence: 0.8 }
            },
            'Caminhões': {
                'running-stopped': { status: 'off', title: 'Motor Desligado', confidence: 0.9 },
                'stopped-running': { status: 'preparing', title: 'Preparando', confidence: 0.7 }
            }
        };
        
        const ruleKey = `${prevStatus.status}-${nextStatus.status}`;
        const groupRules = fillRules[equipmentGroup];
        
        if (groupRules && groupRules[ruleKey]) {
            return { ...groupRules[ruleKey], type: 'contextual' };
        }
        
        // Fallback padrão
        return { 
            status: 'off', 
            title: 'Motor Desligado', 
            confidence: 0.5, 
            type: 'default' 
        };
    }

    applyMLOptimizations(statusList, equipmentName) {
        // Machine learning básico para otimizar sequências
        if (statusList.length < 3) return statusList;
        
        const optimized = [];
        let optimizationCount = 0;
        
        for (let i = 0; i < statusList.length; i++) {
            const current = statusList[i];
            const prev = i > 0 ? statusList[i - 1] : null;
            const next = i < statusList.length - 1 ? statusList[i + 1] : null;
            
            // Detectar sequências anômalas
            if (prev && next && this.isAnomalousSequence(prev, current, next)) {
                // Aplicar correção inteligente
                const corrected = this.correctAnomalousSequence(prev, current, next);
                optimized.push(corrected);
                optimizationCount++;
                
                this.core.addDebugLog(`Sequência anômala corrigida: ${prev.status} -> ${current.status} -> ${next.status}`);
            } else {
                optimized.push(current);
            }
        }
        
        if (optimizationCount > 0) {
            this.core.addDebugLog(`${equipmentName}: ${optimizationCount} otimizações ML aplicadas`);
        }
        
        return optimized;
    }

    isAnomalousSequence(prev, current, next) {
        // Detectar sequências improvávels baseado em padrões conhecidos
        const duration = new Date(current.end) - new Date(current.start);
        const shortDuration = duration < 60000; // Menos de 1 minuto
        
        // Sequências anômalas comuns
        const anomalousPatterns = [
            // Status de muito curta duração entre status similares
            { prev: 'running', current: 'stopped', next: 'running', maxDuration: 30000 },
            { prev: 'off', current: 'running', next: 'off', maxDuration: 60000 },
            // Sequências logicamente impossíveis
            { prev: 'maintenance', current: 'running', next: 'maintenance', maxDuration: 300000 }
        ];
        
        return anomalousPatterns.some(pattern => 
            pattern.prev === prev.status && 
            pattern.current === current.status && 
            pattern.next === next.status &&
            duration < pattern.maxDuration
        );
    }

    correctAnomalousSequence(prev, current, next) {
        // Corrigir sequência anômala
        const avgStatus = this.findMostLikelyStatus([prev, next]);
        
        return {
            ...current,
            status: avgStatus.status,
            status_title: avgStatus.title,
            anomaly_corrected: true,
            original_status: current.status,
            confidence: 0.6
        };
    }

    findMostLikelyStatus(statusList) {
        // Encontrar status mais provável baseado em frequência e prioridade
        const statusCount = {};
        let maxCount = 0;
        let mostLikely = statusList[0];
        
        statusList.forEach(status => {
            const count = (statusCount[status.status] || 0) + 1;
            statusCount[status.status] = count;
            
            if (count > maxCount) {
                maxCount = count;
                mostLikely = status;
            }
        });
        
        return {
            status: mostLikely.status,
            title: mostLikely.status_title || mostLikely.status
        };
    }

    // =============================================================================
    // INTERFACE E TIMELINE
    // =============================================================================
    async ensureTimelineInitialization() {
        if (this.items.length === 0) {
            this.core.addDebugLog('Nenhum item para timeline', 'warning');
            this.showTimelineEmptyState();
            return;
        }

        return new Promise((resolve) => {
            const attemptInitialization = (attempt = 1) => {
                if (this.timeline) {
                    this.updateTimelineSmartly();
                    this.forceTimelineRender();
                    resolve();
                } else {
                    this.initTimeline();
                    setTimeout(() => {
                        if (this.timeline) {
                            this.core.addDebugLog(`Timeline inicializada (tentativa ${attempt})`);
                            this.forceTimelineRender();
                            setTimeout(() => {
                                this.handlePeriodChange();
                                resolve();
                            }, 300);
                        } else if (attempt < 3) {
                            this.core.addDebugLog(`Tentativa ${attempt} falhou, tentando novamente...`, 'warning');
                            setTimeout(() => attemptInitialization(attempt + 1), 500);
                        } else {
                            this.core.addDebugLog('Falha ao inicializar timeline após 3 tentativas', 'error');
                            resolve();
                        }
                    }, 400);
                }
            };

            attemptInitialization();
        });
    }

    initTimeline() {
        const container = document.getElementById('timeline');
        if (!container) {
            this.core.addDebugLog('Container da timeline não encontrado', 'error');
            return;
        }

        container.innerHTML = '';
        
        this.core.addDebugLog(`Inicializando timeline com ${this.items.length} itens e ${this.groups.length} grupos`);

        const options = {
            orientation: 'top',
            stack: true,
            showCurrentTime: true,
            zoomMin: this.core.constants.MIN_ZOOM,
            zoomMax: this.core.constants.MAX_ZOOM,
            editable: false,
            multiselect: false,
            selectable: true,
            tooltip: {
                followMouse: true,
                overflowMethod: 'flip'
            },
            format: {
                minorLabels: {
                    minute: 'HH:mm',
                    hour: 'HH:mm',
                    day: 'DD/MM',
                    month: 'MMM',
                    year: 'YYYY'
                },
                majorLabels: {
                    minute: 'ddd DD/MM',
                    hour: 'ddd DD/MM',
                    day: 'MMMM YYYY',
                    month: 'YYYY',
                    year: ''
                }
            },
            margin: {
                item: { horizontal: 2, vertical: 1 }
            },
            height: '100%',
            maxHeight: 600,
            verticalScroll: true,
            horizontalScroll: true
        };

        try {
            if (typeof vis === 'undefined') {
                this.core.addDebugLog('Biblioteca vis.js não carregada', 'error');
                return;
            }

            this.timeline = new vis.Timeline(container, this.items, this.groups, options);

            // Event listeners
            this.timeline.on('rangechanged', (properties) => {
                this.currentViewWindow = properties;
                this.saveTimelineState();
            });

            this.timeline.on('select', (selection) => {
                this.handleTimelineSelection(selection);
            });

            // Configurar lazy loading se habilitado
            if (this.lazyLoadConfig.enabled) {
                this.setupLazyLoading();
            }

            setTimeout(() => {
                if (this.timeline) {
                    this.timeline.fit();
                    this.core.addDebugLog('Timeline renderizada e ajustada');
                }
            }, 200);

            this.core.addDebugLog('Timeline inicializada com sucesso');

        } catch (error) {
            this.core.addDebugLog(`Erro ao inicializar timeline: ${error.message}`, 'error');
            this.showTimelineErrorState(error.message);
        }
    }

    setupLazyLoading() {
        // Implementar lazy loading para grandes datasets
        if (this.items.length <= 100) return; // Não necessário para datasets pequenos

        this.core.addDebugLog('Configurando lazy loading para timeline');
        
        const container = document.getElementById('timeline');
        if (!container) return;

        // Detectar scroll e carregar mais itens
        this.timeline.on('rangechange', () => {
            this.debounceOperation('lazyLoad', () => {
                this.checkLazyLoad();
            }, 100);
        });
    }

    checkLazyLoad() {
        // Verificar se precisa carregar mais itens
        const window = this.timeline.getWindow();
        const visibleItems = this.getVisibleItems(window.start, window.end);
        
        if (visibleItems.length < this.lazyLoadConfig.loadMoreThreshold) {
            this.loadMoreTimelineItems();
        }
    }

    showTimelineEmptyState() {
        const container = document.getElementById('timeline');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div style="font-size: 2rem; margin-bottom: 1rem;">📊</div>
                    <div>Nenhum dado disponível</div>
                    <div style="font-size: 0.9rem; margin-top: 0.5rem; color: #7f8c8d;">
                        Aguardando sincronização de dados...
                    </div>
                </div>
            `;
        }
    }

    showTimelineErrorState(error) {
        const container = document.getElementById('timeline');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div style="font-size: 2rem; margin-bottom: 1rem; color: #e74c3c;">⚠️</div>
                    <div style="color: #e74c3c;">Erro ao carregar timeline</div>
                    <div style="font-size: 0.9rem; margin-top: 0.5rem; color: #7f8c8d;">
                        ${error}
                    </div>
                </div>
            `;
        }
    }

    // =============================================================================
    // TOOLTIPS MELHORADOS
    // =============================================================================
    createApontTooltip(apont, equipName) {
        const formatDateTime = (dateStr) => {
            return this.core.formatDateTime(dateStr);
        };

        const shortEquipName = this.core.truncateText(equipName, 25);
        const category = apont['Categoria Demora'] || 'N/A';
        const shortCategory = this.core.truncateText(category, 30);

        return `
            <div style="font-size: 12px; line-height: 1.3; max-width: 280px; word-wrap: break-word; overflow-wrap: break-word; white-space: normal;">
                <div style="font-weight: 700; margin-bottom: 6px; color: #fff; font-size: 11px;">📊 Apontamento Manual</div>
                <div style="margin-bottom: 3px; font-size: 11px;"><strong>Equipamento:</strong><br>${shortEquipName}</div>
                <div style="margin-bottom: 3px; font-size: 11px;"><strong>Categoria:</strong> ${shortCategory}</div>
                <div style="margin-bottom: 3px; font-size: 11px;"><strong>Início:</strong><br>${formatDateTime(apont['Data Inicial'])}</div>
                <div style="margin-bottom: 3px; font-size: 11px;"><strong>Fim:</strong><br>${formatDateTime(apont['Data Final'])}</div>
                <div style="font-size: 11px;"><strong>Duração:</strong> ${apont['Tempo Indisponível (HH:MM)'] || 'N/A'}</div>
            </div>
        `;
    }

    createStatusTooltipEnhanced(status, equipName) {
        const totalHours = parseFloat(status.total_time || 0);
        const count = status.consolidated_count || 1;
        const isGapFilled = status.gap_filled || false;
        const isAnomalycorrected = status.anomaly_corrected || false;
        const confidence = status.confidence || 0.5;
        
        const shortEquipName = this.core.truncateText(equipName, 25);
        const statusTitle = status.status_title || status.status;
        const shortStatusTitle = this.core.truncateText(statusTitle, 30);
        
        let tooltipContent = `
            <div style="font-size: 12px; line-height: 1.3; max-width: 280px; word-wrap: break-word; overflow-wrap: break-word; white-space: normal;">
                <div style="font-weight: 700; margin-bottom: 6px; color: #fff; font-size: 11px;">
                    🔄 Status ${isGapFilled ? '(Gap)' : isAnomalyCorreected ? '(ML)' : 'Auto'}
                </div>
                <div style="margin-bottom: 3px; font-size: 11px;"><strong>Equipamento:</strong><br>${shortEquipName}</div>
                <div style="margin-bottom: 3px; font-size: 11px;"><strong>Status:</strong> ${shortStatusTitle}</div>
                <div style="margin-bottom: 3px; font-size: 11px;"><strong>Início:</strong><br>${this.core.formatDateTime(status.start)}</div>
                <div style="margin-bottom: 3px; font-size: 11px;"><strong>Fim:</strong><br>${this.core.formatDateTime(status.end)}</div>
                <div style="margin-bottom: 3px; font-size: 11px;"><strong>Duração:</strong> ${this.core.formatDuration(totalHours)}</div>`;
        
        if (count > 1) {
            tooltipContent += `
                <div style="margin-bottom: 3px; color: #90EE90; font-size: 10px;"><strong>✅ Consolidado:</strong> ${count}x</div>`;
        }

        if (confidence !== 0.5) {
            const confidenceColor = confidence > 0.7 ? '#90EE90' : confidence > 0.4 ? '#FFB347' : '#F08080';
            tooltipContent += `
                <div style="margin-bottom: 3px; color: ${confidenceColor}; font-size: 10px;"><strong>🎯 Confiança:</strong> ${Math.round(confidence * 100)}%</div>`;
        }

        if (isGapFilled) {
            tooltipContent += `
                <div style="color: #FFB347; font-size: 10px;"><strong>⚠️ Gap Preenchido</strong></div>`;
        }

        if (isAnomalyCorreected) {
            tooltipContent += `
                <div style="color: #87CEEB; font-size: 10px;"><strong>🤖 Corrigido por ML</strong></div>`;
        }
        
        tooltipContent += `</div>`;
        
        return tooltipContent;
    }

    // Continuar com as demais funcionalidades...
    debounceOperation(key, callback, delay) {
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }
        
        this.debounceTimers.set(key, setTimeout(callback, delay));
    }

    saveTimelineState() {
        if (this.timeline) {
            this.currentViewWindow = this.timeline.getWindow();
        }
    }

    getTimeSinceSync() {
        const now = new Date();
        const lastSync = this.lastSyncTime || now;
        const diff = Math.floor((now - lastSync) / 60000); // minutos
        
        if (diff < 1) return 'agora';
        if (diff === 1) return '1 min';
        if (diff < 60) return `${diff} min`;
        
        const hours = Math.floor(diff / 60);
        if (hours === 1) return '1h';
        return `${hours}h`;
    }

    // Método principal para atualizar analytics
    updateAnalytics() {
        if (this.equipmentMap.size === 0) return;

        const rulesConfig = this.rules.getRulesConfig();
        if (!rulesConfig) return;

        // Executar análise
        const analysis = this.analytics.analyzeProductivity(this.equipmentMap, rulesConfig);
        
        // Atualizar dashboard se a aba estiver ativa
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab && activeTab.id === 'productivity-tab') {
            this.analytics.updateDashboard();
        }

        this.core.addDebugLog('Analytics atualizados');
    }

    // =============================================================================
    // SISTEMA DE FILTROS AVANÇADOS
    // =============================================================================
    setupAdvancedFilters() {
        this.core.addDebugLog('Configurando sistema de filtros avançados');
        
        // Carregar estado dos filtros salvos
        this.loadFilterState();
        
        // Configurar filtros personalizados
        this.setupCustomFilters();
    }

    loadFilterState() {
        try {
            const savedState = localStorage.getItem('productivity_filter_state');
            if (savedState) {
                this.filterState = { ...this.filterState, ...JSON.parse(savedState) };
                this.core.addDebugLog('Estado dos filtros carregado');
            }
        } catch (error) {
            this.core.addDebugLog(`Erro ao carregar estado dos filtros: ${error.message}`, 'warning');
        }
    }

    saveFilterState() {
        try {
            localStorage.setItem('productivity_filter_state', JSON.stringify(this.filterState));
        } catch (error) {
            this.core.addDebugLog(`Erro ao salvar estado dos filtros: ${error.message}`, 'warning');
        }
    }

    setupCustomFilters() {
        // Adicionar filtros personalizados se necessário
        this.customFilters = {
            productivity: {
                name: 'Produtividade',
                options: ['Todos', 'Produtivos', 'Não Produtivos', 'Neutros'],
                apply: (items, value) => this.filterByProductivity(items, value)
            },
            duration: {
                name: 'Duração',
                options: ['Todas', 'Curta (< 1h)', 'Média (1-4h)', 'Longa (> 4h)'],
                apply: (items, value) => this.filterByDuration(items, value)
            },
            confidence: {
                name: 'Confiança',
                options: ['Todas', 'Alta (> 70%)', 'Média (40-70%)', 'Baixa (< 40%)'],
                apply: (items, value) => this.filterByConfidence(items, value)
            }
        };
    }

    applyAdvancedFilters() {
        if (this.isUpdating || !this.timeline) return;

        return this.core.measureOperation('applyAdvancedFilters', () => {
            this.core.addDebugLog('Aplicando filtros avançados');

            const equipmentFilter = document.getElementById('equipmentFilter')?.value || '';
            const period = document.getElementById('periodFilter')?.value || 'all';
            
            // Atualizar estado dos filtros
            this.filterState.equipment = equipmentFilter;
            this.filterState.period = period;
            
            let filteredItems = [];
            let filteredGroups = new Set();
            
            for (const item of this.items.get()) {
                let include = true;
                
                // Filtro por equipamento
                if (equipmentFilter) {
                    const itemEquipment = item.group.replace(/_apont$|_status$/, '');
                    if (itemEquipment !== equipmentFilter) {
                        include = false;
                    }
                }
                
                // Filtro por período personalizado
                if (period === 'custom') {
                    const startDate = document.getElementById('startDate')?.value;
                    const endDate = document.getElementById('endDate')?.value;
                    
                    if (startDate && item.start < new Date(startDate)) include = false;
                    if (endDate && item.start > new Date(endDate)) include = false;
                }
                
                // Aplicar filtros personalizados
                for (const [filterKey, filterConfig] of Object.entries(this.customFilters)) {
                    const filterValue = this.filterState.customFilters[filterKey];
                    if (filterValue && filterValue !== 'Todos' && filterValue !== 'Todas') {
                        include = include && filterConfig.apply([item], filterValue).length > 0;
                    }
                }
                
                if (include) {
                    filteredItems.push(item);
                    const equipment = item.group.replace(/_apont$|_status$/, '');
                    filteredGroups.add(equipment);
                }
            }
            
            // Filtrar grupos
            const visibleGroups = [];
            for (const group of this.groups.get()) {
                const equipment = group.id.replace(/_apont$|_status$/, '');
                if (!equipmentFilter || filteredGroups.has(equipment)) {
                    visibleGroups.push(group);
                }
            }
            
            // Atualizar timeline
            this.timeline.setData({
                items: new vis.DataSet(filteredItems),
                groups: new vis.DataSet(visibleGroups)
            });
            
            // Atualizar estatísticas
            this.updateVisibleItemsCount(filteredItems.length);
            
            // Salvar estado
            this.saveFilterState();
            
            this.core.addDebugLog(`Filtros aplicados: ${filteredItems.length} itens visíveis de ${this.items.length} total`);
        });
    }

    filterByProductivity(items, value) {
        // Implementar filtro por produtividade
        return items.filter(item => {
            // Lógica específica baseada nas regras de produtividade
            return true; // Placeholder
        });
    }

    filterByDuration(items, value) {
        return items.filter(item => {
            if (!item.start || !item.end) return true;
            
            const duration = (item.end - item.start) / (1000 * 60 * 60); // horas
            
            switch (value) {
                case 'Curta (< 1h)': return duration < 1;
                case 'Média (1-4h)': return duration >= 1 && duration <= 4;
                case 'Longa (> 4h)': return duration > 4;
                default: return true;
            }
        });
    }

    filterByConfidence(items, value) {
        return items.filter(item => {
            // Assumir confiança padrão se não especificada
            const confidence = item.confidence || 0.5;
            const confidencePercent = confidence * 100;
            
            switch (value) {
                case 'Alta (> 70%)': return confidencePercent > 70;
                case 'Média (40-70%)': return confidencePercent >= 40 && confidencePercent <= 70;
                case 'Baixa (< 40%)': return confidencePercent < 40;
                default: return true;
            }
        });
    }

    // =============================================================================
    // GERENCIAMENTO DE ESTADO E INTERFACE
    // =============================================================================
    updateInterface() {
        const totalApont = Array.from(this.equipmentMap.values())
            .reduce((sum, data) => sum + data.apontamentos.length, 0);
        const totalStatus = Array.from(this.equipmentMap.values())
            .reduce((sum, data) => sum + data.status.length, 0);

        // Atualizar contadores
        this.updateElement('apontCount', totalApont);
        this.updateElement('statusCount', totalStatus);
        this.updateElement('equipmentCount', this.equipmentMap.size);
        this.updateElement('lastUpdate', new Date().toLocaleTimeString('pt-BR'));
        this.updateElement('conflictsResolved', this.processingStats.conflictsResolved);
        this.updateElement('duplicatesRemoved', this.processingStats.duplicatesRemoved);

        // Atualizar horário no header
        this.updateLastUpdateTime();

        // Atualizar filtros
        this.updateFilters();
        this.updateNextSyncTime();
        this.updateDebugPanel();
        
        this.core.addDebugLog('Interface atualizada');
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    updateFilters() {
        const equipmentSelect = document.getElementById('equipmentFilter');
        if (!equipmentSelect) return;

        const currentValue = equipmentSelect.value;
        equipmentSelect.innerHTML = '<option value="">Todos os equipamentos</option>';

        Array.from(this.equipmentMap.keys()).sort().forEach(equipName => {
            const option = document.createElement('option');
            option.value = equipName;
            option.textContent = this.core.getDisplayName(equipName);
            if (equipName === currentValue) option.selected = true;
            equipmentSelect.appendChild(option);
        });
    }

    handlePeriodChange() {
        const period = document.getElementById('periodFilter')?.value;
        const customGroup = document.getElementById('customDateGroup');
        const customGroup2 = document.getElementById('customDateGroup2');
        
        if (period === 'custom') {
            if (customGroup) customGroup.style.display = 'block';
            if (customGroup2) customGroup2.style.display = 'block';
            return;
        } else {
            if (customGroup) customGroup.style.display = 'none';
            if (customGroup2) customGroup2.style.display = 'none';
        }

        if (!this.timeline) return;

        const now = new Date();
        let start, end;

        switch (period) {
            case 'today':
                start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
                break;
            case 'yesterday':
                end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
                break;
            case 'week':
                end = now;
                start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                end = now;
                start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                this.timeline.fit();
                return;
        }

        this.timeline.setWindow(start, end);
        this.core.addDebugLog(`Período alterado: ${period}`);
    }

    updateTimelineSmartly() {
        if (!this.timeline) return;

        try {
            // Salvar seleção atual
            const selection = this.timeline.getSelection();
            
            // Atualizar dados
            this.timeline.setData({
                items: this.items,
                groups: this.groups
            });

            // Restaurar janela de visualização se existir
            if (this.currentViewWindow) {
                setTimeout(() => {
                    this.timeline.setWindow(this.currentViewWindow.start, this.currentViewWindow.end);
                }, 100);
            }

            // Restaurar seleção
            if (selection.length > 0) {
                setTimeout(() => {
                    this.timeline.setSelection(selection);
                }, 150);
            }

        } catch (error) {
            this.core.addDebugLog(`Erro ao atualizar timeline: ${error.message}`, 'error');
            // Em caso de erro, reinicializar completamente
            this.initTimeline();
        }
    }

    forceTimelineRender() {
        if (!this.timeline) return;

        try {
            // Forçar redraw da timeline
            this.timeline.redraw();
            
            // Garantir que os dados estão carregados
            const itemsCount = this.items.length;
            const groupsCount = this.groups.length;
            
            this.core.addDebugLog(`Forçando render: ${itemsCount} itens, ${groupsCount} grupos`);
            
            // Se ainda não tem dados visíveis, forçar fit
            if (itemsCount > 0) {
                setTimeout(() => {
                    if (this.timeline) {
                        this.timeline.fit();
                        this.core.addDebugLog('Timeline forçada a exibir dados');
                    }
                }, 100);
            }
        } catch (error) {
            this.core.addDebugLog(`Erro ao forçar render: ${error.message}`, 'error');
        }
    }

    handleTimelineSelection(selection) {
        if (selection.items.length > 0) {
            const selectedItem = this.items.get(selection.items[0]);
            if (selectedItem) {
                this.core.addDebugLog(`Item selecionado: ${selectedItem.content} (${selectedItem.group})`);
                // Implementar ações adicionais para seleção se necessário
            }
        }
    }

    updateVisibleItemsCount(count) {
        const element = document.getElementById('visibleItems');
        if (element) {
            element.textContent = `${count} itens visíveis`;
        }
    }

    updateSyncStatus(status, message) {
        const dot = document.getElementById('syncDot');
        const statusText = document.getElementById('syncStatus');
        
        if (dot) dot.className = `sync-dot ${status}`;
        if (statusText) statusText.textContent = message;
        
        this.lastSyncTime = new Date();
    }

    updateLastUpdateTime() {
        const lastUpdateTimeElement = document.getElementById('lastUpdateTime');
        if (lastUpdateTimeElement) {
            lastUpdateTimeElement.textContent = new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    updateNextSyncTime() {
        if (this.core.config.autoSyncInterval > 0) {
            const nextUpdate = new Date(Date.now() + this.core.config.autoSyncInterval);
            const nextUpdateElement = document.getElementById('nextUpdate');
            if (nextUpdateElement) {
                nextUpdateElement.textContent = nextUpdate.toLocaleTimeString('pt-BR');
            }
        }
    }

    updateSystemInfo() {
        // Atualizar informações do sistema
        this.updateLastUpdateTime();
        
        setInterval(() => {
            const now = new Date();
            this.updateNextSyncTime();
        }, 60000); // Atualizar a cada minuto
    }

    updateDebugPanel() {
        const debugLogElement = document.getElementById('debugLog');
        if (debugLogElement) {
            const recentLogs = this.core.getDebugLog().slice(-20);
            debugLogElement.innerHTML = recentLogs.map(log => log.fullMessage).join('\n');
            debugLogElement.scrollTop = debugLogElement.scrollHeight;
        }

        const debugStatsElement = document.getElementById('debugStats');
        if (debugStatsElement) {
            const stats = this.core.getPerformanceStats();
            debugStatsElement.innerHTML = `
                Registros Originais: ${this.processingStats.originalRecords}<br>
                Registros Finais: ${this.processingStats.finalRecords}<br>
                Conflitos Resolvidos: ${this.processingStats.conflictsResolved}<br>
                Duplicatas Removidas: ${this.processingStats.duplicatesRemoved}<br>
                Tempo de Processamento: ${this.processingStats.lastProcessingTime.toFixed(2)}ms<br>
                Cache: ${stats.cache.valid} válidos, ${stats.cache.expired} expirados<br>
                Memória: ${stats.memory.used || 'N/A'}MB usados
            `;
        }
    }

    // =============================================================================
    // NOTIFICAÇÕES E FEEDBACK
    // =============================================================================
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, this.core.constants.NOTIFICATION_DURATION);

        this.core.addDebugLog(`Notificação: ${message} (${type})`);
    }

    showProgressNotification(message, progress = 0) {
        const existingProgress = document.querySelector('.notification.progress');
        
        if (existingProgress) {
            existingProgress.textContent = `${message} (${progress}%)`;
            return;
        }

        const notification = document.createElement('div');
        notification.className = 'notification progress';
        notification.innerHTML = `
            <div>${message}</div>
            <div style="background: rgba(255,255,255,0.3); height: 4px; border-radius: 2px; margin-top: 0.5rem;">
                <div style="background: white; height: 100%; width: ${progress}%; border-radius: 2px; transition: width 0.3s;"></div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        if (progress >= 100) {
            setTimeout(() => {
                notification.remove();
            }, 1000);
        }
    }

    // =============================================================================
    // NAVEGAÇÃO E PÁGINAS EXTERNAS
    // =============================================================================
    loadAlertsPage() {
        try {
            this.showNotification('🔄 Abrindo página de alertas...', 'info');
            
            const alertsUrl = 'https://grupogps-mecanizada.github.io/Monitoramento-De-Produtividade/alerts.html';
            window.open(alertsUrl, '_blank');
            
            this.showNotification('✅ Página de alertas aberta em nova aba', 'success');
        } catch (error) {
            this.showNotification('⚠️ Erro ao abrir página de alertas', 'error');
            this.core.addDebugLog(`Erro ao abrir alertas: ${error.message}`, 'error');
        }
    }

    loadReportsPage() {
        try {
            this.showNotification('🔄 Abrindo página de relatórios...', 'info');
            
            const reportsUrl = 'https://grupogps-mecanizada.github.io/Productivity-Reports/reports.html';
            window.open(reportsUrl, '_blank');
            
            this.showNotification('✅ Página de relatórios aberta em nova aba', 'success');
        } catch (error) {
            this.showNotification('⚠️ Erro ao abrir página de relatórios', 'error');
            this.core.addDebugLog(`Erro ao abrir relatórios: ${error.message}`, 'error');
        }
    }

    // =============================================================================
    // UTILITÁRIOS E HELPERS
    // =============================================================================
    saveSystemState() {
        try {
            const systemState = {
                filterState: this.filterState,
                currentViewWindow: this.currentViewWindow,
                lastDataHash: this.lastDataHash,
                processingStats: this.processingStats,
                timestamp: new Date().toISOString()
            };
            
            localStorage.setItem('productivity_system_state', JSON.stringify(systemState));
            this.core.addDebugLog('Estado do sistema salvo');
        } catch (error) {
            this.core.addDebugLog(`Erro ao salvar estado: ${error.message}`, 'warning');
        }
    }

    loadSystemState() {
        try {
            const savedState = localStorage.getItem('productivity_system_state');
            if (savedState) {
                const state = JSON.parse(savedState);
                this.filterState = { ...this.filterState, ...state.filterState };
                this.currentViewWindow = state.currentViewWindow;
                this.core.addDebugLog('Estado do sistema carregado');
            }
        } catch (error) {
            this.core.addDebugLog(`Erro ao carregar estado: ${error.message}`, 'warning');
        }
    }

    getVisibleItems(startTime, endTime) {
        return this.items.get().filter(item => {
            return item.start >= startTime && item.start <= endTime;
        });
    }

    loadMoreTimelineItems() {
        // Implementar carregamento lazy de mais itens se necessário
        this.core.addDebugLog('Carregando mais itens da timeline...');
    }

    exportDebugData() {
        const debugData = {
            core: this.core.getPerformanceStats(),
            system: {
                processingStats: this.processingStats,
                equipmentCount: this.equipmentMap.size,
                itemsCount: this.items.length,
                groupsCount: this.groups.length,
                filterState: this.filterState
            },
            analytics: this.analytics.metrics,
            rules: this.rules.getRulesConfig(),
            timestamp: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(debugData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `productivity-debug-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('📁 Dados de debug exportados', 'success');
    }

    // =============================================================================
    // MÉTODOS TRADICIONAIS MANTIDOS PARA COMPATIBILIDADE
    // =============================================================================
    resolveConflictTraditional(status1, status2) {
        const priority1 = this.core.statusPriority[status1.status] || 0;
        const priority2 = this.core.statusPriority[status2.status] || 0;

        switch (this.core.config.conflictResolution) {
            case 'priority':
                if (priority1 > priority2) {
                    return { ...status1, end: status2.end };
                } else if (priority2 > priority1) {
                    return { ...status2 };
                } else {
                    return { ...status2 }; // Usar o mais recente
                }
            
            case 'latest':
                return { ...status2 };
            
            case 'longest':
                const duration1 = new Date(status1.end) - new Date(status1.start);
                const duration2 = new Date(status2.end) - new Date(status2.start);
                
                if (duration1 > duration2) {
                    return { ...status1, end: status2.end };
                } else {
                    return { ...status2 };
                }
            
            default:
                return { ...status2 };
        }
    }

    mergeStatusWithWeight(status1, status2, weights) {
        // Mesclagem ponderada baseada em pesos
        const weight1 = weights.status1 || 0.5;
        const weight2 = weights.status2 || 0.5;
        
        const totalWeight = weight1 + weight2;
        const normalizedWeight1 = weight1 / totalWeight;
        const normalizedWeight2 = weight2 / totalWeight;
        
        // Escolher o status com maior peso
        const chosenStatus = normalizedWeight1 > normalizedWeight2 ? status1 : status2;
        
        return {
            ...chosenStatus,
            start: status1.start,
            end: status2.end,
            total_time: (parseFloat(status1.total_time) || 0) + (parseFloat(status2.total_time) || 0),
            confidence: normalizedWeight1 > normalizedWeight2 ? normalizedWeight1 : normalizedWeight2,
            merge_type: 'weighted',
            original_statuses: [status1.status, status2.status]
        };
    }

    splitStatusIntelligent(status1, status2, splitPoint) {
        const start1 = new Date(status1.start);
        const end2 = new Date(status2.end);
        const duration = end2 - start1;
        const splitTime = new Date(start1.getTime() + duration * splitPoint);
        
        return {
            first: {
                ...status1,
                end: splitTime.toISOString(),
                split_type: 'intelligent'
            },
            second: {
                ...status2,
                start: splitTime.toISOString(),
                split_type: 'intelligent'
            }
        };
    }

    // =============================================================================
    // LIMPEZA E DESTRUCTOR
    // =============================================================================
    destroy() {
        this.core.addDebugLog('Iniciando destruição do sistema');
        
        // Salvar estado final
        this.saveSystemState();
        
        // Limpar intervalos
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
        }
        
        // Limpar debounce timers
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
        
        // Destruir timeline
        if (this.timeline) {
            this.timeline.destroy();
            this.timeline = null;
        }
        
        // Limpar datasets
        this.items.clear();
        this.groups.clear();
        this.equipmentMap.clear();
        
        // Destruir módulos
        if (this.analytics) {
            this.analytics.destroy();
        }
        
        if (this.rules) {
            this.rules.destroy();
        }
        
        if (this.core) {
            this.core.destroy();
        }
        
        console.log('✅ Sistema de Produtividade Modernizado destruído com sucesso');
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.ProductivitySystem = ProductivitySystem;
}
