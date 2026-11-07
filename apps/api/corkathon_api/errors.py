class AppError(Exception):
    """`code` is the stable contract with the web client, `message` is shown to people"""

    def __init__(
        self, code: str, message: str, status: int, fields: list[str] | None = None
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields
