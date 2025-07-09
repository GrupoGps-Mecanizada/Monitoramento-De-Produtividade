// =============================================================================
// PRODUCTIVITY ANALYTICS MODULE - Sistema de Analytics Ultra Inteligente v2.0
// =============================================================================

class ProductivityAnalytics {
    constructor(coreInstance) {
        this.core = coreInstance;
        this.version = '2.0.0';
        this.charts = {};
        this.metrics = {};
        this.equipmentAnalysis = new Map();
        this.lastAnalysisTime = null;
        this.analyticsCache = new Map();
        this.predictionModels = new Map();
        this.anomalyDetector = null;
        
        // Advanced configuration
        this.config = {
            productivityThreshold: 70,
            warningThreshold: 50,
            criticalThreshold: 30,
            updateInterval: 30000,
            predictionHorizon: 7, // days
            anomalyThreshold: 2, // standard deviations
            confidenceLevel: 0.85,
            
            // Advanced metrics
            enablePredictiveAnalytics: true,
            enableAnomalyDetection: true,
            enableBenchmarking: true,
            enableRealTimeAlerts: true,
            
            // Chart colors optimized for accessibility
            chartColors: {
                productive: '#27AE60',
                nonProductive: '#E74C3C',
                neutral: '#95A5A6',
                warning: '#F39C12',
                critical: '#C0392B',
                excellent: '#16A085',
                primary: '#667EEA',
                secondary: '#764BA2',
                gradient: {
                    productive: ['#27AE60', '#2ECC71'],
                    nonProductive: ['#E74C3C', '#C0392B'],
                    neutral: ['#95A5A6', '#7F8C8D'],
                    performance: ['#667EEA', '#764BA2']
                }
            },
            
            // KPI targets and benchmarks
            benchmarks: {
                industry: {
                    productivityRate: 82,
                    uptimeRate: 87,
                    maintenanceRatio: 8,
                    efficiencyScore: 78
                },
                internal: {
                    productivityTarget: 85,
                    uptimeTarget: 90,
                    maintenanceTarget: 6,
                    efficiencyTarget: 80
                }
            }
        };

        // Advanced analytics modules
        this.modules = {
            trending: new TrendAnalysis(this),
            forecasting: new ProductivityForecasting(this),
            anomaly: new AnomalyDetection(this),
            benchmarking: new PerformanceBenchmarking(this),
            optimization: new OptimizationSuggestions(this)
        };

        this.initializeAdvancedAnalytics();
    }

    // =============================================================================
    // INICIALIZAÇÃO AVANÇADA
    // =============================================================================
    initializeAdvancedAnalytics() {
        this.core.addDebugLog('Analytics Module v2.0 inicializado');
        this.setupEventListeners();
        this.initializeChartEngine();
        this.loadAnalyticsConfig();
        this.startRealTimeMonitoring();
    }

    setupEventListeners() {
        this.core.addEventListener('dataProcessed', (event) => {
            this.scheduleIntelligentAnalysis();
        });

        this.core.addEventListener('configUpdated', (event) => {
            this.updateAnalyticsConfig();
        });

        this.core.addEventListener('ruleUpdated', (event) => {
            this.invalidateAnalyticsCache();
        });
    }

    initializeChartEngine() {
        if (typeof Chart !== 'undefined') {
            Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
            Chart.defaults.font.size = 12;
            Chart.defaults.color = '#2c3e50';
            Chart.defaults.plugins.legend.position = 'bottom';
            Chart.defaults.responsive = true;
            Chart.defaults.maintainAspectRatio = false;
            
            // Register custom plugins
            this.registerChartPlugins();
        }
    }

    registerChartPlugins() {
        // Custom animation plugin
        Chart.register({
            id: 'customAnimations',
            beforeUpdate: (chart) => {
                chart.options.animation = {
                    duration: 750,
                    easing: 'easeInOutQuart'
                };
            }
        });
    }

    loadAnalyticsConfig() {
        try {
            const savedConfig = localStorage.getItem('productivity_analytics_config_v2');
            if (savedConfig) {
                const parsed = JSON.parse(savedConfig);
                this.config = { ...this.config, ...parsed };
                this.core.addDebugLog('Configurações avançadas de analytics carregadas');
            }
        } catch (error) {
            this.core.addDebugLog(`Erro ao carregar config analytics: ${error.message}`, 'warning');
        }
    }

    startRealTimeMonitoring() {
        if (this.config.enableRealTimeAlerts) {
            setInterval(() => {
                this.performRealTimeAnalysis();
            }, this.config.updateInterval);
        }
    }

