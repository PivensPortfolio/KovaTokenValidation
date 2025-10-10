// Main View State Management System Entry Point

import { ViewStateController } from './controllers/ViewStateController';
import { ViewType, DesignSystemInfo, ValidationIssue } from './types/ViewState';

// Global instance
let viewStateController: ViewStateController | null = null;

// Initialize the view state management system
export async function initializeViewStateManager(): Promise<ViewStateController> {
  if (viewStateController) {
    console.warn('ViewStateManager already initialized');
    return viewStateController;
  }

  try {
    viewStateController = new ViewStateController();
    await viewStateController.initialize();
    
    console.log('ViewStateManager initialized successfully');
    return viewStateController;
  } catch (error) {
    console.error('Failed to initialize ViewStateManager:', error);
    throw error;
  }
}

// Get the current view state controller instance
export function getViewStateController(): ViewStateController {
  console.log('=== getViewStateController called ===');
  console.log('viewStateController exists:', !!viewStateController);
  
  if (!viewStateController) {
    console.error('=== ViewStateManager not initialized ===');
    throw new Error('ViewStateManager not initialized. Call initializeViewStateManager() first.');
  }
  return viewStateController;
}

// Convenience functions for common operations
export async function switchToView(view: ViewType, data?: any): Promise<void> {
  const controller = getViewStateController();
  await controller.switchToView(view, data);
}

export async function goToForm(): Promise<void> {
  const controller = getViewStateController();
  await controller.goToForm();
}

export async function goToResults(issues?: ValidationIssue[], totalNodes?: number, scope?: string): Promise<void> {
  console.log('=== ViewStateManager.goToResults called ===');
  console.log('Issues:', issues?.length || 0);
  console.log('Total nodes:', totalNodes);
  console.log('Scope:', scope);
  
  const controller = getViewStateController();
  
  if (issues && totalNodes !== undefined && scope) {
    console.log('Setting validation results...');
    controller.setValidationResults(issues, totalNodes, scope);
    const resultsData = controller.getResultsData();
    console.log('Retrieved results data:', resultsData);
    await controller.goToResults(resultsData || undefined);
  } else {
    console.log('No results data provided, going to results without data');
    await controller.goToResults();
  }
  console.log('=== ViewStateManager.goToResults completed ===');
}

export async function goToCollapsed(): Promise<void> {
  const controller = getViewStateController();
  await controller.goToCollapsed();
}

export async function goBack(): Promise<void> {
  const controller = getViewStateController();
  await controller.goBack();
}

export async function attachDesignSystem(systemInfo: DesignSystemInfo): Promise<void> {
  const controller = getViewStateController();
  await controller.attachDesignSystem(systemInfo);
}

export async function detachDesignSystem(): Promise<void> {
  const controller = getViewStateController();
  await controller.detachDesignSystem();
}

export function setValidationOptions(options: string[]): void {
  const controller = getViewStateController();
  controller.setValidationOptions(options);
}

export function toggleValidationOption(option: string): void {
  const controller = getViewStateController();
  controller.toggleValidationOption(option);
}

export function getCurrentView(): ViewType {
  const controller = getViewStateController();
  return controller.getCurrentView();
}

export function getState() {
  const controller = getViewStateController();
  return controller.getState();
}

export function canRunValidation(): boolean {
  const controller = getViewStateController();
  return controller.canRunValidation();
}

export function subscribeToStateChanges(callback: (state: any) => void): () => void {
  const controller = getViewStateController();
  return controller.subscribeToStateChanges(callback);
}

// Cleanup function
export function destroyViewStateManager(): void {
  if (viewStateController) {
    viewStateController.destroy();
    viewStateController = null;
  }
}

// Export types for external use
export type { ViewType, DesignSystemInfo, ValidationIssue } from './types/ViewState';