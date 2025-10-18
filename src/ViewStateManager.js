// Main View State Management System Entry Point
import { ViewStateController } from './controllers/ViewStateController';
// Global instance
let viewStateController = null;
// Initialize the view state management system
export async function initializeViewStateManager() {
    if (viewStateController) {
        console.warn('ViewStateManager already initialized');
        return viewStateController;
    }
    try {
        viewStateController = new ViewStateController();
        await viewStateController.initialize();
        console.log('ViewStateManager initialized successfully');
        return viewStateController;
    }
    catch (error) {
        console.error('Failed to initialize ViewStateManager:', error);
        throw error;
    }
}
// Get the current view state controller instance
export function getViewStateController() {
    console.log('=== getViewStateController called ===');
    console.log('viewStateController exists:', !!viewStateController);
    if (!viewStateController) {
        console.error('=== ViewStateManager not initialized ===');
        throw new Error('ViewStateManager not initialized. Call initializeViewStateManager() first.');
    }
    return viewStateController;
}
// Convenience functions for common operations
export async function switchToView(view, data) {
    const controller = getViewStateController();
    await controller.switchToView(view, data);
}
export async function goToForm() {
    const controller = getViewStateController();
    await controller.goToForm();
}
export async function goToResults(issues, totalNodes, scope) {
    console.log('=== ViewStateManager.goToResults called ===');
    console.log('Issues:', (issues === null || issues === void 0 ? void 0 : issues.length) || 0);
    console.log('Total nodes:', totalNodes);
    console.log('Scope:', scope);
    const controller = getViewStateController();
    if (issues && totalNodes !== undefined && scope) {
        console.log('Setting validation results...');
        controller.setValidationResults(issues, totalNodes, scope);
        const resultsData = controller.getResultsData();
        console.log('Retrieved results data:', resultsData);
        await controller.goToResults(resultsData || undefined);
    }
    else {
        console.log('No results data provided, going to results without data');
        await controller.goToResults();
    }
    console.log('=== ViewStateManager.goToResults completed ===');
}
export async function goToCollapsed() {
    const controller = getViewStateController();
    await controller.goToCollapsed();
}
export async function goBack() {
    const controller = getViewStateController();
    await controller.goBack();
}
export async function attachDesignSystem(systemInfo) {
    const controller = getViewStateController();
    await controller.attachDesignSystem(systemInfo);
}
export async function detachDesignSystem() {
    const controller = getViewStateController();
    await controller.detachDesignSystem();
}
export function setValidationOptions(options) {
    const controller = getViewStateController();
    controller.setValidationOptions(options);
}
export function toggleValidationOption(option) {
    const controller = getViewStateController();
    controller.toggleValidationOption(option);
}
export function getCurrentView() {
    const controller = getViewStateController();
    return controller.getCurrentView();
}
export function getState() {
    const controller = getViewStateController();
    return controller.getState();
}
export function canRunValidation() {
    const controller = getViewStateController();
    return controller.canRunValidation();
}
export function subscribeToStateChanges(callback) {
    const controller = getViewStateController();
    return controller.subscribeToStateChanges(callback);
}
// Cleanup function
export function destroyViewStateManager() {
    if (viewStateController) {
        viewStateController.destroy();
        viewStateController = null;
    }
}
