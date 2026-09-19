from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..audit import verify_chain
from ..database import get_db
from ..dependencies import require_roles
from ..models import Role, User


router = APIRouter(prefix="/audit", tags=["audit integrity"])


@router.get("/integrity")
def audit_integrity(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.MINISTRY, Role.AUDITOR)),
) -> dict[str, int | bool | str]:
    result = verify_chain(db)
    result["assurance"] = "Tamper-evident application ledger; anchor periodic hashes outside the primary database for stronger assurance."
    return result
