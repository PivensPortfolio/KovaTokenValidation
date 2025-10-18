// Basic DOM types for Figma plugin UI
declare global {
  interface NodeList<T> {
    forEach(callback: (value: T, index: number) => void): void;
  }

  interface HTMLElement {
    querySelector(selector: string): HTMLElement | null;
    querySelectorAll(selector: string): NodeList<HTMLElement>;
    addEventListener(type: string, listener: (event: any) => void): void;
    contains(node: Node | null): boolean;
    closest(selector: string): HTMLElement | null;
    dataset: { [key: string]: string | undefined };
    textContent: string | null;
    innerHTML: string;
    style: { [key: string]: string };
    classList: {
      add(className: string): void;
      remove(className: string): void;
      toggle(className: string, force?: boolean): void;
      contains(className: string): boolean;
    };
    appendChild(child: HTMLElement): void;
    previousElementSibling: HTMLElement | null;
    className: string;
    id: string;
    title: string;
    setAttribute(name: string, value: string): void;
    remove(): void;
    focus(): void;
    insertBefore(newNode: HTMLElement, referenceNode: HTMLElement | null): void;
    firstChild: HTMLElement | null;
  }

  interface HTMLButtonElement extends HTMLElement {
    disabled: boolean;
  }

  interface Node {
    // Basic node interface
  }

  interface Document {
    createElement(tagName: string): HTMLElement;
    addEventListener(type: string, listener: (event: any) => void): void;
    head: HTMLElement;
  }

  var document: Document;
  var parent: {
    postMessage(message: any, targetOrigin?: string): void;
  };
}

export {};