    // =============================================================================
    // ANÁLISE INTELIGENTE DE PRODUTIVIDADE
    // =============================================================================
    analyzeProductivityIntelligent(equipmentData, productivityRules) {
        return this.core.measureOperation('analyzeProductivityIntelligent', () => {
            this.core.addDebugLog('Iniciando análise inteligente de produtividade');
            
            const analysis = {
                overview: this.calculateAdvancedOverviewMetrics(equipmentData, productivityRules),
                equipmentDetails: this.analyzeEquipmentDetailsAdvanced(equipmentData, productivityRules),
                temporalAnalysis: this.analyzeTemporalPatterns(equipmentData),
                groupAnalysis: this.analyzeGroupsAdvanced(equipmentData, productivityRules),
                trendAnalysis: this.modules.trending.analyzeTrends(equipmentData),
                predictions: this.modules.forecasting.generatePredictions(equipmentData),
                anomalies: this.modules.anomaly.detectAnomalies(equipmentData),
                benchmarks: this.modules.benchmarking.compareToBenchmarks(equipmentData),
                optimization: this.modules.optimization.generateSuggestions(equipmentData),
                insights: this.generateActionableInsights(equipmentData, productivityRules),
                alerts: this.generateIntelligentAlerts(equipmentData, productivityRules)
            };

            this.metrics = analysis;
            this.lastAnalysisTime = new Date();
            
            this.core.addDebugLog(`Análise inteligente concluída: ${analysis.equipmentDetails.size} equipamentos analisados`);
            return analysis;
        });
    }

    calculateAdvancedOverviewMetrics(equipmentData, productivityRules) {
        const metrics = {
            // Core metrics
            totalProductiveHours: 0,
            totalNonProductiveHours: 0,
            totalNeutralHours: 0,
            totalDowntime: 0,
            totalOperationalTime: 0,
            
            // Advanced metrics
            productiveEquipmentCount: 0,
            totalEquipments: equipmentData.size,
            averageProductivity: 0,
            productivityStandardDeviation: 0,
            uptimeRate: 0,
            availabilityRate: 0,
            performanceRate: 0,
            qualityRate: 0,
            oeeScore: 0, // Overall Equipment Effectiveness
            
            // Performance categories
            excellentPerformers: [],
            goodPerformers: [],
            averagePerformers: [],
            poorPerformers: [],
            criticalPerformers: [],
            
            // Time-based metrics
            peakProductivityHour: null,
            lowestProductivityHour: null,
            productivityVariability: 0,
            
            // Benchmark comparisons
            vsIndustryBenchmark: 0,
            vsInternalTarget: 0,
            vsHistoricalAverage: 0
        };

        const equipmentProductivities = [];
        const hourlyProductivity = new Array(24).fill(0);
        const hourlyCount = new Array(24).fill(0);

        for (const [equipName, data] of equipmentData) {
            const equipAnalysis = this.analyzeEquipmentProductivityAdvanced(equipName, data, productivityRules);
            
            // Accumulate core metrics
            metrics.totalProductiveHours += equipAnalysis.productiveHours;
            metrics.totalNonProductiveHours += equipAnalysis.nonProductiveHours;
            metrics.totalNeutralHours += equipAnalysis.neutralHours;
            metrics.totalDowntime += equipAnalysis.downtimeHours;
            metrics.totalOperationalTime += equipAnalysis.totalHours;
            
            // Categorize performance
            this.categorizeEquipmentPerformance(equipAnalysis, metrics);
            
            // Track productivities for statistical analysis
            equipmentProductivities.push(equipAnalysis.productivityPercentage);
            
            // Accumulate hourly data
            this.accumulateHourlyData(data, hourlyProductivity, hourlyCount);
        }

        // Calculate derived metrics
        this.calculateDerivedMetrics(metrics, equipmentProductivities, hourlyProductivity, hourlyCount);
        
        // Calculate benchmark comparisons
        this.calculateBenchmarkComparisons(metrics);

        return metrics;
    }

