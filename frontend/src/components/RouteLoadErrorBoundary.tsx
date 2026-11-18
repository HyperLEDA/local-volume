import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

// React.lazy can cache a rejected import. Reloading gets a fresh module graph;
// simply retrying the cached Promise is not sufficient after a chunk failure.
export class RouteLoadErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="catalog">
        <p role="alert" className="catalog-status catalog-status-error">
          This page could not be loaded.
        </p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </main>
    );
  }
}
