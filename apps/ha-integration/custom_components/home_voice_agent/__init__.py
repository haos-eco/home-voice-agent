from __future__ import annotations

import json
import logging
from typing import Any

from aiohttp import (
    ClientError,
    ClientTimeout,
)
import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigType
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.aiohttp_client import (
    async_get_clientsession,
)

from .const import (
    CONF_BACKEND_URL,
    CONF_SHARED_SECRET,
    DOMAIN,
)

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = vol.Schema(
    {
        vol.Optional(DOMAIN): vol.Schema(
            {
                vol.Required(
                    CONF_BACKEND_URL
                ): cv.string,
                vol.Required(
                    CONF_SHARED_SECRET
                ): cv.string,
            }
        )
    },
    extra=vol.ALLOW_EXTRA,
)

_ALIAS_EVIDENCE = [
    "discovery",
    "successful_status",
    "successful_action",
    "explicit_learning",
    "explicit_correction",
]

_PREFERENCE_METRICS = [
    "temperature",
    "volume_level",
    "brightness_pct",
]

_PREFERENCE_EVIDENCE = [
    "implicit",
    "explicit",
    "correction",
]

_MEMORY_CATEGORIES = [
    "household_fact",
    "user_preference",
    "assistant_behavior",
]

_MEMORY_SCOPES = [
    "household",
    "user",
]


async def async_setup(
        hass: HomeAssistant,
        config: ConfigType,
) -> bool:
    """Set up Home Voice Agent."""

    integration_config = config.get(DOMAIN)

    if integration_config is None:
        _LOGGER.error(
            "Home Voice Agent configuration is missing"
        )
        return False

    hass.data[DOMAIN] = {
        CONF_BACKEND_URL: integration_config[
            CONF_BACKEND_URL
        ].rstrip("/"),
        CONF_SHARED_SECRET: integration_config[
            CONF_SHARED_SECRET
        ],
    }

    for command in (
            websocket_realtime_token,
            websocket_realtime_call,
            websocket_memory_context,
            websocket_memory_diagnostics,
            websocket_memory_alias_observe,
            websocket_memory_preference_observe,
            websocket_memory_remember,
            websocket_memory_recall,
            websocket_memory_forget,
            websocket_memory_catalog_reconcile,
            websocket_memory_import,
    ):
        websocket_api.async_register_command(
            hass,
            command,
        )

    return True


def _backend_headers(
        integration_config: dict[str, Any],
        connection: websocket_api.ActiveConnection,
) -> dict[str, str]:
    """Build headers for an authenticated backend request."""

    return {
        "X-Home-Voice-Secret":
            integration_config[
                CONF_SHARED_SECRET
            ],
        "X-Home-Assistant-User-ID":
            str(connection.user.id),
        "Accept": "application/json",
    }


async def _async_backend_request(
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict,
        *,
        method: str,
        path: str,
        expected_status: int = 200,
        json_body: dict[str, Any] | None = None,
        params: dict[str, str] | None = None,
) -> dict[str, Any] | None:
    """Call the internal voice backend and forward JSON errors."""

    integration_config = hass.data[DOMAIN]

    backend_url = (
            integration_config[CONF_BACKEND_URL]
            + path
    )

    headers = _backend_headers(
        integration_config,
        connection,
    )

    session = async_get_clientsession(hass)

    try:
        async with session.request(
                method,
                backend_url,
                headers=headers,
                json=json_body,
                params=params,
                timeout=ClientTimeout(total=15),
        ) as response:
            response_text = await response.text()

            try:
                decoded = (
                    json.loads(response_text)
                    if response_text
                    else {}
                )
            except json.JSONDecodeError:
                decoded = {
                    "error": "invalid_backend_response",
                    "message":
                        "Backend returned invalid JSON.",
                }

            if isinstance(decoded, dict):
                payload = decoded
            else:
                payload = {
                    "result": decoded,
                }

            if response.status != expected_status:
                _LOGGER.warning(
                    "Voice backend %s %s returned HTTP %s: %s",
                    method,
                    path,
                    response.status,
                    response_text,
                )

                connection.send_error(
                    msg["id"],
                    "voice_backend_error",
                    str(
                        payload.get(
                            "message",
                            "Voice backend request failed.",
                        )
                    ),
                )
                return None

    except (
            ClientError,
            TimeoutError,
    ) as error:
        _LOGGER.error(
            "Could not reach voice backend for %s %s: %s",
            method,
            path,
            error,
        )

        connection.send_error(
            msg["id"],
            "voice_backend_unavailable",
            "Could not reach the voice backend.",
        )
        return None

    return payload