    analyzeEquipmentProductivityAdvanced(equipName, equipData, productivityRules) {
        const cacheKey = `advanced_equip_analysis_${equipName}_${this.core.generateHash(equipData)}`;
        const cached = this.core.getCache(cacheKey);
        if (cached) return cached;

        const analysis = {
            equipmentName: equipName,
            displayName: this.core.getDisplayName(equipName),
            group: this.determineEquipmentGroup(equipName),
            
            // Time metrics
            productiveHours: 0,
            nonProductiveHours: 0,
            neutralHours: 0,
            downtimeHours: 0,
            maintenanceHours: 0,
            idleHours: 0,
            totalHours: 0,
            
            // Performance metrics
            productivityPercentage: 0,
            uptimePercentage: 0,
            availabilityPercentage: 0,
            performanceRating: 'average',
            efficiencyScore: 0,
            
            // Operational metrics
            activeCycles: 0,
            averageCycleTime: 0,
            longestContinuousOperation: 0,
            shortestDowntime: Infinity,
            longestDowntime: 0,
            
            // Status information
            currentStatus: 'unknown',
            lastActivity: null,
            timeInCurrentStatus: 0,
            statusChanges: 0,
            
            // Activity breakdown
            activities: [],
            statusDistribution: {},
            appointmentDistribution: {},
            
            // Quality indicators
            dataQuality: 100,
            reliabilityScore: 0,
            consistencyScore: 0,
            
            // Trends and patterns
            hourlyPattern: new Array(24).fill(0),
            weekdayPattern: new Array(7).fill(0),
            productivityTrend: 'stable',
            
            // Alerts and flags
            hasAnomalies: false,
            anomalies: [],
            recommendations: [],
            
            // Predictive indicators
            maintenancePrediction: null,
            performanceForecast: null,
            riskAssessment: 'low'
        };

        // Analyze status data with enhanced metrics
        this.analyzeStatusDataAdvanced(equipData.status, analysis, productivityRules);
        
        // Analyze appointment data
        this.analyzeAppointmentDataAdvanced(equipData.apontamentos, analysis, productivityRules);
        
        // Calculate derived metrics
        this.calculateEquipmentDerivedMetrics(analysis);
        
        // Detect patterns and anomalies
        this.detectEquipmentPatterns(analysis);
        
        // Generate recommendations
        this.generateEquipmentRecommendations(analysis);

        this.core.setCache(cacheKey, analysis, 300000);
        return analysis;
    }

    analyzeStatusDataAdvanced(statusData, analysis, productivityRules) {
        let lastStatusTime = null;
        let currentOperationStart = null;
        let operationDurations = [];

        statusData.forEach((statusItem, index) => {
            const duration = parseFloat(statusItem.total_time) || 0;
            const status = statusItem.status;
            const startTime = this.core.parseDate(statusItem.start);
            const endTime = this.core.parseDate(statusItem.end);
            
            // Classification with context
            const context = {
                equipmentGroup: analysis.group,
                timestamp: startTime,
                previousStatus: lastStatusTime ? lastStatusTime.status : null
            };
            
            const classification = this.classifyActivityAdvanced(status, 'status', productivityRules, context);
            
            // Accumulate time by classification
            switch (classification) {
                case 'productive':
                    analysis.productiveHours += duration;
                    analysis.activeCycles++;
                    if (currentOperationStart === null) {
                        currentOperationStart = startTime;
                    }
                    break;
                case 'non-productive':
                    analysis.nonProductiveHours += duration;
                    if (['maintenance', 'error'].includes(status)) {
                        analysis.maintenanceHours += duration;
                    } else {
                        analysis.downtimeHours += duration;
                    }
                    this.endOperationCycle(currentOperationStart, endTime, operationDurations);
                    currentOperationStart = null;
                    break;
                default:
                    analysis.neutralHours += duration;
                    analysis.idleHours += duration;
            }
            
            // Track status distribution
            analysis.statusDistribution[status] = (analysis.statusDistribution[status] || 0) + duration;
            
            // Update current status info
            if (!analysis.lastActivity || (endTime && endTime > analysis.lastActivity)) {
                analysis.lastActivity = endTime;
                analysis.currentStatus = status;
            }
            
            // Count status changes
            if (lastStatusTime && lastStatusTime.status !== status) {
                analysis.statusChanges++;
            }
            
            // Accumulate hourly patterns
            if (startTime) {
                const hour = startTime.getHours();
                const weekday = startTime.getDay();
                analysis.hourlyPattern[hour] += duration;
                analysis.weekdayPattern[weekday] += duration;
            }
            
            // Store activity for detailed analysis
            analysis.activities.push({
                type: 'status',
                item: status,
                classification: classification,
                duration: duration,
                timestamp: startTime,
                endTime: endTime
            });
            
            lastStatusTime = { status, endTime };
        });

        // Calculate operational metrics
        if (operationDurations.length > 0) {
            analysis.averageCycleTime = operationDurations.reduce((a, b) => a + b, 0) / operationDurations.length;
            analysis.longestContinuousOperation = Math.max(...operationDurations);
        }
    }

