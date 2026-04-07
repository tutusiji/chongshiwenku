from fastapi import APIRouter

from app.api.v1.endpoints.admin import router as admin_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.documents import router as documents_router
from app.api.v1.endpoints.groups import router as groups_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.me import router as me_router

router = APIRouter()
router.include_router(admin_router, prefix="/admin", tags=["admin"])
router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(documents_router, prefix="/documents", tags=["documents"])
router.include_router(groups_router, prefix="/groups", tags=["groups"])
router.include_router(health_router, prefix="/health", tags=["health"])
router.include_router(me_router, prefix="/me", tags=["me"])