@websocket_api.websocket_command(
    {
        vol.Required(
            "type"
        ): "home_voice_agent/realtime_token",
    }
)
@websocket_api.async_response
async def websocket_realtime_token(
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict,
) -> None:
    """Create an OpenAI Realtime credential."""

    payload = await _async_backend_request(
        hass,
        connection,
        msg,
        method="POST",
        path="/internal/realtime/token",
        expected_status=201,
        json_body={},
    )

    if payload is None:
        return

    connection.send_result(
        msg["id"],
        payload,
    )


@websocket_api.websocket_command(
    {
        vol.Required(
            "type"
        ): "home_voice_agent/realtime_call",
        vol.Required(
            "sdp"
        ): vol.All(
            cv.string,
            vol.Length(min=32, max=30000),
        ),
    }
)
@websocket_api.async_response
async def websocket_realtime_call(
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict,
) -> None:
    """Create an OpenAI Realtime WebRTC call from an SDP offer."""

    payload = await _async_backend_request(
        hass,
        connection,
        msg,
        method="POST",
        path="/internal/realtime/call",
        expected_status=201,
        json_body={
            "sdp": msg["sdp"],
        },
    )

    if payload is None:
        return

    connection.send_result(
        msg["id"],
        payload,
    )


@websocket_api.websocket_command(
    {
        vol.Required(
            "type"
        ): "home_voice_agent/memory_context",
        vol.Optional(
            "trusted_only",
            default=False,
        ): cv.boolean,
    }
)
@websocket_api.async_response
async def websocket_memory_context(
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict,
) -> None:
    """Return persistent assistant memory context."""

    params = None

    if msg["trusted_only"]:
        params = {
            "trusted_only": "1",
        }

    payload = await _async_backend_request(
        hass,
        connection,
        msg,
        method="GET",
        path="/internal/memory/context",
        params=params,
    )

    if payload is None:
        return

    connection.send_result(
        msg["id"],
        payload,
    )


@websocket_api.websocket_command(
    {
        vol.Required(
            "type"
        ): "home_voice_agent/memory_diagnostics",
    }
)
@websocket_api.async_response
async def websocket_memory_diagnostics(
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict,
) -> None:
    """Return backend memory diagnostics."""

    payload = await _async_backend_request(
        hass,
        connection,
        msg,
        method="GET",
        path="/internal/memory/diagnostics",
    )

    if payload is None:
        return

    connection.send_result(
        msg["id"],
        payload,
    )


