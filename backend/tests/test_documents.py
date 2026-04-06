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


def test_document_upload_read_like_and_coin_flow(client) -> None:
    register_user(client, "doc_owner", "doc_owner@example.com")
    register_user(client, "doc_reader", "doc_reader@example.com")

    owner_token = login_user(client, "doc_owner")
    reader_token = login_user(client, "doc_reader")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    reader_headers = {"Authorization": f"Bearer {reader_token}"}

    upload_response = client.post(
        "/api/v1/documents",
        headers=owner_headers,
        data={
            "title": "高等数学笔记",
            "summary": "第一章极限与连续",
            "category": "考研",
            "visibility_mode": "public",
            "allow_download": "true",
        },
        files={"upload_file": ("notes.pdf", b"%PDF-1.4\nmock pdf data", "application/pdf")},
    )
    assert upload_response.status_code == 201
    upload_data = upload_response.json()
    document_id = upload_data["id"]
    assert upload_data["file_name"] == "notes.pdf"
    assert upload_data["preview_status"] in {"pending", "ready"}

    owner_coin_response = client.get("/api/v1/me/coins", headers=owner_headers)
    assert owner_coin_response.status_code == 200
    assert owner_coin_response.json()["balance"] == 110

    list_response = client.get("/api/v1/documents?scope=my", headers=owner_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()["items"]) == 1

    reader_detail_response = client.get(f"/api/v1/documents/{document_id}", headers=reader_headers)
    assert reader_detail_response.status_code == 200
    assert reader_detail_response.json()["title"] == "高等数学笔记"

    inline_read_response = client.get(f"/api/v1/documents/{document_id}/file?inline=true", headers=reader_headers)
    assert inline_read_response.status_code == 200
    assert inline_read_response.headers["content-type"] == "application/pdf"

    like_response = client.post(f"/api/v1/documents/{document_id}/likes", headers=reader_headers)
    assert like_response.status_code == 200
    assert like_response.json()["liked"] is True
    assert like_response.json()["like_count"] == 1

    coin_response = client.post(
        f"/api/v1/documents/{document_id}/coins",
        headers=reader_headers,
        json={"coin_amount": 5},
    )
    assert coin_response.status_code == 200
    assert coin_response.json()["my_balance"] == 95
    assert coin_response.json()["document_coin_count"] == 5

    download_response = client.get(f"/api/v1/documents/{document_id}/file", headers=reader_headers)
    assert download_response.status_code == 200

    updated_detail_response = client.get(f"/api/v1/documents/{document_id}", headers=reader_headers)
    assert updated_detail_response.status_code == 200
    updated_detail = updated_detail_response.json()
    assert updated_detail["read_count"] == 1
    assert updated_detail["like_count"] == 1
    assert updated_detail["coin_count"] == 5
    assert updated_detail["download_count"] == 1

    owner_coin_after_response = client.get("/api/v1/me/coins", headers=owner_headers)
    assert owner_coin_after_response.status_code == 200
    assert owner_coin_after_response.json()["balance"] == 115


def test_public_document_discover_and_anonymous_read_flow(client) -> None:
    register_user(client, "public_owner", "public_owner@example.com")
    owner_token = login_user(client, "public_owner")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    upload_response = client.post(
        "/api/v1/documents",
        headers=owner_headers,
        data={
            "title": "公开劳动法案例集",
            "summary": "适合首页公开展示",
            "category": "法律",
            "visibility_mode": "public",
            "allow_download": "true",
        },
        files={"upload_file": ("law.txt", b"public law content", "text/plain")},
    )
    assert upload_response.status_code == 201
    document_id = upload_response.json()["id"]

    discover_response = client.get("/api/v1/documents/discover?category=法律")
    assert discover_response.status_code == 200
    discover_items = discover_response.json()["items"]
    assert len(discover_items) == 1
    assert discover_items[0]["title"] == "公开劳动法案例集"
    assert discover_items[0]["my_liked"] is False

    anonymous_detail_response = client.get(f"/api/v1/documents/{document_id}")
    assert anonymous_detail_response.status_code == 200
    assert anonymous_detail_response.json()["title"] == "公开劳动法案例集"
    assert anonymous_detail_response.json()["preview_strategy"] == "text"
    assert anonymous_detail_response.json()["preview_text_available"] is True

    preview_text_response = client.get(f"/api/v1/documents/{document_id}/preview-text")
    assert preview_text_response.status_code == 200
    assert "public law content" in preview_text_response.text

    anonymous_read_response = client.get(f"/api/v1/documents/{document_id}/file?inline=true")
    assert anonymous_read_response.status_code == 200

    updated_detail_response = client.get(f"/api/v1/documents/{document_id}")
    assert updated_detail_response.status_code == 200
    assert updated_detail_response.json()["read_count"] == 2


def test_inline_preview_supports_non_ascii_file_names(client) -> None:
    register_user(client, "unicode_owner", "unicode_owner@example.com")
    owner_token = login_user(client, "unicode_owner")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    upload_response = client.post(
        "/api/v1/documents",
        headers=owner_headers,
        data={
            "title": "中文文件名预览",
            "summary": "验证中文文件名的页内预览头部编码",
            "category": "测试",
            "visibility_mode": "public",
            "allow_download": "true",
        },
        files={"upload_file": ("数学分析资料.pdf", b"%PDF-1.4\nmock pdf data", "application/octet-stream")},
    )
    assert upload_response.status_code == 201
    document_id = upload_response.json()["id"]

    detail_response = client.get(f"/api/v1/documents/{document_id}")
    assert detail_response.status_code == 200
    assert detail_response.json()["mime_type"] == "application/pdf"

    inline_read_response = client.get(f"/api/v1/documents/{document_id}/file?inline=true")
    assert inline_read_response.status_code == 200
    assert inline_read_response.headers["content-type"] == "application/pdf"
    assert inline_read_response.headers["content-disposition"].startswith("inline;")
    assert "filename*=" in inline_read_response.headers["content-disposition"]
