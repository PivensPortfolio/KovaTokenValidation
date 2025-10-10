// State Management System for Token Validator Views

import { ViewState, ViewType, FormData, ResultsData, DesignSystemInfo } from '../types/ViewState';

export class StateManager {
  private state: ViewState;
  private listeners: Array<(state: ViewState) => void> = [];

  constructor() {
    this.state = this.getInitialState();
  }

  private getInitialState(): ViewState {
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
  getCurrentView(): ViewType {
    return this.state.currentView;
  }

  getState(): ViewState {
    return { ...this.state };
  }

  getFormData(): FormData {
    return { ...this.state.formData };
  }

  getResultsData(): ResultsData | null {
    return this.state.resultsData ? { ...this.state.resultsData } : null;
  }

  getPreviousView(): ViewType | null {
    return this.state.previousView;
  }

  // State setters
  setCurrentView(view: ViewType, preservePrevious: boolean = true): void {
    if (preservePrevious) {
      this.state.previousView = this.state.currentView;
    }
    this.state.currentView = view;
    this.notifyListeners();
  }

  setPreviousView(view: ViewType | null): void {
    this.state.previousView = view;
    this.notifyListeners();
  }

  updateFormData(updates: Partial<FormData>): void {
    this.state.formData = {
      ...this.state.formData,
      ...updates
    };
    this.notifyListeners();
  }

  setResultsData(results: ResultsData): void {
    this.state.resultsData = results;
    this.notifyListeners();
  }

  clearResultsData(): void {
    this.state.resultsData = null;
    this.notifyListeners();
  }

  // Design system management
  attachDesignSystem(systemInfo: DesignSystemInfo): void {
    this.updateFormData({
      selectedDesignSystem: systemInfo.id,
      attachedSystemInfo: systemInfo
    });
  }

  detachDesignSystem(): void {
    this.updateFormData({
      selectedDesignSystem: null,
      attachedSystemInfo: null
    });
  }

  // Validation options management
  setValidationOptions(options: string[]): void {
    this.updateFormData({
      validationOptions: options
    });
  }

  toggleValidationOption(option: string): void {
    const currentOptions = this.state.formData.validationOptions;
    const newOptions = currentOptions.includes(option)
      ? currentOptions.filter(opt => opt !== option)
      : [...currentOptions, option];
    
    this.setValidationOptions(newOptions);
  }

  // State validation
  isDesignSystemAttached(): boolean {
    return this.state.formData.selectedDesignSystem !== null;
  }

  hasValidationOptions(): boolean {
    return this.state.formData.validationOptions.length > 0;
  }

  canRunValidation(): boolean {
    return this.isDesignSystemAttached() && this.hasValidationOptions();
  }

  hasResults(): boolean {
    return this.state.resultsData !== null;
  }

  // State listeners
  subscribe(listener: (state: ViewState) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.getState()));
  }

  // Reset state
  reset(): void {
    this.state = this.getInitialState();
    this.notifyListeners();
  }

  // Debug helpers
  logState(): void {
    console.log('Current State:', this.getState());
  }
}