import pytest

from app import QUOTES, create_app


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_quotes_dataset_has_100_well_formed_quotes():
    assert len(QUOTES) == 100
    ids = set()
    for quote in QUOTES:
        assert "id" in quote and isinstance(quote["id"], int)
        assert "text" in quote and isinstance(quote["text"], str) and len(quote["text"]) > 0
        assert "author" in quote and isinstance(quote["author"], str) and len(quote["author"]) > 0
        assert (
            "categories" in quote
            and isinstance(quote["categories"], list)
            and len(quote["categories"]) >= 1
        )
        ids.add(quote["id"])
    assert len(ids) == 100


def test_index_route(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert "default-src 'self'" in resp.headers.get("Content-Security-Policy", "")
    html = resp.get_data(as_text=True)
    assert "Quotes Explorer" in html
    assert "app.js" in html


def test_meta_endpoint(client):
    resp = client.get("/api/meta")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["total_quotes"] == 100
    assert len(data["authors"]) > 10
    assert len(data["categories"]) > 5


def test_random_quote_endpoint(client):
    resp = client.get("/api/quotes/random")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["matching_count"] == 100
    assert "id" in data["quote"]
    assert "text" in data["quote"]
    assert "author" in data["quote"]


def test_random_quote_filtered_and_exclude_id(client):
    resp = client.get("/api/quotes/random?author=Albert%20Einstein")
    assert resp.status_code == 200
    first = resp.get_json()
    assert first["quote"]["author"] == "Albert Einstein"
    assert first["matching_count"] >= 2

    exclude_id = first["quote"]["id"]
    resp2 = client.get(f"/api/quotes/random?author=Albert%20Einstein&exclude_id={exclude_id}")
    assert resp2.status_code == 200
    second = resp2.get_json()
    assert second["quote"]["author"] == "Albert Einstein"
    assert second["quote"]["id"] != exclude_id


def test_random_quote_not_found(client):
    resp = client.get("/api/quotes/random?author=NonExistentAuthorXYZ")
    assert resp.status_code == 404


def test_quotes_search_by_author_and_category(client):
    # Filter by author substring (case-insensitive)
    resp = client.get("/api/quotes?author=wilde")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["count"] > 0
    for q in data["quotes"]:
        assert "wilde" in q["author"].lower()

    # Filter by category
    resp_cat = client.get("/api/quotes?category=science")
    assert resp_cat.status_code == 200
    cat_data = resp_cat.get_json()
    assert cat_data["count"] > 0
    for q in cat_data["quotes"]:
        assert "science" in [c.lower() for c in q["categories"]]

    # Combined author + category filter
    resp_combined = client.get("/api/quotes?author=einstein&category=science")
    assert resp_combined.status_code == 200
    comb_data = resp_combined.get_json()
    assert comb_data["count"] >= 1
    for q in comb_data["quotes"]:
        assert "einstein" in q["author"].lower()
        assert "science" in [c.lower() for c in q["categories"]]
