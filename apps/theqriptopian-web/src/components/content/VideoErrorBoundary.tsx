/**
 * VideoErrorBoundary - Prevents video errors from breaking the entire Codex
 */

import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  onClose: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class VideoErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[VideoErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onClose();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-8 max-w-md mx-4 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            
            <h2 className="text-xl font-bold text-white mb-2">Video Playback Error</h2>
            <p className="text-white/60 mb-6">
              {this.state.error?.message || 'The video could not be loaded. This may be due to encryption issues or network problems.'}
            </p>
            
            <button
              onClick={this.handleReset}
              className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Close and Return to Codex
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
