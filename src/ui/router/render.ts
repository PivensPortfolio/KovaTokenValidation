import { ViewId, UIState } from '../ViewController';

// Router map - single source of truth for view mounting
const routes: Record<ViewId, (params?: any) => void> = {
  DASHBOARD: mountDashboard,
  VALIDATION_RESULTS: mountResults,
  COLLAPSED: mountCollapsed,
  ISSUE_DETAILS: (params) => mountIssuePanel(params),
  MODAL_OUT_OF_SCOPE: (params) => openOutOfScope(params)
};

// Main render function - called on every state change
export function render(state: UIState) {
  const { view, params } = state.current;
  
  console.log('🎨 Rendering view:', view, params);
  
  // Hide all screens first
  hideAllScreens();
  
  // Mount the requested view
  const mountFn = routes[view];
  if (mountFn) {
    mountFn(params);
  } else {
    console.error('Unknown view:', view);
    mountDashboard(); // Fallback
  }
}

function hideAllScreens() {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
    screen.style.display = 'none';
  });
  
  // Hide collapsed view overlay
  const collapsedView = document.getElementById('collapsed-view-content');
  if (collapsedView) {
    collapsedView.style.display = 'none';
  }
}

function mountDashboard() {
  showScreen('home-screen');
}

function mountResults() {
  showScreen('validation-results-screen');
  
  // Show main results content
  const resultsContent = document.getElementById('validation-results-content');
  const categoryTabs = document.getElementById('category-tabs');
  const statusTabs = document.getElementById('status-tabs');
  const minimizeBtn = document.getElementById('minimize-btn');
  const hamburgerBtn = document.getElementById('hamburger-menu-btn');
  
  if (resultsContent) resultsContent.style.display = 'block';
  if (categoryTabs) categoryTabs.style.display = 'flex';
  if (statusTabs) statusTabs.style.display = 'flex';
  if (minimizeBtn) minimizeBtn.style.display = 'block';
  if (hamburgerBtn) hamburgerBtn.style.display = 'block';
}

function mountCollapsed() {
  showScreen('validation-results-screen');
  
  // Hide main results, show collapsed overlay
  const resultsContent = document.getElementById('validation-results-content');
  const collapsedView = document.getElementById('collapsed-view-content');
  const categoryTabs = document.getElementById('category-tabs');
  const statusTabs = document.getElementById('status-tabs');
  const hamburgerBtn = document.getElementById('hamburger-menu-btn');
  
  if (resultsContent) resultsContent.style.display = 'none';
  if (categoryTabs) categoryTabs.style.display = 'none';
  if (statusTabs) statusTabs.style.display = 'none';
  if (hamburgerBtn) hamburgerBtn.style.display = 'none';
  
  if (collapsedView) {
    collapsedView.style.display = 'block';
    setupCollapsedViewContent();
  }
  
  // Resize to collapsed size
  parent.postMessage({
    pluginMessage: {
      type: 'resize-ui',
      sizeMode: 'validation-results-collapsed'
    }
  }, '*');
}

function mountIssuePanel(params: { nodeId: string; issue: any }) {
  // Issue panel is shown within collapsed view
  mountCollapsed();
  
  const container = document.querySelector('#collapsed-issue-display');
  if (container && params.issue) {
    // Use existing displayConversationalIssue function
    (window as any).displayConversationalIssue(container, params.issue, true);
  }
}

function openOutOfScope(params: { nodeId: string; runId: string }) {
  // Get node name and show modal
  parent.postMessage({
    pluginMessage: {
      type: 'get-node-name',
      nodeId: params.nodeId
    }
  }, '*');
  
  // Store params for when we get the response
  (window as any).pendingOutOfScopeParams = params;
}

function setupCollapsedViewContent() {
  const container = document.getElementById('collapsed-view-content');
  if (!container) return;
  
  container.innerHTML = `
    <div class="enhanced-collapsed-content" style="height: 100vh; box-sizing: border-box; background: #f9fafb; margin: 0; padding: 16px 0 0 0;">
      <div id="collapsed-issue-display" style="height: calc(100% - 10px); display: flex; flex-direction: column; margin: 0; padding: 0;">
        <!-- Issue content will be populated here -->
      </div>
    </div>
  `;
}

function showScreen(screenId: string) {
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.add('active');
    screen.style.display = 'block';
  }
}