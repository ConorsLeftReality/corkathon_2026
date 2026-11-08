from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Email = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        to_lower=True,
        max_length=254,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
    ),
]


class RegisterBody(BaseModel):
    email: Email
    # the cap stops a huge password from tying up a thread in scrypt
    password: str = Field(min_length=8, max_length=128)
    # the token from the invite link, required unless invites are switched off
    invite: str | None = Field(default=None, max_length=128)


class LoginBody(BaseModel):
    email: Email
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