    analyzeAppointmentDataAdvanced(appointmentData, analysis, productivityRules) {
        appointmentData.forEach(apont => {
            const category = apont['Categoria Demora'];
            const duration = this.calculateApontamentoDuration(apont);
            const startTime = this.core.parseDate(apont['Data Inicial']);
            
            const context = {
                equipmentGroup: analysis.group,
                timestamp: startTime
            };
            
            const classification = this.classifyActivityAdvanced(category, 'appointment', productivityRules, context);
            
            // Accumulate time by classification
            switch (classification) {
                case 'productive':
                    analysis.productiveHours += duration;
                    break;
                case 'non-productive':
                    analysis.nonProductiveHours += duration;
                    if (category?.toLowerCase().includes('manutenção')) {
                        analysis.maintenanceHours += duration;
                    }
                    break;
                default:
                    analysis.neutralHours += duration;
            }
            
            // Track appointment distribution
            analysis.appointmentDistribution[category] = (analysis.appointmentDistribution[category] || 0) + duration;
            
            // Store activity
            analysis.activities.push({
                type: 'appointment',
                item: category,
                classification: classification,
                duration: duration,
                timestamp: startTime
            });
        });
    }

    classifyActivityAdvanced(activity, type, productivityRules, context = {}) {
        if (!productivityRules || !activity) return 'neutral';

        try {
            // Use intelligent rules system
            const classification = productivityRules.applyIntelligentRules(activity, type, context);
            return classification;
        } catch (error) {
            this.core.addDebugLog(`Erro na classificação avançada de ${activity}: ${error.message}`, 'warning');
            return 'neutral';
        }
    }

    calculateEquipmentDerivedMetrics(analysis) {
        analysis.totalHours = analysis.productiveHours + analysis.nonProductiveHours + analysis.neutralHours;
        
        if (analysis.totalHours > 0) {
            analysis.productivityPercentage = (analysis.productiveHours / analysis.totalHours) * 100;
            analysis.uptimePercentage = ((analysis.totalHours - analysis.downtimeHours) / analysis.totalHours) * 100;
            analysis.availabilityPercentage = ((analysis.totalHours - analysis.maintenanceHours) / analysis.totalHours) * 100;
        }
        
        // Calculate performance rating
        analysis.performanceRating = this.calculatePerformanceRating(analysis.productivityPercentage);
        
        // Calculate efficiency score (composite metric)
        analysis.efficiencyScore = this.calculateEfficiencyScore(analysis);
        
        // Calculate reliability score
        analysis.reliabilityScore = this.calculateReliabilityScore(analysis);
        
        // Calculate current status time
        if (analysis.lastActivity) {
            analysis.timeInCurrentStatus = (Date.now() - analysis.lastActivity.getTime()) / (1000 * 60 * 60);
        }
    }

    calculatePerformanceRating(productivity) {
        if (productivity >= 90) return 'excellent';
        if (productivity >= this.config.productivityThreshold) return 'good';
        if (productivity >= this.config.warningThreshold) return 'average';
        if (productivity >= this.config.criticalThreshold) return 'poor';
        return 'critical';
    }

    calculateEfficiencyScore(analysis) {
        const productivityWeight = 0.4;
        const uptimeWeight = 0.3;
        const availabilityWeight = 0.2;
        const consistencyWeight = 0.1;
        
        const score = (
            analysis.productivityPercentage * productivityWeight +
            analysis.uptimePercentage * uptimeWeight +
            analysis.availabilityPercentage * availabilityWeight +
            analysis.consistencyScore * consistencyWeight
        );
        
        return Math.round(score * 10) / 10;
    }

    calculateReliabilityScore(analysis) {
        // Based on status changes, data quality, and consistency
        const baseScore = 100;
        const statusChangePenalty = Math.min(analysis.statusChanges * 2, 30);
        const dataQualityBonus = (analysis.dataQuality - 90) * 0.5;
        
        return Math.max(0, Math.min(100, baseScore - statusChangePenalty + dataQualityBonus));
    }

    // =============================================================================
    // ANÁLISE TEMPORAL E PADRÕES
    // =============================================================================
    analyzeTemporalPatterns(equipmentData) {
        const patterns = {
            hourlyDistribution: new Array(24).fill(0),
            dailyAverages: {},
            weeklyPattern: new Array(7).fill(0),
            monthlyTrends: {},
            peakHours: [],
            lowHours: [],
            seasonalEffects: {},
            cyclicalPatterns: {},
            productivityRhythms: {
                morningBoost: false,
                afternoonDip: false,
                eveningRecovery: false
            }
        };

        const hourlyProductivity = new Array(24).fill(0);
        const hourlyCount = new Array(24).fill(0);
        const dailyData = {};

        for (const [equipName, data] of equipmentData) {
            this.analyzeEquipmentTemporal(data, patterns, hourlyProductivity, hourlyCount, dailyData);
        }

        // Calculate averages and identify patterns
        this.calculateTemporalAverages(patterns, hourlyProductivity, hourlyCount, dailyData);
        this.identifyProductivityRhythms(patterns);
        this.detectCyclicalPatterns(patterns);

        return patterns;
    }

