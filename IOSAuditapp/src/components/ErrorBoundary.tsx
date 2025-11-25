import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // Log to console for debugging on Safari iOS
    if (window.console && window.console.error) {
      window.console.error("ErrorBoundary Error:", error);
      window.console.error("ErrorBoundary ErrorInfo:", errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "100vh",
            padding: "20px",
            backgroundColor: "#f5f5f5",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: "500px",
              width: "100%",
              backgroundColor: "#fff",
              borderRadius: "8px",
              padding: "30px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
          >
            <h1
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                marginBottom: "16px",
                color: "#d32f2f",
              }}
            >
              Đã xảy ra lỗi
            </h1>
            <p
              style={{ marginBottom: "20px", color: "#666", lineHeight: "1.6" }}
            >
              Ứng dụng gặp sự cố không mong muốn. Vui lòng thử tải lại trang.
            </p>
            {this.state.error && (
              <details
                style={{
                  marginBottom: "20px",
                  padding: "12px",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontFamily: "monospace",
                }}
              >
                <summary style={{ cursor: "pointer", marginBottom: "8px" }}>
                  Chi tiết lỗi (dành cho nhà phát triển)
                </summary>
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    color: "#d32f2f",
                  }}
                >
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReload}
              style={{
                width: "100%",
                padding: "12px 24px",
                backgroundColor: "#0138C3",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontSize: "16px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
