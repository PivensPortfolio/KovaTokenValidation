// Main View State Controller - Orchestrates state management, persistence, and transitions
import { StateManager } from '../state/StateManager';
import { PersistenceManager } from '../state/PersistenceManager';
import { ViewTransitionController } from './ViewTransitionController';
export class ViewStateController {
    constructor() {
        this.isInitialized = false;
        // View components
        this.formView = null;
        this.collapsedView = null;
        this.navigationIndicator = null;
        this.currentContainer = null;
        this.stateManager = new StateManager();
        this.persistenceManager = new PersistenceManager();
        this.transitionController = new ViewTransitionController(this.stateManager);
        this.setupStateSubscription();
    }
    // Initialize the controller and restore persisted state
    async initialize() {
        if (this.isInitialized) {
            console.warn('ViewStateController already initialized');
            return;
        }
        try {
            console.log('Initializing ViewStateController...');
            // Find the main container for views
            this.currentContainer = this.findViewContainer();
            if (!this.currentContainer) {
                throw new Error('Could not find view container element');
            }
            // Initialize view components
            this.initializeComponents();
            // Migrate any old data format
            await this.persistenceManager.migrateOldData();
            // Load persisted form data
            const persistedFormData = await this.persistenceManager.loadFormData();
            if (persistedFormData) {
                this.stateManager.updateFormData(persistedFormData);
            }
            // Load persisted results data (if fresh)
            const persistedResults = await this.persistenceManager.loadResultsData();
            if (persistedResults && this.persistenceManager.areResultsFresh(persistedResults)) {
                this.stateManager.setResultsData(persistedResults);
            }
            else if (persistedResults) {
                // Clear stale results
                await this.persistenceManager.clearResultsData();
            }
            // Start in form view
            await this.transitionController.goToForm();
            this.isInitialized = true;
            console.log('ViewStateController initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize ViewStateController:', error);
            throw error;
        }
    }
    // Find the main container for views
    findViewContainer() {
        // In plugin context, we don't have access to DOM elements
        // The UI will be controlled via messages
        return null;
    }
    // Initialize view components
    initializeComponents() {
        // In plugin context, we don't create DOM components
        // The UI will be controlled via messages
        console.log('ViewStateController initialized in plugin context - UI will be controlled via messages');
    }
    // Setup callbacks for component interactions
    setupComponentCallbacks() {
        // In plugin context, callbacks are handled via messages
        console.log('Component callbacks will be handled via plugin messages');
    }
    // Setup navigation indicator callbacks
    setupNavigationCallbacks() {
        // In plugin context, navigation is handled via messages
        console.log('Navigation callbacks will be handled via plugin messages');
    }
    // Handle validation run from form
    handleRunValidation(options) {
        this.setValidationOptions(options);
        // Send message to plugin to run validation
        parent.postMessage({
            pluginMessage: {
                type: 'run-design-tokens-check',
                options: options
            }
        }, '*');
    }
    // Handle issue click from results
    async handleIssueClick(nodeId, nodeName) {
        try {
            // Send message to plugin to select node and center viewport
            parent.postMessage({
                pluginMessage: {
                    type: 'select-and-center-node',
                    nodeId: nodeId,
                    nodeName: nodeName
                }
            }, '*');
            // Wait a brief moment for the selection to complete
            await new Promise(resolve => setTimeout(resolve, 200));
            // Transition to collapsed view with smooth animation
            await this.goToCollapsed();
        }
        catch (error) {
            console.error('Error handling issue click:', error);
            // Fallback to just selecting the node
            parent.postMessage({
                pluginMessage: {
                    type: 'select-node',
                    nodeId: nodeId
                }
            }, '*');
        }
    }
    // Handle expand from collapsed view
    handleExpandFromCollapsed() {
        const state = this.getState();
        if (state.resultsData) {
            this.goToResults();
        }
        else {
            this.goToForm();
        }
    }
    // Setup state change subscription for automatic persistence
    setupStateSubscription() {
        this.stateManager.subscribe(async (state) => {
            // Auto-save form data changes
            await this.persistenceManager.saveFormData(state.formData);
            // Auto-save results data changes
            if (state.resultsData) {
                await this.persistenceManager.saveResultsData(state.resultsData);
            }
            // Update component states
            this.updateComponentStates(state);
        });
    }
    // Update component states when main state changes
    updateComponentStates(state) {
        if (this.formView && state.formData) {
            this.formView.setState({
                selectedDesignSystem: state.formData.selectedDesignSystem,
                validationOptions: state.formData.validationOptions,
                attachedSystemInfo: state.formData.attachedSystemInfo
            });
        }
    }
    // View transition methods
    async switchToView(view, data) {
        // Update navigation indicator before transition
        if (this.navigationIndicator) {
            this.navigationIndicator.updateCurrentView(view);
        }
        await this.transitionController.switchToView(view, { data });
        this.renderCurrentView(view);
    }
    async goToForm() {
        if (this.navigationIndicator) {
            this.navigationIndicator.updateCurrentView('form');
        }
        await this.transitionController.goToForm();
        this.renderCurrentView('form');
    }
    async goToResults(resultsData) {
        console.log('=== ViewStateController.goToResults called ===');
        console.log('Results data provided:', !!resultsData);
        if (resultsData) {
            this.stateManager.setResultsData(resultsData);
        }
        if (this.navigationIndicator) {
            this.navigationIndicator.updateCurrentView('results');
        }
        // Get the current results data to pass to the UI
        const currentResultsData = this.stateManager.getResultsData();
        console.log('Current results data:', currentResultsData);
        await this.transitionController.goToResults(currentResultsData);
        this.renderCurrentView('results');
        console.log('=== goToResults completed ===');
    }
    async goToCollapsed() {
        if (this.navigationIndicator) {
            this.navigationIndicator.updateCurrentView('collapsed');
        }
        await this.transitionController.goToCollapsed();
        this.renderCurrentView('collapsed');
    }
    // Render the appropriate view component
    renderCurrentView(view) {
        // In plugin context, rendering is handled by the UI via messages
        console.log(`Rendering ${view} view via message to UI`);
    }
    async goBack() {
        this.transitionController.restorePreviousState();
    }
    // Design system management
    async attachDesignSystem(systemInfo) {
        this.stateManager.attachDesignSystem(systemInfo);
        await this.persistenceManager.saveDesignSystem(systemInfo.id, systemInfo);
    }
    async detachDesignSystem() {
        this.stateManager.detachDesignSystem();
        await this.persistenceManager.clearDesignSystem();
    }
    // Validation options management
    setValidationOptions(options) {
        this.stateManager.setValidationOptions(options);
    }
    toggleValidationOption(option) {
        this.stateManager.toggleValidationOption(option);
    }
    // Results management
    setValidationResults(issues, totalNodes, scope) {
        const resultsData = {
            issues,
            totalNodes,
            scope,
            timestamp: new Date()
        };
        this.stateManager.setResultsData(resultsData);
    }
    async clearResults() {
        this.stateManager.clearResultsData();
        await this.persistenceManager.clearResultsData();
    }
    // State getters
    getCurrentView() {
        return this.stateManager.getCurrentView();
    }
    getState() {
        return this.stateManager.getState();
    }
    getFormData() {
        return this.stateManager.getFormData();
    }
    getResultsData() {
        return this.stateManager.getResultsData();
    }
    // Validation helpers
    canRunValidation() {
        return this.stateManager.canRunValidation();
    }
    isDesignSystemAttached() {
        return this.stateManager.isDesignSystemAttached();
    }
    hasValidationOptions() {
        return this.stateManager.hasValidationOptions();
    }
    hasResults() {
        return this.stateManager.hasResults();
    }
    // State management
    async resetState() {
        this.stateManager.reset();
        await this.persistenceManager.clearAllData();
        await this.transitionController.goToForm();
    }
    // Subscribe to state changes
    subscribeToStateChanges(callback) {
        return this.stateManager.subscribe(callback);
    }
    // Debug helpers
    logCurrentState() {
        console.log('=== Current View State ===');
        console.log('View:', this.getCurrentView());
        console.log('State:', this.getState());
        console.log('Can run validation:', this.canRunValidation());
        console.log('Has results:', this.hasResults());
    }
    // Error handling
    handleError(error, context) {
        console.error(`ViewStateController error in ${context}:`, error);
        // Could implement error recovery logic here
        // For now, just log the error
    }
    // Handle external messages from plugin
    handlePluginMessage(message) {
        var _a;
        switch (message.type) {
            case 'libraries-list':
                if (this.formView) {
                    this.formView.updateLibraries(message.libraries, false, '', message.debug);
                }
                break;
            case 'libraries-error':
                if (this.formView) {
                    this.formView.updateLibraries([], true, message.error, message.debug);
                }
                break;
            case 'design-system-attached':
                const library = (_a = this.stateManager.getFormData().availableLibraries) === null || _a === void 0 ? void 0 : _a.find(lib => lib.id === message.libraryId);
                if (library && this.formView) {
                    this.formView.attachDesignSystem(library);
                    this.attachDesignSystem(library);
                }
                break;
            case 'check-results':
                this.setValidationResults(message.issues, message.totalNodes, message.scope);
                this.goToResults();
                break;
            case 'check-error':
                // Handle validation error
                console.error('Validation error:', message.error);
                break;
        }
    }
    // Cleanup
    destroy() {
        // Clean up components
        if (this.collapsedView) {
            this.collapsedView.destroy();
        }
        if (this.navigationIndicator) {
            this.navigationIndicator.destroy();
        }
        // Clean up any resources, event listeners, etc.
        console.log('ViewStateController destroyed');
    }
}
