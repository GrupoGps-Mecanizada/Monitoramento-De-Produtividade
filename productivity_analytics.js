// =============================================================================
// PRODUCTIVITY ANALYTICS MODULE - Sistema de Análise e Métricas
// =============================================================================

class ProductivityAnalytics {
    constructor(coreInstance) {
        this.core = coreInstance;
        this.charts = {};
        this.metrics = {};
        this.equipmentAnalysis = new Map();
        this.lastAnalysisTime = null;
        this.analysisCache = new Map();
        
        // Configurações de métricas
        this.metricsConfig = {
            productivityThreshold: 70, // % mínimo para considerar produtivo
            updateInterval: 30000, // 30 segundos
            chartColors: {
                productive: '#27ae60',
                nonProductive: '#e74c3c',
                neutral: '#95a5a6',
                primary: '#667eea',
                secondary: '#764ba2',
                warning: '#f39c12',
                info: '#3498db'
            },
            kpiTargets: {
                productivePercentage: 85,
                avgProductiveHours: 8,
                maxDowntime: 2
            }
        };

        this.initializeAnalytics();
    }

    // =============================================================================
    // INICIALIZAÇÃO DO SISTEMA DE ANALYTICS
    // =============================================================================
    initializeAnalytics() {
        this.core.addDebugLog('Analytics Module inicializado');
        this.setupEventListeners();
        this.initializeCharts();
        this.loadAnalyticsConfig();
    }

    setupEventListeners() {
        this.core.addEventListener('dataProcessed', (event) => {
            this.scheduleAnalysisUpdate();
        });

        this.core.addEventListener('configUpdated', (event) => {
            this.updateMetricsConfig();
        });
    }

    loadAnalyticsConfig() {
        try {
            const savedConfig = localStorage.getItem('productivity_analytics_config');
            if (savedConfig) {
                const parsed = JSON.parse(savedConfig);
                this.metricsConfig = { ...this.metricsConfig, ...parsed };
                this.core.addDebugLog('Configurações de analytics carregadas');
            }
        } catch (error) {
            this.core.addDebugLog(`Erro ao carregar config analytics: ${error.message}`, 'warning');
        }
    }

    saveAnalyticsConfig() {
        try {
            localStorage.setItem('productivity_analytics_config', JSON.stringify(this.metricsConfig));
            this.core.addDebugLog('Configurações de analytics salvas');
        } catch (error) {
            this.core.addDebugLog(`Erro ao salvar config analytics: ${error.message}`, 'warning');
        }
    }

    // =============================================================================
    // ANÁLISE DE PRODUTIVIDADE
    // =============================================================================
    analyzeProductivity(equipmentData, productivityRules) {
        return this.core.measureOperation('analyzeProductivity', () => {
            this.core.addDebugLog('Iniciando análise de produtividade');
            
            const analysis = {
                overview: this.calculateOverviewMetrics(equipmentData, productivityRules),
                equipmentDetails: this.analyzeEquipmentDetails(equipmentData, productivityRules),
                timelineAnalysis: this.analyzeTimelinePatterns(equipmentData),
                groupAnalysis: this.analyzeByGroups(equipmentData, productivityRules),
                trends: this.calculateTrends(equipmentData),
                alerts: this.generateAlerts(equipmentData, productivityRules)
            };

            this.metrics = analysis;
            this.lastAnalysisTime = new Date();
            
            this.core.addDebugLog(`Análise concluída: ${analysis.equipmentDetails.size} equipamentos analisados`);
            return analysis;
        });
    }

