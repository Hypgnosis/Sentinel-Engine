# Sentinel Sovereign Sidecar

The Sentinel Sidecar runtime is the proprietary Go kernel of Sentinel Engine v5.5.
It is **not distributed as source code**.

## Integration (Licensed Integrators)

Pull from the High-ArchyTech Solutions private registry:

```bash
docker pull registry.high-archytech.com/sentinel-sidecar:v5.5
```

## Interface Contract

The sidecar exposes its arbitration surface exclusively via Unix Domain Socket:
`/tmp/sentinel_sovereign.sock`

Refer to [`docs/integrator-guide.md`](../docs/integrator-guide.md) and
[`openapi.yaml`](../openapi.yaml) for the full API contract, request
envelope schema, and SLA guarantees.

## Licensing & Access

For enterprise licensing, OEM agreements, or NDA-gated technical access:
**enterprise@high-archytech.com**

> © High-ArchyTech Solutions. All rights reserved.
> The Sovereign Sidecar binary is protected intellectual property.
