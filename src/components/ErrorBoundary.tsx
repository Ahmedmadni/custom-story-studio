import { Component, type ErrorInfo, type ReactNode } from "react";

import { ErrorBlock } from "@/components/ErrorBlock";
import { logError } from "@/lib/errors/errorLogger";

/**
 * حدود خطأ React قابلة لإعادة الاستخدام (Phase 4). تكمّل errorComponent
 * الخاص بـ TanStack Router (المُعرَّف في __root.tsx لأخطاء مستوى المسار)
 * بطبقة دفاع إضافية — ويمكن استخدامها لتطويق أقسام فرعية محدّدة (كلوحة
 * توليد الصور بالذكاء الاصطناعي في الأدمن) بحيث لا يُسقط خطأ فيها الصفحة
 * كاملة، بدل الاكتفاء بحدود واحدة على مستوى الجذر.
 */
interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError(error, { boundary: "react_error_boundary", componentStack: info.componentStack });
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorBlock
          title={this.props.fallbackTitle}
          message={this.props.fallbackMessage ?? this.state.error.message}
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}