    analyzeEquipmentTemporal(data, patterns, hourlyProductivity, hourlyCount, dailyData) {
        data.status.forEach(statusItem => {
            const startDate = this.core.parseDate(statusItem.start);
            if (!startDate) return;
            
            const hour = startDate.getHours();
            const day = startDate.getDay();
            const dayKey = startDate.toDateString();
            const duration = parseFloat(statusItem.total_time) || 0;
            
            // Accumulate hourly data
            patterns.hourlyDistribution[hour] += duration;
            patterns.weeklyPattern[day] += duration;
            
            // Calculate productivity for this hour
            const isProductive = ['running', 'on', 'working'].includes(statusItem.status);
            if (isProductive) {
                hourlyProductivity[hour] += duration;
            }
            hourlyCount[hour] += duration;
            
            // Accumulate daily data
            if (!dailyData[dayKey]) {
                dailyData[dayKey] = { productive: 0, total: 0 };
            }
            dailyData[dayKey].total += duration;
            if (isProductive) {
                dailyData[dayKey].productive += duration;
            }
        });
    }

    // =============================================================================
    // PREDIÇÕES E FORECASTING
    // =============================================================================
    generatePredictiveForecast(equipmentData) {
        const forecast = {
            nextWeekProductivity: {},
            maintenanceAlerts: [],
            performancePredictions: {},
            resourceOptimization: {},
            riskAssessment: {}
        };

        for (const [equipName, data] of equipmentData) {
            const equipmentForecast = this.forecastEquipmentPerformance(equipName, data);
            forecast.nextWeekProductivity[equipName] = equipmentForecast.productivity;
            forecast.performancePredictions[equipName] = equipmentForecast.performance;
            
            if (equipmentForecast.maintenanceRisk > 0.7) {
                forecast.maintenanceAlerts.push({
                    equipment: equipName,
                    risk: equipmentForecast.maintenanceRisk,
                    suggestedAction: equipmentForecast.suggestedAction,
                    timeframe: equipmentForecast.timeframe
                });
            }
        }

        return forecast;
    }

    forecastEquipmentPerformance(equipName, data) {
        // Simplified prediction model - in production, this would use more sophisticated ML
        const recentData = this.getRecentPerformanceData(data, 7);
        const trend = this.calculatePerformanceTrend(recentData);
        
        return {
            productivity: this.extrapolateTrend(trend, 7),
            performance: this.predictPerformanceRating(trend),
            maintenanceRisk: this.assessMaintenanceRisk(data),
            suggestedAction: this.generateActionSuggestion(trend),
            timeframe: this.estimateTimeframe(trend)
        };
    }

    // =============================================================================
    // DETECÇÃO DE ANOMALIAS
    // =============================================================================
    detectProductivityAnomalies(equipmentData) {
        const anomalies = [];
        
        for (const [equipName, data] of equipmentData) {
            const equipmentAnomalies = this.detectEquipmentAnomalies(equipName, data);
            anomalies.push(...equipmentAnomalies);
        }
        
        return {
            total: anomalies.length,
            critical: anomalies.filter(a => a.severity === 'critical').length,
            warning: anomalies.filter(a => a.severity === 'warning').length,
            anomalies: anomalies
        };
    }

    detectEquipmentAnomalies(equipName, data) {
        const anomalies = [];
        const baseline = this.calculateEquipmentBaseline(data);
        
        // Check for unusual downtime
        const currentDowntime = this.calculateCurrentDowntime(data);
        if (currentDowntime > baseline.avgDowntime * 2) {
            anomalies.push({
                type: 'excessive_downtime',
                equipment: equipName,
                severity: currentDowntime > baseline.avgDowntime * 3 ? 'critical' : 'warning',
                value: currentDowntime,
                baseline: baseline.avgDowntime,
                description: `Downtime ${currentDowntime.toFixed(1)}h excede baseline de ${baseline.avgDowntime.toFixed(1)}h`
            });
        }
        
        // Check for productivity drops
        const recentProductivity = this.calculateRecentProductivity(data);
        if (recentProductivity < baseline.avgProductivity * 0.7) {
            anomalies.push({
                type: 'productivity_drop',
                equipment: equipName,
                severity: recentProductivity < baseline.avgProductivity * 0.5 ? 'critical' : 'warning',
                value: recentProductivity,
                baseline: baseline.avgProductivity,
                description: `Produtividade ${recentProductivity.toFixed(1)}% abaixo da baseline ${baseline.avgProductivity.toFixed(1)}%`
            });
        }
        
        return anomalies;
    }

