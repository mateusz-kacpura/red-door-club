# ruff: noqa: I001 - Imports structured for Jinja2 template conditionals
"""
Seed database with sample data.

This command is useful for development and testing.
Uses random data generation - install faker for better data:
    uv add faker --group dev
"""

import asyncio
import secrets
import random
import string

import click

from sqlalchemy import delete, select


from app.commands import command, info, success, warning

# Try to import Faker for better data generation
try:
    from faker import Faker
    fake = Faker()
    HAS_FAKER = True
except ImportError:
    HAS_FAKER = False
    fake = None


def generate_password(length: int = 16) -> str:
    """Generate a secure random password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def random_email() -> str:
    """Generate a random email address."""
    if HAS_FAKER:
        return fake.email()
    random_str = ''.join(random.choices(string.ascii_lowercase, k=8))
    return f"{random_str}@example.com"


def random_name() -> str:
    """Generate a random full name."""
    if HAS_FAKER:
        return fake.name()
    first_names = ["John", "Jane", "Bob", "Alice", "Charlie", "Diana", "Eve", "Frank"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis"]
    return f"{random.choice(first_names)} {random.choice(last_names)}"


def random_title() -> str:
    """Generate a random item title."""
    if HAS_FAKER:
        return fake.sentence(nb_words=4).rstrip('.')
    adjectives = ["Amazing", "Great", "Awesome", "Fantastic", "Incredible", "Beautiful"]
    nouns = ["Widget", "Gadget", "Thing", "Product", "Item", "Object"]
    return f"{random.choice(adjectives)} {random.choice(nouns)}"


def random_description() -> str:
    """Generate a random description."""
    if HAS_FAKER:
        return fake.paragraph(nb_sentences=3)
    return "This is a sample description for development purposes."


# --- Predefined seed users ---
SEED_USERS = [
    {
        "email": "admin@club.s8lls.com",
        "full_name": "Admin Red Door",
        "role": "admin",
        "is_superuser": True,
        "tier": "platinum",
        "user_type": "member",
    },
    {
        "email": "manager@club.s8lls.com",
        "full_name": "Manager Red Door",
        "role": "admin",
        "is_superuser": False,
        "tier": "gold",
        "user_type": "member",
    },
    {
        "email": "member@club.s8lls.com",
        "full_name": "John Member",
        "role": "user",
        "is_superuser": False,
        "tier": "silver",
        "user_type": "member",
        "company_name": "Acme Corp",
        "industry": "Technology",
    },
    {
        "email": "prospect@club.s8lls.com",
        "full_name": "Jane Prospect",
        "role": "user",
        "is_superuser": False,
        "tier": None,
        "user_type": "prospect",
    },
    {
        "email": "vip@club.s8lls.com",
        "full_name": "VIP Guest",
        "role": "user",
        "is_superuser": False,
        "tier": "platinum",
        "user_type": "member",
        "loyalty_points": 5000,
        "loyalty_lifetime_points": 12000,
    },
    {
        "email": "promoter@club.s8lls.com",
        "full_name": "Pro Moter",
        "role": "user",
        "is_superuser": False,
        "tier": None,
        "user_type": "promoter",
        "is_promoter": True,
    },
]


def print_credentials_table(credentials: list[dict]) -> None:
    """Print a formatted table of credentials."""
    click.echo("")
    click.secho("=" * 90, fg="cyan")
    click.secho("  GENERATED CREDENTIALS — SAVE THESE!", fg="cyan", bold=True)
    click.secho("=" * 90, fg="cyan")
    click.echo("")

    header = f"  {'Role':<12} {'Email':<30} {'Password':<20} {'Superuser'}"
    click.secho(header, fg="white", bold=True)
    click.secho("  " + "-" * 86, fg="white")

    for cred in credentials:
        role_color = "red" if cred["role"] == "admin" else "green"
        su = "YES" if cred["is_superuser"] else "no"
        su_color = "red" if cred["is_superuser"] else "white"

        click.echo("  ", nl=False)
        click.secho(f"{cred['role']:<12}", fg=role_color, nl=False)
        click.echo(f" {cred['email']:<30}", nl=False)
        click.secho(f" {cred['password']:<20}", fg="yellow", bold=True, nl=False)
        click.secho(f" {su}", fg=su_color)

    click.echo("")
    click.secho("=" * 90, fg="cyan")
    click.echo("")


@command("seed", help="Seed database with sample data")
@click.option("--count", "-c", default=10, type=int, help="Number of random users to create")
@click.option("--clear", is_flag=True, help="Clear existing data before seeding")
@click.option("--dry-run", is_flag=True, help="Show what would be created without making changes")
@click.option("--users/--no-users", default=True, help="Seed users (default: True)")
@click.option("--items/--no-items", default=True, help="Seed items (default: True)")
def seed(
    count: int,
    clear: bool,
    dry_run: bool,
    users: bool,
    items: bool,
) -> None:
    """
    Seed the database with sample data for development.

    Creates predefined users (admin, manager, member, prospect, VIP)
    with generated passwords, plus optional random users.

    Example:
        project cmd seed                    # Seed all predefined + 10 random users
        project cmd seed --count 0          # Only predefined users
        project cmd seed --clear --count 50 # Clear and reseed
        project cmd seed --dry-run
    """
    if not HAS_FAKER:
        warning("Faker not installed. Using basic random data. For better data: uv add faker --group dev")

    if dry_run:
        info(f"[DRY RUN] Would create {len(SEED_USERS)} predefined + {count} random users")
        for u in SEED_USERS:
            info(f"  - {u['role']:<8} {u['email']:<30} superuser={u['is_superuser']}")
        if items:
            info(f"[DRY RUN] Would create {count} items")
        return

    from app.db.session import async_session_maker
    from app.db.models.user import User
    from app.core.security import get_password_hash
    from app.db.models.item import Item

    async def _seed():
        async with async_session_maker() as session:
            created_counts = {}
            credentials = []

            if users:
                if clear:
                    info("Clearing existing users (except superusers)...")
                    await session.execute(delete(User).where(User.is_superuser == False))  # noqa: E712
                    await session.commit()

                # --- Predefined users ---
                info(f"Creating {len(SEED_USERS)} predefined users...")
                for user_data in SEED_USERS:
                    result = await session.execute(
                        select(User).where(User.email == user_data["email"])
                    )
                    existing = result.scalars().first()
                    if existing:
                        warning(f"  Skipping {user_data['email']} (already exists)")
                        continue

                    password = generate_password()
                    user = User(
                        email=user_data["email"],
                        hashed_password=get_password_hash(password),
                        full_name=user_data["full_name"],
                        role=user_data["role"],
                        is_superuser=user_data["is_superuser"],
                        is_active=True,
                        tier=user_data.get("tier"),
                        user_type=user_data.get("user_type", "prospect"),
                        company_name=user_data.get("company_name"),
                        industry=user_data.get("industry"),
                        loyalty_points=user_data.get("loyalty_points", 0),
                        loyalty_lifetime_points=user_data.get("loyalty_lifetime_points", 0),
                        is_promoter=user_data.get("is_promoter", False),
                        pdpa_consent=True,
                    )
                    session.add(user)
                    credentials.append({
                        "email": user_data["email"],
                        "password": password,
                        "role": user_data["role"],
                        "is_superuser": user_data["is_superuser"],
                    })

                await session.commit()
                created_counts["predefined users"] = len(credentials)

                # --- Random users ---
                if count > 0:
                    info(f"Creating {count} random users...")
                    for _ in range(count):
                        password = generate_password()
                        email = random_email()
                        user = User(
                            email=email,
                            hashed_password=get_password_hash(password),
                            full_name=random_name(),
                            is_active=True,
                            is_superuser=False,
                            role="user",
                            user_type=random.choice(["member", "prospect"]),
                            tier=random.choice([None, "silver", "gold"]),
                        )
                        session.add(user)
                        credentials.append({
                            "email": email,
                            "password": password,
                            "role": "user",
                            "is_superuser": False,
                        })
                    await session.commit()
                    created_counts["random users"] = count

            if items:
                if clear:
                    info("Clearing existing items...")
                    await session.execute(delete(Item))
                    await session.commit()

                result = await session.execute(select(Item).limit(1))
                existing = result.scalars().first()

                if existing and not clear:
                    info("Items already exist. Use --clear to replace them.")
                else:
                    item_count = max(count, 5)
                    info(f"Creating {item_count} sample items...")
                    for _ in range(item_count):
                        item = Item(
                            title=random_title(),
                            description=random_description(),
                            is_active=random.choice([True, True, True, False]),
                        )
                        session.add(item)
                    await session.commit()
                    created_counts["items"] = item_count

            # Print results
            if credentials:
                print_credentials_table(credentials)

            if created_counts:
                summary = ", ".join(f"{v} {k}" for k, v in created_counts.items())
                success(f"Created: {summary}")
            else:
                info("No records created.")

    asyncio.run(_seed())
