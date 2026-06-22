function ensureAccessToken(accessToken) {
  if (!accessToken) {
    throw new Error("Sessao expirada. Entre novamente para gerar audio.");
  }
}

function normalizeResponse(payload) {
  return {
    exists: Boolean(payload?.exists),
    created: Boolean(payload?.created),
    audio: payload?.audio ?? null,
    signedUrl: payload?.signedUrl ?? null,
  };
}

async function readResponsePayload(response) {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!text) return {};
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return { error: "Resposta invalida do servidor de audio." };
    }
  }

  return {
    error: text.slice(0, 180),
  };
}

async function parseError(response) {
  const payload = await readResponsePayload(response);
  return payload?.error || `Erro ${response.status}`;
}

export async function getMindBlockAudio({ mindblockId, voice = "mineirinha", accessToken }) {
  ensureAccessToken(accessToken);
  const params = new URLSearchParams({ mindblockId, voice });
  const response = await fetch(`/api/mindblock-audio?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return normalizeResponse(await readResponsePayload(response));
}

export async function generateMindBlockAudio({ mindblockId, voice = "mineirinha", accessToken }) {
  ensureAccessToken(accessToken);
  const response = await fetch("/api/mindblock-audio", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mindblockId, voice }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return normalizeResponse(await readResponsePayload(response));
}
