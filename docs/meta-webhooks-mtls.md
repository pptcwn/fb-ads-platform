# Meta Webhooks + mTLS (2026)

Meta requires [mutual TLS](https://developers.facebook.com/docs/graph-api/webhooks/getting-started) for webhook callbacks on production apps.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/webhooks/meta` | Subscription verification (`hub.challenge`) |
| POST | `/api/webhooks/meta` | Event delivery |

## Environment

```env
META_WEBHOOK_VERIFY_TOKEN=your-random-verify-token
META_WEBHOOK_MTLS_REQUIRED=true
META_CA_BUNDLE_PATH=/path/to/meta-ca-bundle.pem
FB_APP_SECRET=...  # for X-Hub-Signature-256
```

## Reverse proxy (recommended)

Terminate mTLS at nginx/Caddy and forward to API:

```nginx
ssl_verify_client on;
ssl_client_certificate /etc/ssl/meta/ca-bundle.pem;
proxy_set_header X-SSL-Client-Verify $ssl_client_verify;
```

Set `META_WEBHOOK_MTLS_REQUIRED=true` so the API rejects requests without a verified client cert (or `X-SSL-Client-Verify: SUCCESS`).

## App Dashboard

1. Webhooks → Add subscription → Callback URL: `https://your-domain/api/webhooks/meta`
2. Verify token = `META_WEBHOOK_VERIFY_TOKEN`
3. Subscribe to `ads_management` / account fields as needed