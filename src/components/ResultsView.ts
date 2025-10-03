import { ViewStateController } from '../controllers/ViewStateController';

export interface ValidationIssue {
  nodeId: string;
  nodeName: string;
  type: 'spacing' | 'corner-radius' | 'font-size' | 'font-color';
  issue: string;
  suggestion: string;
  severity: 'warning' | 'error';
}

export interface ResultsViewState {
  issues: ValidationIssue[];
  totalNodes: number;
  scope: string;
  designSystem?: string;
}

export class ResultsView {
  private container: HTMLElement;
  private state: ResultsViewState;
  private viewController: ViewStateController;
  private onBackToForm?: () => void;
  private onIssueClick?: (nodeId: string, nodeName: string) => void;

  constructor(container: HTMLElement, viewController: ViewStateController) {
    this.container = container;
    this.viewController = viewController;
    this.state = {
      issues: [],
      totalNodes: 0,
      scope: ''
    };
  }

  public render(): void {
    this.container.innerHTML = `
      <div class="results-header">
        <button class="back-button" id="back-to-form">
          <span class="back-icon">←</span>
          Back to Form
        </button>
        <div class="results-title-section">
          <div class="results-title" id="results-title">Results</div>
          <div class="results-count" id="results-count"></div>
        </div>
      </div>
      <div class="results-content" id="results-content">
        <!-- Results will be populated here -->
      </div>
    `;

    this.attachEventListeners();
    this.updateResults();
  }

  private attachEventListeners(): void {
    const backButton = this.container.querySelector('#back-to-form') as HTMLButtonElement;
    backButton?.addEventListener('click', () => {
      if (this.onBackToForm) {
        this.onBackToForm();
      }
    });
  }

  private updateResults(): void {
    const resultsTitle = this.container.querySelector('#results-title') as HTMLElement;
    const resultsCount = this.container.querySelector('#results-count') as HTMLElement;
    const resultsContent = this.container.querySelector('#results-content') as HTMLElement;

    if (!resultsTitle || !resultsCount || !resultsContent) return;

    // Update count display with severity breakdown
    const severityBreakdown = this.getSeverityBreakdown();
    resultsCount.innerHTML = `
      ${this.state.issues.length} issues found in ${this.state.totalNodes} nodes (${this.state.scope})
      ${severityBreakdown.errors > 0 ? `<span class="severity-count error">${severityBreakdown.errors} errors</span>` : ''}
      ${severityBreakdown.warnings > 0 ? `<span class="severity-count warning">${severityBreakdown.warnings} warnings</span>` : ''}
    `;

    if (this.state.issues.length === 0) {
      // No issues found - show success state
      resultsTitle.textContent = '✅ All Good!';
      resultsContent.innerHTML = `
        <div class="no-issues">
          <div class="success-icon">🎉</div>
          <div class="success-message">No design token issues found!</div>
          <div class="success-description">All elements are using proper design tokens.</div>
        </div>
      `;
    } else {
      // Issues found - show categorized issue list
      resultsTitle.textContent = `⚠️ Issues Found`;
      
      const categorizedIssues = this.categorizeIssues();
      const issuesHTML = this.renderCategorizedIssues(categorizedIssues);

      resultsContent.innerHTML = `
        <div class="issues-container">
          ${issuesHTML}
        </div>
      `;

      // Add click handlers for issue items
      this.attachIssueClickHandlers();
    }
  }

  private attachIssueClickHandlers(): void {
    const issueItems = this.container.querySelectorAll('.issue-item');
    issueItems.forEach(item => {
      item.addEventListener('click', () => {
        const nodeId = (item as HTMLElement).dataset.nodeId;
        const nodeName = (item as HTMLElement).dataset.nodeName;
        
        if (nodeId && nodeName && this.onIssueClick) {
          // Add visual feedback for the clicked item
          this.showIssueClickFeedback(item as HTMLElement);
          
          // Call the click handler
          this.onIssueClick(nodeId, nodeName);
        }
      });
    });
  }

  private showIssueClickFeedback(item: HTMLElement): void {
    // Add a temporary visual feedback class
    item.classList.add('issue-selecting');
    
    // Remove the feedback class after a short delay
    setTimeout(() => {
      item.classList.remove('issue-selecting');
    }, 1000);
  }

  private getIssueColorClass(type: string): string {
    const colorMap: { [key: string]: string } = {
      'spacing': 'spacing',
      'corner-radius': 'corner-radius', 
      'font-size': 'font-size',
      'font-color': 'font-color'
    };
    return colorMap[type] || 'spacing';
  }

  private getSeverityIcon(severity: 'warning' | 'error'): string {
    return severity === 'error' ? '🔴' : '🟠';
  }

