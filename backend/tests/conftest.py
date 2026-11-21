import os

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("ADMIN_API_KEY", "test-admin-key")
os.environ.setdefault("SERVICE_API_KEY", "test-service-key")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-long-enough-for-hs256-0123456789")