@websocket_api.websocket_command(
    {
        vol.Required(
            "type"
        ): "home_voice_agent/memory_alias_observe",
        vol.Required(
            "phrase"
        ): cv.string,
        vol.Optional(
            "area_name",
            default=None,
        ): vol.Any(
            None,
            cv.string,
        ),
        vol.Optional(
            "domain",
            default=None,
        ): vol.Any(
            None,
            cv.string,
        ),
        vol.Required(
            "entity_id"
        ): cv.string,
        vol.Required(
            "evidence"
        ): vol.In(
            _ALIAS_EVIDENCE
        ),
        vol.Optional(
            "event_id"
        ): cv.string,
        vol.Optional(
            "source_device",
            default=None,
        ): vol.Any(
            None,
            cv.string,
        ),
        vol.Optional(
            "at"
        ): vol.Coerce(int),
    }
)
@websocket_api.async_response
async def websocket_memory_alias_observe(
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict,
) -> None:
    """Record an alias learning observation."""

    body = {
        "phrase": msg["phrase"],
        "area_name": msg["area_name"],
        "domain": msg["domain"],
        "entity_id": msg["entity_id"],
        "evidence": msg["evidence"],
        "source_device": msg["source_device"],
    }

    if "event_id" in msg:
        body["event_id"] = msg["event_id"]

    if "at" in msg:
        body["at"] = msg["at"]

    payload = await _async_backend_request(
        hass,
        connection,
        msg,
        method="POST",
        path="/internal/memory/alias/observe",
        json_body=body,
    )

    if payload is None:
        return

    connection.send_result(
        msg["id"],
        payload,
    )


@websocket_api.websocket_command(
    {
        vol.Required(
            "type"
        ): "home_voice_agent/memory_preference_observe",
        vol.Required(
            "metric"
        ): vol.In(
            _PREFERENCE_METRICS
        ),
        vol.Optional(
            "area_name",
            default=None,
        ): vol.Any(
            None,
            cv.string,
        ),
        vol.Required(
            "entity_id"
        ): cv.string,
        vol.Required(
            "value"
        ): vol.Coerce(float),
        vol.Optional(
            "evidence",
            default="implicit",
        ): vol.In(
            _PREFERENCE_EVIDENCE
        ),
        vol.Optional(
            "event_id"
        ): cv.string,
        vol.Optional(
            "source_device",
            default=None,
        ): vol.Any(
            None,
            cv.string,
        ),
        vol.Optional(
            "at"
        ): vol.Coerce(int),
    }
)
@websocket_api.async_response
async def websocket_memory_preference_observe(
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict,
) -> None:
    """Record a numeric preference observation."""

    body = {
        "metric": msg["metric"],
        "area_name": msg["area_name"],
        "entity_id": msg["entity_id"],
        "value": msg["value"],
        "evidence": msg["evidence"],
        "source_device": msg["source_device"],
    }

    if "event_id" in msg:
        body["event_id"] = msg["event_id"]

    if "at" in msg:
        body["at"] = msg["at"]

    payload = await _async_backend_request(
        hass,
        connection,
        msg,
        method="POST",
        path="/internal/memory/preference/observe",
        json_body=body,
    )

    if payload is None:
        return

    connection.send_result(
        msg["id"],
        payload,
    )


@websocket_api.websocket_command(
    {
        vol.Required(
            "type"
        ): "home_voice_agent/memory_remember",
        vol.Required(
            "scope"
        ): vol.In(
            _MEMORY_SCOPES
        ),
        vol.Required(
            "category"
        ): vol.In(
            _MEMORY_CATEGORIES
        ),
        vol.Optional(
            "memory_key",
            default=None,
        ): vol.Any(
            None,
            cv.string,
        ),
        vol.Required(
            "content"
        ): cv.string,
        vol.Optional(
            "event_id"
        ): cv.string,
        vol.Optional(
            "source_device",
            default=None,
        ): vol.Any(
            None,
            cv.string,
        ),
        vol.Optional(
            "at"
        ): vol.Coerce(int),
    }
)
@websocket_api.async_response
async def websocket_memory_remember(
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict,
) -> None:
    """Persist an explicit durable assistant memory."""

    body = {
        "scope": msg["scope"],
        "category": msg["category"],
        "memory_key": msg["memory_key"],
        "content": msg["content"],
        "source": "explicit_user",
        "source_device": msg["source_device"],
    }

    if "event_id" in msg:
        body["event_id"] = msg["event_id"]

    if "at" in msg:
        body["at"] = msg["at"]

    payload = await _async_backend_request(
        hass,
        connection,
        msg,
        method="POST",
        path="/internal/memory/remember",
        json_body=body,
    )

    if payload is None:
        return

    connection.send_result(
        msg["id"],
        payload,
    )


