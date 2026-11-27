# Security handoff: Information Assurance and Security 1 final

For the Group 4 teammate writing the security paper and preparing the demo. Every claim below was checked against the code on branch `feat/real-login` (2026-11-22). File paths are relative to the repo root, so you can open each one and see the control for yourself.

The guidelines ask the paper to **separate what is built from what is only proposed**, and the presentation must match the paper. Section 4 is built and can be shown live. Section 5 is not built: write it as "proposed".

The risk levels and wording below are suggestions to start from. The rubric grades your own analysis, so adjust them and write them in your own words.

---

## 1. The system in one paragraph

FreshOps (repo `dyna-fefo`) is a decision-support dashboard for perishable food in cold storage. Temperature and humidity sensors in each chiller send readings; the backend estimates each batch's remaining shelf life from the temperatures it actually went through (Q10 model) instead of trusting the printed expiry date, and a Markov Decision Process recommends **Dispatch first** or **Salvage**. A human supervisor approves or rejects every recommendation; floor staff then confirm the work was done. Sensors are simulated (no physical ESP32), using the same message format a real device would send.

**Users and roles**
| Role | Can do | Cannot do |
|---|---|---|
| `supervisor` | See everything; approve/reject recommendations; add, edit, delete batches and sensors | Confirm floor tasks (staff only) |
| `staff` | See the dashboard; confirm "Shipment done / Salvage done" or flag "Not found / Looks spoiled" | Approve, reject, or change any record (403) |
| Sensor device | Send readings for its own chiller only | Anything else |

**Technologies:** FastAPI (Python 3.12) REST API, PostgreSQL 16 + TimescaleDB, Mosquitto MQTT broker, Next.js/React dashboard, Docker Compose. Runs fully offline on one laptop.

**Information stored:** user accounts (username, argon2 password hash, role); device records (ID, chiller, SHA-256 hash of the device key); batches (code, product, chiller, received time, printed expiry, quantity); telemetry readings (device, chiller, timestamp, temperature, humidity); computed shelf-life state; recommendations and decisions (who decided, when, note); the audit log. No customer personal data, no payment data.

**Main components:** `api` (FastAPI), `worker` (MQTT subscriber + scheduled shelf-life recompute), `mqtt` (Mosquitto), `db` (Postgres), `simulator`, `simulator-b`, `simulator-c` (one per chiller), `frontend` (dashboard).

---

## 2. Why security matters here (CIA triad)

- **Integrity is the most important.** A fake or altered temperature changes the shelf-life estimate. Too-cold fake data hides heat damage, so spoiled chicken could be dispatched and sold (a food-safety problem). Too-hot fake data makes good stock get thrown away (a money problem). An unauthorized approval does the same.
- **Confidentiality** matters less (no personal or payment data), but credentials, device keys and the token signing secret must stay secret, because they protect integrity. Stock levels and losses are also business-sensitive.
- **Availability:** if sensors, the broker or the database stop, nobody sees a chiller warming up in time. The system must keep working without internet (venue Wi-Fi is not trusted).

---

## 3. Information assets

| Asset | Where | Why protect it |
|---|---|---|
| User passwords | `users.password_hash` (argon2) | Whoever has the supervisor password can approve dispatch/salvage |
| Token signing secret | `JWT_SECRET` env | Anyone with it can forge a sign-in token for any user |
| Device keys | `devices.api_key_hash` (SHA-256); MQTT password file | Whoever has a key can send readings as that sensor |
| Telemetry readings | `telemetry` table | All shelf-life estimates and recommendations come from them |
| Batches and recommendations | `batches`, `recommendations` | The decisions themselves |
| Audit log | `audit_log` table, "Change history" tab | Accountability: who did what, when; failed sign-ins |
| Database volume | Docker volume `dbdata` | Everything above; `docker compose down -v` deletes it |
| Configuration | `.env` (not committed; see `.gitignore`), `docker-compose.yml` | Holds the secrets above |

---

## 4. Security measures already implemented (can be shown live)

