from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

CompanyNumber = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\d{1,10}$")]


class ClientBody(BaseModel):
    company_num: CompanyNumber


class ClientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    company_num: str
    added_at: datetime