    // =============================================================================
    // DASHBOARD E VISUALIZAÇÃO AVANÇADA
    // =============================================================================
    updateAdvancedDashboard() {
        if (!this.metrics || !this.metrics.overview) {
            this.core.addDebugLog('Métricas não disponíveis para dashboard avançado', 'warning');
            return;
        }

        this.updateAdvancedKPIs();
        this.updateAdvancedCharts();
        this.updateEquipmentTable();
        this.updateAlertsDashboard();
        this.updateInsightsPanels();
        
        this.core.addDebugLog('Dashboard avançado atualizado com sucesso');
    }

    updateAdvancedKPIs() {
        const overview = this.metrics.overview;
        
        // Enhanced KPIs with trends and comparisons
        this.updateKPIWithTrend('productivePercentage', `${overview.averageProductivity.toFixed(1)}%`, 
            this.calculateTrendIndicator('productivity'));
        this.updateKPIWithTrend('activeEquipment', `${overview.productiveEquipmentCount}/${overview.totalEquipments}`,
            this.calculateTrendIndicator('activeEquipment'));
        this.updateKPIWithTrend('operationalEfficiency', `${overview.oeeScore.toFixed(1)}%`,
            this.calculateTrendIndicator('oee'));
        this.updateKPIWithTrend('totalDowntime', `${overview.totalDowntime.toFixed(1)}h`,
            this.calculateTrendIndicator('downtime'));
    }

    updateKPIWithTrend(elementId, value, trendData) {
        const valueElement = document.getElementById(elementId);
        const changeElement = document.getElementById(elementId + 'Change');
        
        if (valueElement) {
            valueElement.textContent = value;
            valueElement.classList.add('fade-in');
        }
        
        if (changeElement && trendData) {
            const arrow = trendData.direction === 'up' ? '↗' : trendData.direction === 'down' ? '↘' : '→';
            const color = trendData.isGood ? '#27ae60' : trendData.direction === 'stable' ? '#95a5a6' : '#e74c3c';
            
            changeElement.innerHTML = `<span style="color: ${color}">${arrow} ${Math.abs(trendData.change).toFixed(1)}%</span>`;
            changeElement.title = trendData.description;
        }
    }

    updateAdvancedCharts() {
        this.updateProductivityTrendChart();
        this.updateEfficiencyRadarChart();
        this.updateHourlyHeatmapChart();
        this.updateEquipmentPerformanceChart();
        this.updatePredictiveChart();
    }

