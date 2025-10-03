// State Management System for Token Validator Views
export class StateManager {
    constructor() {
        this.listeners = [];
        this.state = this.getInitialState();
    }
    getInitialState() {
        return {
            currentView: 'form',
            formData: {
                selectedDesignSystem: null,
                validationOptions: ['spacings'], // Default to spacings checked
                attachedSystemInfo: null
            },
            resultsData: null,
            previousView: null
        };
    }
    // State getters
    getCurrentView() {
        return this.state.currentView;
    }
    getState() {
        return Object.assign({}, this.state);
    }
    getFormData() {
        return Object.assign({}, this.state.formData);
    }
    getResultsData() {
        return this.state.resultsData ? Object.assign({}, this.state.resultsData) : null;
    }
    getPreviousView() {
        return this.state.previousView;
    }
    // State setters
    setCurrentView(view, preservePrevious = true) {
        if (preservePrevious) {
            this.state.previousView = this.state.currentView;
        }
        this.state.currentView = view;
        this.notifyListeners();
    }
    updateFormData(updates) {
        this.state.formData = Object.assign(Object.assign({}, this.state.formData), updates);
        this.notifyListeners();
    }
    setResultsData(results) {
        this.state.resultsData = results;
        this.notifyListeners();
    }
    clearResultsData() {
        this.state.resultsData = null;
        this.notifyListeners();
    }
    // Design system management
    attachDesignSystem(systemInfo) {
        this.updateFormData({
            selectedDesignSystem: systemInfo.id,
            attachedSystemInfo: systemInfo
        });
    }
    detachDesignSystem() {
        this.updateFormData({
            selectedDesignSystem: null,
            attachedSystemInfo: null
        });
    }
    // Validation options management
    setValidationOptions(options) {
        this.updateFormData({
            validationOptions: options
        });
    }
    toggleValidationOption(option) {
        const currentOptions = this.state.formData.validationOptions;
        const newOptions = currentOptions.includes(option)
            ? currentOptions.filter(opt => opt !== option)
            : [...currentOptions, option];
        this.setValidationOptions(newOptions);
    }
    // State validation
    isDesignSystemAttached() {
        return this.state.formData.selectedDesignSystem !== null;
    }
    hasValidationOptions() {
        return this.state.formData.validationOptions.length > 0;
    }
    canRunValidation() {
        return this.isDesignSystemAttached() && this.hasValidationOptions();
    }
    hasResults() {
        return this.state.resultsData !== null;
    }
    // State listeners
    subscribe(listener) {
        this.listeners.push(listener);
        // Return unsubscribe function
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }
    notifyListeners() {
        this.listeners.forEach(listener => listener(this.getState()));
    }
    // Reset state
    reset() {
        this.state = this.getInitialState();
        this.notifyListeners();
    }
    // Debug helpers
    logState() {
        console.log('Current State:', this.getState());
    }
}
