// Main View State Management System Entry Point
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { ViewStateController } from './controllers/ViewStateController';
// Global instance
let viewStateController = null;
// Initialize the view state management system
export function initializeViewStateManager() {
    return __awaiter(this, void 0, void 0, function* () {
        if (viewStateController) {
            console.warn('ViewStateManager already initialized');
            return viewStateController;
        }
        try {
            viewStateController = new ViewStateController();
            yield viewStateController.initialize();
            console.log('ViewStateManager initialized successfully');
            return viewStateController;
        }
        catch (error) {
            console.error('Failed to initialize ViewStateManager:', error);
            throw error;
        }
    });
}
// Get the current view state controller instance
export function getViewStateController() {
    if (!viewStateController) {
        throw new Error('ViewStateManager not initialized. Call initializeViewStateManager() first.');
    }
    return viewStateController;
}
// Convenience functions for common operations
export function switchToView(view, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const controller = getViewStateController();
        yield controller.switchToView(view, data);
    });
}
export function goToForm() {
    return __awaiter(this, void 0, void 0, function* () {
        const controller = getViewStateController();
        yield controller.goToForm();
    });
}
export function goToResults(issues, totalNodes, scope) {
    return __awaiter(this, void 0, void 0, function* () {
        const controller = getViewStateController();
        if (issues && totalNodes !== undefined && scope) {
            controller.setValidationResults(issues, totalNodes, scope);
        }
        yield controller.goToResults();
    });
}
export function goToCollapsed() {
    return __awaiter(this, void 0, void 0, function* () {
        const controller = getViewStateController();
        yield controller.goToCollapsed();
    });
}
export function goBack() {
    return __awaiter(this, void 0, void 0, function* () {
        const controller = getViewStateController();
        yield controller.goBack();
    });
}
export function attachDesignSystem(systemInfo) {
    return __awaiter(this, void 0, void 0, function* () {
        const controller = getViewStateController();
        yield controller.attachDesignSystem(systemInfo);
    });
}
export function detachDesignSystem() {
    return __awaiter(this, void 0, void 0, function* () {
        const controller = getViewStateController();
        yield controller.detachDesignSystem();
    });
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