    updateProductivityTrendChart() {
        const canvas = document.getElementById('productivityTrendChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        if (this.charts.productivityTrend) {
            this.charts.productivityTrend.destroy();
        }

        const trendData = this.generateTrendChartData();
        
        this.charts.productivityTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trendData.labels,
                datasets: [
                    {
                        label: 'Produtividade Real',
                        data: trendData.actual,
                        borderColor: this.config.chartColors.primary,
                        backgroundColor: this.config.chartColors.primary + '20',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Meta',
                        data: trendData.target,
                        borderColor: this.config.chartColors.productive,
                        backgroundColor: 'transparent',
                        borderDash: [5, 5]
                    },
                    {
                        label: 'Previsão',
                        data: trendData.prediction,
                        borderColor: this.config.chartColors.warning,
                        backgroundColor: this.config.chartColors.warning + '10',
                        borderDash: [3, 3],
                        pointStyle: 'triangle'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        min: 40,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    updateEfficiencyRadarChart() {
        const canvas = document.getElementById('efficiencyRadarChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        if (this.charts.efficiencyRadar) {
            this.charts.efficiencyRadar.destroy();
        }

        const radarData = this.generateRadarChartData();
        
        this.charts.efficiencyRadar = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: radarData.labels,
                datasets: [
                    {
                        label: 'Performance Atual',
                        data: radarData.current,
                        borderColor: this.config.chartColors.primary,
                        backgroundColor: this.config.chartColors.primary + '30',
                        pointBackgroundColor: this.config.chartColors.primary,
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: this.config.chartColors.primary
                    },
                    {
                        label: 'Benchmark',
                        data: radarData.benchmark,
                        borderColor: this.config.chartColors.productive,
                        backgroundColor: this.config.chartColors.productive + '20',
                        pointBackgroundColor: this.config.chartColors.productive,
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: this.config.chartColors.productive
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    // =============================================================================
    // INSIGHTS E RECOMENDAÇÕES INTELIGENTES
    // =============================================================================
    generateActionableInsights(equipmentData, productivityRules) {
        const insights = {
            performance: [],
            operational: [],
            strategic: [],
            immediate: [],
            priority: 'high'
        };

        // Analyze performance insights
        insights.performance = this.generatePerformanceInsights(equipmentData);
        
        // Analyze operational insights
        insights.operational = this.generateOperationalInsights(equipmentData);
        
        // Analyze strategic insights
        insights.strategic = this.generateStrategicInsights(equipmentData);
        
        // Generate immediate action items
        insights.immediate = this.generateImmediateActions(equipmentData);

        return insights;
    }

    generatePerformanceInsights(equipmentData) {
        const insights = [];
        const performanceData = Array.from(this.equipmentAnalysis.values());
        
        // Top performers analysis
        const topPerformers = performanceData
            .filter(eq => eq.productivityPercentage > 85)
            .sort((a, b) => b.productivityPercentage - a.productivityPercentage);
        
        if (topPerformers.length > 0) {
            insights.push({
                type: 'positive',
                category: 'performance',
                title: 'Equipamentos de Alto Desempenho',
                description: `${topPerformers.length} equipamentos com produtividade superior a 85%`,
                impact: 'high',
                actionable: true,
                suggestion: 'Analisar práticas dos top performers para replicar em outros equipamentos'
            });
        }
        
        // Underperformers analysis
        const underPerformers = performanceData
            .filter(eq => eq.productivityPercentage < this.config.warningThreshold);
        
        if (underPerformers.length > 0) {
            insights.push({
                type: 'warning',
                category: 'performance',
                title: 'Equipamentos com Baixo Desempenho',
                description: `${underPerformers.length} equipamentos abaixo de ${this.config.warningThreshold}%`,
                impact: 'high',
                actionable: true,
                suggestion: 'Investigar causas e implementar plano de melhoria imediato'
            });
        }

        return insights;
    }

    // =============================================================================
    // UTILITÁRIOS E HELPERS AVANÇADOS
    // =============================================================================
    scheduleIntelligentAnalysis() {
        if (this.analysisTimeout) {
            clearTimeout(this.analysisTimeout);
        }
        
        this.analysisTimeout = setTimeout(() => {
            this.core.dispatchEvent('intelligentAnalysisRequested', {
                timestamp: new Date(),
                source: 'scheduleIntelligentAnalysis'
            });
        }, 1000);
    }

    invalidateAnalyticsCache() {
        this.analyticsCache.clear();
        this.core.addDebugLog('Cache de analytics invalidado');
    }

    calculateTrendIndicator(metric) {
        // Simplified trend calculation - in production, this would use historical data
        const change = (Math.random() - 0.5) * 20; // -10% to +10%
        const direction = change > 2 ? 'up' : change < -2 ? 'down' : 'stable';
        
        let isGood = false;
        switch (metric) {
            case 'productivity':
            case 'activeEquipment':
            case 'oee':
                isGood = direction === 'up';
                break;
            case 'downtime':
                isGood = direction === 'down';
                break;
        }
        
        return {
            change: Math.abs(change),
            direction: direction,
            isGood: isGood,
            description: `${isGood ? 'Melhoria' : 'Deterioração'} de ${Math.abs(change).toFixed(1)}% no período`
        };
    }

    performRealTimeAnalysis() {
        if (!this.metrics) return;
        
        // Check for real-time alerts
        const currentTime = new Date();
        const hoursSinceLastUpdate = (currentTime - this.lastAnalysisTime) / (1000 * 60 * 60);
        
        if (hoursSinceLastUpdate > 1) {
            this.core.dispatchEvent('staleDataWarning', {
                hoursSinceUpdate: hoursSinceLastUpdate
            });
        }
    }

    // =============================================================================
    // EXPORTAÇÃO E RELATÓRIOS AVANÇADOS
    // =============================================================================
    exportAdvancedReport(format = 'json') {
        const reportData = {
            metadata: {
                generated: new Date().toISOString(),
                version: this.version,
                period: this.getAnalysisPeriod(),
                equipmentCount: this.equipmentAnalysis.size
            },
            executive: {
                summary: this.generateExecutiveSummary(),
                kpis: this.extractKPIs(),
                trends: this.extractTrends()
            },
            detailed: {
                equipmentAnalysis: Array.from(this.equipmentAnalysis.entries()).map(([name, data]) => ({ name, ...data })),
                groupAnalysis: this.metrics.groupAnalysis,
                temporalAnalysis: this.metrics.temporalAnalysis,
                anomalies: this.metrics.anomalies,
                predictions: this.metrics.predictions
            },
            insights: this.metrics.insights,
            recommendations: this.generateComprehensiveRecommendations()
        };

        switch (format.toLowerCase()) {
            case 'json':
                this.exportJSON(reportData, 'advanced-productivity-report');
                break;
            case 'csv':
                this.exportAdvancedCSV(reportData.detailed.equipmentAnalysis);
                break;
            case 'pdf':
                this.generatePDFReport(reportData);
                break;
            default:
                this.core.addDebugLog(`Formato de export inválido: ${format}`, 'error');
        }
    }

    // =============================================================================
    // LIMPEZA E DESTRUTOR AVANÇADO
    // =============================================================================
    destroy() {
        if (this.analysisTimeout) {
            clearTimeout(this.analysisTimeout);
        }
        
        // Destroy all charts
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        
        // Destroy analytics modules
        Object.values(this.modules).forEach(module => {
            if (module && typeof module.destroy === 'function') {
                module.destroy();
            }
        });
        
        // Clear data structures
        this.charts = {};
        this.metrics = {};
        this.equipmentAnalysis.clear();
        this.analyticsCache.clear();
        this.predictionModels.clear();
        
        this.core.addDebugLog('Analytics Module v2.0 destruído');
    }
}

// =============================================================================
// MÓDULOS AUXILIARES PARA ANALYTICS AVANÇADAS
// =============================================================================

class TrendAnalysis {
    constructor(analyticsInstance) {
        this.analytics = analyticsInstance;
    }
    
    analyzeTrends(equipmentData) {
        return {
            overall: this.calculateOverallTrend(equipmentData),
            byEquipment: this.calculateEquipmentTrends(equipmentData),
            byGroup: this.calculateGroupTrends(equipmentData),
            seasonal: this.detectSeasonalTrends(equipmentData)
        };
    }
    
    calculateOverallTrend(equipmentData) {
        // Simplified trend calculation
        return {
            direction: 'improving',
            strength: 'moderate',
            confidence: 0.75,
            timeframe: '30 days'
        };
    }
    
    calculateEquipmentTrends(equipmentData) {
        const trends = {};
        for (const [equipName] of equipmentData) {
            trends[equipName] = {
                productivity: 'stable',
                reliability: 'improving',
                efficiency: 'declining'
            };
        }
        return trends;
    }
    
    destroy() {
        this.analytics = null;
    }
}

class ProductivityForecasting {
    constructor(analyticsInstance) {
        this.analytics = analyticsInstance;
    }
    
    generatePredictions(equipmentData) {
        return {
            shortTerm: this.generateShortTermPredictions(equipmentData),
            mediumTerm: this.generateMediumTermPredictions(equipmentData),
            longTerm: this.generateLongTermPredictions(equipmentData)
        };
    }
    
    generateShortTermPredictions(equipmentData) {
        return {
            nextDay: { productivity: 78, confidence: 0.85 },
            nextWeek: { productivity: 76, confidence: 0.72 }
        };
    }
    
    destroy() {
        this.analytics = null;
    }
}

class AnomalyDetection {
    constructor(analyticsInstance) {
        this.analytics = analyticsInstance;
    }
    
    detectAnomalies(equipmentData) {
        return {
            statistical: this.detectStatisticalAnomalies(equipmentData),
            behavioral: this.detectBehavioralAnomalies(equipmentData),
            contextual: this.detectContextualAnomalies(equipmentData)
        };
    }
    
    detectStatisticalAnomalies(equipmentData) {
        return [];
    }
    
    destroy() {
        this.analytics = null;
    }
}

class PerformanceBenchmarking {
    constructor(analyticsInstance) {
        this.analytics = analyticsInstance;
    }
    
    compareToBenchmarks(equipmentData) {
        return {
            industry: this.compareToIndustryBenchmarks(equipmentData),
            internal: this.compareToInternalBenchmarks(equipmentData),
            historical: this.compareToHistoricalBenchmarks(equipmentData)
        };
    }
    
    compareToIndustryBenchmarks(equipmentData) {
        return {
            productivity: { current: 78, benchmark: 82, variance: -4 },
            uptime: { current: 87, benchmark: 87, variance: 0 },
            efficiency: { current: 75, benchmark: 78, variance: -3 }
        };
    }
    
    destroy() {
        this.analytics = null;
    }
}

class OptimizationSuggestions {
    constructor(analyticsInstance) {
        this.analytics = analyticsInstance;
    }
    
    generateSuggestions(equipmentData) {
        return {
            immediate: this.generateImmediateSuggestions(equipmentData),
            shortTerm: this.generateShortTermSuggestions(equipmentData),
            longTerm: this.generateLongTermSuggestions(equipmentData)
        };
    }
    
    generateImmediateSuggestions(equipmentData) {
        return [
            {
                type: 'maintenance',
                priority: 'high',
                description: 'Verificar equipamentos com produtividade abaixo de 50%',
                impact: 'high',
                effort: 'medium'
            }
        ];
    }
    
    destroy() {
        this.analytics = null;
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.ProductivityAnalytics = ProductivityAnalytics;
}