    calculateOverviewMetrics(equipmentData, productivityRules) {
        let totalProductiveHours = 0;
        let totalNonProductiveHours = 0;
        let productiveEquipmentCount = 0;
        let totalEquipments = equipmentData.size;
        let topEquipment = { name: '--', productivity: 0 };

        for (const [equipName, data] of equipmentData) {
            const equipAnalysis = this.analyzeEquipmentProductivity(equipName, data, productivityRules);
            
            totalProductiveHours += equipAnalysis.productiveHours;
            totalNonProductiveHours += equipAnalysis.nonProductiveHours;
            
            if (equipAnalysis.productivityPercentage >= this.metricsConfig.productivityThreshold) {
                productiveEquipmentCount++;
            }
            
            if (equipAnalysis.productivityPercentage > topEquipment.productivity) {
                topEquipment = {
                    name: this.core.getDisplayName(equipName),
                    productivity: equipAnalysis.productivityPercentage
                };
            }
        }

        const totalHours = totalProductiveHours + totalNonProductiveHours;
        const productivePercentage = totalHours > 0 ? (totalProductiveHours / totalHours) * 100 : 0;
        const equipmentProductivePercentage = totalEquipments > 0 ? (productiveEquipmentCount / totalEquipments) * 100 : 0;

        return {
            productivePercentage: Math.round(productivePercentage * 10) / 10,
            equipmentProductivePercentage: Math.round(equipmentProductivePercentage * 10) / 10,
            totalProductiveHours: Math.round(totalProductiveHours * 10) / 10,
            totalNonProductiveHours: Math.round(totalNonProductiveHours * 10) / 10,
            totalHours: Math.round(totalHours * 10) / 10,
            productiveEquipmentCount,
            totalEquipments,
            topEquipment,
            avgProductivityPerEquipment: totalEquipments > 0 ? Math.round((productivePercentage / totalEquipments) * 10) / 10 : 0
        };
    }

    analyzeEquipmentDetails(equipmentData, productivityRules) {
        const details = new Map();

        for (const [equipName, data] of equipmentData) {
            const analysis = this.analyzeEquipmentProductivity(equipName, data, productivityRules);
            details.set(equipName, analysis);
        }

        this.equipmentAnalysis = details;
        return details;
    }

    analyzeEquipmentProductivity(equipName, equipData, productivityRules) {
        const cacheKey = `equip_analysis_${equipName}_${this.core.generateHash(equipData)}`;
        const cached = this.core.getCache(cacheKey);
        if (cached) return cached;

        let productiveTime = 0;
        let nonProductiveTime = 0;
        let neutralTime = 0;
        let lastActivity = null;
        let currentStatus = 'unknown';
        let activities = [];

        // Analisar status de telemetria
        equipData.status.forEach(statusItem => {
            const duration = parseFloat(statusItem.total_time) || 0;
            const status = statusItem.status;
            const classification = this.classifyActivity(status, 'status', productivityRules);
            
            activities.push({
                type: 'status',
                item: status,
                classification: classification,
                duration: duration,
                timestamp: this.core.parseDate(statusItem.start)
            });

            switch (classification) {
                case 'productive':
                    productiveTime += duration;
                    break;
                case 'non-productive':
                    nonProductiveTime += duration;
                    break;
                default:
                    neutralTime += duration;
            }

            const timestamp = this.core.parseDate(statusItem.end);
            if (!lastActivity || (timestamp && timestamp > lastActivity)) {
                lastActivity = timestamp;
                currentStatus = status;
            }
        });

        // Analisar apontamentos
        equipData.apontamentos.forEach(apont => {
            const category = apont['Categoria Demora'];
            const duration = this.calculateApontamentoDuration(apont);
            const classification = this.classifyActivity(category, 'apontamento', productivityRules);
            
            activities.push({
                type: 'apontamento',
                item: category,
                classification: classification,
                duration: duration,
                timestamp: this.core.parseDate(apont['Data Final'])
            });

            switch (classification) {
                case 'productive':
                    productiveTime += duration;
                    break;
                case 'non-productive':
                    nonProductiveTime += duration;
                    break;
                default:
                    neutralTime += duration;
            }
        });

        const totalTime = productiveTime + nonProductiveTime + neutralTime;
        const productivityPercentage = totalTime > 0 ? (productiveTime / totalTime) * 100 : 0;

        // Determinar grupo do equipamento
        const group = this.determineEquipmentGroup(equipName);

        const analysis = {
            equipmentName: equipName,
            displayName: this.core.getDisplayName(equipName),
            group: group,
            productiveHours: Math.round(productiveTime * 10) / 10,
            nonProductiveHours: Math.round(nonProductiveTime * 10) / 10,
            neutralHours: Math.round(neutralTime * 10) / 10,
            totalHours: Math.round(totalTime * 10) / 10,
            productivityPercentage: Math.round(productivityPercentage * 10) / 10,
            currentStatus: currentStatus,
            lastActivity: lastActivity,
            activities: activities,
            isProductive: productivityPercentage >= this.metricsConfig.productivityThreshold
        };

        this.core.setCache(cacheKey, analysis, 300000); // Cache por 5 minutos
        return analysis;
    }

