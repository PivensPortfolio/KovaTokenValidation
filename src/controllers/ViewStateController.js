// Main View State Controller - Orchestrates state management, persistence, and transitions
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { StateManager } from '../state/StateManager';
import { PersistenceManager } from '../state/PersistenceManager';
import { ViewTransitionController } from './ViewTransitionController';
export class ViewStateController {
    constructor() {
        this.isInitialized = false;
        this.stateManager = new StateManager();
        this.persistenceManager = new PersistenceManager();
        this.transitionController = new ViewTransitionController(this.stateManager);
        this.setupStateSubscription();
    }
    // Initialize the controller and restore persisted state
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isInitialized) {
                console.warn('ViewStateController already initialized');
                return;
            }
            try {
                console.log('Initializing ViewStateController...');
                // Migrate any old data format
                yield this.persistenceManager.migrateOldData();
                // Load persisted form data
                const persistedFormData = yield this.persistenceManager.loadFormData();
                if (persistedFormData) {
                    this.stateManager.updateFormData(persistedFormData);
                }
                // Load persisted results data (if fresh)
                const persistedResults = this.persistenceManager.loadResultsData();
                if (persistedResults && this.persistenceManager.areResultsFresh(persistedResults)) {
                    this.stateManager.setResultsData(persistedResults);
                }
                else if (persistedResults) {
                    // Clear stale results
                    this.persistenceManager.clearResultsData();
                }
                // Start in form view
                yield this.transitionController.goToForm();
                this.isInitialized = true;
                console.log('ViewStateController initialized successfully');
            }
            catch (error) {
                console.error('Failed to initialize ViewStateController:', error);
                throw error;
            }
        });
    }
    // Setup state change subscription for automatic persistence
    setupStateSubscription() {
        this.stateManager.subscribe((state) => __awaiter(this, void 0, void 0, function* () {
            // Auto-save form data changes
            yield this.persistenceManager.saveFormData(state.formData);
            // Auto-save results data changes
            if (state.resultsData) {
                this.persistenceManager.saveResultsData(state.resultsData);
            }
        }));
    }
    // View transition methods
    switchToView(view, data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.transitionController.switchToView(view, { data });
        });
    }
    goToForm() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.transitionController.goToForm();
        });
    }
    goToResults(resultsData) {
        return __awaiter(this, void 0, void 0, function* () {
            if (resultsData) {
                this.stateManager.setResultsData(resultsData);
            }
            yield this.transitionController.goToResults();
        });
    }
    goToCollapsed() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.transitionController.goToCollapsed();
        });
    }
    goBack() {
        return __awaiter(this, void 0, void 0, function* () {
            this.transitionController.restorePreviousState();
        });
    }
    // Design system management
    attachDesignSystem(systemInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            this.stateManager.attachDesignSystem(systemInfo);
            yield this.persistenceManager.saveDesignSystem(systemInfo.id, systemInfo);
        });
    }
    detachDesignSystem() {
        return __awaiter(this, void 0, void 0, function* () {
            this.stateManager.detachDesignSystem();
            yield this.persistenceManager.clearDesignSystem();
        });
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
    clearResults() {
        this.stateManager.clearResultsData();
        this.persistenceManager.clearResultsData();
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
    resetState() {
        return __awaiter(this, void 0, void 0, function* () {
            this.stateManager.reset();
            yield this.persistenceManager.clearAllData();
            yield this.transitionController.goToForm();
        });
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
    // Cleanup
    destroy() {
        // Clean up any resources, event listeners, etc.
        console.log('ViewStateController destroyed');
    }
}
