"use client";

import React from "react";
import { reportClientError } from "@/lib/observability";

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    reportClientError(error, "AppErrorBoundary");
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="auth-page">
          <section className="card auth-card">
            <h1>Something went wrong</h1>
            <p className="muted">Please refresh the page. The error has been logged for review.</p>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
