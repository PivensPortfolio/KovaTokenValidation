// View State Management Types and Interfaces

export type ViewType = 'form' | 'results' | 'collapsed';

export interface DesignSystemInfo {
  id: string;
  name: string;
  type: 'local-variables' | 'library-variables' | 'local-styles';
  key: string;
  source: 'Local' | 'Library';
  libraryName?: string;
  collectionName?: string;
  assetsCount?: number;
}

export interface ValidationIssue {
  nodeId: string;
  nodeName: string;
  type: 'spacing' | 'corner-radius' | 'font-size' | 'font-color';
  issue: string;
  suggestion: string;
  severity: 'warning' | 'error';
}

export interface FormData {
  selectedDesignSystem: string | null;
  validationOptions: string[];
  attachedSystemInfo: DesignSystemInfo | null;
  availableLibraries?: DesignSystemInfo[];
}

export interface ResultsData {
  issues: ValidationIssue[];
  totalNodes: number;
  scope: string;
  timestamp: Date;
}

export interface ViewState {
  currentView: ViewType;
  formData: FormData;
  resultsData: ResultsData | null;
  previousView: ViewType | null;
}

export interface ViewTransition {
  from: ViewType;
  to: ViewType;
  animation: 'slide' | 'fade' | 'resize';
  duration: number;
  preserveData: boolean;
}

export interface ViewTransitionOptions {
  animation?: 'slide' | 'fade' | 'resize';
  duration?: number;
  preserveData?: boolean;
  data?: any;
}