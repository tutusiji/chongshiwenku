from __future__ import annotations


def register_user(client, username: str, email: str) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": email,
            "password": "secret123",
            "nickname": username,
        },
    )
    assert response.status_code == 201


def login_user(client, account: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"account": account, "password": "secret123"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_group_crud_and_member_flow(client) -> None:
    register_user(client, "owner_user", "owner@example.com")
    register_user(client, "member_user", "member@example.com")

    owner_token = login_user(client, "owner_user")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    create_response = client.post(
        "/api/v1/groups",
        headers=owner_headers,
        json={
            "name": "考研组",
            "description": "考研资料沉淀",
            "visibility_mode": "password",
            "allow_member_invite": True,
            "password": "1234",
            "password_hint": "四位数",
        },
    )
    assert create_response.status_code == 201
    group_data = create_response.json()
    group_id = group_data["id"]
    assert group_data["member_count"] == 1
    assert group_data["password_enabled"] is True

    list_response = client.get("/api/v1/groups?scope=my", headers=owner_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()["items"]) == 1

    add_member_response = client.post(
        f"/api/v1/groups/{group_id}/members",
        headers=owner_headers,
        json={"username": "member_user", "role": "member"},
    )
    assert add_member_response.status_code == 201
    assert add_member_response.json()["user"]["username"] == "member_user"

    detail_response = client.get(f"/api/v1/groups/{group_id}", headers=owner_headers)
    assert detail_response.status_code == 200
    detail_data = detail_response.json()
    assert len(detail_data["members"]) == 2

    target_user_id = next(item["user"]["id"] for item in detail_data["members"] if item["user"]["username"] == "member_user")
    remove_member_response = client.delete(
        f"/api/v1/groups/{group_id}/members/{target_user_id}",
        headers=owner_headers,
    )
    assert remove_member_response.status_code == 204

    patch_response = client.patch(
        f"/api/v1/groups/{group_id}",
        headers=owner_headers,
        json={
            "name": "考研组-更新",
            "visibility_mode": "public",
            "specific_usernames": [],
        },
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["name"] == "考研组-更新"
    assert patch_response.json()["visibility_mode"] == "public"


def test_password_group_can_update_name_without_resubmitting_password(client) -> None:
    register_user(client, "password_owner", "password_owner@example.com")
    owner_token = login_user(client, "password_owner")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    create_response = client.post(
        "/api/v1/groups",
        headers=owner_headers,
        json={
            "name": "密码组",
            "visibility_mode": "password",
            "password": "abcd1234",
            "password_hint": "默认密码",
        },
    )
    assert create_response.status_code == 201
    group_id = create_response.json()["id"]

    update_response = client.patch(
        f"/api/v1/groups/{group_id}",
        headers=owner_headers,
        json={"name": "密码组-改名"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "密码组-改名"
    assert update_response.json()["password_enabled"] is True


def test_specific_user_group_can_update_description_without_resubmitting_acl(client) -> None:
    register_user(client, "specific_owner", "specific_owner@example.com")
    register_user(client, "specific_viewer", "specific_viewer@example.com")
    register_user(client, "specific_other", "specific_other@example.com")

    owner_token = login_user(client, "specific_owner")
    viewer_token = login_user(client, "specific_viewer")
    other_token = login_user(client, "specific_other")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}
    other_headers = {"Authorization": f"Bearer {other_token}"}

    create_response = client.post(
        "/api/v1/groups",
        headers=owner_headers,
        json={
            "name": "指定用户组",
            "visibility_mode": "specific_users",
            "specific_usernames": ["specific_viewer"],
        },
    )
    assert create_response.status_code == 201
    group_id = create_response.json()["id"]

    update_response = client.patch(
        f"/api/v1/groups/{group_id}",
        headers=owner_headers,
        json={"description": "更新后的简介"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["description"] == "更新后的简介"
    assert update_response.json()["visibility_mode"] == "specific_users"

    viewer_detail_response = client.get(f"/api/v1/groups/{group_id}", headers=viewer_headers)
    assert viewer_detail_response.status_code == 200

    other_detail_response = client.get(f"/api/v1/groups/{group_id}", headers=other_headers)
    assert other_detail_response.status_code == 403
