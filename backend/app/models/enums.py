from enum import StrEnum


class UserStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    DISABLED = "disabled"
    BANNED = "banned"


class ResourceVisibility(StrEnum):
    PUBLIC = "public"
    PASSWORD = "password"
    OWNER_ONLY = "owner_only"
    GROUP_MEMBERS = "group_members"
    SPECIFIC_USERS = "specific_users"


class ResourceStatus(StrEnum):
    ACTIVE = "active"
    HIDDEN = "hidden"
    ARCHIVED = "archived"
    DELETED = "deleted"


class GroupRole(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class DocumentPreviewStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class DocumentAssetKind(StrEnum):
    ORIGINAL = "original"
    PREVIEW_PDF = "preview_pdf"
    COVER_IMAGE = "cover_image"
    THUMBNAIL = "thumbnail"
    EXTRACTED_TEXT = "extracted_text"


class ACLSubjectType(StrEnum):
    USER = "user"
    GROUP_ROLE = "group_role"


class ACLPermissionType(StrEnum):
    VIEW = "view"
    DOWNLOAD = "download"
    MANAGE = "manage"