    classifyActivity(activity, type, productivityRules) {
        if (!productivityRules || !activity) return 'neutral';

        try {
            const rules = type === 'status' ? productivityRules.telemetryRules : productivityRules.appointmentRules;
            
            if (rules && rules[activity]) {
                return rules[activity];
            }

            // Fallback para regras globais
            if (productivityRules.globalRules && productivityRules.globalRules[activity]) {
                return productivityRules.globalRules[activity];
            }

            // Classificação padrão baseada no tipo de atividade
            return this.getDefaultClassification(activity, type);
            
        } catch (error) {
            this.core.addDebugLog(`Erro na classificação de atividade ${activity}: ${error.message}`, 'warning');
            return 'neutral';
        }
    }

    getDefaultClassification(activity, type) {
        if (type === 'status') {
            const productiveStatuses = ['running', 'on', 'working'];
            const nonProductiveStatuses = ['stopped', 'off', 'maintenance', 'out_of_plant'];
            
            if (productiveStatuses.includes(activity.toLowerCase())) return 'productive';
            if (nonProductiveStatuses.includes(activity.toLowerCase())) return 'non-productive';
        } else if (type === 'apontamento') {
            const productiveActivities = ['preparação', 'documentação'];
            const nonProductiveActivities = ['manutenção', 'bloqueio', 'aguardando'];
            
            const activityLower = activity.toLowerCase();
            if (productiveActivities.some(p => activityLower.includes(p))) return 'productive';
            if (nonProductiveActivities.some(np => activityLower.includes(np))) return 'non-productive';
        }
        
        return 'neutral';
    }

    calculateApontamentoDuration(apont) {
        const start = this.core.parseDate(apont['Data Inicial']);
        const end = this.core.parseDate(apont['Data Final']);
        
        if (!start || !end) return 0;
        
        return (end - start) / (1000 * 60 * 60); // Converter para horas
    }

    determineEquipmentGroup(equipName) {
        const name = equipName.toLowerCase();
        
        if (name.includes('alta pressão') || name.includes('alta pressao')) return 'Alta Pressão';
        if (name.includes('baixa pressão') || name.includes('baixa pressao')) return 'Baixa Pressão';
        if (name.includes('vácuo') || name.includes('vacuo')) return 'Vácuo';
        if (name.includes('caminhão') || name.includes('caminhao')) return 'Caminhões';
        if (name.includes('escavadeira')) return 'Escavadeiras';
        
        return 'Outros';
    }

    analyzeTimelinePatterns(equipmentData) {
        const patterns = {
            hourlyDistribution: new Array(24).fill(0),
            dailyAverages: {},
            peakProductivityHours: [],
            lowProductivityHours: []
        };

        for (const [equipName, data] of equipmentData) {
            data.status.forEach(statusItem => {
                const startDate = this.core.parseDate(statusItem.start);
                if (startDate) {
                    const hour = startDate.getHours();
                    const day = startDate.toDateString();
                    
                    patterns.hourlyDistribution[hour]++;
                    
                    if (!patterns.dailyAverages[day]) {
                        patterns.dailyAverages[day] = { productive: 0, total: 0 };
                    }
                    
                    patterns.dailyAverages[day].total++;
                    
                    const classification = this.getDefaultClassification(statusItem.status, 'status');
                    if (classification === 'productive') {
                        patterns.dailyAverages[day].productive++;
                    }
                }
            });
        }

        // Identificar horários de pico e baixa produtividade
        const avgProductivity = patterns.hourlyDistribution.reduce((a, b) => a + b, 0) / 24;
        
        patterns.hourlyDistribution.forEach((count, hour) => {
            if (count > avgProductivity * 1.2) {
                patterns.peakProductivityHours.push(hour);
            } else if (count < avgProductivity * 0.8) {
                patterns.lowProductivityHours.push(hour);
            }
        });

        return patterns;
    }