| # | Measure | Where in the code | What it protects |
|---|---|---|---|
| 1 | **Password sign-in with argon2 hashing.** Passwords are never stored in plain text; argon2 won the Password Hashing Competition and is recommended by OWASP | `backend/app/core/security.py` (`hash_password`, `verify_password`); `backend/app/db/seed.py` | Credentials, even if the database leaks |
| 2 | **Signed session tokens (JWT, HS256), 8-hour expiry.** Every request must carry `Authorization: Bearer <token>`; missing, expired or tampered tokens get 401 | `security.py` (`create_token`, `username_from_token`); `backend/app/core/deps.py` (`get_current_user`) | Authentication on every API call |
| 3 | **Role-based access control,** enforced on the server, not only by hiding buttons. The role is re-read from the database on every request | `deps.py` (`require_role`); used in `api/v1/batches.py`, `devices.py`, `recommendations.py` | Only supervisors approve/edit; only staff confirm tasks |
| 4 | **Separation of duties.** The supervisor who approves an order cannot also mark it done; staff who do it cannot approve | `backend/app/api/v1/recommendations.py` (`decide` needs supervisor, `complete_task` needs staff) | Integrity of decisions |
| 5 | **Account lockout.** 5 wrong passwords within 15 minutes lock the account for 15 minutes (HTTP 423), even if the next password is right | `backend/app/services/auth.py` (`MAX_FAILS`, `WINDOW`) | Password guessing / brute force |
| 6 | **No username enumeration.** A wrong password and an unknown username get the same error and take the same time (dummy hash check) | `services/auth.py` (`_BAD`); `security.py` (`_DUMMY_HASH`) | Attackers can't learn which accounts exist |
| 7 | **Audit log.** Every create, edit, delete, approval, rejection, staff confirmation, flag, sign-in and failed sign-in is recorded with user and time; deleted records are soft-deleted, so history stays | `backend/app/services/audit.py`; "Change history" tab (filter "User" for sign-ins) | Accountability, detection |
| 8 | **Human in the loop.** Recommendations stay `pending` until a supervisor decides; nothing is applied automatically | `backend/app/services/recommendations.py` | Integrity; a wrong estimate can't act on its own |
| 9 | **MQTT broker authentication.** No anonymous clients; each sensor logs in with its device ID and device key, the worker as `ingest`. Passwords hashed by `mosquitto_passwd` at start-up | `infra/mosquitto/mosquitto.conf`, `infra/mosquitto/start.sh` | Fake sensors |
| 10 | **MQTT topic rules (ACL).** A sensor can only publish to its own topic `sensors/<id>/telemetry`, and read back only its own last reading (so a restarted simulator resumes its clock); only `ingest` can read every sensor's data | `infra/mosquitto/acl` | One sensor posing as another; other clients reading the data |
| 11 | **Topic vs. payload check.** A reading whose `device_id` doesn't match its topic is dropped and logged (`topic_mismatch`) | `backend/app/services/telemetry.py` (`handle_message`) | Spoofing inside an allowed topic |
| 12 | **Device keys for the HTTP fallback.** Keys are random (`secrets.token_urlsafe`), shown once, stored only as a SHA-256 hash, compared in constant time | `backend/app/services/devices.py`; `services/telemetry.py` (`hmac.compare_digest`) | Fake readings over HTTP |
| 13 | **Input validation.** Temperature must be -40 to 60 °C, humidity 0-100 %, timestamps time-zone aware; duplicates (same device + sequence) ignored; a sensor can't post for another chiller (`zone_mismatch`); a deleted sensor's readings are refused | `backend/app/schemas/telemetry.py`; `services/telemetry.py` | Garbage or replayed data |
| 14 | **CORS restricted** to the dashboard's own address (`http://localhost:3000`) | `backend/app/main.py`, `CORS_ORIGINS` | Other websites calling the API from a user's browser |
| 15 | **Secrets in environment variables,** not in code; `.env` is git-ignored | `.env.example`, `docker-compose.yml`, `.gitignore` | Leaking secrets through the repo |
| 16 | **Session ends with the tab.** The token is kept in `sessionStorage` (cleared when the tab closes) and removed on log out; a refused token sends the user back to sign-in | `frontend/src/api/client.ts`, `frontend/src/App.tsx` | A left-open session on a shared laptop |
| 17 | **Availability basics.** Runs fully offline; every service has a Docker health check or waits for one; worker and simulators restart automatically; the broker port is not exposed outside Docker | `docker-compose.yml` | Uptime without internet |

