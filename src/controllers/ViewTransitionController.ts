// View Transition Controller with Animation Support

import { ViewType, ViewTransition, ViewTransitionOptions } from '../types/ViewState';
import { StateManager } from '../state/StateManager';
import { NavigationIndicator } from '../components/NavigationIndicator';

export class ViewTransitionController {
  private stateManager: StateManager;
  private isTransitioning: boolean = false;
  private transitionCallbacks: Map<string, () => void> = new Map();
  private navigationIndicator: NavigationIndicator | null = null;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  // Set navigation indicator for visual feedback
  public setNavigationIndicator(indicator: NavigationIndicator): void {
    this.navigationIndicator = indicator;
  }

  // Main transition method
  async switchToView(
    targetView: ViewType, 
    options: ViewTransitionOptions = {}
  ): Promise<void> {
    if (this.isTransitioning) {
      console.warn('Transition already in progress, ignoring request');
      return;
    }

    const currentView = this.stateManager.getCurrentView();
    if (currentView === targetView) {
      console.log(`Already in ${targetView} view, no transition needed`);
      return;
    }

    this.isTransitioning = true;

    try {
      const transition: ViewTransition = {
        from: currentView,
        to: targetView,
        animation: options.animation || this.getDefaultAnimation(currentView, targetView),
        duration: options.duration || this.getDefaultDuration(currentView, targetView),
        preserveData: options.preserveData !== false // Default to true
      };

      // Preserve current state if requested
      if (transition.preserveData) {
        this.preserveCurrentState();
      }

      // Execute the transition
      await this.executeTransition(transition, options.data);

      // Update state manager
      this.stateManager.setCurrentView(targetView, true);

      console.log(`Successfully transitioned from ${currentView} to ${targetView}`);
    } catch (error) {
      console.error('Transition failed:', error);
      throw error;
    } finally {
      this.isTransitioning = false;
    }
  }

  // Execute the actual transition with animations
  private async executeTransition(transition: ViewTransition, data?: any): Promise<void> {
    // Send transition start message to UI for visual feedback
    this.sendTransitionMessage('transition-start', {
      from: transition.from,
      to: transition.to,
      animation: transition.animation,
      duration: transition.duration
    });

    // Add loading indicator for visual feedback during transition
    this.showTransitionFeedback(transition);

    // Handle window resizing for different views with smooth animation
    await this.handleWindowResize(transition);

    // Send view change message to UI
    this.sendViewChangeMessage(transition.to, data);

    // Wait for animation to complete
    await this.waitForAnimation(transition.duration);

    // Hide loading indicator
    this.hideTransitionFeedback();

    // Send transition complete message
    this.sendTransitionMessage('transition-complete', {
      from: transition.from,
      to: transition.to
    });

    // Execute any registered callbacks
    this.executeTransitionCallbacks();
  }

  // Handle window resizing based on view transitions with smooth animation
  private async handleWindowResize(transition: ViewTransition): Promise<void> {
    const sizes = this.getViewSizes();
    const fromSize = sizes[transition.from];
    const toSize = sizes[transition.to];

    if (fromSize.width !== toSize.width || fromSize.height !== toSize.height) {
      // Animate resize smoothly based on transition type
      if (transition.animation === 'resize') {
        // For collapse/expand, use smooth resize animation
        await this.animateResize(fromSize, toSize, transition.duration);
      } else {
        // For other transitions, resize immediately
        figma.ui.resize(toSize.width, toSize.height);
      }
      
      // Reposition UI for collapsed view to top center
      if (transition.to === 'collapsed') {
        this.repositionUITopCenter(toSize);
      }
      
      // Restore position for expanded views
      if (transition.from === 'collapsed' && transition.to !== 'collapsed') {
        this.restoreUIPosition();
      }
    }
  }

  // Animate resize smoothly for better visual feedback
  private async animateResize(
    fromSize: { width: number; height: number },
    toSize: { width: number; height: number },
    duration: number
  ): Promise<void> {
    const steps = Math.max(10, Math.floor(duration / 20)); // 20ms per step
    const stepDuration = duration / steps;
    
    const widthStep = (toSize.width - fromSize.width) / steps;
    const heightStep = (toSize.height - fromSize.height) / steps;
    
    for (let i = 1; i <= steps; i++) {
      const currentWidth = Math.round(fromSize.width + (widthStep * i));
      const currentHeight = Math.round(fromSize.height + (heightStep * i));
      
      figma.ui.resize(currentWidth, currentHeight);
      
      if (i < steps) {
        await new Promise(resolve => setTimeout(resolve, stepDuration));
      }
    }
  }

  // Restore UI position when expanding from collapsed view
  private restoreUIPosition(): void {
    // Reset to default position (center of viewport)
    const { bounds } = figma.viewport;
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    
    figma.ui.reposition(x, y);
  }