@websocket_api.websocket_command(
    {
        vol.Required(
            "type"
        ): "home_voice_agent/memory_recall",
        vol.Required(
            "query"
        ): cv.string,
        vol.Optional(
            "categories",
            default=[],
        ): [
            vol.In(
                _MEMORY_CATEGORIES
            )
        ],
        vol.Optional(
            "limit",
            default=8,
        ): vol.All(
            vol.Coerce(int),
            vol.Range(min=1, max=20),
        ),
    }
)
@websocket_api.async_response
async def websocket_memory_recall(
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict,
) -> None:
    """Retrieve relevant durable assistant memories."""

    payload = await _async_backend_request(
        hass,
        connection,
        msg,
        method="POST",
        path="/internal/memory/recall",
        json_body={
            "query": msg["query"],
            "categories": msg["categories"],
            "limit": msg["limit"],
        },
    )

    if payload is None:
        return

    connection.send_result(
        msg["id"],
        payload,
    )


@websocket_api.websocket_command(
    {
        vol.Required(
            "type"
        ): "home_voice_agent/memory_forget",
        vol.Required(
            "memory_id"
        ): cv.string,
        vol.Optional(
            "event_id"
        ): cv.string,
        vol.Optional(
            "source_device",
            default=None,
        ): vol.Any(
            None,
            cv.string,
        ),
        vol.Optional(
            "at"
        ): vol.Coerce(int),
    }
)
@websocket_api.async_response
async def websocket_memory_forget(
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict,
) -> None:
    """Forget one durable assistant memory."""

    body = {
        "memory_id": msg["memory_id"],
        "source_device": msg["source_device"],
    }

    if "event_id" in msg:
        body["event_id"] = msg["event_id"]

    if "at" in msg:
        body["at"] = msg["at"]

    payload = await _async_backend_request(
        hass,
        connection,
        msg,
        method="POST",
        path="/internal/memory/forget",
        json_body=body,
    )

    if payload is None:
        return

    connection.send_result(
        msg["id"],
        payload,
    )


@websocket_api.websocket_command(
    {
        vol.Required(
            "type"
        ): "home_voice_agent/memory_catalog_reconcile",
        vol.Required(
            "entity_ids"
        ): [
            cv.string
        ],
        vol.Optional(
            "at"
        ): vol.Coerce(int),
    }
)
@websocket_api.async_response
async def websocket_memory_catalog_reconcile(
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict,
) -> None:
    """Reconcile learned memory with the HA entity catalog."""

    body: dict[str, Any] = {
        "entity_ids": msg["entity_ids"],
    }

    if "at" in msg:
        body["at"] = msg["at"]

    payload = await _async_backend_request(
        hass,
        connection,
        msg,
        method="POST",
        path="/internal/memory/catalog/reconcile",
        json_body=body,
    )

    if payload is None:
        return

    connection.send_result(
        msg["id"],
        payload,
    )


@websocket_api.websocket_command(
    {
        vol.Required(
            "type"
        ): "home_voice_agent/memory_import",
        vol.Optional(
            "aliases",
            default=[],
        ): [
            dict
        ],
        vol.Optional(
            "preferences",
            default=[],
        ): [
            dict
        ],
        vol.Optional(
            "source_device",
            default=None,
        ): vol.Any(
            None,
            cv.string,
        ),
    }
)
@websocket_api.async_response
async def websocket_memory_import(
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict,
) -> None:
    """Import a legacy frontend learning snapshot."""

    body = {
        "aliases": msg["aliases"],
        "preferences": msg["preferences"],
        "source_device": msg["source_device"],
    }

    payload = await _async_backend_request(
        hass,
        connection,
        msg,
        method="POST",
        path="/internal/memory/import",
        json_body=body,
    )

    if payload is None:
        return

    connection.send_result(
        msg["id"],
        payload,
    )