**Automated tests** prove most of these: `backend/tests/test_auth.py` (hashing, login, bad/expired/forged tokens, lockout, staff 403) and `backend/tests/test_telemetry.py` (bad device key, wrong chiller, topic mismatch). All 152 backend tests pass.

---

## 5. Gaps: write these as "proposed", not built

| Gap | Why it matters | Proposed fix |
|---|---|---|
| **No HTTPS/TLS** on the API, dashboard or MQTT | Passwords and tokens cross the network in plain text if the laptop is on a shared network | TLS on the API (reverse proxy such as Caddy/Nginx) and on Mosquitto (port 8883 with certificates) |
| **No multi-factor authentication** | A stolen supervisor password is enough | TOTP app codes for supervisors |
| **No backups** | `docker compose down -v` or a disk failure deletes everything | Scheduled `pg_dump` to another disk; test a restore |
| **Tokens can't be revoked early** | Log out clears the browser, but a copied token stays valid up to 8 h | Shorter tokens + refresh tokens, or a server-side deny list |
| **Token kept in `sessionStorage`** | A script injected into the page (XSS) could read it | HttpOnly, Secure, SameSite cookie + Content-Security-Policy header |
| **Dev default secrets** in `docker-compose.yml` / `.env.example` (demo passwords, JWT secret, device keys, DB password) | Anyone who reads the repo knows them if they are not changed | Set real values in `.env` before any shared deployment; a secrets manager later |
| **Lockout can be abused** | An attacker can keep the supervisor locked out (denial of service) | Lock per user + IP, CAPTCHA, or alert the admin |
| **No general rate limiting** | Only sign-in is protected; other endpoints can be flooded | Rate limiting middleware or at the reverse proxy |
| **No account management** | Only the two seeded demo accounts; no password change or reset | Admin screen for users, password policy, forced change on first sign-in |
| **Audit log is not tamper-evident** | A database admin could edit it | Append-only table permissions, or hash-chain the rows |
| **Future-timestamp check is off** in the demo (`SIM_MODE=true`, needed to speed up simulated time) | A device could send readings dated in the future | Turn `SIM_MODE` off outside demos |
| **New sensors need a broker restart** to get an MQTT login; a deleted sensor can still log in to the broker until restart (its readings are refused by the backend) | Operational gap | Mosquitto dynamic security plugin |
| **No dependency scanning** | Vulnerable libraries go unnoticed | `pip-audit` and `npm audit` in CI |

---

## 6. Threats to analyze (pick at least 3)

These are specific to this system. Suggested likelihood/impact; adjust with your own reasoning.

| Threat | How it could happen here | Impact | Current controls | Suggested risk |
|---|---|---|---|---|
| **Fake or spoofed sensor readings** | A device on the network publishes cold readings for a chiller that is actually warm | Spoiled chicken dispatched and sold: food-safety harm | #9-#13 (MQTT login, ACL, topic check, device keys, validation) | Likelihood low (now) / Impact high → **Medium** |
| **Supervisor password guessing or theft** | Guessing, shoulder-surfing, a reused password | Unauthorized approvals and record changes | #1, #5, #6, #7 | Likelihood medium (no MFA, default demo passwords) / Impact high → **High** until passwords are changed and MFA added |
| **Network eavesdropping** | Laptop on venue Wi-Fi; no HTTPS | Password or token captured, then reused | #2 expiry only; broker port not exposed | Likelihood medium / Impact high → **High** |
| **Data loss** | Disk failure, accidental `down -v` | All history and audit trail gone | None (no backups) | Likelihood medium / Impact high → **High** |
| **Insider misuse** | Staff mark a task done that wasn't; supervisor approves wrongly | Wrong stock moves, unaccountable losses | #3, #4, #7, #8 | Likelihood low / Impact medium → **Low-Medium** |
| **Lockout abuse (denial of service)** | Someone types wrong passwords for `demo-supervisor` on purpose | Supervisor can't approve for 15 minutes | Lock is short; audit shows it | Likelihood low / Impact medium → **Low** |

