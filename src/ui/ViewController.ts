// Single source of truth for UI navigation and state
export type ViewId = 
  | 'DASHBOARD'
  | 'VALIDATION_RESULTS' 
  | 'COLLAPSED'
  | 'ISSUE_DETAILS'
  | 'MODAL_OUT_OF_SCOPE';

export interface ViewState {
  view: ViewId;
  params?: Record<string, any>;
}

export interface UIState {
  current: ViewState;
  history: ViewState[];
  validationData: {
    results: ValidationResult[];
    resultIndex: Map<string, ValidationResult>;
    runId: string;
    generatedAt: number;
  } | null;
}

export interface ValidationResult {
  nodeId: string;
  issueType: 'spacing' | 'color' | 'text' | 'token' | 'other';
  summary: string;
  details?: string;
  suggestedFix?: {
    kind: 'token' | 'value';
    tokenPath?: string;
    valuePx?: number;
  };
}

export type NavigationEvent = 
  | { type: 'GO'; view: ViewId; params?: Record<string, any> }
  | { type: 'BACK' }
  | { type: 'REPLACE'; view: ViewId; params?: Record<string, any> };

class ViewController {
  private state: UIState = {
    current: { view: 'DASHBOARD' },
    history: [],
    validationData: null
  };

  private listeners: Array<(state: UIState) => void> = [];

  // Initialize with validation results
  setValidationResults(results: ValidationResult[], runId: string) {
    const resultIndex = new Map<string, ValidationResult>();
    results.forEach(result => {
      resultIndex.set(result.nodeId, result);
    });

    this.state.validationData = {
      results,
      resultIndex,
      runId,
      generatedAt: Date.now()
    };

    this.notifyListeners();
  }

  // Navigate to a new view
  navigate(event: NavigationEvent) {
    const prevState = { ...this.state.current };

    switch (event.type) {
      case 'GO':
        this.state.history.push(prevState);
        this.state.current = { view: event.view, params: event.params };
        break;

      case 'REPLACE':
        this.state.current = { view: event.view, params: event.params };
        break;

      case 'BACK':
        if (this.state.history.length > 0) {
          this.state.current = this.state.history.pop()!;
        }
        break;
    }

    // Log navigation for debugging
    console.log('🧭 Navigation:', {
      from: prevState,
      to: this.state.current,
      event: event.type
    });

    this.notifyListeners();
  }

  // Handle collapsed asset selection with proper guards
  onCollapsedAssetSelected(nodeId: string) {
    if (!nodeId || !this.state.validationData?.resultIndex) {
      console.warn('Invalid selection:', { nodeId, hasResultIndex: !!this.state.validationData?.resultIndex });
      return this.navigate({
        type: 'GO',
        view: 'MODAL_OUT_OF_SCOPE',
        params: { nodeId, runId: this.state.validationData?.runId ?? '' }
      });
    }

    const hit = this.state.validationData.resultIndex.get(nodeId);
    
    // Log selection for telemetry
    console.log('🎯 collapsed.select', {
      nodeId,
      hit: !!hit,
      runId: this.state.validationData.runId
    });

    return hit
      ? this.navigate({ type: 'GO', view: 'ISSUE_DETAILS', params: { nodeId, issue: hit } })
      : this.navigate({ type: 'GO', view: 'MODAL_OUT_OF_SCOPE', params: { nodeId, runId: this.state.validationData.runId } });
  }

  // Get current state
  getState(): UIState {
    return { ...this.state };
  }

  // Subscribe to state changes
  subscribe(listener: (state: UIState) => void) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }
}

// Single instance
export const viewController = new ViewController();