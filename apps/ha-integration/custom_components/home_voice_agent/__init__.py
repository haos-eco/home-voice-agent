"""Home Voice Agent integration."""

from __future__ import annotations

import json
import logging

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

    websocket_api.async_register_command(
        hass,
        websocket_realtime_token,
    )

    return True


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

    integration_config = hass.data[DOMAIN]

    backend_url = (
        integration_config[CONF_BACKEND_URL]
        + "/internal/realtime/token"
    )

    headers = {
        "X-Home-Voice-Secret":
            integration_config[
                CONF_SHARED_SECRET
            ],
        "X-Home-Assistant-User-ID":
            str(connection.user.id),
        "Accept": "application/json",
    }

    session = async_get_clientsession(hass)

    try:
        async with session.post(
            backend_url,
            headers=headers,
            json={},
            timeout=ClientTimeout(total=15),
        ) as response:
            response_text = await response.text()

            try:
                payload = json.loads(response_text)
            except json.JSONDecodeError:
                payload = {
                    "error": "invalid_backend_response",
                    "message":
                        "Backend returned invalid JSON.",
                }

            if response.status != 201:
                _LOGGER.warning(
                    "Voice backend returned HTTP %s: %s",
                    response.status,
                    response_text,
                )

                connection.send_error(
                    msg["id"],
                    "voice_backend_error",
                    payload.get(
                        "message",
                        "Voice backend request failed.",
                    ),
                )
                return

    except (
        ClientError,
        TimeoutError,
    ) as error:
        _LOGGER.error(
            "Could not reach voice backend: %s",
            error,
        )

        connection.send_error(
            msg["id"],
            "voice_backend_unavailable",
            "Could not reach the voice backend.",
        )
        return

    connection.send_result(
        msg["id"],
        payload,
    )