The guidelines also ask "what should be done if it occurs". Examples: spoofing → delete the device in the Sensors tab (the backend then refuses its readings), review Change history, re-check the affected batches; stolen password → change it and restart with a new `JWT_SECRET`, which invalidates every token.

## 7. Recommendations (need at least 5; the order is a suggestion)

1. Enable HTTPS/TLS for the API, dashboard and MQTT.
2. Add MFA for supervisor accounts.
3. Change every default secret before deployment (`.env`), and remove dev defaults.
4. Automated daily database backups with a tested restore.
5. Short-lived tokens in HttpOnly cookies, with a Content-Security-Policy.
6. Rate limiting on all endpoints.
7. Make the audit log append-only / tamper-evident.
8. Account management with a password policy.
9. Dependency vulnerability scanning.

---

## 8. Running it and the demo (15 minutes)

```bash
git clone https://github.com/JD-Code05/dyna-fefo.git
cd dyna-fefo
git switch feat/real-login            # until it is merged into main
docker compose --profile ui down -v   # fresh demo data (deletes old data!)
docker compose --profile ui up -d --build
```
Open http://localhost:3000 → Sign in. Accounts: `demo-supervisor` and `demo-staff`; their passwords are in `.env.example` (`DEMO_SUPERVISOR_PASSWORD`, `DEMO_STAFF_PASSWORD`). API docs with an **Authorize** button: http://localhost:8000/docs.

**Suggested live demo (each step matches a row in section 4):**
1. Sign in as supervisor with a **wrong** password → "Wrong username or password" (#1, #6).
2. Sign in correctly → supervisor dashboard (#2).
3. **Change history** → filter **User** → the failed and successful sign-ins (#7).
4. Approve a Dispatch; log out; sign in as **staff** → the order is on the pull list; staff has no approve buttons and the API refuses them with 403 (#3, #4, #8).
5. The API refuses requests without a token: open http://localhost:8000/api/v1/batches in the browser → `not_authenticated` (#2).
6. A fake sensor is refused (run from a terminal in the repo folder):
   ```bash
   docker compose exec mqtt mosquitto_pub -t sensors/esp32-chiller-01/telemetry -m "{}"
   # Connection Refused: not authorised   (#9)
   ```
7. Show `infra/mosquitto/acl` and explain the topic rule (#10).
8. **Last**, if wanted: lockout on `demo-staff` (5 wrong passwords → "Too many failed sign-ins", #5). That account then stays locked for 15 minutes, so do it at the end.

Reset with `down -v` shortly before presenting: the seeded Dispatch recommendations turn into Salvage about 5-6 hours after start-up.

## 9. References you can cite

- OWASP Foundation. *Password Storage Cheat Sheet* (argon2id recommendation). https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- Biryukov, A., Dinu, D., Khovratovich, D., & Josefsson, S. (2021). *RFC 9106: Argon2 memory-hard function for password hashing and proof-of-work applications.* IETF.
- Jones, M., Bradley, J., & Sakimura, N. (2015). *RFC 7519: JSON Web Token (JWT).* IETF.
- National Institute of Standards and Technology. (2017). *SP 800-63B: Digital identity guidelines: Authentication and lifecycle management* (limiting failed sign-ins, MFA).
- OWASP Foundation. (2021). *OWASP Top 10*: A01 Broken Access Control, A02 Cryptographic Failures, A07 Identification and Authentication Failures.
- Eclipse Foundation. *Mosquitto documentation: authentication methods* and `acl_file`. https://mosquitto.org/documentation/authentication-methods/
- Stallings, W., & Brown, L. (2018). *Computer security: Principles and practice* (4th ed.). Pearson (CIA triad, access control).
