from __future__ import annotations
import os
from typing import Optional

OTEL_ENABLED = os.getenv("OTEL_ENABLED", "false").lower() in ("1", "true", "yes")

# Lazy import to avoid mandatory dependency at startup
_tracer_provider = None
_tracer = None


def init_otel(app_name: str = "kiff-backend-lite-v2") -> None:
    global _tracer_provider, _tracer
    if not OTEL_ENABLED:
        return
    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.resources import Resource

        endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318")
        resource = Resource.create({"service.name": app_name})

        _tracer_provider = TracerProvider(resource=resource)
        span_exporter = OTLPSpanExporter(endpoint=f"{endpoint}/v1/traces")
        _tracer_provider.add_span_processor(BatchSpanProcessor(span_exporter))
        trace.set_tracer_provider(_tracer_provider)
        _tracer = trace.get_tracer(app_name)
    except Exception:
        # Swallow errors; observability should not block app startup
        _tracer_provider = None
        _tracer = None


def get_tracer(name: str = "observability"):
    if _tracer is None:
        class _NoopSpan:
            def set_attribute(self, *_args, **_kwargs):
                pass

        class _NoopCtx:
            def __enter__(self):
                return _NoopSpan()
            def __exit__(self, exc_type, exc, tb):
                return False

        class _Noop:
            def start_as_current_span(self, *_args, **_kwargs):
                return _NoopCtx()

        return _Noop()
    return _tracer