    analyzeByGroups(equipmentData, productivityRules) {
        const groupAnalysis = {};

        for (const [equipName, data] of equipmentData) {
            const group = this.determineEquipmentGroup(equipName);
            
            if (!groupAnalysis[group]) {
                groupAnalysis[group] = {
                    equipmentCount: 0,
                    totalProductiveHours: 0,
                    totalNonProductiveHours: 0,
                    equipments: []
                };
            }

            const equipAnalysis = this.analyzeEquipmentProductivity(equipName, data, productivityRules);
            
            groupAnalysis[group].equipmentCount++;
            groupAnalysis[group].totalProductiveHours += equipAnalysis.productiveHours;
            groupAnalysis[group].totalNonProductiveHours += equipAnalysis.nonProductiveHours;
            groupAnalysis[group].equipments.push(equipAnalysis);
        }

        // Calcular métricas por grupo
        Object.keys(groupAnalysis).forEach(group => {
            const groupData = groupAnalysis[group];
            const totalHours = groupData.totalProductiveHours + groupData.totalNonProductiveHours;
            
            groupData.productivityPercentage = totalHours > 0 ? 
                Math.round((groupData.totalProductiveHours / totalHours) * 100 * 10) / 10 : 0;
                
            groupData.avgProductivityPerEquipment = groupData.equipmentCount > 0 ?
                Math.round((groupData.productivityPercentage / groupData.equipmentCount) * 10) / 10 : 0;
        });

        return groupAnalysis;
    }

    calculateTrends(equipmentData) {
        const trends = {
            productivityTrend: 'stable',
            equipmentPerformanceTrend: {},
            alertsGenerated: 0,
            improvementOpportunities: []
        };

        // Analisar tendências por equipamento
        for (const [equipName, data] of equipmentData) {
            const recentData = this.getRecentData(data, 7); // Últimos 7 dias
            const olderData = this.getOlderData(data, 7, 14); // 7-14 dias atrás

            if (recentData.length > 0 && olderData.length > 0) {
                const recentProductivity = this.calculateProductivityForPeriod(recentData);
                const olderProductivity = this.calculateProductivityForPeriod(olderData);
                
                const trend = recentProductivity > olderProductivity ? 'improving' : 
                             recentProductivity < olderProductivity ? 'declining' : 'stable';
                
                trends.equipmentPerformanceTrend[equipName] = {
                    trend: trend,
                    recentProductivity: recentProductivity,
                    olderProductivity: olderProductivity,
                    change: Math.round((recentProductivity - olderProductivity) * 10) / 10
                };
            }
        }

        return trends;
    }

    generateAlerts(equipmentData, productivityRules) {
        const alerts = [];

        for (const [equipName, data] of equipmentData) {
            const analysis = this.analyzeEquipmentProductivity(equipName, data, productivityRules);
            
            // Alert para baixa produtividade
            if (analysis.productivityPercentage < this.metricsConfig.productivityThreshold) {
                alerts.push({
                    type: 'low_productivity',
                    severity: 'warning',
                    equipment: equipName,
                    message: `Produtividade baixa: ${analysis.productivityPercentage}%`,
                    timestamp: new Date(),
                    data: analysis
                });
            }

            // Alert para equipamento inativo há muito tempo
            if (analysis.lastActivity) {
                const hoursInactive = (Date.now() - analysis.lastActivity) / (1000 * 60 * 60);
                if (hoursInactive > 24) {
                    alerts.push({
                        type: 'inactive_equipment',
                        severity: 'error',
                        equipment: equipName,
                        message: `Equipamento inativo há ${Math.round(hoursInactive)}h`,
                        timestamp: new Date(),
                        data: { hoursInactive: hoursInactive }
                    });
                }
            }
        }

        return alerts;
    }

    // =============================================================================
    // DASHBOARD E INTERFACE
    // =============================================================================
    updateDashboard() {
        if (!this.metrics || !this.metrics.overview) {
            this.core.addDebugLog('Métricas não disponíveis para dashboard', 'warning');
            return;
        }

        this.updateKPIs();
        this.updateCharts();
        this.updateEquipmentTable();
        
        this.core.addDebugLog('Dashboard atualizado com sucesso');
    }