  private formatIssueType(type: string): string {
    const typeMap: { [key: string]: string } = {
      'spacing': 'Spacing',
      'corner-radius': 'Corner Radius',
      'font-size': 'Font Size', 
      'font-color': 'Font Color'
    };
    return typeMap[type] || type;
  }

  private getSeverityBreakdown(): { errors: number; warnings: number } {
    return this.state.issues.reduce(
      (acc, issue) => {
        if (issue.severity === 'error') {
          acc.errors++;
        } else {
          acc.warnings++;
        }
        return acc;
      },
      { errors: 0, warnings: 0 }
    );
  }

  private categorizeIssues(): { [key: string]: ValidationIssue[] } {
    const categories: { [key: string]: ValidationIssue[] } = {
      'spacing': [],
      'corner-radius': [],
      'font-size': [],
      'font-color': []
    };

    // Sort issues by severity (errors first) then by type
    const sortedIssues = [...this.state.issues].sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === 'error' ? -1 : 1;
      }
      return a.type.localeCompare(b.type);
    });

    sortedIssues.forEach(issue => {
      if (categories[issue.type]) {
        categories[issue.type].push(issue);
      }
    });

    return categories;
  }

  private renderCategorizedIssues(categorizedIssues: { [key: string]: ValidationIssue[] }): string {
    let html = '';
    
    // Define category order and metadata
    const categoryOrder = ['spacing', 'corner-radius', 'font-size', 'font-color'];
    const categoryMeta = {
      'spacing': {
        title: 'Spacing Issues',
        icon: '📏',
        description: 'Elements using manual spacing instead of design tokens'
      },
      'corner-radius': {
        title: 'Corner Radius Issues', 
        icon: '🔲',
        description: 'Elements using manual border radius instead of design tokens'
      },
      'font-size': {
        title: 'Font Size Issues',
        icon: '🔤',
        description: 'Text elements using manual font sizes instead of design tokens'
      },
      'font-color': {
        title: 'Font Color Issues',
        icon: '🎨',
        description: 'Text elements using manual colors instead of design tokens'
      }
    };

    categoryOrder.forEach(categoryType => {
      const issues = categorizedIssues[categoryType];
      if (issues && issues.length > 0) {
        const meta = categoryMeta[categoryType as keyof typeof categoryMeta];
        const severityBreakdown = this.getCategorySeverityBreakdown(issues);
        
        html += `
          <div class="issue-category">
            <div class="category-header">
              <div class="category-title">
                <span class="category-icon">${meta.icon}</span>
                <span class="category-name">${meta.title}</span>
                <span class="category-count">(${issues.length})</span>
              </div>
              <div class="category-severity">
                ${severityBreakdown.errors > 0 ? `<span class="severity-badge error">${severityBreakdown.errors} errors</span>` : ''}
                ${severityBreakdown.warnings > 0 ? `<span class="severity-badge warning">${severityBreakdown.warnings} warnings</span>` : ''}
              </div>
            </div>
            <div class="category-description">${meta.description}</div>
            <div class="category-issues">
              ${this.renderIssueList(issues)}
            </div>
          </div>
        `;
      }
    });

    return html;
  }

  private getCategorySeverityBreakdown(issues: ValidationIssue[]): { errors: number; warnings: number } {
    return issues.reduce(
      (acc, issue) => {
        if (issue.severity === 'error') {
          acc.errors++;
        } else {
          acc.warnings++;
        }
        return acc;
      },
      { errors: 0, warnings: 0 }
    );
  }

  private renderIssueList(issues: ValidationIssue[]): string {
    return issues.map(issue => {
      const severityClass = issue.severity === 'error' ? 'error' : 'warning';
      const severityIcon = this.getSeverityIcon(issue.severity);
      const typeClass = this.getIssueColorClass(issue.type);
      
      return `
        <div class="issue-item ${typeClass} ${severityClass}" data-node-id="${issue.nodeId}" data-node-name="${issue.nodeName}">
          <div class="issue-header">
            <div class="issue-node">
              <span class="severity-indicator ${severityClass}">${severityIcon}</span>
              <span class="node-name">${issue.nodeName}</span>
            </div>
            <div class="issue-type-badge ${issue.type}">${this.formatIssueType(issue.type)}</div>
          </div>
          <div class="issue-content">
            <div class="issue-description">${issue.issue}</div>
            <div class="issue-suggestion">
              <span class="suggestion-icon">💡</span>
              <span class="suggestion-text">${issue.suggestion}</span>
            </div>
          </div>
          <div class="issue-actions">
            <div class="click-hint">👆 Click to select in Figma</div>
          </div>
        </div>
      `;
    }).join('');
  }

  public setResults(issues: ValidationIssue[], totalNodes: number, scope: string, designSystem?: string): void {
    this.state = {
      issues,
      totalNodes,
      scope,
      designSystem
    };
    
    // Update the display if already rendered
    if (this.container.querySelector('#results-content')) {
      this.updateResults();
    }
  }

  public setOnBackToForm(callback: () => void): void {
    this.onBackToForm = callback;
  }

  public setOnIssueClick(callback: (nodeId: string, nodeName: string) => void): void {
    this.onIssueClick = callback;
  }

  public getState(): ResultsViewState {
    return { ...this.state };
  }

  public addCustomStyles(): void {
    // Add additional styles specific to results view
    const style = document.createElement('style');
    style.textContent = `
      .results-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 1px solid #e0e0e0;
      }

      .back-button {
        display: flex;
        align-items: center;
        gap: 8px;
        background: none;
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 13px;
        color: #666;
        cursor: pointer;
        transition: all 0.2s;
      }

      .back-button:hover {
        background: #f5f5f5;
        border-color: #ccc;
        color: #333;
      }

      .back-icon {
        font-size: 14px;
      }

      .results-title-section {
        text-align: right;
      }

      .results-title {
        font-size: 16px;
        font-weight: 600;
        color: #333;
        margin-bottom: 4px;
      }

      .results-count {
        font-size: 12px;
        color: #666;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .severity-count {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 10px;
        font-weight: 500;
      }

      .severity-count.error {
        background: #ffebee;
        color: #d32f2f;
      }

      .severity-count.warning {
        background: #fff3e0;
        color: #f57c00;
      }

      .results-content {
        flex: 1;
        overflow-y: auto;
        padding-right: 8px;
      }

      .no-issues {
        text-align: center;
        padding: 40px 20px;
        color: #4caf50;
      }

      .success-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }

      .success-message {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 8px;
      }

      .success-description {
        font-size: 14px;
        opacity: 0.8;
      }

      .issues-container {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .issue-category {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
      }

      .category-header {
        background: #f8f9fa;
        padding: 12px 16px;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .category-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        color: #333;
      }

      .category-icon {
        font-size: 16px;
      }

      .category-count {
        font-size: 12px;
        color: #666;
        font-weight: normal;
      }

      .category-severity {
        display: flex;
        gap: 6px;
      }

      .severity-badge {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 10px;
        font-weight: 500;
      }

      .severity-badge.error {
        background: #ffebee;
        color: #d32f2f;
      }

      .severity-badge.warning {
        background: #fff3e0;
        color: #f57c00;
      }

      .category-description {
        padding: 8px 16px;
        font-size: 12px;
        color: #666;
        font-style: italic;
        background: #fafafa;
        border-bottom: 1px solid #e0e0e0;
      }

      .category-issues {
        display: flex;
        flex-direction: column;
      }

      .issue-item {
        padding: 12px 16px;
        border-bottom: 1px solid #f0f0f0;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
      }

      .issue-item:last-child {
        border-bottom: none;
      }

      .issue-item:hover {
        background: #f8f9fa;
      }

      .issue-item.error {
        border-left: 3px solid #d32f2f;
      }

      .issue-item.warning {
        border-left: 3px solid #f57c00;
      }

      .issue-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .issue-node {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .severity-indicator {
        font-size: 12px;
      }

      .node-name {
        font-weight: 500;
        color: #333;
      }

      .issue-type-badge {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 3px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .issue-type-badge.spacing {
        background: #fff3e0;
        color: #f57c00;
      }

      .issue-type-badge.corner-radius {
        background: #e3f2fd;
        color: #1976d2;
      }

      .issue-type-badge.font-size {
        background: #f3e5f5;
        color: #7b1fa2;
      }

      .issue-type-badge.font-color {
        background: #ffebee;
        color: #d32f2f;
      }

      .issue-content {
        margin-bottom: 8px;
      }

      .issue-description {
        font-size: 13px;
        color: #555;
        margin-bottom: 6px;
        line-height: 1.4;
      }

      .issue-suggestion {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        font-size: 12px;
        color: #4caf50;
        line-height: 1.3;
      }

      .suggestion-icon {
        font-size: 12px;
        margin-top: 1px;
      }

      .suggestion-text {
        flex: 1;
      }

      .issue-actions {
        display: flex;
        justify-content: flex-end;
      }

      .click-hint {
        font-size: 11px;
        color: #999;
        font-style: italic;
      }

      .issue-item.issue-selecting {
        background: #e3f2fd;
        border-left-color: #1976d2;
        transform: scale(0.98);
        transition: all 0.2s ease;
      }

      .issue-item.issue-selecting .click-hint {
        color: #1976d2;
        font-weight: 500;
      }

      .issue-item.issue-selecting .click-hint::before {
        content: '🎯 ';
      }
    `;
    
    if (!document.head.querySelector('style[data-results-view]')) {
      style.setAttribute('data-results-view', 'true');
      document.head.appendChild(style);
    }
  }
}