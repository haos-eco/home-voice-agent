from __future__ import annotations

import hmac
import json
import logging
import os
import time

from pyopen_wakeword import (
    Model,
    OpenWakeWord,
    OpenWakeWordFeatures,
)
from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosed


HOST = "0.0.0.0"
PORT = int(os.getenv("WAKE_PORT", "8788"))

SECRET = os.environ["WAKE_PROXY_SECRET"]

ALLOWED_ORIGIN = os.getenv(
    "WAKE_ALLOWED_ORIGIN",
    "https://ha.emmanuele.casa",
)

THRESHOLD = float(
    os.getenv("WAKE_THRESHOLD", "0.50")
)

COOLDOWN_SECONDS = float(
    os.getenv(
        "WAKE_COOLDOWN_SECONDS",
        "2.0",
    )
)

FRAME_SAMPLES = 1280
FRAME_BYTES = FRAME_SAMPLES * 2

logging.basicConfig(
    level=logging.INFO,
    format=(
        "%(asctime)s %(levelname)s "
        "[wake-word] %(message)s"
    ),
)

logger = logging.getLogger(
    "wake-word"
)


def authorized(websocket) -> bool:
    supplied = (
        websocket.request.headers.get(
            "X-Home-Voice-Secret",
            "",
        )
    )

    if not hmac.compare_digest(
            supplied,
            SECRET,
    ):
        return False

    origin = (
        websocket.request.headers.get(
            "Origin",
            "",
        )
    )

    return origin == ALLOWED_ORIGIN


def create_detector():
    features = (
        OpenWakeWordFeatures.from_builtin()
    )

    wake_word = (
        OpenWakeWord.from_builtin(
            Model.HEY_JARVIS
        )
    )

    return features, wake_word


async def handler(websocket) -> None:
    if not authorized(websocket):
        logger.warning(
            "Rejected unauthorized connection"
        )

        await websocket.close(
            code=4401,
            reason="Unauthorized",
        )
        return

    remote = websocket.remote_address

    logger.info(
        "Wake client connected: %s",
        remote,
    )

    features, wake_word = (
        create_detector()
    )

    metadata = {
        "room": "unknown",
        "device_id": "unknown",
    }

    last_activation = 0.0

    await websocket.send(
        json.dumps(
            {
                "type": "ready",
                "keyword": "hey_jarvis",
                "sample_rate": 16000,
                "frame_samples":
                    FRAME_SAMPLES,
            }
        )
    )

    try:
        async for message in websocket:
            if isinstance(
                    message,
                    str,
            ):
                try:
                    payload = json.loads(
                        message
                    )
                except json.JSONDecodeError:
                    continue

                if (
                        payload.get("type")
                        == "hello"
                ):
                    metadata["room"] = str(
                        payload.get(
                            "room",
                            "unknown",
                        )
                    )

                    metadata[
                        "device_id"
                    ] = str(
                        payload.get(
                            "deviceId",
                            "unknown",
                        )
                    )

                    logger.info(
                        (
                            "Client identified: "
                            "room=%s device=%s"
                        ),
                        metadata["room"],
                        metadata[
                            "device_id"
                        ],
                    )

                continue

            if len(message) != FRAME_BYTES:
                logger.debug(
                    (
                        "Ignoring invalid PCM "
                        "frame: %s bytes"
                    ),
                    len(message),
                )
                continue

            detected = False

            for embeddings in (
                    features.process_streaming(
                        message
                    )
            ):
                for probability in (
                        wake_word
                                .process_streaming(
                            embeddings
                        )
                ):
                    now = (
                        time.monotonic()
                    )

                    if (
                            probability
                            >= THRESHOLD
                            and (
                            now
                            - last_activation
                    )
                            >= COOLDOWN_SECONDS
                    ):
                        last_activation = now
                        detected = True

                        logger.info(
                            (
                                "Wake detected: "
                                "hey_jarvis "
                                "score=%.3f "
                                "room=%s "
                                "device=%s"
                            ),
                            probability,
                            metadata["room"],
                            metadata[
                                "device_id"
                            ],
                        )

                        await websocket.send(
                            json.dumps(
                                {
                                    "type":
                                        "wake",
                                    "keyword":
                                        "hey_jarvis",
                                    "score":
                                        float(
                                            probability
                                        ),
                                }
                            )
                        )

                        break

                if detected:
                    break

            if detected:
                features.reset()
                wake_word.reset()

    except ConnectionClosed:
        pass

    finally:
        wake_word.close()
        features.close()

        logger.info(
            "Wake client disconnected: %s",
            remote,
        )


async def main() -> None:
    logger.info(
        "Starting wake server on %s:%s",
        HOST,
        PORT,
    )

    async with serve(
            handler,
            HOST,
            PORT,
            compression=None,
            max_size=8192,
            ping_interval=20,
            ping_timeout=20,
    ) as server:
        await server.serve_forever()


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())