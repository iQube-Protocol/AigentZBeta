/**
 * VideoErrorBoundary - Error Boundary for Video Components
 * 
 * Ported from Qriptopian Web App with SmartTriad integration
 * Catches and handles video player errors gracefully.
 */

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VideoErrorBoundaryProps {
  children: ReactNode;
  onClose: () => void;
}

interface VideoErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class VideoErrorBoundary extends Component<VideoErrorBoundaryProps, VideoErrorBoundaryState> {
  constructor(props: VideoErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): VideoErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('VideoErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
          <div className="h-full flex items-center justify-center p-8">
            <div className="max-w-md w-full text-center space-y-6">
              <div className="flex justify-center">
                <div className="p-3 rounded-full bg-red-500/20 ring-1 ring-red-500/30">
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-white">Video Error</h3>
                <p className="text-white/60">
                  There was an error loading the video. This could be due to network issues or an unsupported format.
                </p>
                {this.state.error && (
                  <p className="text-xs text-red-400 mt-2">
                    {this.state.error.message}
                  </p>
                )}
              </div>

              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  className="border-white/20 text-white/60 hover:text-white hover:bg-white/10"
                  onClick={() => {
                    this.setState({ hasError: false, error: undefined });
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
                
                <Button
                  variant="outline"
                  className="border-white/20 text-white/60 hover:text-white hover:bg-white/10"
                  onClick={this.props.onClose}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