  // Get view-specific window sizes
  private getViewSizes(): Record<ViewType, { width: number; height: number }> {
    return {
      form: { width: 800, height: 720 },
      results: { width: 800, height: 720 },
      collapsed: { width: 200, height: 400 }
    };
  }

  // Reposition UI to top center of viewport
  private repositionUITopCenter(size: { width: number; height: number }): void {
    const { bounds, zoom } = figma.viewport;
    const wInCanvas = size.width / zoom;
    const padding = 16;

    const x = bounds.x + (bounds.width - wInCanvas) / 2;
    const y = bounds.y + (padding / zoom);
    
    figma.ui.reposition(x, y);
  }

  // Get default animation type based on transition
  private getDefaultAnimation(from: ViewType, to: ViewType): 'slide' | 'fade' | 'resize' {
    if (from === 'collapsed' || to === 'collapsed') {
      return 'resize';
    }
    if (from === 'form' && to === 'results') {
      return 'slide';
    }
    if (from === 'results' && to === 'form') {
      return 'slide';
    }
    return 'fade';
  }

  // Get default duration based on transition
  private getDefaultDuration(from: ViewType, to: ViewType): number {
    if (from === 'collapsed' || to === 'collapsed') {
      return 200; // Faster for collapse/expand
    }
    return 300; // Standard transition duration
  }

  // Wait for animation to complete
  private waitForAnimation(duration: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, duration);
    });
  }

  // Send transition-related messages to UI
  private sendTransitionMessage(type: string, data: any): void {
    figma.ui.postMessage({
      type,
      ...data
    });
  }

  // Send view change message to UI
  private sendViewChangeMessage(view: ViewType, data?: any): void {
    const message: any = {
      type: 'view-change',
      view,
      collapsed: view === 'collapsed'
    };

    if (data) {
      message.data = data;
    }

    console.log('=== SENDING VIEW CHANGE MESSAGE ===');
    console.log('Message:', JSON.stringify(message, null, 2));
    figma.ui.postMessage(message);
    console.log('Message sent to UI');
  }



  // Quick transition methods for common scenarios
  async goToForm(data?: any): Promise<void> {
    await this.switchToView('form', { data });
  }

  async goToResults(data?: any): Promise<void> {
    await this.switchToView('results', { 
      animation: 'slide',
      data 
    });
  }

  async goToCollapsed(data?: any): Promise<void> {
    await this.switchToView('collapsed', { 
      animation: 'resize',
      duration: 200,
      data 
    });
  }

  // Check if transition is in progress
  isTransitionInProgress(): boolean {
    return this.isTransitioning;
  }

  // Register callback for transition completion
  onTransitionComplete(id: string, callback: () => void): void {
    this.transitionCallbacks.set(id, callback);
  }

  // Remove transition callback
  removeTransitionCallback(id: string): void {
    this.transitionCallbacks.delete(id);
  }

  // Show visual feedback during transition (Requirement 4.1)
  private showTransitionFeedback(transition: ViewTransition): void {
    // Use navigation indicator if available, otherwise send message to UI
    if (this.navigationIndicator) {
      this.navigationIndicator.showTransitionFeedback(
        transition.from, 
        transition.to, 
        transition.animation
      );
    } else {
      this.sendTransitionMessage('show-loading', {
        message: `Switching to ${transition.to} view...`,
        animation: transition.animation
      });
    }
  }

  // Hide visual feedback after transition
  private hideTransitionFeedback(): void {
    if (this.navigationIndicator) {
      this.navigationIndicator.hideLoading();
    } else {
      this.sendTransitionMessage('hide-loading', {});
    }
  }

  // Enhanced preserve current state with better data preservation (Requirement 4.2)
  public preserveCurrentState(): void {
    const currentState = this.stateManager.getState();
    
    // Store current view as previous view for navigation
    this.stateManager.setPreviousView(currentState.currentView);
    
    // Log state preservation for debugging
    console.log('Preserving current state:', {
      view: currentState.currentView,
      hasFormData: !!currentState.formData,
      hasResults: !!currentState.resultsData
    });
  }

  // Enhanced restore previous state with validation (Requirement 4.4)
  public restorePreviousState(): void {
    const previousView = this.stateManager.getPreviousView();
    const currentState = this.stateManager.getState();
    
    if (previousView) {
      console.log(`Restoring previous view: ${previousView}`);
      
      // Ensure we have the necessary data for the target view
      if (previousView === 'results' && !currentState.resultsData) {
        console.warn('Cannot restore results view: no results data available');
        this.switchToView('form', { preserveData: true });
        return;
      }
      
      this.switchToView(previousView, { 
        preserveData: true,
        animation: 'fade' // Use gentle animation for back navigation
      });
    } else {
      console.warn('No previous view to restore, going to form view');
      this.switchToView('form', { preserveData: true });
    }
  }

  // Execute transition callbacks
  private executeTransitionCallbacks(): void {
    this.transitionCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Transition callback error:', error);
      }
    });
  }
}