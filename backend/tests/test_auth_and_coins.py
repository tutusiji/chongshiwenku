from __future__ import annotations


def test_register_login_and_checkin_flow(client) -> None:
    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "username": "alice",
            "email": "alice@example.com",
            "password": "secret123",
            "nickname": "Alice",
        },
    )
    assert register_response.status_code == 201
    register_data = register_response.json()
    assert register_data["coin_account"]["balance"] == 100

    login_response = client.post(
        "/api/v1/auth/login",
        json={"account": "alice", "password": "secret123"},
    )
    assert login_response.status_code == 200
    login_data = login_response.json()
    token = login_data["access_token"]
    assert login_data["coin_account"]["balance"] == 100

    headers = {"Authorization": f"Bearer {token}"}

    me_response = client.get("/api/v1/me", headers=headers)
    assert me_response.status_code == 200
    assert me_response.json()["user"]["username"] == "alice"

    checkin_response = client.post("/api/v1/me/checkins", headers=headers)
    assert checkin_response.status_code == 200
    checkin_data = checkin_response.json()
    assert checkin_data["reward_coins"] == 2
    assert checkin_data["balance"] == 102

    second_checkin_response = client.post("/api/v1/me/checkins", headers=headers)
    assert second_checkin_response.status_code == 400

    coin_account_response = client.get("/api/v1/me/coins", headers=headers)
    assert coin_account_response.status_code == 200
    assert coin_account_response.json()["balance"] == 102

    ledger_response = client.get("/api/v1/me/coin-ledgers", headers=headers)
    assert ledger_response.status_code == 200
    ledger_items = ledger_response.json()["items"]
    assert len(ledger_items) == 2
