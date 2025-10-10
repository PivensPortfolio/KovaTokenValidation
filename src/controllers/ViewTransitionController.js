// View Transition Controller with Animation Support
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
export class ViewTransitionController {
    constructor(stateManager) {
        this.isTransitioning = false;
        this.transitionCallbacks = new Map();
        this.stateManager = stateManager;
    }
    // Main transition method
    switchToView(targetView_1) {
        return __awaiter(this, arguments, void 0, function* (targetView, options = {}) {
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
                const transition = {
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
                yield this.executeTransition(transition, options.data);
                // Update state manager
                this.stateManager.setCurrentView(targetView, true);
                console.log(`Successfully transitioned from ${currentView} to ${targetView}`);
            }
            catch (error) {
                console.error('Transition failed:', error);
                throw error;
            }
            finally {
                this.isTransitioning = false;
            }
        });
    }
    // Execute the actual transition with animations
    executeTransition(transition, data) {
        return __awaiter(this, void 0, void 0, function* () {
            // Send transition start message to UI
            this.sendTransitionMessage('transition-start', {
                from: transition.from,
                to: transition.to,
                animation: transition.animation,
                duration: transition.duration
            });
            // Handle window resizing for different views
            yield this.handleWindowResize(transition);
            // Send view change message to UI
            this.sendViewChangeMessage(transition.to, data);
            // Wait for animation to complete
            yield this.waitForAnimation(transition.duration);
            // Send transition complete message
            this.sendTransitionMessage('transition-complete', {
                from: transition.from,
                to: transition.to
            });
        });
    }
    // Handle window resizing based on view transitions
    handleWindowResize(transition) {
        return __awaiter(this, void 0, void 0, function* () {
            const sizes = this.getViewSizes();
            const fromSize = sizes[transition.from];
            const toSize = sizes[transition.to];
            if (fromSize.width !== toSize.width || fromSize.height !== toSize.height) {
                // Animate resize
                figma.ui.resize(toSize.width, toSize.height);
                // Reposition UI for collapsed view
                if (transition.to === 'collapsed') {
                    this.repositionUITopCenter(toSize);
                }
            }
        });
    }
    // Get view-specific window sizes
    getViewSizes() {
        return {
            form: { width: 800, height: 720 },
            results: { width: 800, height: 720 },
            collapsed: { width: 200, height: 400 }
        };
    }
    // Reposition UI to top center of viewport
    repositionUITopCenter(size) {
        const { bounds, zoom } = figma.viewport;
        const wInCanvas = size.width / zoom;
        const padding = 16;
        const x = bounds.x + (bounds.width - wInCanvas) / 2;
        const y = bounds.y + (padding / zoom);
        figma.ui.reposition(x, y);
    }
    // Get default animation type based on transition
    getDefaultAnimation(from, to) {
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
    getDefaultDuration(from, to) {
        if (from === 'collapsed' || to === 'collapsed') {
            return 200; // Faster for collapse/expand
        }
        return 300; // Standard transition duration
    }
    // Wait for animation to complete
    waitForAnimation(duration) {
        return new Promise(resolve => {
            setTimeout(resolve, duration);
        });
    }
    // Send transition-related messages to UI
    sendTransitionMessage(type, data) {
        figma.ui.postMessage(Object.assign({ type }, data));
    }
    // Send view change message to UI
    sendViewChangeMessage(view, data) {
        const message = {
            type: 'view-change',
            view,
            collapsed: view === 'collapsed'
        };
        if (data) {
            message.data = data;
        }
        figma.ui.postMessage(message);
    }
    // Preserve current state before transition
    preserveCurrentState() {
        // This method can be extended to save specific state data
        // For now, the StateManager handles state preservation
        console.log('Preserving current state before transition');
    }
    // Restore previous state
    restorePreviousState() {
        const previousView = this.stateManager.getPreviousView();
        if (previousView) {
            this.switchToView(previousView, { preserveData: true });
        }
        else {
            console.warn('No previous view to restore');
        }
    }
    // Quick transition methods for common scenarios
    goToForm(data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.switchToView('form', { data });
        });
    }
    goToResults(data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.switchToView('results', { data });
        });
    }
    goToCollapsed(data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.switchToView('collapsed', {
                animation: 'resize',
                duration: 200,
                data
            });
        });
    }
    // Check if transition is in progress
    isTransitionInProgress() {
        return this.isTransitioning;
    }
    // Register callback for transition completion
    onTransitionComplete(id, callback) {
        this.transitionCallbacks.set(id, callback);
    }
    // Remove transition callback
    removeTransitionCallback(id) {
        this.transitionCallbacks.delete(id);
    }
    // Execute transition callbacks
    executeTransitionCallbacks() {
        this.transitionCallbacks.forEach(callback => {
            try {
                callback();
            }
            catch (error) {
                console.error('Transition callback error:', error);
            }
        });
    }
}
