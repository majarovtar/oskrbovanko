from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def service_info() -> dict:
    return {"name": "MojOdpust"}