    updateKPIs() {
        const overview = this.metrics.overview;
        
        this.updateKPI('productivePercentage', `${overview.equipmentProductivePercentage}%`);
        this.updateKPI('totalProductiveHours', `${overview.totalProductiveHours}h`);
        this.updateKPI('totalNonProductiveHours', `${overview.totalNonProductiveHours}h`);
        this.updateKPI('topEquipmentName', overview.topEquipment.name);
    }

    updateKPI(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
            
            // Adicionar animação de atualização
            element.style.transform = 'scale(1.1)';
            setTimeout(() => {
                element.style.transform = 'scale(1)';
            }, 200);
        }
    }

    updateCharts() {
        this.updateProductivityPieChart();
        this.updateProductivityTimelineChart();
    }

    updateProductivityPieChart() {
        const canvas = document.getElementById('productivityPieChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        if (this.charts.pieChart) {
            this.charts.pieChart.destroy();
        }

        const overview = this.metrics.overview;
        
        this.charts.pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Produtivo', 'Não Produtivo'],
                datasets: [{
                    data: [overview.totalProductiveHours, overview.totalNonProductiveHours],
                    backgroundColor: [
                        this.metricsConfig.chartColors.productive,
                        this.metricsConfig.chartColors.nonProductive
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed}h (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    updateProductivityTimelineChart() {
        const canvas = document.getElementById('productivityTimelineChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        if (this.charts.timelineChart) {
            this.charts.timelineChart.destroy();
        }

        const timelineData = this.generateTimelineChartData();
        
        this.charts.timelineChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timelineData.labels,
                datasets: [{
                    label: 'Produtividade (%)',
                    data: timelineData.productivity,
                    borderColor: this.metricsConfig.chartColors.primary,
                    backgroundColor: this.metricsConfig.chartColors.primary + '20',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Produtividade: ${context.parsed.y}%`;
                            }
                        }
                    }
                }
            }
        });
    }

    generateTimelineChartData() {
        const data = { labels: [], productivity: [] };
        
        if (!this.metrics.timelineAnalysis || !this.metrics.timelineAnalysis.dailyAverages) {
            return data;
        }

        const dailyAverages = this.metrics.timelineAnalysis.dailyAverages;
        const sortedDays = Object.keys(dailyAverages).sort();
        
        sortedDays.slice(-7).forEach(day => { // Últimos 7 dias
            const dayData = dailyAverages[day];
            const productivity = dayData.total > 0 ? (dayData.productive / dayData.total) * 100 : 0;
            
            data.labels.push(new Date(day).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
            data.productivity.push(Math.round(productivity * 10) / 10);
        });

        return data;
    }

    updateEquipmentTable() {
        const tbody = document.getElementById('equipmentAnalysisBody');
        if (!tbody || !this.equipmentAnalysis) return;

        tbody.innerHTML = '';

        // Ordenar equipamentos por produtividade (decrescente)
        const sortedEquipments = Array.from(this.equipmentAnalysis.entries())
            .sort(([,a], [,b]) => b.productivityPercentage - a.productivityPercentage);

        sortedEquipments.forEach(([equipName, analysis]) => {
            const row = document.createElement('tr');
            
            const statusBadgeClass = analysis.isProductive ? 'status-productive' : 'status-non-productive';
            const statusText = analysis.isProductive ? 'Produtivo' : 'Não Produtivo';
            
            row.innerHTML = `
                <td style="font-weight: 600;">${analysis.displayName}</td>
                <td>${analysis.group}</td>
                <td><span class="status-badge ${statusBadgeClass}">${statusText}</span></td>
                <td style="font-weight: 600; color: ${analysis.isProductive ? '#27ae60' : '#e74c3c'};">${analysis.productivityPercentage}%</td>
                <td>${analysis.productiveHours}h</td>
                <td>${analysis.nonProductiveHours}h</td>
                <td>${analysis.lastActivity ? this.core.formatDateTime(analysis.lastActivity) : 'N/A'}</td>
            `;
            
            tbody.appendChild(row);
        });

        this.core.addDebugLog(`Tabela de equipamentos atualizada: ${sortedEquipments.length} equipamentos`);
    }

    // =============================================================================
    // EXPORT E RELATÓRIOS
    // =============================================================================
    exportProductivityReport(format = 'json') {
        const reportData = {
            timestamp: new Date().toISOString(),
            summary: this.metrics.overview,
            equipmentDetails: Array.from(this.equipmentAnalysis.entries()).map(([name, data]) => ({ name, ...data })),
            groupAnalysis: this.metrics.groupAnalysis,
            trends: this.metrics.trends,
            alerts: this.metrics.alerts
        };

        switch (format.toLowerCase()) {
            case 'json':
                this.exportJSON(reportData, 'productivity-report');
                break;
            case 'csv':
                this.exportCSV(reportData.equipmentDetails, 'equipment-productivity');
                break;
            case 'excel':
                this.exportExcel(reportData);
                break;
            default:
                this.core.addDebugLog(`Formato de export inválido: ${format}`, 'error');
        }
    }

    exportJSON(data, filename) {
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        this.downloadFile(dataBlob, `${filename}-${this.getDateString()}.json`);
        this.core.addDebugLog('Relatório JSON exportado');
    }

    exportCSV(data, filename) {
        const headers = ['Nome', 'Grupo', 'Produtividade (%)', 'Horas Produtivas', 'Horas Improdutivas', 'Status Atual', 'Última Atividade'];
        const csvContent = [
            headers.join(','),
            ...data.map(item => [
                `"${item.displayName}"`,
                `"${item.group}"`,
                item.productivityPercentage,
                item.productiveHours,
                item.nonProductiveHours,
                `"${item.currentStatus}"`,
                `"${item.lastActivity ? this.core.formatDateTime(item.lastActivity) : 'N/A'}"`
            ].join(','))
        ].join('\n');

        const dataBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        this.downloadFile(dataBlob, `${filename}-${this.getDateString()}.csv`);
        this.core.addDebugLog('Relatório CSV exportado');
    }

    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    getDateString() {
        return new Date().toISOString().split('T')[0];
    }

    // =============================================================================
    // UTILITÁRIOS E HELPERS
    // =============================================================================
    scheduleAnalysisUpdate() {
        // Debounce para evitar atualizações excessivas
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        
        this.updateTimeout = setTimeout(() => {
            this.core.dispatchEvent('analyticsUpdateRequested', {
                timestamp: new Date(),
                source: 'scheduleAnalysisUpdate'
            });
        }, 1000);
    }

    updateMetricsConfig() {
        this.loadAnalyticsConfig();
        this.updateDashboard();
    }

    initializeCharts() {
        // Configurações globais do Chart.js
        if (typeof Chart !== 'undefined') {
            Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
            Chart.defaults.font.size = 12;
            Chart.defaults.color = '#2c3e50';
        }
    }

    getRecentData(data, days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        return data.status.filter(item => {
            const itemDate = this.core.parseDate(item.start);
            return itemDate && itemDate >= cutoffDate;
        });
    }

    getOlderData(data, startDays, endDays) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - endDays);
        
        const endDate = new Date();
        endDate.setDate(endDate.getDate() - startDays);
        
        return data.status.filter(item => {
            const itemDate = this.core.parseDate(item.start);
            return itemDate && itemDate >= startDate && itemDate < endDate;
        });
    }

    calculateProductivityForPeriod(data) {
        let productiveTime = 0;
        let totalTime = 0;
        
        data.forEach(item => {
            const duration = parseFloat(item.total_time) || 0;
            totalTime += duration;
            
            const classification = this.getDefaultClassification(item.status, 'status');
            if (classification === 'productive') {
                productiveTime += duration;
            }
        });
        
        return totalTime > 0 ? (productiveTime / totalTime) * 100 : 0;
    }

    // =============================================================================
    // LIMPEZA E DESTRUTOR
    // =============================================================================
    destroy() {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        
        this.charts = {};
        this.metrics = {};
        this.equipmentAnalysis.clear();
        this.analysisCache.clear();
        
        this.core.addDebugLog('Analytics Module destruído');
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.ProductivityAnalytics = ProductivityAnalytics;
}
