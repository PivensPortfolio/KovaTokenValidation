import { viewController } from './ViewController';
import { render } from './router/render';

// Centralized message handling - no direct DOM manipulation
export function initializeMessageHandler() {
  // Subscribe to view controller changes
  viewController.subscribe((state) => {
    render(state);
  });

  // Handle messages from plugin
  window.onmessage = (event) => {
    const msg = event.data.pluginMessage;
    
    console.log('📨 Message received:', msg.type);
    
    switch (msg.type) {
      case 'ui-mode':
        handleUIMode(msg);
        break;
        
      case 'validation-results':
        handleValidationResults(msg);
        break;
        
      case 'selection-changed':
        handleSelectionChanged(msg);
        break;
        
      case 'plugin-minimized':
        handlePluginMinimized();
        break;
        
      case 'node-name-response':
        handleNodeNameResponse(msg);
        break;
        
      default:
        console.log('Unhandled message type:', msg.type);
    }
  };
}

function handleUIMode(msg: any) {
  console.log('UI received mode:', msg.mode);
  
  const modeToView: Record<string, any> = {
    'home': { view: 'DASHBOARD' },
    'validation-results': { view: 'VALIDATION_RESULTS' }
  };
  
  const viewConfig = modeToView[msg.mode];
  if (viewConfig) {
    viewController.navigate({ type: 'REPLACE', ...viewConfig });
  }
  
  // Request resize to match the screen
  parent.postMessage({
    pluginMessage: {
      type: 'resize-ui',
      sizeMode: msg.mode
    }
  }, '*');
}

function handleValidationResults(msg: any) {
  console.log('🔍 Validation results received');
  
  // Set validation data in controller
  viewController.setValidationResults(msg.results, msg.runId || Date.now().toString());
  
  // Navigate to results view
  viewController.navigate({ type: 'GO', view: 'VALIDATION_RESULTS' });
}

function handleSelectionChanged(msg: any) {
  const state = viewController.getState();
  
  // Only handle selection in collapsed view
  if (state.current.view === 'COLLAPSED') {
    console.log('🔍 Selection changed in collapsed view:', msg.nodeId);
    viewController.onCollapsedAssetSelected(msg.nodeId);
  }
}

function handlePluginMinimized() {
  console.log('🔍 Plugin minimized - switching to collapsed view');
  viewController.navigate({ type: 'GO', view: 'COLLAPSED' });
}

function handleNodeNameResponse(msg: any) {
  const params = (window as any).pendingOutOfScopeParams;
  if (params && params.nodeId === msg.nodeId) {
    // Show the out-of-scope modal with the node name
    (window as any).showOutOfScopePrompt(msg.nodeId, msg.nodeName);
    delete (window as any).pendingOutOfScopeParams;
  }
}