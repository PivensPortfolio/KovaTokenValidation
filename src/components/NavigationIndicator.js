// Navigation Indicator Component - Shows current view state and provides visual feedback
export class NavigationIndicator {
    constructor(container, options = {}) {
        this.currentView = 'form';
        this.isLoading = false;
        this.container = container;
        this.options = Object.assign({ showBreadcrumbs: true, showViewTitle: true, showLoadingStates: true }, options);
        this.createIndicatorElement();
    }
    createIndicatorElement() {
        const indicatorElement = document.createElement('div');
        indicatorElement.className = 'navigation-indicator';
        indicatorElement.id = 'navigation-indicator';
        // Insert at the top of the container
        this.container.insertBefore(indicatorElement, this.container.firstChild);
        this.addStyles();
    }
    // Update the current view indicator (Requirement 6.1)
    updateCurrentView(view) {
        this.currentView = view;
        this.render();
    }
    // Show loading state during transitions (Requirement 4.5)
    showLoading(message = 'Loading...') {
        this.isLoading = true;
        this.renderLoadingState(message);
    }
    // Hide loading state
    hideLoading() {
        this.isLoading = false;
        this.render();
    }
    // Main render method
    render() {
        const indicator = this.container.querySelector('#navigation-indicator');
        if (!indicator)
            return;
        if (this.isLoading) {
            return; // Loading state is handled separately
        }
        let content = '';
        // Add breadcrumbs (Requirement 6.2)
        if (this.options.showBreadcrumbs) {
            content += this.renderBreadcrumbs();
        }
        // Add view title (Requirement 6.1)
        if (this.options.showViewTitle) {
            content += this.renderViewTitle();
        }
        indicator.innerHTML = content;
    }
    // Render breadcrumb navigation
    renderBreadcrumbs() {
        const breadcrumbs = this.getBreadcrumbsForView(this.currentView);
        if (breadcrumbs.length <= 1) {
            return ''; // Don't show breadcrumbs for single-level views
        }
        const breadcrumbItems = breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const isClickable = !isLast && crumb.clickable;
            return `
        <span class="breadcrumb-item ${isLast ? 'current' : ''} ${isClickable ? 'clickable' : ''}"
              ${isClickable ? `data-view="${crumb.view}"` : ''}>
          ${crumb.label}
        </span>
        ${!isLast ? '<span class="breadcrumb-separator">›</span>' : ''}
      `;
        }).join('');
        return `
      <div class="breadcrumbs">
        ${breadcrumbItems}
      </div>
    `;
    }
    // Render view title with status indicator
    renderViewTitle() {
        const viewInfo = this.getViewInfo(this.currentView);
        return `
      <div class="view-title-section">
        <div class="view-indicator ${this.currentView}">
          <span class="view-icon">${viewInfo.icon}</span>
          <span class="view-title">${viewInfo.title}</span>
        </div>
        <div class="view-status">${viewInfo.status}</div>
      </div>
    `;
    }
    // Render loading state with progress indicator
    renderLoadingState(message) {
        const indicator = this.container.querySelector('#navigation-indicator');
        if (!indicator)
            return;
        indicator.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <div class="loading-message">${message}</div>
      </div>
    `;
    }
    // Get breadcrumbs for current view
    getBreadcrumbsForView(view) {
        switch (view) {
            case 'form':
                return [
                    { label: 'Token Validator', clickable: false }
                ];
            case 'results':
                return [
                    { label: 'Token Validator', view: 'form', clickable: true },
                    { label: 'Results', clickable: false }
                ];
            case 'collapsed':
                return [
                    { label: 'Token Validator', view: 'form', clickable: true },
                    { label: 'Results', view: 'results', clickable: true },
                    { label: 'Inspect Element', clickable: false }
                ];
            default:
                return [{ label: 'Token Validator', clickable: false }];
        }
    }
    // Get view information
    getViewInfo(view) {
        switch (view) {
            case 'form':
                return {
                    icon: '⚙️',
                    title: 'Configuration',
                    status: 'Set up validation parameters'
                };
            case 'results':
                return {
                    icon: '📊',
                    title: 'Results',
                    status: 'Review validation findings'
                };
            case 'collapsed':
                return {
                    icon: '🔍',
                    title: 'Inspect',
                    status: 'Focus on selected element'
                };
            default:
                return {
                    icon: '⚙️',
                    title: 'Token Validator',
                    status: 'Ready'
                };
        }
    }
    // Add event listeners for breadcrumb navigation
    attachEventListeners(onNavigate) {
        const indicator = this.container.querySelector('#navigation-indicator');
        if (!indicator)
            return;
        indicator.addEventListener('click', (event) => {
            const target = event.target;
            const breadcrumbItem = target.closest('.breadcrumb-item.clickable');
            if (breadcrumbItem) {
                const targetView = breadcrumbItem.dataset.view;
                if (targetView) {
                    onNavigate(targetView);
                }
            }
        });
    }
    // Add styles for the navigation indicator
    addStyles() {
        if (document.head.querySelector('style[data-navigation-indicator]')) {
            return; // Styles already added
        }
        const style = document.createElement('style');
        style.setAttribute('data-navigation-indicator', 'true');
        style.textContent = `
      .navigation-indicator {
        margin-bottom: 16px;
        padding: 12px 0;
        border-bottom: 1px solid #e0e0e0;
      }

      .breadcrumbs {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 12px;
        color: #666;
      }

      .breadcrumb-item {
        display: inline-flex;
        align-items: center;
        padding: 2px 4px;
        border-radius: 3px;
        transition: all 0.2s;
      }

      .breadcrumb-item.clickable {
        cursor: pointer;
        color: #1976d2;
      }

      .breadcrumb-item.clickable:hover {
        background: #e3f2fd;
        color: #1565c0;
      }

      .breadcrumb-item.current {
        color: #333;
        font-weight: 500;
      }

      .breadcrumb-separator {
        color: #ccc;
        font-size: 10px;
      }

      .view-title-section {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .view-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .view-icon {
        font-size: 16px;
      }

      .view-title {
        font-size: 14px;
        font-weight: 600;
        color: #333;
      }

      .view-status {
        font-size: 11px;
        color: #666;
        font-style: italic;
      }

      .view-indicator.form .view-icon {
        color: #4caf50;
      }

      .view-indicator.results .view-icon {
        color: #ff9800;
      }

      .view-indicator.collapsed .view-icon {
        color: #2196f3;
      }

      .loading-state {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 0;
      }

      .loading-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid #e0e0e0;
        border-top: 2px solid #1976d2;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      .loading-message {
        font-size: 12px;
        color: #666;
        font-style: italic;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      /* Responsive adjustments */
      @media (max-width: 400px) {
        .breadcrumbs {
          font-size: 11px;
        }
        
        .view-title {
          font-size: 13px;
        }
        
        .view-status {
          font-size: 10px;
        }
      }
    `;
        document.head.appendChild(style);
    }
    // Public method to show transition feedback
    showTransitionFeedback(from, to, animation) {
        const animationMessages = {
            'slide': `Sliding to ${to} view...`,
            'fade': `Switching to ${to} view...`,
            'resize': to === 'collapsed' ? 'Collapsing view...' : 'Expanding view...'
        };
        const message = animationMessages[animation] || `Switching to ${to} view...`;
        this.showLoading(message);
    }
    // Cleanup method
    destroy() {
        const indicator = this.container.querySelector('#navigation-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
}
