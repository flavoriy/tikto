# Dashboard Service Data Ownership

`dashboard-service` does not own mutable tables. It composes a user dashboard by
calling `tasks-service` and `calendar-service` over their internal HTTP APIs.

If dashboard-specific read models are added later, create them here with a
dashboard-owned schema or database instead of reading task/event tables directly.
