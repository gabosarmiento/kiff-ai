from __future__ import annotations
from typing import Optional, Dict
from dataclasses import dataclass


@dataclass
class User:
    email: str
    password: str  # plain for mock only
    role: str  # "admin" | "user"


# In-memory user store (mock only)
_USERS: Dict[str, User] = {
    "bob@kiff.dev": User(email="bob@kiff.dev", password="bob12345", role="admin"),
    "demo@kiff.dev": User(email="demo@kiff.dev", password="demo12345", role="user"),
}


def get_user(email: str) -> Optional[User]:
    return _USERS.get(email.lower())


def create_user(email: str, password: str, role: str = "user") -> User:
    key = email.lower()
    if key in _USERS:
        return _USERS[key]
    user = User(email=key, password=password, role=role)
    _USERS[key] = user
    return user
