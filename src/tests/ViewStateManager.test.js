// Basic tests for View State Management System
// Note: These are conceptual tests since we can't run a full test framework in Figma plugin context
import { StateManager } from '../state/StateManager';
import { ViewTransitionController } from '../controllers/ViewTransitionController';
import { ViewStateController } from '../controllers/ViewStateController';
// Mock Figma API for testing
const mockFigma = {
    clientStorage: {
        setAsync: async (key, value) => {
            console.log(`Mock clientStorage.setAsync: ${key}`, value);
        },
        getAsync: async (key) => {
            console.log(`Mock clientStorage.getAsync: ${key}`);
            return null;
        },
        deleteAsync: async (key) => {
            console.log(`Mock clientStorage.deleteAsync: ${key}`);
        }
    },
    ui: {
        postMessage: (message) => {
            console.log('Mock UI message:', message);
        },
        resize: (width, height) => {
            console.log(`Mock UI resize: ${width}x${height}`);
        },
        reposition: (x, y) => {
            console.log(`Mock UI reposition: ${x}, ${y}`);
        }
    },
    viewport: {
        bounds: { x: 0, y: 0, width: 1000, height: 800 },
        zoom: 1
    }
};
// Test functions
export function testStateManager() {
    console.log('=== Testing StateManager ===');
    try {
        const stateManager = new StateManager();
        // Test initial state
        const initialState = stateManager.getState();
        console.log('Initial state:', initialState);
        if (initialState.currentView !== 'form') {
            throw new Error('Initial view should be form');
        }
        if (!initialState.formData.validationOptions.includes('spacings')) {
            throw new Error('Default validation options should include spacings');
        }
        // Test view switching
        stateManager.setCurrentView('results');
        if (stateManager.getCurrentView() !== 'results') {
            throw new Error('View should be results after switching');
        }
        if (stateManager.getPreviousView() !== 'form') {
            throw new Error('Previous view should be form');
        }
        // Test validation options
        stateManager.toggleValidationOption('font-size');
        const formData = stateManager.getFormData();
        if (!formData.validationOptions.includes('font-size')) {
            throw new Error('Font-size should be added to validation options');
        }
        stateManager.toggleValidationOption('spacings');
        const updatedFormData = stateManager.getFormData();
        if (updatedFormData.validationOptions.includes('spacings')) {
            throw new Error('Spacings should be removed from validation options');
        }
        console.log('✅ StateManager tests passed');
        return true;
    }
    catch (error) {
        console.error('❌ StateManager test failed:', error);
        return false;
    }
}
export function testViewTransitionController() {
    console.log('=== Testing ViewTransitionController ===');
    try {
        const stateManager = new StateManager();
        const transitionController = new ViewTransitionController(stateManager);
        // Test transition methods exist
        if (typeof transitionController.switchToView !== 'function') {
            throw new Error('switchToView method should exist');
        }
        if (typeof transitionController.goToForm !== 'function') {
            throw new Error('goToForm method should exist');
        }
        if (typeof transitionController.goToResults !== 'function') {
            throw new Error('goToResults method should exist');
        }
        if (typeof transitionController.goToCollapsed !== 'function') {
            throw new Error('goToCollapsed method should exist');
        }
        console.log('✅ ViewTransitionController tests passed');
        return true;
    }
    catch (error) {
        console.error('❌ ViewTransitionController test failed:', error);
        return false;
    }
}
export function testViewStateController() {
    console.log('=== Testing ViewStateController ===');
    try {
        const controller = new ViewStateController();
        // Test controller methods exist
        if (typeof controller.initialize !== 'function') {
            throw new Error('initialize method should exist');
        }
        if (typeof controller.switchToView !== 'function') {
            throw new Error('switchToView method should exist');
        }
        if (typeof controller.attachDesignSystem !== 'function') {
            throw new Error('attachDesignSystem method should exist');
        }
        if (typeof controller.setValidationOptions !== 'function') {
            throw new Error('setValidationOptions method should exist');
        }
        // Test state getters
        const currentView = controller.getCurrentView();
        if (typeof currentView !== 'string') {
            throw new Error('getCurrentView should return a string');
        }
        const canRun = controller.canRunValidation();
        if (typeof canRun !== 'boolean') {
            throw new Error('canRunValidation should return a boolean');
        }
        console.log('✅ ViewStateController tests passed');
        return true;
    }
    catch (error) {
        console.error('❌ ViewStateController test failed:', error);
        return false;
    }
}
// Run all tests
export function runAllTests() {
    console.log('=== Running View State Management Tests ===');
    const results = [
        testStateManager(),
        testViewTransitionController(),
        testViewStateController()
    ];
    const allPassed = results.every(result => result);
    if (allPassed) {
        console.log('🎉 All tests passed!');
    }
    else {
        console.log('❌ Some tests failed');
    }
    return allPassed;
}
