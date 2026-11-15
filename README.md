# guestbook-backend
방명록 API

## 실행

Node.js 20 이상. 외부 패키지는 없습니다.

```bash
npm start
npm test
```

- 기본 포트: `5050` (`PORT`)
- CORS: `http://localhost:5173` (`CORS_ORIGIN`)
- 저장소: `data/guestbook.json` (`DB_PATH`)

비밀번호는 `crypto.scrypt`로 해시해서 저장합니다. 이 환경은 Node 20이라 내장 `node:sqlite`와 native SQLite 모듈을 쓰지 않고 JSON 파일로 저장합니다.

## 디렉터리

```
src/            서버와 라우팅
src/services/   글 저장·조회
src/utils/      검증, 해시, HTTP 헬퍼
tests/          API 테스트
```

## 공통

- Base URL: `http://localhost:5050` (`PORT` 환경변수로 변경 가능)
- CORS: 프론트엔드 `http://localhost:5173`(Vite) 허용 (`CORS_ORIGIN` 환경변수로 변경 가능)
- 요청/응답 본문: `application/json; charset=utf-8`
- 시간: ISO 8601 UTC (`2026-11-14T07:20:00.000Z`)
- 회원 기능 없음. 글마다 비밀번호를 걸고, 수정·삭제 시 그 비밀번호로 확인합니다.
- 비밀번호는 해시로만 저장되며 어떤 응답에도 포함되지 않습니다.

### Entry 객체

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | integer | 글 번호 |
| `name` | string | 작성자 이름 |
| `message` | string | 내용 |
| `createdAt` | string | 작성 시각 |
| `updatedAt` | string \| null | 마지막 수정 시각 (수정 전에는 `null`) |

### 입력 제한

| 필드 | 규칙 |
|---|---|
| `name` | 앞뒤 공백 제거 후 1–20자 |
| `message` | 앞뒤 공백 제거 후 1–500자 |
| `password` | 4–20자 |

### 에러 응답

```json
{ "error": "message는 1~500자여야 합니다." }
```

| 상태 | 의미 |
|---|---|
| `400` | 입력값 오류 / 잘못된 JSON |
| `403` | 비밀번호 불일치 |
| `404` | 글 없음 / 경로 없음 |
| `500` | 서버 오류 |

---

## 목록 조회

`GET /entries?page=1&limit=20`

| 쿼리 | 기본값 | 설명 |
|---|---|---|
| `page` | `1` | 1 이상 |
| `limit` | `20` | 1–100 |

최신 글부터 반환합니다.

**200**
```json
{
  "items": [
    { "id": 2, "name": "철수", "message": "안녕하세요!", "createdAt": "2026-11-14T07:20:00.000Z", "updatedAt": null }
  ],
  "page": 1,
  "limit": 20,
  "total": 2
}
```

## 작성

`POST /entries`

```json
{ "name": "철수", "message": "안녕하세요!", "password": "1234" }
```

**201** — 생성된 Entry 객체

## 수정

`PATCH /entries/:id`

```json
{ "password": "1234", "message": "수정된 내용" }
```

`name`, `message` 중 바꿀 것만 보냅니다 (최소 하나 필요).

**200** — 수정된 Entry 객체 · **403** 비밀번호 불일치 · **404** 글 없음

## 삭제

`DELETE /entries/:id`

```json
{ "password": "1234" }
```

**204** — 본문 없음 · **403** 비밀번호 불일치 · **404** 글 없음

---

## 예시 (curl)

```bash
curl localhost:5050/entries
curl -X POST localhost:5050/entries -H "Content-Type: application/json" \
  -d '{"name":"철수","message":"안녕하세요!","password":"1234"}'
curl -X PATCH localhost:5050/entries/1 -H "Content-Type: application/json" \
  -d '{"password":"1234","message":"수정된 내용"}'
curl -X DELETE localhost:5050/entries/1 -H "Content-Type: application/json" \
  -d '{"password":"1234"}'
```
