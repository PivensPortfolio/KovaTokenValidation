import { ViewStateController } from '../controllers/ViewStateController';

export class CollapsedView {
  private container: HTMLElement;
  private viewController: ViewStateController;
  private onExpand?: () => void;

  constructor(container: HTMLElement, viewController: ViewStateController) {
    this.container = container;
    this.viewController = viewController;
  }

  public render(): void {
    this.container.innerHTML = `
      <div class="collapsed-content">
        <button id="expand-button" class="expand-button">
          Token Validator
        </button>
      </div>
    `;

    this.attachEventListeners();
    this.addCustomStyles();
  }

  private attachEventListeners(): void {
    const expandButton = this.container.querySelector('#expand-button') as HTMLButtonElement;
    expandButton?.addEventListener('click', () => {
      if (this.onExpand) {
        this.onExpand();
      }
    });

    // Add hover effects
    expandButton?.addEventListener('mouseenter', () => {
      this.addHoverEffect();
    });

    expandButton?.addEventListener('mouseleave', () => {
      this.removeHoverEffect();
    });
  }

  private addHoverEffect(): void {
    const button = this.container.querySelector('#expand-button') as HTMLButtonElement;
    if (button) {
      button.classList.add('hover');
    }
  }

  private removeHoverEffect(): void {
    const button = this.container.querySelector('#expand-button') as HTMLButtonElement;
    if (button) {
      button.classList.remove('hover');
    }
  }

  public setOnExpand(callback: () => void): void {
    this.onExpand = callback;
  }

  public addCustomStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .collapsed-content {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        width: 100%;
        padding: 16px;
        box-sizing: border-box;
      }

      .expand-button {
        background: #007AFF;
        border: none;
        border-radius: 8px;
        padding: 12px 24px;
        cursor: pointer;
        font-family: inherit;
        font-size: 14px;
        color: white;
        font-weight: 600;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
        min-width: 140px;
        text-align: center;
        position: relative;
        overflow: hidden;
      }

      .expand-button:hover,
      .expand-button.hover {
        background: #0056CC;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 122, 255, 0.4);
      }

      .expand-button:active {
        transform: translateY(0);
        box-shadow: 0 2px 6px rgba(0, 122, 255, 0.3);
      }

      .expand-button:focus {
        outline: none;
        box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3), 0 0 0 3px rgba(0, 122, 255, 0.2);
      }

      /* Ripple effect on click */
      .expand-button::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0;
        height: 0;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: translate(-50%, -50%);
        transition: width 0.3s, height 0.3s;
      }

      .expand-button:active::before {
        width: 100px;
        height: 100px;
      }

      /* Accessibility improvements */
      .expand-button:focus-visible {
        outline: 2px solid #ffffff;
        outline-offset: 2px;
      }

      /* Animation for smooth appearance */
      .collapsed-content {
        animation: fadeIn 0.2s ease-out;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      /* Responsive adjustments */
      @media (max-width: 250px) {
        .expand-button {
          padding: 10px 16px;
          font-size: 12px;
          min-width: 120px;
        }
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .expand-button {
          border: 2px solid #ffffff;
        }
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .expand-button {
          transition: none;
        }
        
        .expand-button:hover,
        .expand-button.hover {
          transform: none;
        }
        
        .collapsed-content {
          animation: none;
        }
      }
    `;
    
    if (!document.head.querySelector('style[data-collapsed-view]')) {
      style.setAttribute('data-collapsed-view', 'true');
      document.head.appendChild(style);
    }
  }

  public focus(): void {
    const button = this.container.querySelector('#expand-button') as HTMLButtonElement;
    button?.focus();
  }

  public destroy(): void {
    // Clean up event listeners and styles if needed
    const style = document.head.querySelector('style[data-collapsed-view]');
    if (style) {
      style.remove();
    }
  }
}