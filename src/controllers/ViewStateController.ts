// Main View State Controller - Orchestrates state management, persistence, and transitions

import { StateManager } from '../state/StateManager';
import { PersistenceManager } from '../state/PersistenceManager';
import { ViewTransitionController } from './ViewTransitionController';
import { ViewType, DesignSystemInfo, ValidationIssue, ResultsData } from '../types/ViewState';
import { FormView, ResultsView, CollapsedView } from '../components';
import { NavigationIndicator } from '../components/NavigationIndicator';

export class ViewStateController {
  private stateManager: StateManager;
  private persistenceManager: PersistenceManager;
  private transitionController: ViewTransitionController;
  private isInitialized: boolean = false;
  
  // View components
  private formView: FormView | null = null;
  private resultsView: ResultsView | null = null;
  private collapsedView: CollapsedView | null = null;
  private navigationIndicator: NavigationIndicator | null = null;
  private currentContainer: HTMLElement | null = null;

  constructor() {
    this.stateManager = new StateManager();
    this.persistenceManager = new PersistenceManager();
    this.transitionController = new ViewTransitionController(this.stateManager);
    
    this.setupStateSubscription();
  }

  // Initialize the controller and restore persisted state
  async initialize(): Promise<void> {
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
      } else if (persistedResults) {
        // Clear stale results
        await this.persistenceManager.clearResultsData();
      }

      // Start in form view
      await this.transitionController.goToForm();
      
      this.isInitialized = true;
      console.log('ViewStateController initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ViewStateController:', error);
      throw error;
    }
  }

  // Find the main container for views
  private findViewContainer(): HTMLElement | null {
    // In plugin context, we don't have access to DOM elements
    // The UI will be controlled via messages
    return null;
  }

  // Initialize view components
  private initializeComponents(): void {
    // In plugin context, we don't create DOM components
    // The UI will be controlled via messages
    console.log('ViewStateController initialized in plugin context - UI will be controlled via messages');
  }

  // Setup callbacks for component interactions
  private setupComponentCallbacks(): void {
    // In plugin context, callbacks are handled via messages
    console.log('Component callbacks will be handled via plugin messages');
  }

  // Setup navigation indicator callbacks
  private setupNavigationCallbacks(): void {
    // In plugin context, navigation is handled via messages
    console.log('Navigation callbacks will be handled via plugin messages');
  }

  // Handle validation run from form
  private handleRunValidation(options: string[]): void {
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
  private async handleIssueClick(nodeId: string, nodeName: string): Promise<void> {
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
    } catch (error) {
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
  private handleExpandFromCollapsed(): void {
    const state = this.getState();
    if (state.resultsData) {
      this.goToResults();
    } else {
      this.goToForm();
    }
  }

  // Setup state change subscription for automatic persistence
  private setupStateSubscription(): void {
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
  private updateComponentStates(state: any): void {
    if (this.formView && state.formData) {
      this.formView.setState({
        selectedDesignSystem: state.formData.selectedDesignSystem,
        validationOptions: state.formData.validationOptions,
        attachedSystemInfo: state.formData.attachedSystemInfo
      });
    }
    
    if (this.resultsView && state.resultsData) {
      this.resultsView.setResults(
        state.resultsData.issues,
        state.resultsData.totalNodes,
        state.resultsData.scope
      );
    }
  }

  // View transition methods
  async switchToView(view: ViewType, data?: any): Promise<void> {
    // Update navigation indicator before transition
    if (this.navigationIndicator) {
      this.navigationIndicator.updateCurrentView(view);
    }
    
    await this.transitionController.switchToView(view, { data });
    this.renderCurrentView(view);
  }

  async goToForm(): Promise<void> {
    if (this.navigationIndicator) {
      this.navigationIndicator.updateCurrentView('form');
    }
    await this.transitionController.goToForm();
    this.renderCurrentView('form');
  }

  async goToResults(resultsData?: ResultsData): Promise<void> {
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

  async goToCollapsed(): Promise<void> {
    if (this.navigationIndicator) {
      this.navigationIndicator.updateCurrentView('collapsed');
    }
    await this.transitionController.goToCollapsed();
    this.renderCurrentView('collapsed');
  }

  // Render the appropriate view component
  private renderCurrentView(view: ViewType): void {
    // In plugin context, rendering is handled by the UI via messages
    console.log(`Rendering ${view} view via message to UI`);
  }

  async goBack(): Promise<void> {
    this.transitionController.restorePreviousState();
  }

  // Design system management
  async attachDesignSystem(systemInfo: DesignSystemInfo): Promise<void> {
    this.stateManager.attachDesignSystem(systemInfo);
    await this.persistenceManager.saveDesignSystem(systemInfo.id, systemInfo);
  }

  async detachDesignSystem(): Promise<void> {
    this.stateManager.detachDesignSystem();
    await this.persistenceManager.clearDesignSystem();
  }

  // Validation options management
  setValidationOptions(options: string[]): void {
    this.stateManager.setValidationOptions(options);
  }

  toggleValidationOption(option: string): void {
    this.stateManager.toggleValidationOption(option);
  }

  // Results management
  setValidationResults(issues: ValidationIssue[], totalNodes: number, scope: string): void {
    const resultsData: ResultsData = {
      issues,
      totalNodes,
      scope,
      timestamp: new Date()
    };
    
    this.stateManager.setResultsData(resultsData);
  }

  async clearResults(): Promise<void> {
    this.stateManager.clearResultsData();
    await this.persistenceManager.clearResultsData();
  }

  // State getters
  getCurrentView(): ViewType {
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
  canRunValidation(): boolean {
    return this.stateManager.canRunValidation();
  }

  isDesignSystemAttached(): boolean {
    return this.stateManager.isDesignSystemAttached();
  }

  hasValidationOptions(): boolean {
    return this.stateManager.hasValidationOptions();
  }

  hasResults(): boolean {
    return this.stateManager.hasResults();
  }

  // State management
  async resetState(): Promise<void> {
    this.stateManager.reset();
    await this.persistenceManager.clearAllData();
    await this.transitionController.goToForm();
  }

  // Subscribe to state changes
  subscribeToStateChanges(callback: (state: any) => void): () => void {
    return this.stateManager.subscribe(callback);
  }

  // Debug helpers
  logCurrentState(): void {
    console.log('=== Current View State ===');
    console.log('View:', this.getCurrentView());
    console.log('State:', this.getState());
    console.log('Can run validation:', this.canRunValidation());
    console.log('Has results:', this.hasResults());
  }

  // Error handling
  handleError(error: Error, context: string): void {
    console.error(`ViewStateController error in ${context}:`, error);
    
    // Could implement error recovery logic here
    // For now, just log the error
  }

  // Handle external messages from plugin
  handlePluginMessage(message: any): void {
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
        const library = this.stateManager.getFormData().availableLibraries?.find(
          lib => lib.id === message.libraryId
        );
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
  destroy(): void {
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