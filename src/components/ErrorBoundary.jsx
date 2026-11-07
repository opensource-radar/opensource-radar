import { Component } from "react";

// Catches rendering errors below it, so one broken part of the page shows a
// fallback instead of blanking the whole site. `fallback` is a node, or a
// function that receives { retry } to try rendering the children again.
class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  retry = () => {
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) return this.props.children;

    const { fallback = null } = this.props;
    return typeof fallback === "function"
      ? fallback({ retry: this.retry })
      : fallback;
  }
}

export default ErrorBoundary;
