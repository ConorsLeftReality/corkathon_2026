from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints


class NoteBody(BaseModel):
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    body: str
